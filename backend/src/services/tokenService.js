const redis = require('../config/redis');
const jwt = require('jsonwebtoken');

/**
 * Helper to check if Redis is connected and ready to execute commands
 */
const isRedisReady = () => {
  return Boolean(redis && redis.isOpen && redis.isReady);
};

/**
 * Add JWT token to Redis blacklist with TTL matching token expiry
 */
exports.blacklistToken = async (token) => {
  try {
    if (!token || !isRedisReady()) return;

    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return;

    const currentTime = Math.floor(Date.now() / 1000);
    const ttl = decoded.exp - currentTime;

    if (ttl > 0) {
      await redis.set(`bl_${token}`, 'true', {
        EX: Math.floor(ttl),
      });
    }
  } catch (err) {
    console.error('Redis Blacklist Error:', err?.message || err);
  }
};

/**
 * Check if a token exists in the Redis blacklist
 */
exports.isTokenBlacklisted = async (token) => {
  try {
    if (!token || !isRedisReady()) {
      return false; // Fail open locally if Redis is not connected
    }

    const result = await redis.get(`bl_${token}`);
    return result === 'true';
  } catch (err) {
    console.error('Redis Check Error:', err?.message || err);
    return false; // Fail open to allow valid users if cache fails
  }
};