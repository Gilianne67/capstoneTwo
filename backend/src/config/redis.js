const { createClient } = require('redis');

const getRedisUrl = () => {
  // 1. Explicit REDIS_URL passed (Railway or local .env)
  if (process.env.REDIS_URL && !process.env.REDIS_URL.includes('${{')) {
    return process.env.REDIS_URL;
  }

  // 2. Individual Railway variable fallback
  if (process.env.REDISHOST) {
    const host = process.env.REDISHOST;
    const port = process.env.REDISPORT || '6379';
    const user = process.env.REDISUSER || 'default';
    const pass = process.env.REDISPASSWORD || process.env.REDIS_PASSWORD;
    return pass ? `redis://${user}:${pass}@${host}:${port}` : `redis://${host}:${port}`;
  }

  // 3. Local Development Default
  return 'redis://127.0.0.1:6379';
};

const hasExplicitRedisUrl = Boolean(
  process.env.REDIS_URL && !process.env.REDIS_URL.includes('${{')
);

const redisClient = createClient({
  url: getRedisUrl(),
  // IMPORTANT: Disable offline command queuing so commands fail fast when Redis is offline
  disableOfflineQueue: true,
  socket: {
    connectTimeout: 500, // Socket connection timeout in ms
    reconnectStrategy: (retries) => {
      // If running locally without REDIS_URL, stop reconnecting immediately
      if (!hasExplicitRedisUrl && process.env.NODE_ENV === 'development') {
        return false;
      }
      return Math.min(retries * 100, 3000);
    },
  },
});

// Suppress local connection error noise
redisClient.on('error', (err) => {
  if (err?.code !== 'ECONNREFUSED' && !err?.message?.includes('enableOfflineQueue')) {
    console.error('❌ Redis Client Error:', err?.message || err);
  }
});

redisClient.on('connect', () => {
  console.log('✅ Connected to Redis successfully.');
});

// Auto-connect if explicit URL provided or not in local dev
(async () => {
  try {
    if (!redisClient.isOpen && (hasExplicitRedisUrl || process.env.NODE_ENV !== 'development')) {
      await redisClient.connect();
    }
  } catch (err) {
    if (err?.code === 'ECONNREFUSED') {
      console.warn('⚠️ Local Redis not detected. Running backend in fail-open mode.');
    }
  }
})();

module.exports = redisClient;