const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const jwt = require('jsonwebtoken');


const redisPath = require.resolve('../config/redis');
const store = new Map();
const redis = {
  isOpen: true,
  isReady: true,
  async set(key, value) {
    store.set(key, value);
    return 'OK';
  },
  async get(key) {
    return store.has(key) ? store.get(key) : null;
  },
};
const redisModule = new Module(redisPath, module);
redisModule.filename = redisPath;
redisModule.loaded = true;
redisModule.exports = redis;
require.cache[redisPath] = redisModule;

const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { logout } = require('../controllers/authController');
const { isTokenBlacklisted } = require('../services/tokenService');
const { protect } = require('../middleware/auth');
const authRoutes = require('../routes/authRoutes');
const { installMemoryRevocationStore } = require('./revocationStoreStub');

installMemoryRevocationStore();

const secret = process.env.JWT_SECRET || 'fallback_secret';

// Logout records an audit row. Keep that call, but do not open MongoDB.
AuditLog.create = async () => ({});

const signToken = (id) =>
  jwt.sign({ id, role: 'student', status: 'active' }, secret, { expiresIn: '1h' });

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
        resolve({
          nextCalled: false,
          statusCode: this.statusCode,
          body,
        });
      },
    };

    Promise.resolve(
      middleware(req, res, () => {
        resolve({ nextCalled: true, statusCode: res.statusCode, body: res.body, req });
      })
    ).catch(reject);
  });

const handlersFor = (router, method, routePath) => {
  const layer = router.stack.find(
    (entry) =>
      entry.route &&
      entry.route.path === routePath &&
      entry.route.methods[method]
  );
  assert.ok(layer, `Missing ${method.toUpperCase()} ${routePath}`);
  return layer.route.stack.map((entry) => entry.handle.name);
};

const main = async () => {
  const activeUser = {
    _id: 'student-1',
    id: 'student-1',
    role: 'student',
    status: 'active',
    isOnboarded: true,
  };

  User.findById = () => ({
    select: async () => activeUser,
  });

  const token = signToken(activeUser.id);
  const otherToken = signToken('student-2');

  const loggedIn = await run(protect, {
    headers: { authorization: `Bearer ${token}` },
    cookies: {},
  });
  assert.strictEqual(loggedIn.nextCalled, true);
  assert.strictEqual(loggedIn.req.user.role, 'student');

  const cleared = [];
  const res = {
    statusCode: null,
    body: null,
    clearCookie(name, options) {
      cleared.push({ name, options });
      return this;
    },
    cookie() {
      throw new Error('Logout must clear the auth cookie.');
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await logout(
    { token, user: activeUser, headers: { authorization: `Bearer ${token}` } },
    res,
    (error) => {
      throw error;
    }
  );

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(cleared.length, 1);
  assert.strictEqual(cleared[0].name, 'token');
  assert.strictEqual(cleared[0].options.httpOnly, true);
  assert.strictEqual(cleared[0].options.sameSite, 'lax');
  assert.strictEqual(await isTokenBlacklisted(token), true);
  assert.strictEqual(await isTokenBlacklisted(otherToken), false);

  const revoked = await run(protect, {
    headers: { authorization: `Bearer ${token}` },
    cookies: {},
  });
  assert.strictEqual(revoked.nextCalled, false);
  assert.strictEqual(revoked.statusCode, 401);
  assert.match(revoked.body.message, /revoked/i);

  const otherSession = await run(protect, {
    headers: { authorization: `Bearer ${otherToken}` },
    cookies: {},
  });
  assert.strictEqual(otherSession.nextCalled, true);

  const logoutHandlers = handlersFor(authRoutes, 'get', '/logout');
  assert.ok(logoutHandlers.includes('protect'));
  assert.strictEqual(
    authRoutes.stack.some(
      (entry) => entry.route && entry.route.path === '/logout' && entry.route.methods.post
    ),
    false
  );

  const read = (relativePath) =>
    fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
  const authContext = read('../../../frontend/src/context/AuthContext.jsx');
  const logoutResult = read('../../../frontend/src/context/logoutResult.js');
  const sidebar = read('../../../frontend/src/components/navigation/SideBar.jsx');
  const layout = read('../../../frontend/src/layouts/AppLayout.jsx');
  const app = read('../../../frontend/src/App.jsx');

  assert.match(authContext, /method:\s*'GET'/);
  assert.match(authContext, /\/auth\/logout/);
  assert.match(authContext, /interpretLogoutResult/);
  assert.match(authContext, /if \(!result\.clearSession\) return result;/);
  assert.match(logoutResult, /clearSession: false/);
  assert.match(logoutResult, /Logout could not revoke this session/);
  assert.match(logoutResult, /You are still signed in/);
  assert.match(authContext, /setUser\(null\)/);
  assert.match(authContext, /setToken\(null\)/);
  assert.match(authContext, /localStorage\.removeItem\('token'\)/);
  assert.match(sidebar, /await logout\(\)/);
  assert.match(sidebar, /result\.ok === false/);
  assert.match(sidebar, /role="alert"/);
  assert.doesNotMatch(sidebar, /localStorage\.removeItem\('token'\)/);
  assert.match(layout, /await logout\(\)/);
  assert.match(layout, /result\.ok === false/);
  assert.match(layout, /role="alert"/);
  assert.doesNotMatch(layout, /\/api\/v1\/auth\/logout/);
  assert.match(layout, /\/auth\?mode=signin/);
  assert.match(app, /if \(!user\)/);
  assert.match(app, /to="\/auth\?mode=signin"/);

  console.log('logout session tests passed');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
