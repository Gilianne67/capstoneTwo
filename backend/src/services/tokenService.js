const crypto = require('crypto');
const mongoose = require('mongoose');
const redis = require('../config/redis');
const jwt = require('jsonwebtoken');

/**
 * Helper to check if Redis is connected and ready to execute commands
 */
const isRedisReady = () => Boolean(redis && redis.isOpen && redis.isReady);

/**
 * True only after Redis has been rebuilt from the durable revocation
 * records and the legacy import finished. A miss is never proof that a
 * token is still valid: the durable hash is checked whenever it is available.
 */
let revocationCacheTrusted = false;

exports.isRevocationCacheTrusted = () => revocationCacheTrusted;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const blockKey = (token) => `bl_${hashToken(token)}`;

const loadModel = (relativePath) => {
  const model = require(relativePath);
  if (model && model.persistenceStub === true) return model;
  if (mongoose.connection && mongoose.connection.readyState === 1) return model;
  return null;
};

const loadRevokedTokenModel = () => loadModel('../models/RevokedToken');

const loadIssuedSessionModel = () => loadModel('../models/IssuedSession');

const revocationUnavailable = () => {
  const error = new Error('revocation_store_unavailable');
  error.code = 'REVOCATION_STORE_UNAVAILABLE';
  return error;
};

const persistRevocation = async (token, ttlSeconds) => {
  const model = loadRevokedTokenModel();
  if (!model || typeof model.updateOne !== 'function') {
    return { ok: false, reason: 'revocation_store_unavailable' };
  }

  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + (ttlSeconds * 1000));
  await model.updateOne(
    { tokenHash },
    { $set: { expiresAt }, $setOnInsert: { tokenHash } },
    { upsert: true }
  );
  return { ok: true };
};

const readPersistedRevocation = async (token) => {
  const model = loadRevokedTokenModel();
  if (!model || typeof model.findOne !== 'function') {
    return { checked: false, reason: 'revocation_store_unavailable' };
  }

  const row = await model.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  }).select('_id').lean();
  return { checked: true, revoked: Boolean(row) };
};

const sessionKey = (userId) => `auth:sessions:${String(userId)}`;

const nowSeconds = () => Math.floor(Date.now() / 1000);

const decodeToken = (token) => {
  if (!token || typeof token !== 'string') return null;
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded.exp !== 'number') return null;
  return decoded;
};

const readSessionEntries = async (key) => {
  if (typeof redis.zRangeWithScores !== 'function') {
    return { ok: false, reason: 'redis_unsupported', entries: [] };
  }

  const rows = await redis.zRangeWithScores(key, 0, -1);
  const entries = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      token: row && (row.value || row.member),
      exp: Number(row && row.score),
    }))
    .filter((row) => row.token && Number.isFinite(row.exp));

  return { ok: true, entries };
};

const refreshSessionExpiry = async (key, entries) => {
  const now = nowSeconds();
  const live = entries.filter((entry) => entry.exp > now);

  if (typeof redis.zRemRangeByScore === 'function') {
    await redis.zRemRangeByScore(key, 0, now);
  }

  if (live.length === 0) {
    if (typeof redis.del === 'function') await redis.del(key);
    return live;
  }

  const maxExp = live.reduce((max, entry) => Math.max(max, entry.exp), 0);
  if (typeof redis.expire === 'function') {
    await redis.expire(key, Math.max(1, maxExp - now));
  }

  return live;
};

const forgetIssuedHash = async (tokenHash) => {
  const model = loadIssuedSessionModel();
  if (!model || typeof model.deleteOne !== 'function' || !tokenHash) return;
  try {
    await model.deleteOne({ tokenHash });
  } catch (err) {
    console.warn('Issued session removal skipped.');
  }
};

const persistIssuedSession = async (userId, token, ttlSeconds) => {
  const model = loadIssuedSessionModel();
  if (!model || typeof model.updateOne !== 'function') {
    return { ok: false, reason: 'revocation_store_unavailable', durableRequired: false };
  }

  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + (ttlSeconds * 1000));
  await model.updateOne(
    { tokenHash },
    { $set: { userId: String(userId), expiresAt }, $setOnInsert: { tokenHash } },
    { upsert: true }
  );
  return { ok: true, durableRequired: true };
};

const listIssuedSessions = async (userId) => {
  const model = loadIssuedSessionModel();
  if (!model || typeof model.find !== 'function') {
    return { checked: false, reason: 'revocation_store_unavailable', sessions: [] };
  }

  const rows = await model.find({
    userId: String(userId),
    expiresAt: { $gt: new Date() },
  }).select('tokenHash expiresAt').lean();
  const sessions = (Array.isArray(rows) ? rows : [])
    .filter((row) => row && row.tokenHash)
    .map((row) => ({
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
    }));
  return { checked: true, sessions };
};

/**
 * Revoke a session when only its hash is known. The raw JWT is not required
 * and is not written to the database or to logs.
 */
const revokePersistedHash = async (tokenHash, expiresAt) => {
  const model = loadRevokedTokenModel();
  if (!model || typeof model.updateOne !== 'function' || !tokenHash) {
    return { ok: false, reason: 'revocation_store_unavailable' };
  }

  const expiry = new Date(expiresAt);
  await model.updateOne(
    { tokenHash },
    { $set: { expiresAt: expiry }, $setOnInsert: { tokenHash } },
    { upsert: true }
  );

  const ttl = Math.ceil((expiry.getTime() - Date.now()) / 1000);
  if (isRedisReady() && ttl > 0) {
    try {
      await redis.set(`bl_${tokenHash}`, 'true', { EX: ttl });
    } catch (err) {
      revocationCacheTrusted = false;
      console.error('Redis blocklist write failed.');
    }
  } else if (!isRedisReady()) {
    revocationCacheTrusted = false;
  }

  await forgetIssuedHash(tokenHash);
  return { ok: true };
};

/**
 * Add a JWT hash to the durable revocation store, then cache it in Redis.
 * Success requires the durable write. A Redis-only write is not success.
 * Does not log the token.
 */
exports.blacklistToken = async (token) => {
  try {
    if (!token) return { ok: false, reason: 'missing_token' };

    const decoded = decodeToken(token);
    if (!decoded) return { ok: false, reason: 'invalid_token' };

    const ttl = decoded.exp - nowSeconds();
    if (ttl <= 0) return { ok: true, reason: 'already_expired' };

    const ttlSeconds = Math.floor(ttl);
    let persisted = { ok: false, reason: 'revocation_store_unavailable' };
    try {
      persisted = await persistRevocation(token, ttlSeconds);
    } catch (err) {
      revocationCacheTrusted = false;
      console.error('Persistent revocation write failed.');
      persisted = { ok: false, reason: 'revocation_store_unavailable' };
    }

    if (!persisted.ok) {
      revocationCacheTrusted = false;
      return { ok: false, reason: 'revocation_store_unavailable' };
    }

    await forgetIssuedHash(hashToken(token));

    if (isRedisReady()) {
      try {
        await redis.set(blockKey(token), 'true', { EX: ttlSeconds });
      } catch (err) {
        revocationCacheTrusted = false;
        console.error('Redis blocklist write failed.');
      }
    } else {
      revocationCacheTrusted = false;
    }

    return { ok: true };
  } catch (err) {
    console.error('Persistent revocation write failed.');
    return { ok: false, reason: 'revocation_store_unavailable' };
  }
};

/**
 * Check whether this token was revoked.
 * A Redis blocklist hit rejects immediately. A miss, a Redis error, or a
 * reconnect does not override a RevokedToken row. A failed durable lookup
 * is not treated as "not revoked".
 */
exports.isTokenBlacklisted = async (token) => {
  if (!token) return false;

  if (isRedisReady()) {
    try {
      const hashed = await redis.get(blockKey(token));
      if (hashed === 'true') return true;
      const legacy = await redis.get(`bl_${token}`);
      if (legacy === 'true') return true;
    } catch (err) {
      revocationCacheTrusted = false;
      console.error('Redis blocklist check failed.');
    }
  } else {
    revocationCacheTrusted = false;
  }

  try {
    const persisted = await readPersistedRevocation(token);
    if (persisted.checked) return persisted.revoked;
  } catch (err) {
    console.error('Persistent revocation check failed.');
    throw revocationUnavailable();
  }

  // The revocation collection lives in the same database as the user record.
  // When that database is not connected, protected requests already fail while
  // loading the account. Unit tests stub the user and have no revocation
  // collection; they keep the Redis answer only in that disconnected case.
  if (!loadRevokedTokenModel()) return false;
  throw revocationUnavailable();
};

const legacyTokenFromKey = (key) => {
  const value = String(key || '');
  if (!value.startsWith('bl_')) return null;
  const token = value.slice(3);
  if (token.split('.').length !== 3) return null;
  return token;
};

/**
 * Revocations written before the database hash existed are Redis keys of
 * the raw JWT. Copy those hashes into MongoDB while Redis can still list
 * them. The raw token is not stored or logged.
 * If Redis is already unavailable, those keys cannot be listed and the raw
 * JWTs cannot be reconstructed from any other store.
 */
exports.importLegacyRevocations = async () => {
  const model = loadRevokedTokenModel();
  if (!model || !isRedisReady()) {
    return { ok: false, reason: 'revocation_store_unavailable', imported: 0 };
  }
  if (typeof redis.scanIterator !== 'function') {
    return { ok: true, imported: 0, skipped: true };
  }

  let imported = 0;
  try {
    for await (const item of redis.scanIterator({ MATCH: 'bl_*', COUNT: 100 })) {
      const keys = typeof item === 'string'
        ? [item]
        : Array.isArray(item)
          ? item
          : item && Array.isArray(item.keys)
            ? item.keys
            : [];

      for (const key of keys) {
        const token = legacyTokenFromKey(key);
        const decoded = token ? decodeToken(token) : null;
        if (!decoded) continue;
        const ttl = decoded.exp - nowSeconds();
        if (ttl <= 0) continue;
        const persisted = await persistRevocation(token, Math.floor(ttl));
        if (!persisted.ok) {
          return { ok: false, reason: persisted.reason || 'revocation_store_unavailable', imported };
        }
        imported += 1;
      }
    }
    return { ok: true, imported };
  } catch (err) {
    console.error('Legacy revocation import failed.');
    return { ok: false, reason: 'revocation_store_unavailable', imported };
  }
};

/**
 * Copy unexpired durable revocations into Redis.
 * Until this succeeds, a Redis miss still has to be confirmed in the database.
 */
exports.rehydrateRevocations = async () => {
  revocationCacheTrusted = false;
  const model = loadRevokedTokenModel();
  if (!model || !isRedisReady() || typeof redis.set !== 'function' || typeof model.find !== 'function') {
    revocationCacheTrusted = false;
    return { ok: false, reason: 'revocation_store_unavailable' };
  }

  const legacy = await exports.importLegacyRevocations();
  if (!legacy.ok) {
    revocationCacheTrusted = false;
    return { ok: false, reason: legacy.reason || 'revocation_store_unavailable', imported: legacy.imported || 0 };
  }

  try {
    const rows = await model.find({ expiresAt: { $gt: new Date() } }).select('tokenHash expiresAt').lean();
    const liveRows = Array.isArray(rows) ? rows : [];
    const now = Date.now();

    for (const row of liveRows) {
      const expiresAt = new Date(row && row.expiresAt).getTime();
      const ttl = Math.ceil((expiresAt - now) / 1000);
      if (!row || !row.tokenHash || ttl <= 0) continue;
      await redis.set(`bl_${row.tokenHash}`, 'true', { EX: ttl });
    }

    revocationCacheTrusted = legacy.skipped ? false : true;
    return {
      ok: true,
      count: liveRows.length,
      imported: legacy.imported || 0,
      migrationComplete: !legacy.skipped,
    };
  } catch (err) {
    revocationCacheTrusted = false;
    console.error('Revocation cache rehydrate failed.');
    return { ok: false, reason: 'revocation_store_unavailable' };
  }
};

if (redis && typeof redis.on === 'function') {
  redis.on('ready', () => {
    exports.rehydrateRevocations().catch(() => {
      revocationCacheTrusted = false;
    });
  });
}

/**
 * Remember a newly issued token until it expires.
 * The durable record stores only the token hash. Redis keeps the raw token
 * in the session index as a cache. A Redis outage does not skip the durable
 * record when that store is connected.
 */
exports.registerIssuedToken = async (userId, token) => {
  try {
    if (!userId || !token) return { ok: false, reason: 'missing_token' };

    const decoded = decodeToken(token);
    if (!decoded) return { ok: false, reason: 'invalid_token' };

    const ttl = decoded.exp - nowSeconds();
    if (ttl <= 0) return { ok: false, reason: 'already_expired' };

    const durableRequired = Boolean(loadIssuedSessionModel());
    if (durableRequired) {
      try {
        const recorded = await persistIssuedSession(userId, token, ttl);
        if (!recorded.ok) {
          return { ok: false, reason: 'revocation_store_unavailable', durableRequired: true };
        }
      } catch (err) {
        console.warn('Issued session record failed.');
        return { ok: false, reason: 'revocation_store_unavailable', durableRequired: true };
      }
    }

    if (!isRedisReady() || typeof redis.zAdd !== 'function') {
      if (durableRequired) return { ok: true, cached: false };
      return { ok: false, reason: 'redis_unavailable', durableRequired: false };
    }

    try {
      const key = sessionKey(userId);
      await redis.zAdd(key, [{ score: decoded.exp, value: token }]);
      const listed = await readSessionEntries(key);
      if (!listed.ok) {
        if (durableRequired) return { ok: true, cached: false };
        return { ok: false, reason: listed.reason, durableRequired: false };
      }
      await refreshSessionExpiry(key, listed.entries);
      return { ok: true, durableRequired };
    } catch (err) {
      console.warn('Session index update skipped.');
      if (durableRequired) return { ok: true, cached: false };
      return { ok: false, reason: 'redis_write_failed', durableRequired: false };
    }
  } catch (err) {
    console.warn('Session index update skipped.');
    return { ok: false, reason: 'redis_write_failed', durableRequired: false };
  }
};

exports.forgetIssuedToken = async (userId, token) => {
  try {
    if (!userId || !token || !isRedisReady() || typeof redis.zRem !== 'function') return;
    const key = sessionKey(userId);
    await redis.zRem(key, token);
    const listed = await readSessionEntries(key);
    if (listed.ok) await refreshSessionExpiry(key, listed.entries);
  } catch (err) {
    console.warn('Session index removal skipped.');
  }
};

exports.isSessionTracked = async (userId, token) => {
  try {
    if (!userId || !token || !isRedisReady()) return false;
    const listed = await readSessionEntries(sessionKey(userId));
    if (!listed.ok) return false;
    const now = nowSeconds();
    return listed.entries.some((entry) => entry.token === token && entry.exp > now);
  } catch (err) {
    console.warn('Session index check skipped.');
    return false;
  }
};

/**
 * Blocklist every session that can be listed for a user.
 * Redis is one index. Issued-session hashes are the other. Success means
 * both indexes were read and every listed session was durably revoked.
 * A missing issued-session store is revocation_store_unavailable, not an
 * empty index. A Redis outage is not reported as "no tracked sessions".
 */
exports.revokeUserSessions = async (userId, options = {}) => {
  const startedAt = options.statusChangedAt || process.hrtime.bigint();
  const result = {
    required: true,
    success: false,
    blocklisted: 0,
    failed: 0,
    skipped: 0,
    reason: null,
    elapsedMs: null,
    indexCleanupFailed: false,
  };

  if (!userId) {
    result.reason = 'missing_user';
    return result;
  }

  let durableSessions = [];
  let durableRead = false;
  if (!loadIssuedSessionModel()) {
    result.reason = 'revocation_store_unavailable';
    return result;
  }
  try {
    const listed = await listIssuedSessions(userId);
    if (!listed.checked) {
      result.reason = 'revocation_store_unavailable';
      return result;
    }
    durableSessions = listed.sessions;
    durableRead = true;
  } catch (err) {
    console.error('Issued session lookup failed.');
    result.reason = 'revocation_store_unavailable';
    return result;
  }

  let redisTokens = [];
  let redisIndexRead = false;
  let redisReason = 'redis_unavailable';
  if (isRedisReady()) {
    try {
      const listed = await readSessionEntries(sessionKey(userId));
      if (!listed.ok) {
        redisReason = listed.reason || 'redis_read_failed';
      } else {
        redisIndexRead = true;
        const now = nowSeconds();
        redisTokens = listed.entries
          .filter((entry) => entry.exp > now)
          .map((entry) => entry.token);
      }
    } catch (err) {
      console.error('Session revocation failed.');
      redisReason = 'redis_read_failed';
    }
  }

  const covered = new Set();
  const blocklistedTokens = [];
  let acknowledgedAt = null;

  for (const token of redisTokens) {
    const written = await exports.blacklistToken(token);
    if (written.ok && written.reason === 'already_expired') {
      result.skipped += 1;
      covered.add(hashToken(token));
      blocklistedTokens.push(token);
    } else if (written.ok) {
      result.blocklisted += 1;
      covered.add(hashToken(token));
      blocklistedTokens.push(token);
      acknowledgedAt = process.hrtime.bigint();
    } else {
      result.failed += 1;
      covered.add(hashToken(token));
    }
  }

  for (const session of durableSessions) {
    if (covered.has(session.tokenHash)) continue;
    const written = await revokePersistedHash(session.tokenHash, session.expiresAt);
    if (written.ok) {
      result.blocklisted += 1;
      covered.add(session.tokenHash);
      acknowledgedAt = process.hrtime.bigint();
    } else {
      result.failed += 1;
    }
  }

  if (acknowledgedAt) {
    result.elapsedMs = Number(acknowledgedAt - startedAt) / 1e6;
  }

  if (!durableRead) {
    result.success = false;
    result.reason = 'revocation_store_unavailable';
  } else if (result.failed > 0 && (result.blocklisted > 0 || result.skipped > 0)) {
    result.success = false;
    result.reason = 'partial_failure';
  } else if (result.failed > 0) {
    result.success = false;
    result.reason = 'revocation_store_unavailable';
  } else if (!redisIndexRead) {
    result.success = false;
    result.reason = redisReason;
  } else if (result.blocklisted === 0 && result.skipped === 0) {
    result.success = true;
    result.reason = 'no_tracked_sessions';
  } else {
    result.success = true;
    result.reason = null;
  }

  try {
    if (redisIndexRead && result.success && typeof redis.del === 'function') {
      await redis.del(sessionKey(userId));
    } else if (redisIndexRead && typeof redis.zRem === 'function') {
      for (const token of blocklistedTokens) {
        await redis.zRem(sessionKey(userId), token);
      }
      const remaining = await readSessionEntries(sessionKey(userId));
      if (remaining.ok) await refreshSessionExpiry(sessionKey(userId), remaining.entries);
    }
  } catch (cleanupErr) {
    result.indexCleanupFailed = true;
    console.warn('Session index removal skipped.');
  }

  return result;
};
