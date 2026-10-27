const redis = require('../config/redis');
const jwt = require('jsonwebtoken');

/**
 * Helper to check if Redis is connected and ready to execute commands
 */
const isRedisReady = () => Boolean(redis && redis.isOpen && redis.isReady);

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

/**
 * Add JWT token to Redis blacklist with TTL matching token expiry.
 * Returns whether the write succeeded. Does not log the token.
 */
exports.blacklistToken = async (token) => {
  try {
    if (!token) return { ok: false, reason: 'missing_token' };
    if (!isRedisReady()) return { ok: false, reason: 'redis_unavailable' };

    const decoded = decodeToken(token);
    if (!decoded) return { ok: false, reason: 'invalid_token' };

    const ttl = decoded.exp - nowSeconds();
    if (ttl <= 0) return { ok: true, reason: 'already_expired' };

    await redis.set(`bl_${token}`, 'true', {
      EX: Math.floor(ttl),
    });
    return { ok: true };
  } catch (err) {
    console.error('Redis blocklist write failed.');
    return { ok: false, reason: 'redis_write_failed' };
  }
};

/**
 * Check if a token exists in the Redis blacklist.
 * Fail open when Redis is unavailable so a cache outage does not reject
 * every active session. Suspended accounts are rejected separately from
 * the persisted user status.
 */
exports.isTokenBlacklisted = async (token) => {
  try {
    if (!token || !isRedisReady()) {
      return false;
    }

    const result = await redis.get(`bl_${token}`);
    return result === 'true';
  } catch (err) {
    console.error('Redis blocklist check failed.');
    return false;
  }
};

/**
 * Remember a newly issued token until it expires.
 * The sorted-set score is the token exp, and the key TTL is the longest
 * remaining member lifetime. Raw tokens are never written to logs.
 */
exports.registerIssuedToken = async (userId, token) => {
  try {
    if (!userId || !token) return { ok: false, reason: 'missing_token' };
    if (!isRedisReady() || typeof redis.zAdd !== 'function') {
      return { ok: false, reason: 'redis_unavailable' };
    }

    const decoded = decodeToken(token);
    if (!decoded) return { ok: false, reason: 'invalid_token' };

    const ttl = decoded.exp - nowSeconds();
    if (ttl <= 0) return { ok: false, reason: 'already_expired' };

    const key = sessionKey(userId);
    await redis.zAdd(key, [{ score: decoded.exp, value: token }]);
    const listed = await readSessionEntries(key);
    if (!listed.ok) return { ok: false, reason: listed.reason };
    await refreshSessionExpiry(key, listed.entries);
    return { ok: true };
  } catch (err) {
    console.warn('Session index update skipped.');
    return { ok: false, reason: 'redis_write_failed' };
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
 * Blocklist every tracked session for a user.
 * statusChangedAt, when supplied, is the moment the account-status write
 * finished. elapsedMs then ends when Redis acknowledges the last blocklist
 * write, before session-index cleanup.
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

  if (!userId || !isRedisReady()) {
    result.reason = 'redis_unavailable';
    return result;
  }

  const key = sessionKey(userId);

  try {
    const listed = await readSessionEntries(key);
    if (!listed.ok) {
      result.reason = listed.reason || 'redis_read_failed';
      return result;
    }

    const now = nowSeconds();
    const liveTokens = listed.entries
      .filter((entry) => entry.exp > now)
      .map((entry) => entry.token);
    const blocklistedTokens = [];
    let acknowledgedAt = null;

    for (const token of liveTokens) {
      const written = await exports.blacklistToken(token);
      if (written.ok && written.reason === 'already_expired') {
        result.skipped += 1;
        blocklistedTokens.push(token);
      } else if (written.ok) {
        result.blocklisted += 1;
        blocklistedTokens.push(token);
        acknowledgedAt = process.hrtime.bigint();
      } else {
        result.failed += 1;
      }
    }

    if (acknowledgedAt) {
      result.elapsedMs = Number(acknowledgedAt - startedAt) / 1e6;
    }

    result.success = result.failed === 0;
    if (!result.success) {
      result.reason = result.blocklisted > 0 ? 'partial_failure' : 'redis_write_failed';
    } else if (result.blocklisted === 0) {
      result.reason = 'no_tracked_sessions';
    }

    try {
      if (result.success) {
        if (typeof redis.del === 'function') await redis.del(key);
      } else if (typeof redis.zRem === 'function') {
        for (const token of blocklistedTokens) {
          await redis.zRem(key, token);
        }
        const remaining = await readSessionEntries(key);
        if (remaining.ok) await refreshSessionExpiry(key, remaining.entries);
      }
    } catch (cleanupErr) {
      result.indexCleanupFailed = true;
      console.warn('Session index removal skipped.');
    }

    return result;
  } catch (err) {
    console.error('Session revocation failed.');
    result.success = false;
    result.reason = 'redis_read_failed';
    return result;
  }
};
