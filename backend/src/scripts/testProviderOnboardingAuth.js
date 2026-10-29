const assert = require('assert');
const jwt = require('jsonwebtoken');
const { installMemoryRevocationStore } = require('./revocationStoreStub');

installMemoryRevocationStore();

const User = require('../models/User');
const Provider = require('../models/Provider');
const { protect, authorize } = require('../middleware/auth');
const providerRoutes = require('../routes/providerRoutes');
const userRoutes = require('../routes/userRoutes');
const { handleOnboarding: providerOnboarding, getProfile, updateProfile } = require('../controllers/providerController');
const { handleOnboarding: studentOnboarding } = require('../controllers/userController');

const secret = process.env.JWT_SECRET || 'fallback_secret';

const users = {
  'provider-a': {
    _id: 'provider-a',
    id: 'provider-a',
    role: 'provider',
    status: 'active',
    email: 'provider.a@example.com',
    name: 'Provider A',
  },
  'provider-b': {
    _id: 'provider-b',
    id: 'provider-b',
    role: 'provider',
    status: 'active',
    email: 'provider.b@example.com',
    name: 'Provider B',
  },
  'student-a': {
    _id: 'student-a',
    id: 'student-a',
    role: 'student',
    status: 'active',
    email: 'student.a@example.com',
    name: 'Student A',
  },
};

User.findById = (id) => ({
  select() {
    return Promise.resolve(users[String(id)] || null);
  },
});

Provider.findOne = () => ({
  select() {
    return Promise.resolve(null);
  },
});

const sign = (id, options = {}) => jwt.sign({ id, role: users[id]?.role || 'provider' }, secret, options);

const run = async (handler, req) => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let nextCalled = false;
  await handler(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled, req };
};

const routeHandlers = (router, method, path) => {
  const layer = router.stack.find(
    (entry) => entry.route && entry.route.path === path && entry.route.methods[method]
  );
  assert.ok(layer, `${method.toUpperCase()} ${path} route is missing`);
  return layer.route.stack.map((entry) => entry.handle);
};

const globalHandlers = (router) =>
  router.stack
    .filter((entry) => !entry.route)
    .map((entry) => entry.handle && entry.handle.name)
    .filter(Boolean);

const main = async () => {
  const providerGlobals = globalHandlers(providerRoutes);
  assert.ok(providerGlobals.includes('protect'), 'provider routes must authenticate every request');
  assert.ok(
    providerGlobals.includes('authorizeRequest'),
    'provider routes must require the provider role'
  );
  const providerOnboardingHandlers = routeHandlers(providerRoutes, 'post', '/onboarding');
  assert.equal(providerOnboardingHandlers[0].name, 'multerMiddleware');
  assert.equal(providerOnboardingHandlers.at(-1), providerOnboarding);
  assert.ok(routeHandlers(providerRoutes, 'get', '/profile').includes(getProfile));
  assert.ok(routeHandlers(providerRoutes, 'put', '/profile').includes(updateProfile));

  const studentOnboardingHandlers = routeHandlers(userRoutes, 'post', '/onboarding');
  assert.ok(studentOnboardingHandlers.some((handler) => handler.name === 'protect'));
  assert.equal(studentOnboardingHandlers.at(-1), studentOnboarding);

  const anonymous = await run(protect, { headers: {}, body: { userId: 'provider-b' } });
  assert.equal(anonymous.nextCalled, false);
  assert.equal(anonymous.res.statusCode, 401);
  assert.match(anonymous.res.body.message, /log in/i);

  const invalid = await run(protect, {
    headers: { authorization: 'Bearer not-a-token' },
    body: {},
  });
  assert.equal(invalid.nextCalled, false);
  assert.equal(invalid.res.statusCode, 401);
  assert.equal(invalid.res.body.code, 'SESSION_REVOKED');

  const expiredToken = jwt.sign(
    { id: 'provider-a', exp: Math.floor(Date.now() / 1000) - 60 },
    secret
  );
  const expired = await run(protect, {
    headers: { authorization: `Bearer ${expiredToken}` },
    body: { userId: 'provider-b' },
  });
  assert.equal(expired.nextCalled, false);
  assert.equal(expired.res.statusCode, 401);
  assert.equal(expired.res.body.code, 'SESSION_REVOKED');

  const studentToken = sign('student-a');
  const studentProtected = await run(protect, {
    headers: { authorization: `Bearer ${studentToken}` },
    body: { userId: 'provider-a' },
  });
  assert.equal(studentProtected.nextCalled, true);
  assert.equal(String(studentProtected.req.user._id), 'student-a');
  const studentForbidden = await run(authorize('provider'), studentProtected.req);
  assert.equal(studentForbidden.nextCalled, false);
  assert.equal(studentForbidden.res.statusCode, 403);

  const providerToken = sign('provider-a');
  const providerProtected = await run(protect, {
    headers: { authorization: `Bearer ${providerToken}` },
    body: { userId: 'provider-b', providerId: 'provider-other' },
  });
  assert.equal(providerProtected.nextCalled, true);
  assert.equal(String(providerProtected.req.user._id), 'provider-a');
  assert.notEqual(String(providerProtected.req.user._id), providerProtected.req.body.userId);
  const providerAllowed = await run(authorize('provider'), providerProtected.req);
  assert.equal(providerAllowed.nextCalled, true);
  assert.equal(providerAllowed.res.statusCode, 200);

  console.log('provider onboarding auth tests passed');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
