const assert = require('assert');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Provider = require('../models/Provider');
const Scholarship = require('../models/Scholarship');
const scholarshipController = require('../controllers/scholarshipController');
const searchSync = require('../services/scholarshipSearchSync');
const { protect, authorize } = require('../middleware/auth');
const scholarshipRoutes = require('../routes/scholarshipRoutes');
const { manilaCalendarDate } = require('../utils/scholarshipInputValidation');

const UNEXPECTED_ERROR_MESSAGE = 'Unable to complete this request. Please try again.';
const secret = process.env.JWT_SECRET || 'fallback_secret';

const originals = {
  userFindById: User.findById,
  providerFindOne: Provider.findOne,
  scholarshipFindOne: Scholarship.findOne,
  scholarshipFind: Scholarship.find,
  scholarshipCreate: Scholarship.create,
  sync: searchSync.syncScholarshipSearch
};

const restore = () => {
  User.findById = originals.userFindById;
  Provider.findOne = originals.providerFindOne;
  Scholarship.findOne = originals.scholarshipFindOne;
  Scholarship.find = originals.scholarshipFind;
  Scholarship.create = originals.scholarshipCreate;
  searchSync.syncScholarshipSearch = originals.sync;
};

const mockRes = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

const owner = {
  _id: 'provider-owner',
  id: 'provider-owner',
  role: 'provider',
  status: 'active',
  verificationStatus: 'Verified'
};

const otherProvider = {
  _id: 'provider-other',
  id: 'provider-other',
  role: 'provider',
  status: 'active',
  verificationStatus: 'Verified'
};

const student = {
  _id: 'student-1',
  id: 'student-1',
  role: 'student',
  status: 'active'
};

const ownedListing = {
  _id: 'sch-owner',
  providerId: owner._id,
  name: 'Owner Listing',
  description: 'Owned by provider-owner',
  deadline: '2026-12-31',
  applicationURL: 'https://provider.gov.ph/apply',
  status: 'Open',
  isArchived: false,
  async save() {
    return this;
  }
};

const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role, status: user.status }, secret, {
    expiresIn: '1h'
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

const runHandlers = (handlers, req) =>
  new Promise((resolve, reject) => {
    const res = mockRes();
    res.json = function json(body) {
      this.body = body;
      resolve({
        nextCalled: false,
        statusCode: this.statusCode || 200,
        body
      });
      return this;
    };

    let index = 0;
    const next = (error) => {
      if (error) {
        reject(error);
        return;
      }

      const handler = handlers[index++];
      if (!handler) {
        resolve({
          nextCalled: true,
          statusCode: res.statusCode || 200,
          body: res.body
        });
        return;
      }

      Promise.resolve(handler(req, res, next)).catch(reject);
    };

    next();
  });

const runRoute = (method, routePath, req) => {
  const layer = scholarshipRoutes.stack.find(
    (entry) =>
      entry.route &&
      entry.route.path === routePath &&
      entry.route.methods[method]
  );

  assert.ok(layer, `Missing ${method.toUpperCase()} ${routePath}`);
  return runHandlers(
    layer.route.stack.map((entry) => entry.handle),
    req
  );
};

const mockUser = (user) => {
  User.findById = () => ({
    select: async () => user
  });
};

const mockProvider = (providers) => {
  Provider.findOne = (query) => {
    const userId = String(query?.userId || '');
    const doc =
      providers.find((provider) => String(provider._id) === userId) || null;
    const promise = Promise.resolve(doc);
    promise.select = async () =>
      doc
        ? {
            verificationStatus: doc.verificationStatus,
            rejectionReason: doc.rejectionReason || null
          }
        : null;
    return promise;
  };
};

const mockOwnedScholarship = () => {
  Scholarship.findOne = async (query) => {
    if (String(query?._id) !== String(ownedListing._id)) {
      return null;
    }

    if (
      query?.providerId !== undefined &&
      String(query.providerId) !== String(ownedListing.providerId)
    ) {
      return null;
    }

    return ownedListing;
  };
};

const validCreateBody = () => ({
  name: 'Access Test Listing',
  scholarshipType: 'Merit-Based',
  description: 'Used only for authorization tests.',
  grantValue: '10000',
  deadline: '2026-12-31',
  applicationURL: 'https://provider.gov.ph/apply',
  hardFilters: {
    academicLevel: 'College',
    citizenshipStatus: 'Filipino',
    geographicLocation: {
      scope: 'Nationwide',
      regions: [],
      provinces: [],
      municipalities: []
    }
  }
});

const assertNoSecrets = (body) => {
  const serialized = JSON.stringify(body);
  assert.doesNotMatch(serialized, /mongodb(?:\+srv)?:\/\//i);
  assert.doesNotMatch(serialized, /ECONNREFUSED/i);
  assert.doesNotMatch(serialized, /secret mongo/i);
};

const runRouteGuardTests = async () => {
  const providerOnly = [
    ['post', '/'],
    ['put', '/:id'],
    ['patch', '/:id/status'],
    ['patch', '/:id/archive'],
    ['get', '/my']
  ];

  providerOnly.forEach(([method, routePath]) => {
    const names = handlersFor(scholarshipRoutes, method, routePath);
    assert.ok(names.includes('protect'), `${method} ${routePath} must use protect`);
    assert.ok(
      names.includes('authorizeRequest'),
      `${method} ${routePath} must use authorize`
    );
  });

  const studentGet = handlersFor(scholarshipRoutes, 'get', '/:id');
  assert.ok(studentGet.includes('protect'));
  assert.ok(studentGet.includes('authorizeRequest'));

  const unauthenticatedCreate = await runRoute('post', '/', {
    headers: {},
    cookies: {},
    body: validCreateBody()
  });
  assert.equal(unauthenticatedCreate.statusCode, 401);
  assert.equal(unauthenticatedCreate.nextCalled, false);

  const unauthenticatedUpdate = await runRoute('put', '/:id', {
    headers: {},
    cookies: {},
    params: { id: ownedListing._id },
    body: { description: 'Should not save' }
  });
  assert.equal(unauthenticatedUpdate.statusCode, 401);

  mockUser(null);
  const missingUser = await runRoute('post', '/', {
    headers: { authorization: `Bearer ${signToken(owner)}` },
    cookies: {},
    body: validCreateBody()
  });
  assert.equal(missingUser.statusCode, 401);

  const invalidToken = await runRoute('put', '/:id', {
    headers: { authorization: 'Bearer not-a-valid-token' },
    cookies: {},
    params: { id: ownedListing._id },
    body: { description: 'Should not save' }
  });
  assert.equal(invalidToken.statusCode, 401);

  mockUser(student);
  const studentCreate = await runRoute('post', '/', {
    headers: { authorization: `Bearer ${signToken(student)}` },
    cookies: {},
    user: student,
    body: validCreateBody()
  });
  assert.equal(studentCreate.statusCode, 403);
  assert.match(studentCreate.body.message, /do not have permission/i);

  const studentUpdate = await runRoute('put', '/:id', {
    headers: { authorization: `Bearer ${signToken(student)}` },
    cookies: {},
    params: { id: ownedListing._id },
    body: { description: 'Student edit' }
  });
  assert.equal(studentUpdate.statusCode, 403);

  const studentArchive = await runRoute('patch', '/:id/archive', {
    headers: { authorization: `Bearer ${signToken(student)}` },
    cookies: {},
    params: { id: ownedListing._id }
  });
  assert.equal(studentArchive.statusCode, 403);

  const studentMayView = await runHandlers([authorize('provider', 'student')], {
    user: student
  });
  assert.equal(studentMayView.nextCalled, true);

  const studentBlockedFromProvider = await runHandlers(
    [authorize('provider')],
    { user: student }
  );
  assert.equal(studentBlockedFromProvider.statusCode, 403);
};

const runOwnershipTests = async () => {
  mockUser(otherProvider);
  mockProvider([owner, otherProvider]);
  mockOwnedScholarship();
  searchSync.syncScholarshipSearch = async () => ({ synchronized: true });

  ownedListing.description = 'Owned by provider-owner';
  ownedListing.isArchived = false;
  let saveCount = 0;
  ownedListing.save = async function save() {
    saveCount += 1;
    return this;
  };

  const crossUpdate = await runRoute('put', '/:id', {
    headers: { authorization: `Bearer ${signToken(otherProvider)}` },
    cookies: {},
    params: { id: ownedListing._id },
    user: otherProvider,
    body: { description: 'Hijacked description' }
  });
  assert.equal(crossUpdate.statusCode, 404);
  assert.equal(saveCount, 0);
  assert.equal(ownedListing.description, 'Owned by provider-owner');

  const crossArchive = await runRoute('patch', '/:id/archive', {
    headers: { authorization: `Bearer ${signToken(otherProvider)}` },
    cookies: {},
    params: { id: ownedListing._id },
    user: otherProvider
  });
  assert.equal(crossArchive.statusCode, 404);
  assert.equal(ownedListing.isArchived, false);
  assert.equal(saveCount, 0);

  const crossStatus = await runRoute('patch', '/:id/status', {
    headers: { authorization: `Bearer ${signToken(otherProvider)}` },
    cookies: {},
    params: { id: ownedListing._id },
    user: otherProvider,
    body: { status: 'Closed' }
  });
  assert.equal(crossStatus.statusCode, 404);
  assert.equal(ownedListing.status, 'Open');
};

const runVerificationPolicyTests = async () => {
  const pendingProvider = {
    _id: 'provider-pending',
    id: 'provider-pending',
    role: 'provider',
    status: 'active',
    verificationStatus: 'Pending Review'
  };

  mockProvider([pendingProvider]);
  Scholarship.create = async () => {
    throw new Error('unverified providers must not create scholarships');
  };

  const pendingCreate = mockRes();
  await scholarshipController.createScholarship(
    { user: { id: pendingProvider.id }, body: validCreateBody() },
    pendingCreate
  );
  assert.equal(pendingCreate.statusCode, 403);
  assert.match(pendingCreate.body.message, /Only verified providers/);

  const pendingListing = {
    ...ownedListing,
    providerId: pendingProvider._id,
    description: 'Existing listing',
    async save() {
      this.description = 'Edited while pending';
      return this;
    }
  };
  Scholarship.findOne = async () => pendingListing;

  const pendingUpdate = mockRes();
  await scholarshipController.updateScholarship(
    {
      user: { id: pendingProvider.id },
      params: { id: pendingListing._id },
      body: { description: 'Edited while pending' }
    },
    pendingUpdate
  );
  assert.equal(pendingUpdate.statusCode, 200);
  assert.equal(pendingListing.description, 'Edited while pending');
};

const runUnexpectedErrorTests = async () => {
  const secretError = new Error(
    'secret mongo mongodb://user:pass@localhost:27017 ECONNREFUSED'
  );
  const logged = [];
  const originalError = console.error;
  console.error = (...args) => {
    logged.push(args);
  };

  try {
  mockProvider([owner]);

  Provider.findOne = async () => {
    throw secretError;
  };

  const listRes = mockRes();
  await scholarshipController.getMyScholarships(
    { user: { id: owner.id } },
    listRes
  );
  assert.equal(listRes.statusCode, 500);
  assert.equal(listRes.body.message, UNEXPECTED_ERROR_MESSAGE);
  assertNoSecrets(listRes.body);

  mockProvider([owner]);
  Scholarship.findOne = async () => {
    throw secretError;
  };

  const detailRes = mockRes();
  await scholarshipController.getScholarshipById(
    { user: { id: owner.id, role: 'provider' }, params: { id: ownedListing._id } },
    detailRes
  );
  assert.equal(detailRes.statusCode, 500);
  assert.equal(detailRes.body.message, UNEXPECTED_ERROR_MESSAGE);
  assertNoSecrets(detailRes.body);

  mockProvider([owner]);
  mockOwnedScholarship();
  ownedListing.save = async () => {
    throw secretError;
  };

  const statusRes = mockRes();
  await scholarshipController.updateScholarshipStatus(
    {
      user: { id: owner.id },
      params: { id: ownedListing._id },
      body: { status: 'Closed' }
    },
    statusRes
  );
  assert.equal(statusRes.statusCode, 500);
  assert.equal(statusRes.body.message, UNEXPECTED_ERROR_MESSAGE);
  assertNoSecrets(statusRes.body);

  const archiveRes = mockRes();
  await scholarshipController.archiveScholarship(
    { user: { id: owner.id }, params: { id: ownedListing._id } },
    archiveRes
  );
  assert.equal(archiveRes.statusCode, 500);
  assert.equal(archiveRes.body.message, UNEXPECTED_ERROR_MESSAGE);
  assertNoSecrets(archiveRes.body);

  mockOwnedScholarship();
  const invalidStatus = mockRes();
  await scholarshipController.updateScholarshipStatus(
    {
      user: { id: owner.id },
      params: { id: ownedListing._id },
      body: { status: 'Archived' }
    },
    invalidStatus
  );
  assert.equal(invalidStatus.statusCode, 400);
  assert.match(invalidStatus.body.message, /Open or Closed/);

  ownedListing.isArchived = true;
  const repeatArchive = mockRes();
  await scholarshipController.archiveScholarship(
    { user: { id: owner.id }, params: { id: ownedListing._id } },
    repeatArchive
  );
  assert.equal(repeatArchive.statusCode, 400);
  ownedListing.isArchived = false;

  const validationError = new Error(
    'At least one academic grading scale requirement is required.'
  );
  validationError.name = 'ValidationError';
  validationError.errors = {
    academicRequirements: {
      message: 'At least one academic grading scale requirement is required.'
    }
  };
  ownedListing.save = async () => {
    throw validationError;
  };
  const statusValidation = mockRes();
  await scholarshipController.updateScholarshipStatus(
    {
      user: { id: owner.id },
      params: { id: ownedListing._id },
      body: { status: 'Closed' }
    },
    statusValidation
  );
  assert.equal(statusValidation.statusCode, 400);
  assert.match(statusValidation.body.message, /grading scale requirement/);
  assert.ok(logged.length > 0);
  assert.ok(
    logged.some((args) => String(args[0]).includes('Error')),
    'unexpected errors must be logged server-side'
  );
  } finally {
    console.error = originalError;
  }
};

const main = async () => {
  try {
    await runRouteGuardTests();
    await runOwnershipTests();
    await runVerificationPolicyTests();
    await runUnexpectedErrorTests();
    assert.equal(typeof manilaCalendarDate(new Date()), 'string');
    console.log('scholarship access tests passed');
  } finally {
    restore();
  }
};

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    restore();
    console.error(error);
    process.exit(1);
  });
