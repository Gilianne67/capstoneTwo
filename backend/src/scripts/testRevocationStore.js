/**
 * Token revocation when Redis is available and when it is not.
 * The revocation collection is an in-memory stand-in. No passwords are printed.
 */
const assert = require('assert');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Module = require('module');

const secret = process.env.JWT_SECRET || 'revocation-store-test-secret';
process.env.JWT_SECRET = secret;

const strings = new Map();
const sessionSets = new Map();
const redis = {
  isOpen: true,
  isReady: true,
  async set(key, value) {
    strings.set(key, value);
    return 'OK';
  },
  async get(key) {
    return strings.has(key) ? strings.get(key) : null;
  },
  async del(key) {
    strings.delete(key);
    sessionSets.delete(key);
    return 1;
  },
  async zAdd(key, members) {
    const set = sessionSets.get(key) || new Map();
    for (const member of members) set.set(member.value, member.score);
    sessionSets.set(key, set);
    return members.length;
  },
  async zRem(key, value) {
    const set = sessionSets.get(key);
    if (!set) return 0;
    return set.delete(value) ? 1 : 0;
  },
  async zRangeWithScores(key) {
    const set = sessionSets.get(key) || new Map();
    return [...set.entries()].map(([value, score]) => ({ value, score }));
  },
  async *scanIterator() {
    for (const key of strings.keys()) {
      if (String(key).startsWith('bl_')) yield key;
    }
  },
};

const redisPath = require.resolve('../config/redis');
const redisModule = new Module(redisPath, module);
redisModule.filename = redisPath;
redisModule.loaded = true;
redisModule.exports = redis;
require.cache[redisPath] = redisModule;

const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const RevokedToken = require('../models/RevokedToken');
const IssuedSession = require('../models/IssuedSession');
const { logout, updatePassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const {
  isTokenBlacklisted,
  isRevocationCacheTrusted,
  rehydrateRevocations,
  revokeUserSessions,
  importLegacyRevocations,
  registerIssuedToken,
} = require('../services/tokenService');

AuditLog.create = async () => ({});

const rows = new Map();
const issuedRows = new Map();
let failReads = false;
let failWrites = false;
let pauseRehydrate = null;

RevokedToken.persistenceStub = true;
IssuedSession.persistenceStub = true;
RevokedToken.updateOne = async (filter, update) => {
  if (failWrites) throw new Error('revocation write failed');
  rows.set(filter.tokenHash, update.$set.expiresAt);
  return { acknowledged: true };
};
RevokedToken.findOne = (filter) => ({
  select() {
    return this;
  },
  async lean() {
    if (failReads) throw new Error('revocation read failed');
    const expiresAt = rows.get(filter.tokenHash);
    if (!expiresAt || new Date(expiresAt).getTime() <= Date.now()) return null;
    return { _id: filter.tokenHash };
  },
});
RevokedToken.find = () => ({
  select() {
    return this;
  },
  async lean() {
    const listed = [...rows.entries()]
      .filter(([, expiresAt]) => new Date(expiresAt).getTime() > Date.now())
      .map(([tokenHash, expiresAt]) => ({ tokenHash, expiresAt }));
    if (pauseRehydrate) await pauseRehydrate(listed);
    return listed;
  },
});
IssuedSession.updateOne = async (filter, update) => {
  issuedRows.set(filter.tokenHash, {
    tokenHash: filter.tokenHash,
    userId: update.$set.userId,
    expiresAt: update.$set.expiresAt,
  });
  return { acknowledged: true };
};
IssuedSession.deleteOne = async (filter) => {
  issuedRows.delete(filter.tokenHash);
  return { deletedCount: 1 };
};
IssuedSession.find = (filter) => ({
  select() {
    return this;
  },
  async lean() {
    const now = Date.now();
    return [...issuedRows.values()].filter((row) => {
      if (filter && filter.userId != null && String(row.userId) !== String(filter.userId)) return false;
      return new Date(row.expiresAt).getTime() > now;
    });
  },
});

const users = new Map();
User.findById = (id) => ({
  select: async () => users.get(String(id)) || null,
});

let tokenSequence = 0;
const signToken = (user, extra = {}) =>
  jwt.sign(
    { id: user._id, role: user.role, status: user.status, seq: tokenSequence += 1, ...extra },
    secret,
    { expiresIn: '1h' }
  );

const run = (middleware, req) =>
  new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        resolve({ nextCalled: false, statusCode: this.statusCode, body });
      },
    };
    Promise.resolve(
      middleware(req, res, () => {
        resolve({ nextCalled: true, statusCode: res.statusCode, body: res.body, req });
      })
    ).catch(reject);
  });

const protectToken = (token, extras = {}) =>
  run(protect, {
    method: 'GET',
    originalUrl: '/api/v1/scholarships',
    url: '/scholarships',
    headers: { authorization: `Bearer ${token}` },
    cookies: {},
    ...extras,
  });

const invoke = (handler, req) => {
  const res = {
    statusCode: 200,
    body: null,
    cleared: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    clearCookie(name, options) {
      this.cleared.push({ name, options });
      return this;
    },
    cookie() {
      throw new Error('This response must not set an auth cookie.');
    },
  };
  return handler(req, res, (error) => {
    if (error) throw error;
  }).then(() => res);
};

const setRedis = (ready) => {
  redis.isOpen = ready;
  redis.isReady = ready;
};

const main = async () => {
  const active = {
    _id: 'student-active',
    id: 'student-active',
    email: 'active@example.test',
    role: 'student',
    status: 'active',
    name: 'Active Student',
  };
  const other = {
    _id: 'student-other',
    id: 'student-other',
    email: 'other@example.test',
    role: 'student',
    status: 'active',
    name: 'Other Student',
  };
  users.set(active._id, active);
  users.set(other._id, other);

  const validToken = signToken(active);
  const otherToken = signToken(other);

  const availableSession = await protectToken(validToken);
  assert.equal(availableSession.nextCalled, true);

  const loggedOut = await invoke(logout, {
    token: validToken,
    user: active,
    headers: { authorization: `Bearer ${validToken}` },
    ip: '127.0.0.1',
  });
  assert.equal(loggedOut.statusCode, 200);
  assert.equal(loggedOut.body.success, true);
  assert.equal(loggedOut.cleared.length, 1);
  assert.equal(loggedOut.cleared[0].name, 'token');
  assert.equal(await isTokenBlacklisted(validToken), true);
  assert.equal(await isTokenBlacklisted(otherToken), false);
  assert.equal((await protectToken(validToken)).statusCode, 401);
  assert.equal((await protectToken(otherToken)).nextCalled, true);
  assert.ok(rows.size >= 1);

  strings.clear();
  assert.equal(await isTokenBlacklisted(validToken), true);
  assert.equal((await protectToken(validToken)).statusCode, 401);
  assert.equal((await protectToken(otherToken)).nextCalled, true);

  setRedis(false);
  assert.equal(await isTokenBlacklisted(validToken), true);
  assert.equal(await isTokenBlacklisted(otherToken), false);
  const unavailableRevoked = await protectToken(validToken);
  assert.equal(unavailableRevoked.nextCalled, false);
  assert.equal(unavailableRevoked.statusCode, 401);
  const unavailableOther = await protectToken(otherToken);
  assert.equal(unavailableOther.nextCalled, true);

  const offlineLogoutToken = signToken(other);
  const offlineLogout = await invoke(logout, {
    token: offlineLogoutToken,
    user: other,
    headers: { authorization: `Bearer ${offlineLogoutToken}` },
    ip: '127.0.0.1',
  });
  assert.equal(offlineLogout.statusCode, 200);
  assert.equal(offlineLogout.body.success, true);
  assert.equal(await isTokenBlacklisted(offlineLogoutToken), true);
  assert.equal((await protectToken(offlineLogoutToken)).statusCode, 401);

  const passwordUser = {
    _id: 'student-password',
    id: 'student-password',
    email: 'password@example.test',
    role: 'student',
    status: 'active',
    name: 'Password Student',
    passwordChangedAt: null,
    async matchPassword(entered) {
      return entered === 'current-password1';
    },
    async save() {
      return this;
    },
    getSignedJwtToken() {
      return jwt.sign(
        {
          id: this._id,
          role: this.role,
          passwordChangedAt: new Date(this.passwordChangedAt).getTime(),
        },
        secret,
        { expiresIn: '1h' }
      );
    },
  };
  users.set(passwordUser._id, passwordUser);
  const stalePasswordToken = signToken(passwordUser);
  const changed = await invoke(updatePassword, {
    body: { currentPassword: 'current-password1', newPassword: 'replacement-pass1' },
    user: passwordUser,
    headers: {},
    ip: '127.0.0.1',
  });
  assert.equal(changed.statusCode, 503);
  assert.equal(changed.body.success, false);
  assert.equal(changed.body.revocation.reason, 'redis_unavailable');
  assert.ok(changed.body.token);
  assert.equal(JSON.stringify(changed.body).includes('replacement-pass1'), false);
  assert.ok(passwordUser.passwordChangedAt instanceof Date);
  const stalePasswordAccess = await protectToken(stalePasswordToken);
  assert.equal(stalePasswordAccess.nextCalled, false);
  assert.equal(stalePasswordAccess.statusCode, 401);
  const replacementAccess = await protectToken(changed.body.token);
  assert.equal(replacementAccess.nextCalled, true);

  const sessionUser = {
    _id: 'student-sessions',
    id: 'student-sessions',
    email: 'sessions@example.test',
    role: 'student',
    status: 'active',
  };
  users.set(sessionUser._id, sessionUser);
  const trackedToken = signToken(sessionUser);
  const missedRevocation = await revokeUserSessions(sessionUser._id);
  assert.equal(missedRevocation.success, false);
  assert.equal(missedRevocation.reason, 'redis_unavailable');
  assert.equal(await isTokenBlacklisted(trackedToken), false);
  sessionUser.passwordChangedAt = new Date();
  const missedAccess = await protectToken(trackedToken);
  assert.equal(missedAccess.nextCalled, false);
  assert.equal(missedAccess.statusCode, 401);

  const suspended = {
    _id: 'student-suspended',
    id: 'student-suspended',
    email: 'suspended@example.test',
    role: 'student',
    status: 'suspended',
  };
  users.set(suspended._id, suspended);
  const suspendedToken = signToken(suspended);
  const suspendedAccess = await protectToken(suspendedToken);
  assert.equal(suspendedAccess.nextCalled, false);
  assert.equal(suspendedAccess.statusCode, 403);
  assert.match(suspendedAccess.body.message, /suspended/i);

  failReads = true;
  const unverifiedActive = await protectToken(signToken(active));
  assert.equal(unverifiedActive.nextCalled, false);
  assert.equal(unverifiedActive.statusCode, 503);
  const unverifiedSuspended = await protectToken(suspendedToken);
  assert.equal(unverifiedSuspended.statusCode, 403);
  failReads = false;

  failWrites = true;
  const unsavedToken = signToken({
    _id: 'student-unsaved',
    role: 'student',
    status: 'active',
  });
  users.set('student-unsaved', {
    _id: 'student-unsaved',
    id: 'student-unsaved',
    email: 'unsaved@example.test',
    role: 'student',
    status: 'active',
    name: 'Unsaved Student',
  });
  const failedLogout = await invoke(logout, {
    token: unsavedToken,
    user: users.get('student-unsaved'),
    headers: { authorization: `Bearer ${unsavedToken}` },
    ip: '127.0.0.1',
  });
  assert.equal(failedLogout.statusCode, 503);
  assert.equal(failedLogout.body.success, false);
  assert.match(failedLogout.body.message, /could not revoke/i);
  assert.equal(failedLogout.cleared.length, 1);
  assert.equal(JSON.stringify(failedLogout.body).includes('logged out successfully'), false);
  failWrites = false;

  setRedis(true);
  failWrites = true;
  const healthyRedisToken = signToken(active);
  const healthyRedisLogout = await invoke(logout, {
    token: healthyRedisToken,
    user: active,
    headers: { authorization: `Bearer ${healthyRedisToken}` },
    ip: '127.0.0.1',
  });
  assert.equal(healthyRedisLogout.statusCode, 503);
  assert.equal(healthyRedisLogout.body.success, false);
  assert.match(healthyRedisLogout.body.message, /could not revoke/i);
  assert.equal(JSON.stringify(healthyRedisLogout.body).includes('successfully'), false);
  assert.equal(await isTokenBlacklisted(healthyRedisToken), false);
  assert.equal((await protectToken(healthyRedisToken)).nextCalled, true);
  failWrites = false;

  setRedis(false);
  const outageUser = {
    _id: 'student-outage',
    id: 'student-outage',
    email: 'outage@example.test',
    role: 'student',
    status: 'active',
    name: 'Outage Student',
  };
  users.set(outageUser._id, outageUser);
  const outageToken = signToken(outageUser);
  const issuedDuringOutage = await registerIssuedToken(outageUser._id, outageToken);
  assert.equal(issuedDuringOutage.ok, true);
  assert.equal(await isTokenBlacklisted(outageToken), false);
  const outageRevocation = await revokeUserSessions(outageUser._id);
  assert.equal(outageRevocation.success, false);
  assert.equal(outageRevocation.reason, 'redis_unavailable');
  assert.equal(outageRevocation.blocklisted, 1);
  assert.equal(outageRevocation.failed, 0);
  assert.equal(await isTokenBlacklisted(outageToken), true);
  assert.equal((await protectToken(outageToken)).statusCode, 401);

  setRedis(true);
  const secondOutageToken = signToken(outageUser);
  assert.equal((await registerIssuedToken(outageUser._id, secondOutageToken)).ok, true);
  const recoveredRevocation = await revokeUserSessions(outageUser._id);
  assert.equal(recoveredRevocation.success, true);
  assert.equal(recoveredRevocation.failed, 0);
  assert.equal(await isTokenBlacklisted(secondOutageToken), true);

  const partialUser = {
    _id: 'student-partial-durable',
    id: 'student-partial-durable',
    email: 'partial-durable@example.test',
    role: 'student',
    status: 'active',
    name: 'Partial Durable',
  };
  users.set(partialUser._id, partialUser);
  const partialA = signToken(partialUser);
  const partialB = signToken(partialUser);
  assert.equal((await registerIssuedToken(partialUser._id, partialA)).ok, true);
  assert.equal((await registerIssuedToken(partialUser._id, partialB)).ok, true);
  const originalUpdate = RevokedToken.updateOne;
  let durableWrites = 0;
  RevokedToken.updateOne = async (filter, update) => {
    durableWrites += 1;
    if (durableWrites > 1) throw new Error('revocation write failed');
    return originalUpdate(filter, update);
  };
  const partialRevocation = await revokeUserSessions(partialUser._id);
  RevokedToken.updateOne = originalUpdate;
  assert.equal(partialRevocation.success, false);
  assert.equal(partialRevocation.reason, 'partial_failure');
  assert.equal(partialRevocation.blocklisted, 1);
  assert.equal(partialRevocation.failed, 1);
  const partialChecks = await Promise.all([
    isTokenBlacklisted(partialA),
    isTokenBlacklisted(partialB),
  ]);
  assert.equal(partialChecks.filter(Boolean).length, 1);

  const legacyUser = {
    _id: 'student-legacy-key',
    id: 'student-legacy-key',
    email: 'legacy-key@example.test',
    role: 'student',
    status: 'active',
    name: 'Legacy Key',
  };
  users.set(legacyUser._id, legacyUser);
  const legacyToken = signToken(legacyUser);
  strings.set(`bl_${'a'.repeat(64)}`, 'true');
  strings.set(`bl_${legacyToken}`, 'true');
  setRedis(true);
  assert.equal(await isTokenBlacklisted(legacyToken), true);
  const imported = await importLegacyRevocations();
  assert.equal(imported.ok, true);
  assert.equal(imported.imported, 1);
  strings.clear();
  setRedis(false);
  assert.equal(await isTokenBlacklisted(legacyToken), true);
  assert.equal((await protectToken(legacyToken)).statusCode, 401);

  const lostLegacyToken = signToken(legacyUser);
  strings.clear();
  strings.set(`bl_${lostLegacyToken}`, 'true');
  setRedis(false);
  const lostImport = await importLegacyRevocations();
  assert.equal(lostImport.ok, false);
  strings.clear();
  assert.equal(await isTokenBlacklisted(lostLegacyToken), false);

  setRedis(true);
  const migratedLegacy = signToken(legacyUser);
  const interruptedLegacy = signToken(other);
  strings.set(`bl_${migratedLegacy}`, 'true');
  strings.set(`bl_${interruptedLegacy}`, 'true');
  const originalScan = redis.scanIterator;
  redis.scanIterator = async function* scan() {
    yield `bl_${migratedLegacy}`;
    throw new Error('scan interrupted');
  };
  const interrupted = await rehydrateRevocations();
  redis.scanIterator = originalScan;
  assert.equal(interrupted.ok, false);
  strings.clear();
  assert.equal(await isTokenBlacklisted(migratedLegacy), true);
  assert.equal(await isTokenBlacklisted(interruptedLegacy), false);

  setRedis(true);
  strings.clear();
  const rebuilt = await rehydrateRevocations();
  assert.equal(rebuilt.ok, true);
  assert.equal(rebuilt.migrationComplete, true);
  assert.equal(isRevocationCacheTrusted(), true);
  assert.ok(rebuilt.count >= 1);
  assert.equal(await isTokenBlacklisted(validToken), true);
  assert.equal((await protectToken(validToken)).statusCode, 401);
  assert.equal((await protectToken(changed.body.token)).nextCalled, true);

  strings.clear();
  assert.equal(isRevocationCacheTrusted(), true);
  assert.equal(await isTokenBlacklisted(validToken), true);
  assert.equal((await protectToken(validToken)).statusCode, 401);
  assert.equal(await isTokenBlacklisted(otherToken), false);

  setRedis(false);
  setRedis(true);
  let releaseRebuild;
  const snapshotReady = new Promise((resolve) => {
    pauseRehydrate = (listed) => new Promise((release) => {
      releaseRebuild = release;
      resolve(listed);
    });
  });
  const rebuilding = rehydrateRevocations();
  const rebuildSnapshot = await snapshotReady;
  assert.equal(isRevocationCacheTrusted(), false);
  const concurrentToken = signToken(active);
  const concurrentHash = crypto.createHash('sha256').update(concurrentToken).digest('hex');
  rows.set(concurrentHash, new Date(Date.now() + (60 * 60 * 1000)));
  assert.equal(rebuildSnapshot.some((row) => row.tokenHash === concurrentHash), false);
  assert.equal(strings.has(`bl_${concurrentHash}`), false);
  assert.equal(await isTokenBlacklisted(concurrentToken), true);
  assert.equal((await protectToken(concurrentToken)).statusCode, 401);
  releaseRebuild();
  pauseRehydrate = null;
  const rebuildFinished = await rebuilding;
  assert.equal(rebuildFinished.ok, true);
  assert.equal(isRevocationCacheTrusted(), true);
  strings.delete(`bl_${concurrentHash}`);
  assert.equal(await isTokenBlacklisted(concurrentToken), true);
  assert.equal((await protectToken(concurrentToken)).statusCode, 401);

  const trustedBeforeFailure = isRevocationCacheTrusted();
  assert.equal(trustedBeforeFailure, true);
  const scanBeforeFailure = redis.scanIterator;
  redis.scanIterator = async function* failedScan() {
    throw new Error('legacy import failed');
  };
  const failedRebuild = await rehydrateRevocations();
  redis.scanIterator = scanBeforeFailure;
  assert.equal(failedRebuild.ok, false);
  assert.equal(isRevocationCacheTrusted(), false);
  strings.clear();
  assert.equal(await isTokenBlacklisted(validToken), true);
  assert.equal((await protectToken(validToken)).statusCode, 401);

  IssuedSession.persistenceStub = false;
  const missingIssuedIndex = await revokeUserSessions(active._id);
  IssuedSession.persistenceStub = true;
  assert.equal(missingIssuedIndex.success, false);
  assert.equal(missingIssuedIndex.reason, 'revocation_store_unavailable');
  assert.notEqual(missingIssuedIndex.reason, 'no_tracked_sessions');
  assert.equal(missingIssuedIndex.blocklisted, 0);

  failWrites = true;
  const retryProtect = await run(protect, {
    method: 'GET',
    originalUrl: '/api/v1/auth/logout',
    url: '/auth/logout',
    headers: { authorization: `Bearer ${validToken}` },
    cookies: {},
  });
  assert.equal(retryProtect.nextCalled, true);
  const retryLogout = await invoke(logout, retryProtect.req);
  failWrites = false;
  assert.equal(retryLogout.statusCode, 200);
  assert.equal(retryLogout.body.success, true);
  assert.match(retryLogout.body.message, /token revoked/i);
  assert.equal((await protectToken(validToken)).statusCode, 401);

  console.log('revocation store unit tests passed (in-memory stand-ins, not live Redis or MongoDB)');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
