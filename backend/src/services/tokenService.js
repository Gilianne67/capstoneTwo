const redis = require('../config/redis');
const jwt = require('jsonwebtoken');

// Add token to Redis blacklist with TTL
exports.blacklistToken = async (token) => {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return;

    const currentTime = Math.floor(Date.now() / 1000);
    const ttl = decoded.exp - currentTime;

    if (ttl > 0) {
      await redis.set(`bl_${token}`, 'true', 'EX', ttl);
    }
  } catch (err) {
    console.error('Redis Blacklist Error:', err.message);
  }
};

// Check if token is blacklisted
exports.isTokenBlacklisted = async (token) => {
  try {
    const result = await redis.get(`bl_${token}`);
    return result === 'true';
  } catch (err) {
    return false; // Fail open if Redis is down
  }
};