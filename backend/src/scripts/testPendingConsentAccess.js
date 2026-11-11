const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Provider = require('../models/Provider');
const { authorize, protect } = require('../middleware/auth');
const matchingRoutes = require('../routes/matchingRoutes');
const studentRoutes = require('../routes/studentRoutes');
const userRoutes = require('../routes/userRoutes');
const { MISSING_DOB_ACCESS_MESSAGE } = require('../utils/studentAge');

const secret = process.env.JWT_SECRET || 'fallback_secret';

const pendingStudent = {
  id: 'student-pending',
  role: 'student',
  status: 'pending_consent',
  isOnboarded: true,
};

const approvedStudent = {
  id: 'student-approved',
  role: 'student',
  status: 'active',
  isOnboarded: true,
  dob: new Date('2000-01-15T00:00:00.000Z'),
};

const onboardedStudent = {
  id: 'student-active',
  role: 'student',
  status: 'active',
  isOnboarded: true,
  dob: new Date('2000-01-15T00:00:00.000Z'),
};

const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role, status: user.status }, secret, {
    expiresIn: '1h',
  });

const runMiddleware = (middleware, req) =>
  new Promise((resolve) => {
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        resolve({
          nextCalled: false,
          statusCode: this.statusCode,
          body: payload,
        });
      },
    };

    middleware(req, res, () => {
      resolve({
        nextCalled: true,
        statusCode: res.statusCode,
        body: res.body,
      });
    });
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

const authenticatedRequest = (user) => {
  const token = signToken(user);
  const decoded = jwt.verify(token, secret);

  return {
    token,
    user: {
      ...user,
      id: decoded.id,
      role: decoded.role,
    },
  };
};

const main = async () => {
  const studentGate = authorize('student');
  const scholarshipGate = authorize('provider', 'student');

  const pendingRequest = authenticatedRequest(pendingStudent);
  const blockedProfile = await runMiddleware(studentGate, pendingRequest);
  const blockedMatches = await runMiddleware(studentGate, pendingRequest);
  const blockedScholarship = await runMiddleware(scholarshipGate, pendingRequest);

  assert.strictEqual(blockedProfile.nextCalled, false);
  assert.strictEqual(blockedProfile.statusCode, 403);
  assert.strictEqual(blockedProfile.body.underage, false);
  assert.strictEqual(blockedProfile.body.code, 'DOB_UNVERIFIED');
  assert.strictEqual(blockedProfile.body.message, MISSING_DOB_ACCESS_MESSAGE);
  assert.strictEqual(blockedMatches.nextCalled, false);
  assert.strictEqual(blockedMatches.statusCode, 403);
  assert.strictEqual(blockedScholarship.nextCalled, false);
  assert.strictEqual(jwt.verify(pendingRequest.token, secret).id, pendingStudent.id);

  const matchingHandlers = handlersFor(matchingRoutes, 'get', '/');
  const profileHandlers = handlersFor(studentRoutes, 'get', '/profile');
  assert.ok(matchingHandlers.includes('protect'));
  assert.ok(matchingHandlers.includes('authorizeRequest'));
  assert.ok(profileHandlers.includes('authorizeRequest'));

  assert.equal(
    userRoutes.stack.some((entry) => entry.route && String(entry.route.path).includes('consent')),
    false
  );

  const frontendPath = path.resolve(
    __dirname,
    '../../../frontend/src/context/redirectPath.js'
  );
  const { resolveRedirectPath } = await import(pathToFileURL(frontendPath).href);

  assert.strictEqual(resolveRedirectPath(pendingStudent), '/dashboard/student');
  assert.strictEqual(
    resolveRedirectPath({
      role: 'provider',
      isOnboarded: true,
      verificationStatus: 'Rejected',
    }),
    '/dashboard/provider/verification'
  );
  assert.strictEqual(
    resolveRedirectPath({
      role: 'provider',
      isOnboarded: true,
      verificationStatus: 'Rejected',
      isFinalRejection: true,
    }),
    '/auth?mode=signin'
  );

  const approvedRequest = authenticatedRequest(approvedStudent);
  const approvedAccess = await runMiddleware(studentGate, approvedRequest);
  assert.strictEqual(approvedAccess.nextCalled, true);
  assert.strictEqual(resolveRedirectPath(approvedStudent), '/dashboard/student');

  const activeRequest = authenticatedRequest(onboardedStudent);
  const activeAccess = await runMiddleware(studentGate, activeRequest);
  assert.strictEqual(activeAccess.nextCalled, true);
  assert.strictEqual(resolveRedirectPath(onboardedStudent), '/dashboard/student');
  assert.notStrictEqual(activeRequest.token, pendingRequest.token);

  const providerGate = authorize('provider');
  const providerAccess = await runMiddleware(providerGate, {
    user: { role: 'provider', status: 'active', isOnboarded: true },
  });
  assert.strictEqual(providerAccess.nextCalled, true);

  const providerId = '507f1f77bcf86cd799439011';
  User.findById = () => ({
    select: async () => ({
      _id: providerId,
      id: providerId,
      role: 'provider',
      status: 'active',
    }),
  });

  const rejectedToken = jwt.sign({ id: providerId, role: 'provider' }, secret, {
    expiresIn: '1h',
  });
  const rejectedRequest = {
    headers: { authorization: `Bearer ${rejectedToken}` },
    cookies: {},
    method: 'GET',
    originalUrl: '/api/v1/providers/dashboard',
  };

  Provider.findOne = () => ({
    select: async () => ({
      verificationStatus: 'Rejected',
      rejectionReason: 'Missing permit',
      isFinalRejection: false,
    }),
  });
  const resubmittableSession = await runMiddleware(protect, rejectedRequest);
  assert.strictEqual(resubmittableSession.nextCalled, true);

  Provider.findOne = () => ({
    select: async () => ({
      verificationStatus: 'Rejected',
      rejectionReason: 'Missing permit',
      isFinalRejection: true,
    }),
  });
  const rejectedSession = await runMiddleware(protect, rejectedRequest);
  assert.strictEqual(rejectedSession.nextCalled, false);
  assert.strictEqual(rejectedSession.statusCode, 403);
  assert.match(rejectedSession.body.message, /declined|rejected/i);

  const rejectedLogout = await runMiddleware(protect, {
    ...rejectedRequest,
    originalUrl: '/api/v1/auth/logout',
  });
  assert.strictEqual(rejectedLogout.nextCalled, true);

  Provider.findOne = () => ({
    select: async () => ({
      verificationStatus: 'Verified',
      rejectionReason: null,
    }),
  });
  const verifiedSession = await runMiddleware(protect, rejectedRequest);
  assert.strictEqual(verifiedSession.nextCalled, true);

  console.log('pending consent access tests passed');
};

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
