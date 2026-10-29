/**
 * Functional tests for account suspension and session revocation.
 * Redis is an in-memory stand-in. Timing here is not a Redis latency measurement.
 */
const assert = require('assert');
const express = require('express');
const jwt = require('jsonwebtoken');
const Module = require('module');

const secret = process.env.JWT_SECRET || 'account-suspension-test-secret';
process.env.JWT_SECRET = secret;

const createRedisMock = () => {
  const strings = new Map();
  const sets = new Map();
  const expiresAt = new Map();
  const api = {
    isOpen: true,
    isReady: true,
    failBlocklistAfter: Infinity,
    blocklistWrites: 0,
    async set(key, value) {
      if (String(key).startsWith('bl_')) {
        api.blocklistWrites += 1;
        if (api.blocklistWrites > api.failBlocklistAfter) {
          throw new Error('forced redis write failure');
        }
      }
      strings.set(key, value);
      return 'OK';
    },
    async get(key) {
      return strings.has(key) ? strings.get(key) : null;
    },
    async del(key) {
      strings.delete(key);
      sets.delete(key);
      expiresAt.delete(key);
      return 1;
    },
    async zAdd(key, members) {
      const set = sets.get(key) || new Map();
      for (const member of members) set.set(member.value, member.score);
      sets.set(key, set);
      return members.length;
    },
    async zRem(key, value) {
      const set = sets.get(key);
      if (!set) return 0;
      const removed = set.delete(value) ? 1 : 0;
      if (set.size === 0) sets.delete(key);
      return removed;
    },
    async zRangeWithScores(key) {
      const set = sets.get(key) || new Map();
      return [...set.entries()].map(([value, score]) => ({ value, score }));
    },
    async zRemRangeByScore(key, min, max) {
      const set = sets.get(key);
      if (!set) return 0;
      let removed = 0;
      for (const [value, score] of [...set.entries()]) {
        if (score >= Number(min) && score <= Number(max)) {
          set.delete(value);
          removed += 1;
        }
      }
      if (set.size === 0) sets.delete(key);
      return removed;
    },
    async expire(key, seconds) {
      expiresAt.set(key, Math.floor(Date.now() / 1000) + Number(seconds));
      return 1;
    },
    async ttl(key) {
      if (!sets.has(key) && !strings.has(key)) return -2;
      if (!expiresAt.has(key)) return -1;
      return expiresAt.get(key) - Math.floor(Date.now() / 1000);
    },
  };
  return api;
};

const redisPath = require.resolve('../config/redis');
const redis = createRedisMock();
const redisModule = new Module(redisPath, module);
redisModule.filename = redisPath;
redisModule.loaded = true;
redisModule.exports = redis;
require.cache[redisPath] = redisModule;

const User = require('../models/User');
const Provider = require('../models/Provider');
const AuditLog = require('../models/AuditLog');
const auditController = require('../controllers/auditController');
const { login, logout } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');
const adminRoutes = require('../routes/adminRoutes');
const errorHandler = require('../middleware/error');
const { isTokenBlacklisted, isSessionTracked } = require('../services/tokenService');
const { installMemoryRevocationStore } = require('./revocationStoreStub');

installMemoryRevocationStore();

const users = new Map();
const audits = [];

User.findById = (id) => {
  const doc = users.get(String(id)) || null;
  return {
    select() {
      return Promise.resolve(doc);
    },
    then(resolve, reject) {
      return Promise.resolve(doc).then(resolve, reject);
    },
  };
};

User.findOne = (query = {}) => {
  const doc = [...users.values()].find((user) => user.email === query.email) || null;
  return {
    select() {
      return Promise.resolve(doc);
    },
    then(resolve, reject) {
      return Promise.resolve(doc).then(resolve, reject);
    },
  };
};

Provider.findOne = () => ({
  select() {
    return Promise.resolve(null);
  },
  then(resolve, reject) {
    return Promise.resolve(null).then(resolve, reject);
  },
});

auditController.recordAuditLog = async (entry) => {
  audits.push(entry);
  return entry;
};
AuditLog.create = async (entry) => {
  audits.push(entry);
  return entry;
};

const createUser = (overrides) => {
  const user = {
    _id: overrides._id,
    id: overrides._id,
    name: overrides.name || 'Test User',
    email: overrides.email,
    role: overrides.role || 'student',
    status: overrides.status || 'active',
    isVerified: true,
    isOnboarded: true,
    issued: 0,
    saveCount: 0,
    _plainPassword: overrides.password || 'secret123',
    async matchPassword(entered) {
      return entered === this._plainPassword;
    },
    getSignedJwtToken() {
      this.issued += 1;
      return jwt.sign(
        { id: this._id, role: this.role, status: this.status },
        secret,
        { expiresIn: '1h', jwtid: `${this._id}-${this.issued}` }
      );
    },
    async save() {
      this.saveCount += 1;
      users.set(String(this._id), this);
      return this;
    },
  };
  users.set(String(user._id), user);
  return user;
};

const signAccessToken = (user, jwtid) =>
  jwt.sign(
    { id: user._id, role: user.role, status: user.status },
    secret,
    { expiresIn: '1h', jwtid }
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
        resolve({ nextCalled: false, statusCode: this.statusCode, body, req });
      },
    };

    Promise.resolve(
      middleware(req, res, () => {
        resolve({ nextCalled: true, statusCode: res.statusCode, body: res.body, req });
      })
    ).catch(reject);
  });

const invoke = (handler, req) =>
  new Promise((resolve, reject) => {
    const cleared = [];
    const res = {
      statusCode: 200,
      body: null,
      cleared,
      clearCookie(name, options) {
        cleared.push({ name, options });
        return this;
      },
      cookie() {
        return this;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        resolve({ statusCode: this.statusCode, body, cleared });
      },
    };

    Promise.resolve(
      handler(req, res, (error) => {
        if (error) {
          errorHandler(error, req, res, () => {});
          return;
        }
        resolve({ statusCode: res.statusCode, body: res.body, cleared, nextCalled: true });
      })
    ).catch(reject);
  });

const startServer = () =>
  new Promise((resolve) => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/admin', adminRoutes);
    app.use(errorHandler);
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });

const requestStatus = async (server, { token, userId, body }) => {
  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/v1/admin/users/${userId}/status`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }
  );
  return { status: response.status, body: await response.json() };
};

// The app logs expected validation and blocklist failures. Capture those only
// while the negative case is running, and still print anything else.
const withExpectedConsoleErrors = async (fn, isExpected) => {
  const originalError = console.error;
  let unexpected = 0;
  console.error = (...args) => {
    if (isExpected(...args)) return;
    unexpected += 1;
    originalError(...args);
  };
  try {
    const result = await fn();
    if (unexpected > 0) {
      throw new Error(`${unexpected} unexpected console.error call(s) during a negative test`);
    }
    return result;
  } finally {
    console.error = originalError;
  }
};

const isUnsupportedStatusLog = (...args) =>
  args[0] instanceof Error && args[0].message === 'Unsupported account status.';

const isPendingConsentStatusLog = (...args) =>
  args[0] instanceof Error
  && args[0].message === 'Administrators cannot set an account to pending consent. That state is assigned by the student consent workflow.';

const isBlocklistWriteLog = (...args) =>
  args.length === 1 && args[0] === 'Redis blocklist write failed.';

const accessRoute = async (token, method = 'GET', originalUrl = '/api/v1/students/profile') => {
  const authenticated = await run(protect, {
    method,
    originalUrl,
    url: originalUrl,
    headers: { authorization: `Bearer ${token}` },
    cookies: {},
  });
  if (!authenticated.nextCalled) return authenticated;
  return run(authorize('student'), authenticated.req);
};

const main = async () => {
  const statusRoutes = adminRoutes.stack.filter(
    (layer) => layer.route && layer.route.path === '/users/:id/status'
  );
  assert.equal(statusRoutes.length, 1);
  assert.equal(statusRoutes[0].route.methods.patch, true);
  const gates = adminRoutes.stack.filter((layer) => !layer.route);
  assert.equal(gates[0].handle.name, 'protect');

  const server = await startServer();
  try {
    const admin = createUser({
      _id: 'admin-1',
      email: 'admin@example.test',
      name: 'Audit Admin',
      role: 'admin',
    });
    const superadmin = createUser({
      _id: 'superadmin-1',
      email: 'superadmin@example.test',
      name: 'Super Admin',
      role: 'superadmin',
    });
    const student = createUser({
      _id: 'student-1',
      email: 'student@example.test',
      name: 'Active Student',
      role: 'student',
    });
    const other = createUser({
      _id: 'student-2',
      email: 'other@example.test',
      name: 'Other Student',
      role: 'student',
    });
    const adminToken = signAccessToken(admin, 'admin-session');
    const superadminToken = signAccessToken(superadmin, 'superadmin-session');

    const firstLogin = await invoke(login, {
      body: { email: student.email, password: 'secret123' },
      headers: {},
      ip: '127.0.0.1',
    });
    const secondLogin = await invoke(login, {
      body: { email: student.email, password: 'secret123' },
      headers: {},
      ip: '127.0.0.1',
    });
    const otherLogin = await invoke(login, {
      body: { email: other.email, password: 'secret123' },
      headers: {},
      ip: '127.0.0.1',
    });
    assert.equal(firstLogin.statusCode, 200);
    const firstToken = firstLogin.body.token;
    const secondToken = secondLogin.body.token;
    const otherToken = otherLogin.body.token;
    assert.notEqual(firstToken, secondToken);
    assert.equal(await isSessionTracked(student._id, firstToken), true);
    assert.equal(await isSessionTracked(student._id, secondToken), true);
    assert.equal(await isSessionTracked(other._id, otherToken), true);
    const sessionTtl = await redis.ttl(`auth:sessions:${student._id}`);
    assert.ok(sessionTtl > 0 && sessionTtl <= 3600);

    const activeAccess = await accessRoute(firstToken);
    assert.equal(activeAccess.nextCalled, true);
    assert.equal(activeAccess.req.user.role, 'student');

    const writesBeforeSuspend = redis.blocklistWrites;
    const suspended = await requestStatus(server, {
      token: adminToken,
      userId: student._id,
      body: { status: 'suspended' },
    });
    assert.equal(suspended.status, 200);
    assert.equal(suspended.body.success, true);
    assert.equal(suspended.body.statusUpdated, true);
    assert.equal(suspended.body.data.status, 'suspended');
    assert.equal(suspended.body.revocation.required, true);
    assert.equal(suspended.body.revocation.success, true);
    assert.equal(suspended.body.revocation.failed, 0);
    assert.equal(suspended.body.revocation.blocklisted, 2);
    assert.equal(student.status, 'suspended');
    assert.equal(await isTokenBlacklisted(firstToken), true);
    assert.equal(await isTokenBlacklisted(secondToken), true);
    assert.equal(await isTokenBlacklisted(otherToken), false);
    assert.equal(await isSessionTracked(student._id, firstToken), false);
    assert.equal(await isSessionTracked(other._id, otherToken), true);
    assert.ok(redis.blocklistWrites >= writesBeforeSuspend + 2);
    assert.equal(JSON.stringify(suspended.body).includes(firstToken), false);
    const suspensionAudit = audits.filter((entry) => entry.action === 'ACCOUNT_STATUS_CHANGE').at(-1);
    assert.ok(suspensionAudit);
    assert.equal(suspensionAudit.role, 'Admin');
    assert.equal(suspensionAudit.severity, 'Warning');
    assert.equal(suspensionAudit.details.includes(firstToken), false);
    assert.equal(suspensionAudit.details.includes(secondToken), false);

    const revokedFirst = await accessRoute(firstToken);
    const revokedSecond = await accessRoute(secondToken);
    assert.equal(revokedFirst.nextCalled, false);
    assert.equal(revokedFirst.statusCode, 401);
    assert.equal(revokedFirst.body.code, 'SESSION_REVOKED');
    assert.equal(revokedSecond.nextCalled, false);
    assert.equal(revokedSecond.statusCode, 401);
    const otherAccess = await accessRoute(otherToken);
    assert.equal(otherAccess.nextCalled, true);

    const reactivated = await requestStatus(server, {
      token: adminToken,
      userId: student._id,
      body: { status: 'active' },
    });
    assert.equal(reactivated.status, 200);
    assert.equal(reactivated.body.success, true);
    assert.equal(reactivated.body.revocation.required, false);
    assert.equal(reactivated.body.revocation.blocklisted, 0);
    assert.equal(await isTokenBlacklisted(firstToken), true);
    assert.equal(await isTokenBlacklisted(secondToken), true);
    const stillRevoked = await accessRoute(firstToken);
    assert.equal(stillRevoked.nextCalled, false);
    assert.equal(stillRevoked.statusCode, 401);
    const replacementLogin = await invoke(login, {
      body: { email: student.email, password: 'secret123' },
      headers: {},
      ip: '127.0.0.1',
    });
    const replacementToken = replacementLogin.body.token;
    assert.equal(await isTokenBlacklisted(replacementToken), false);
    const replacementAccess = await accessRoute(replacementToken);
    assert.equal(replacementAccess.nextCalled, true);
    assert.equal((await accessRoute(otherToken)).nextCalled, true);
    const reactivationAudit = audits.filter((entry) => entry.action === 'ACCOUNT_STATUS_CHANGE').at(-1);
    assert.equal(reactivationAudit.severity, 'Info');
    assert.match(reactivationAudit.details, /not required/i);

    const saveCountBeforeInvalid = student.saveCount;
    const unsupported = await withExpectedConsoleErrors(
      () => requestStatus(server, {
        token: adminToken,
        userId: student._id,
        body: { status: 'banned' },
      }),
      isUnsupportedStatusLog
    );
    const wrongCase = await withExpectedConsoleErrors(
      () => requestStatus(server, {
        token: adminToken,
        userId: student._id,
        body: { status: 'Suspended' },
      }),
      isUnsupportedStatusLog
    );
    assert.equal(unsupported.status, 400);
    assert.equal(unsupported.body.success, false);
    assert.equal(wrongCase.status, 400);
    assert.equal(student.saveCount, saveCountBeforeInvalid);
    assert.equal(student.status, 'active');

    const missingAuth = await requestStatus(server, {
      userId: student._id,
      body: { status: 'suspended' },
    });
    const studentCaller = await requestStatus(server, {
      token: replacementToken,
      userId: other._id,
      body: { status: 'suspended' },
    });
    const provider = createUser({
      _id: 'provider-1',
      email: 'provider@example.test',
      role: 'provider',
    });
    const providerCaller = await requestStatus(server, {
      token: signAccessToken(provider, 'provider-session'),
      userId: other._id,
      body: { status: 'suspended' },
    });
    assert.equal(missingAuth.status, 401);
    assert.equal(studentCaller.status, 403);
    assert.equal(providerCaller.status, 403);
    assert.equal(other.status, 'active');
    assert.equal(await isTokenBlacklisted(otherToken), false);

    const saveCountBeforeConsent = other.saveCount;
    const superadminChange = await withExpectedConsoleErrors(
      () => requestStatus(server, {
        token: superadminToken,
        userId: other._id,
        body: { status: 'pending_consent' },
      }),
      isPendingConsentStatusLog
    );
    const adminConsentChange = await withExpectedConsoleErrors(
      () => requestStatus(server, {
        token: adminToken,
        userId: other._id,
        body: { status: 'pending_consent' },
      }),
      isPendingConsentStatusLog
    );
    assert.equal(superadminChange.status, 400);
    assert.equal(superadminChange.body.success, false);
    assert.equal(adminConsentChange.status, 400);
    assert.equal(other.status, 'active');
    assert.equal(other.saveCount, saveCountBeforeConsent);
    assert.equal(await isTokenBlacklisted(otherToken), false);
    assert.equal((await accessRoute(otherToken)).nextCalled, true);

    const failingUser = createUser({
      _id: 'student-3',
      email: 'failing@example.test',
      role: 'student',
    });
    const failingLoginA = await invoke(login, {
      body: { email: failingUser.email, password: 'secret123' },
      headers: {},
      ip: '127.0.0.1',
    });
    const failingLoginB = await invoke(login, {
      body: { email: failingUser.email, password: 'secret123' },
      headers: {},
      ip: '127.0.0.1',
    });
    const failingTokenA = failingLoginA.body.token;
    const failingTokenB = failingLoginB.body.token;
    redis.blocklistWrites = 0;
    redis.failBlocklistAfter = 0;
    const failedRevocation = await withExpectedConsoleErrors(
      () => requestStatus(server, {
        token: adminToken,
        userId: failingUser._id,
        body: { status: 'suspended' },
      }),
      isBlocklistWriteLog
    );
    redis.failBlocklistAfter = Infinity;
    assert.equal(failedRevocation.status, 200);
    assert.equal(failedRevocation.body.success, true);
    assert.equal(failedRevocation.body.statusUpdated, true);
    assert.equal(failedRevocation.body.revocation.success, true);
    assert.equal(failedRevocation.body.revocation.blocklisted, 2);
    assert.equal(failedRevocation.body.revocation.failed, 0);
    assert.equal(failingUser.status, 'suspended');
    assert.equal(await isTokenBlacklisted(failingTokenA), true);
    assert.equal(await isTokenBlacklisted(failingTokenB), true);
    const failedAccess = await accessRoute(failingTokenA);
    assert.equal(failedAccess.nextCalled, false);
    assert.equal(failedAccess.statusCode, 401);

    const partialUser = createUser({
      _id: 'student-4',
      email: 'partial@example.test',
      role: 'student',
    });
    const partialTokenA = (await invoke(login, {
      body: { email: partialUser.email, password: 'secret123' },
      headers: {},
      ip: '127.0.0.1',
    })).body.token;
    const partialTokenB = (await invoke(login, {
      body: { email: partialUser.email, password: 'secret123' },
      headers: {},
      ip: '127.0.0.1',
    })).body.token;
    redis.blocklistWrites = 0;
    redis.failBlocklistAfter = 1;
    const partial = await withExpectedConsoleErrors(
      () => requestStatus(server, {
        token: adminToken,
        userId: partialUser._id,
        body: { status: 'suspended' },
      }),
      isBlocklistWriteLog
    );
    redis.failBlocklistAfter = Infinity;
    assert.equal(partial.status, 200);
    assert.equal(partial.body.success, true);
    assert.equal(partial.body.revocation.success, true);
    assert.equal(partial.body.revocation.blocklisted, 2);
    assert.equal(partial.body.revocation.failed, 0);
    assert.equal(partialUser.status, 'suspended');
    const partialResults = await Promise.all([
      isTokenBlacklisted(partialTokenA),
      isTokenBlacklisted(partialTokenB),
    ]);
    assert.equal(partialResults.filter(Boolean).length, 2);
    assert.equal((await accessRoute(partialTokenA)).statusCode, 401);
    assert.equal((await accessRoute(partialTokenB)).statusCode, 401);

    const legacyUser = createUser({
      _id: 'student-5',
      email: 'legacy@example.test',
      role: 'student',
    });
    const legacyToken = signAccessToken(legacyUser, 'legacy-before-index');
    assert.equal(await isSessionTracked(legacyUser._id, legacyToken), false);
    const legacySuspension = await requestStatus(server, {
      token: adminToken,
      userId: legacyUser._id,
      body: { status: 'suspended' },
    });
    assert.equal(legacySuspension.status, 200);
    assert.equal(legacySuspension.body.success, true);
    assert.equal(legacySuspension.body.revocation.reason, 'no_tracked_sessions');
    assert.equal(legacySuspension.body.revocation.blocklisted, 0);
    assert.equal(await isTokenBlacklisted(legacyToken), false);
    const legacyAccess = await accessRoute(legacyToken);
    assert.equal(legacyAccess.nextCalled, false);
    assert.equal(legacyAccess.statusCode, 403);
    assert.match(legacyAccess.body.message, /suspended/i);

    const offlineUser = createUser({
      _id: 'student-6',
      email: 'offline@example.test',
      role: 'student',
      status: 'active',
    });
    const offlineToken = signAccessToken(offlineUser, 'legacy-offline');
    redis.isOpen = false;
    redis.isReady = false;
    let offlineSuspension;
    try {
      offlineSuspension = await requestStatus(server, {
        token: adminToken,
        userId: offlineUser._id,
        body: { status: 'suspended' },
      });
      const offlineAccess = await accessRoute(offlineToken);
      assert.equal(offlineSuspension.status, 503);
      assert.equal(offlineSuspension.body.success, false);
      assert.equal(offlineSuspension.body.statusUpdated, true);
      assert.equal(offlineSuspension.body.revocation.reason, 'redis_unavailable');
      assert.equal(offlineUser.status, 'suspended');
      assert.equal(offlineAccess.nextCalled, false);
      assert.equal(offlineAccess.statusCode, 403);
    } finally {
      redis.isOpen = true;
      redis.isReady = true;
    }

    const logoutUser = createUser({
      _id: 'student-7',
      email: 'logout@example.test',
      role: 'student',
    });
    const logoutLogin = await invoke(login, {
      body: { email: logoutUser.email, password: 'secret123' },
      headers: {},
      ip: '127.0.0.1',
    });
    const logoutToken = logoutLogin.body.token;
    const loggedOut = await invoke(logout, {
      token: logoutToken,
      user: logoutUser,
      headers: { authorization: `Bearer ${logoutToken}` },
      ip: '127.0.0.1',
    });
    assert.equal(loggedOut.statusCode, 200);
    assert.equal(loggedOut.body.success, true);
    assert.equal(loggedOut.cleared.length, 1);
    assert.equal(loggedOut.cleared[0].name, 'token');
    assert.equal(loggedOut.cleared[0].options.httpOnly, true);
    assert.equal(await isTokenBlacklisted(logoutToken), true);
    assert.equal(await isSessionTracked(logoutUser._id, logoutToken), false);
    assert.equal((await accessRoute(logoutToken)).statusCode, 401);

    logoutUser.status = 'suspended';
    const suspendedLogoutToken = signAccessToken(logoutUser, 'suspended-logout');
    const suspendedLogoutGate = await run(protect, {
      method: 'GET',
      originalUrl: '/api/v1/auth/logout',
      url: '/auth/logout',
      headers: { authorization: `Bearer ${suspendedLogoutToken}` },
      cookies: {},
    });
    assert.equal(suspendedLogoutGate.nextCalled, true);
    const suspendedProtected = await accessRoute(suspendedLogoutToken);
    assert.equal(suspendedProtected.nextCalled, false);
    assert.equal(suspendedProtected.statusCode, 403);
    assert.equal(suspendedProtected.body.code, 'ACCOUNT_SUSPENDED');

    console.log('account suspension functional tests passed (in-memory Redis mock; not a latency measurement)');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
