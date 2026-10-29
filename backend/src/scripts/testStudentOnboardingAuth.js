const assert = require('assert');
const jwt = require('jsonwebtoken');
const { installMemoryRevocationStore } = require('./revocationStoreStub');

installMemoryRevocationStore();

const User = require('../models/User');
const Provider = require('../models/Provider');
const { protect, authorize } = require('../middleware/auth');
const studentRoutes = require('../routes/studentRoutes');
const userRoutes = require('../routes/userRoutes');
const consentRoutes = require('../routes/consentRoutes');
const { handleOnboarding: studentOnboarding } = require('../controllers/userController');
const {
  createProfile,
  getProfile,
  updateProfile,
} = require('../controllers/studentProfileController');

const secret = process.env.JWT_SECRET || 'fallback_secret';

const users = {
  'student-new': {
    _id: 'student-new',
    id: 'student-new',
    role: 'student',
    status: 'active',
    isOnboarded: false,
    email: 'new.student@example.com',
    name: 'New Student',
  },
  'student-done': {
    _id: 'student-done',
    id: 'student-done',
    role: 'student',
    status: 'active',
    isOnboarded: true,
    email: 'done.student@example.com',
    name: 'Finished Student',
  },
  'student-minor': {
    _id: 'student-minor',
    id: 'student-minor',
    role: 'student',
    status: 'pending_consent',
    isOnboarded: true,
    email: 'minor.student@example.com',
    name: 'Minor Student',
  },
  'provider-a': {
    _id: 'provider-a',
    id: 'provider-a',
    role: 'provider',
    status: 'active',
    isOnboarded: false,
    email: 'provider.a@example.com',
    name: 'Provider A',
  },
  'admin-a': {
    _id: 'admin-a',
    id: 'admin-a',
    role: 'admin',
    status: 'active',
    email: 'admin.a@example.com',
    name: 'Admin A',
  },
};

const lookups = [];

User.findById = (id) => {
  lookups.push(String(id));
  const user = users[String(id)] || null;
  return {
    select() {
      return Promise.resolve(user);
    },
    then(resolve, reject) {
      return Promise.resolve(user).then(resolve, reject);
    },
  };
};

Provider.findOne = () => ({
  select() {
    return Promise.resolve(null);
  },
});

const sign = (id, options = {}) => jwt.sign(
  { id, role: users[id]?.role || 'student' },
  secret,
  options
);

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

const main = async () => {
  const profileRoutes = [
    ['post', createProfile],
    ['get', getProfile],
    ['put', updateProfile],
  ];

  profileRoutes.forEach(([method, controller]) => {
    const handlers = routeHandlers(studentRoutes, method, '/profile');
    assert.equal(handlers[0].name, 'protect', `${method.toUpperCase()} /profile must require a JWT`);
    assert.equal(handlers[1].name, 'authorizeRequest', `${method.toUpperCase()} /profile must require the student role`);
    assert.equal(handlers.at(-1), controller);
  });

  const onboardingHandlers = routeHandlers(userRoutes, 'post', '/onboarding');
  assert.ok(onboardingHandlers.some((handler) => handler.name === 'protect'));
  assert.equal(onboardingHandlers.at(-1), studentOnboarding);

  const consentVerify = routeHandlers(consentRoutes, 'get', '/verify');
  const consentApprove = routeHandlers(consentRoutes, 'post', '/approve');
  const userConsentVerify = routeHandlers(userRoutes, 'get', '/consent/verify');
  const userConsentApprove = routeHandlers(userRoutes, 'post', '/consent/approve');
  [consentVerify, consentApprove, userConsentVerify, userConsentApprove].forEach((handlers) => {
    assert.equal(handlers.some((handler) => handler.name === 'protect'), false);
    assert.equal(handlers.some((handler) => handler.name === 'authorizeRequest'), false);
  });
  assert.ok(routeHandlers(userRoutes, 'post', '/consent/resend').some((handler) => handler.name === 'protect'));
  assert.ok(routeHandlers(consentRoutes, 'post', '/resend').some((handler) => handler.name === 'protect'));

  const anonymous = await run(protect, {
    headers: {},
    body: { userId: 'student-done' },
  });
  assert.equal(anonymous.nextCalled, false);
  assert.equal(anonymous.res.statusCode, 401);
  assert.match(anonymous.res.body.message, /log in/i);

  const invalid = await run(protect, {
    headers: { authorization: 'Bearer not-a-token' },
    body: { userId: 'student-done' },
  });
  assert.equal(invalid.nextCalled, false);
  assert.equal(invalid.res.statusCode, 401);
  assert.equal(invalid.res.body.code, 'SESSION_REVOKED');

  const expiredToken = jwt.sign(
    { id: 'student-new', exp: Math.floor(Date.now() / 1000) - 60 },
    secret
  );
  const expired = await run(protect, {
    headers: { authorization: `Bearer ${expiredToken}` },
    body: { userId: 'student-done' },
  });
  assert.equal(expired.nextCalled, false);
  assert.equal(expired.res.statusCode, 401);
  assert.equal(expired.res.body.code, 'SESSION_REVOKED');

  const studentToken = sign('student-new');
  const studentProtected = await run(protect, {
    headers: { authorization: `Bearer ${studentToken}` },
    body: { userId: 'student-done' },
  });
  assert.equal(studentProtected.nextCalled, true);
  assert.equal(String(studentProtected.req.user._id), 'student-new');
  assert.notEqual(String(studentProtected.req.user._id), studentProtected.req.body.userId);
  const studentAllowed = await run(authorize('student'), studentProtected.req);
  assert.equal(studentAllowed.nextCalled, true);

  const providerToken = sign('provider-a');
  const providerProtected = await run(protect, {
    headers: { authorization: `Bearer ${providerToken}` },
    body: { userId: 'student-new' },
  });
  assert.equal(providerProtected.nextCalled, true);
  assert.equal(String(providerProtected.req.user._id), 'provider-a');
  const providerForbidden = await run(authorize('student'), providerProtected.req);
  assert.equal(providerForbidden.nextCalled, false);
  assert.equal(providerForbidden.res.statusCode, 403);

  const adminToken = sign('admin-a');
  const adminProtected = await run(protect, {
    headers: { authorization: `Bearer ${adminToken}` },
    body: { userId: 'student-new' },
  });
  assert.equal(adminProtected.nextCalled, true);
  const adminForbidden = await run(authorize('student'), adminProtected.req);
  assert.equal(adminForbidden.nextCalled, false);
  assert.equal(adminForbidden.res.statusCode, 403);

  lookups.length = 0;
  const newStudent = await run(studentOnboarding, {
    user: { id: 'student-new', _id: 'student-new', role: 'student' },
    body: { userId: 'student-done', email: 'done.student@example.com' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(newStudent.res.statusCode, 400);
  assert.match(newStudent.res.body.message, /date of birth/i);
  assert.deepStrictEqual(lookups, ['student-new']);

  lookups.length = 0;
  const providerOnboarding = await run(studentOnboarding, {
    user: { id: 'provider-a', _id: 'provider-a', role: 'provider' },
    body: { userId: 'student-new', dob: '2004-01-15' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(providerOnboarding.res.statusCode, 403);
  assert.match(providerOnboarding.res.body.message, /student accounts/i);
  assert.deepStrictEqual(lookups, ['provider-a']);

  lookups.length = 0;
  const finishedStudent = await run(studentOnboarding, {
    user: { id: 'student-done', _id: 'student-done', role: 'student' },
    body: { userId: 'student-new', dob: '2004-01-15' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(finishedStudent.res.statusCode, 400);
  assert.match(finishedStudent.res.body.message, /already been completed/i);
  assert.deepStrictEqual(lookups, ['student-done']);

  lookups.length = 0;
  const pendingConsent = await run(studentOnboarding, {
    user: { id: 'student-minor', _id: 'student-minor', role: 'student', status: 'pending_consent' },
    body: { userId: 'student-new', dob: '2012-01-15', guardianEmail: 'guardian@example.com' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(pendingConsent.res.statusCode, 403);
  assert.match(pendingConsent.res.body.message, /parental consent/i);
  assert.deepStrictEqual(lookups, ['student-minor']);

  console.log('student onboarding auth tests passed');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
