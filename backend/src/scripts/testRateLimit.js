const assert = require('assert');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const {
  AUTH_RATE_LIMIT_MESSAGE,
  EMAIL_RATE_LIMIT_MESSAGE,
  GENERAL_RATE_LIMIT_MESSAGE,
  configureTrustProxy,
  createApiLimiters,
  mountRateLimiters,
  resolveRateLimitConfig,
} = require('../middleware/rateLimit');

const buildApp = (overrides) => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  mountRateLimiters(app, createApiLimiters(overrides));
  app.get('/api/v1/health', (req, res) => {
    res.status(200).json({ success: true, message: 'IskolarMatch API Online' });
  });
  app.get('/api/v1/auth/me', (req, res) => {
    res.status(200).json({ success: true });
  });
  app.post('/api/v1/auth/login', (req, res) => {
    res.status(200).json({ success: true });
  });
  app.post('/api/v1/auth/forgotpassword', (req, res) => {
    res.status(200).json({ success: true });
  });
  return app;
};

const listen = (app) => new Promise((resolve) => {
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
});

const close = (server) => new Promise((resolve, reject) => {
  server.close((error) => (error ? reject(error) : resolve()));
});

const hit = (server, path, options = {}) => {
  const { port } = server.address();
  return fetch(`http://127.0.0.1:${port}${path}`, options);
};

const readJson = async (response) => {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
};

const signToken = (id) => jwt.sign(
  { id, role: 'student' },
  process.env.JWT_SECRET || 'fallback_secret',
  { expiresIn: '1h' }
);

const check = async (name, fn) => {
  await fn();
  console.log(`ok - ${name}`);
};

const withEnv = async (values, fn) => {
  const previous = {};
  Object.keys(values).forEach((key) => {
    previous[key] = process.env[key];
    if (values[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = values[key];
    }
  });

  try {
    await fn();
  } finally {
    Object.keys(previous).forEach((key) => {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    });
  }
};

const main = async () => {
  await check('development and production defaults stay separate', async () => {
    await withEnv({
      NODE_ENV: 'development',
      RATE_LIMIT_WINDOW_MS: undefined,
      RATE_LIMIT_MAX: undefined,
      AUTH_RATE_LIMIT_MAX: undefined,
      EMAIL_RATE_LIMIT_MAX: undefined,
    }, async () => {
      const dev = resolveRateLimitConfig();
      assert.strictEqual(dev.windowMs, 15 * 60 * 1000);
      assert.strictEqual(dev.generalLimit, 1500);
      assert.strictEqual(dev.authLimit, 200);
      assert.strictEqual(dev.emailLimit, 30);
    });

    await withEnv({
      NODE_ENV: 'production',
      RATE_LIMIT_WINDOW_MS: undefined,
      RATE_LIMIT_MAX: undefined,
      AUTH_RATE_LIMIT_MAX: undefined,
      EMAIL_RATE_LIMIT_MAX: undefined,
    }, async () => {
      const prod = resolveRateLimitConfig();
      assert.strictEqual(prod.generalLimit, 600);
      assert.strictEqual(prod.authLimit, 100);
      assert.strictEqual(prod.emailLimit, 10);
    });
  });

  await check('trust proxy follows deployment topology', async () => {
    await withEnv({ NODE_ENV: 'development', TRUST_PROXY_HOPS: undefined }, async () => {
      const app = express();
      configureTrustProxy(app);
      assert.strictEqual(app.get('trust proxy'), false);
    });

    await withEnv({ NODE_ENV: 'production', TRUST_PROXY_HOPS: undefined }, async () => {
      const app = express();
      configureTrustProxy(app);
      assert.strictEqual(app.get('trust proxy'), 1);
    });

    await withEnv({ NODE_ENV: 'production', TRUST_PROXY_HOPS: '0' }, async () => {
      const app = express();
      configureTrustProxy(app);
      assert.strictEqual(app.get('trust proxy'), false);
    });

    await withEnv({ NODE_ENV: 'development', TRUST_PROXY_HOPS: '2' }, async () => {
      const app = express();
      configureTrustProxy(app);
      assert.strictEqual(app.get('trust proxy'), 2);
    });
  });

  await check('signed-in sessions do not share one anonymous IP bucket', async () => {
    const server = await listen(buildApp({
      windowMs: 60 * 1000,
      generalLimit: 2,
      authLimit: 20,
      emailLimit: 20,
    }));

    const tokenA = signToken('student-a');
    const tokenB = signToken('student-b');

    try {
      const first = await hit(server, '/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const second = await hit(server, '/api/v1/health', {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const blocked = await hit(server, '/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const otherSession = await hit(server, '/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      const sameCookie = await hit(server, '/api/v1/health', {
        headers: { Cookie: `token=${tokenA}` },
      });
      const anonymous = await hit(server, '/api/v1/health');

      assert.strictEqual(first.status, 200);
      assert.strictEqual(second.status, 200);
      assert.strictEqual(blocked.status, 429);
      assert.strictEqual(otherSession.status, 200);
      assert.strictEqual(sameCookie.status, 429);
      assert.strictEqual(anonymous.status, 200);

      const body = await readJson(blocked);
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error, GENERAL_RATE_LIMIT_MESSAGE);
      assert.strictEqual(body.message, GENERAL_RATE_LIMIT_MESSAGE);
      assert.ok(Number(blocked.headers.get('retry-after')) > 0);
    } finally {
      await close(server);
    }
  });

  await check('repeated session checks do not consume the login limit', async () => {
    const server = await listen(buildApp({
      windowMs: 60 * 1000,
      generalLimit: 4,
      authLimit: 2,
      emailLimit: 2,
    }));

    try {
      const sessionToken = signToken('student-session');
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const response = await hit(server, '/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        assert.strictEqual(response.status, 200);
      }

      const login = await hit(server, '/api/v1/auth/login', { method: 'POST' });
      const secondLogin = await hit(server, '/api/v1/auth/login', { method: 'POST' });
      const blockedLogin = await hit(server, '/api/v1/auth/login', { method: 'POST' });
      const body = await readJson(blockedLogin);

      assert.strictEqual(login.status, 200);
      assert.strictEqual(secondLogin.status, 200);
      assert.strictEqual(blockedLogin.status, 429);
      assert.strictEqual(body.error, AUTH_RATE_LIMIT_MESSAGE);
      assert.ok(Number(blockedLogin.headers.get('retry-after')) > 0);
    } finally {
      await close(server);
    }
  });

  await check('unverified authorization values share the anonymous IP bucket', async () => {
    const server = await listen(buildApp({
      windowMs: 60 * 1000,
      generalLimit: 2,
      authLimit: 20,
      emailLimit: 20,
    }));

    try {
      const first = await hit(server, '/api/v1/health', {
        headers: { Authorization: 'Bearer not-a-jwt' },
      });
      const second = await hit(server, '/api/v1/health', {
        headers: { Authorization: 'Bearer also-not-a-jwt' },
      });
      const blocked = await hit(server, '/api/v1/health', {
        headers: { Authorization: 'Bearer third-fake' },
      });
      const anonymous = await hit(server, '/api/v1/health');
      const valid = await hit(server, '/api/v1/health', {
        headers: { Authorization: `Bearer ${signToken('student-isolated')}` },
      });

      assert.strictEqual(first.status, 200);
      assert.strictEqual(second.status, 200);
      assert.strictEqual(blocked.status, 429);
      assert.strictEqual(anonymous.status, 429);
      assert.strictEqual(valid.status, 200);
    } finally {
      await close(server);
    }
  });

  await check('email-sending auth routes keep a stricter limit than login', async () => {
    const server = await listen(buildApp({
      windowMs: 60 * 1000,
      generalLimit: 20,
      authLimit: 20,
      emailLimit: 2,
    }));

    try {
      const first = await hit(server, '/api/v1/auth/forgotpassword', { method: 'POST' });
      const second = await hit(server, '/api/v1/auth/forgotpassword', { method: 'POST' });
      const blocked = await hit(server, '/api/v1/auth/forgotpassword', { method: 'POST' });
      const login = await hit(server, '/api/v1/auth/login', { method: 'POST' });
      const body = await readJson(blocked);

      assert.strictEqual(first.status, 200);
      assert.strictEqual(second.status, 200);
      assert.strictEqual(blocked.status, 429);
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error, EMAIL_RATE_LIMIT_MESSAGE);
      assert.strictEqual(body.message, EMAIL_RATE_LIMIT_MESSAGE);
      assert.strictEqual(login.status, 200);
    } finally {
      await close(server);
    }
  });

  console.log('\n6 rate limit checks passed');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
