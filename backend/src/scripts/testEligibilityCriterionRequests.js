const assert = require('assert');
const fs = require('fs');
const path = require('path');

const EligibilityCriterionRequest = require('../models/EligibilityCriterionRequest');
const Provider = require('../models/Provider');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const emailService = require('../utils/emailService');
const adminRoutes = require('../routes/adminRoutes');
const providerRoutes = require('../routes/providerRoutes');
const {
  createEligibilityCriterionRequest,
  getMyEligibilityCriterionRequests,
  getMyEligibilityCriterionRequest,
  getEligibilityCriterionRequests,
  reviewEligibilityCriterionRequest,
  updateEligibilityCriterionFulfillment,
} = require('../controllers/eligibilityCriterionRequestController');

const originals = {
  create: EligibilityCriterionRequest.create,
  find: EligibilityCriterionRequest.find,
  findOne: EligibilityCriterionRequest.findOne,
  findById: EligibilityCriterionRequest.findById,
  providerFindOne: Provider.findOne,
  providerFindById: Provider.findById,
  userFindById: User.findById,
  auditCreate: AuditLog.create,
  completionEmail: emailService.sendEligibilityCriterionCompletedEmail,
};

const db = {
  requests: [],
  providers: [],
};

const providerUserId = (provider) => {
  const linked = provider && provider.userId;
  if (linked && typeof linked === 'object') return String(linked._id || linked.id || '');
  return String(linked || '');
};

const matches = (doc, query = {}) =>
  Object.entries(query).every(([key, expected]) => {
    if (expected instanceof RegExp) return expected.test(String(doc[key] || ''));
    return String(doc[key]) === String(expected);
  });

let sequence = 1;
let findCalls = 0;

const installStubs = () => {
  EligibilityCriterionRequest.create = async (data) => {
    const doc = {
      _id: `request-${sequence++}`,
      rejectionReason: null,
      reviewedAt: null,
      reviewedBy: null,
      completionEmailSentAt: null,
      createdAt: new Date('2026-10-28T03:00:00.000Z'),
      updatedAt: new Date('2026-10-28T03:00:00.000Z'),
      saveCount: 0,
      ...data,
      async save() {
        this.saveCount += 1;
        this.updatedAt = new Date();
        return this;
      },
    };
    db.requests.push(doc);
    return doc;
  };

  EligibilityCriterionRequest.find = (filter) => {
    findCalls += 1;
    const docs = db.requests.filter((doc) => matches(doc, filter));
    return {
      sort: async () => docs.slice().sort((left, right) => right.createdAt - left.createdAt),
    };
  };

  EligibilityCriterionRequest.findOne = async (filter) =>
    db.requests.find((doc) => matches(doc, filter)) || null;

  EligibilityCriterionRequest.findById = async (id) =>
    db.requests.find((doc) => String(doc._id) === String(id)) || null;

  Provider.findOne = async (filter) =>
    db.providers.find((provider) => providerUserId(provider) === String(filter.userId)) || null;

  Provider.findById = (id) => ({
    populate: async () =>
      db.providers.find((provider) => String(provider._id) === String(id)) || null,
  });

  User.findById = async (id) => {
    const users = {
      'user-a': { _id: 'user-a', email: 'a.registered@example.com', name: 'Provider A' },
      'user-b': { _id: 'user-b', email: 'b.registered@example.com', name: 'Provider B' },
      'user-missing': { _id: 'user-missing', name: 'No Mail Provider' },
    };
    return users[String(id)] || null;
  };

  AuditLog.create = async () => ({ _id: 'audit-1' });
};

const restore = () => {
  EligibilityCriterionRequest.create = originals.create;
  EligibilityCriterionRequest.find = originals.find;
  EligibilityCriterionRequest.findOne = originals.findOne;
  EligibilityCriterionRequest.findById = originals.findById;
  Provider.findOne = originals.providerFindOne;
  Provider.findById = originals.providerFindById;
  User.findById = originals.userFindById;
  AuditLog.create = originals.auditCreate;
  emailService.sendEligibilityCriterionCompletedEmail = originals.completionEmail;
};

const mockRes = () => ({
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
});

const invoke = (handler, req) =>
  new Promise((resolve, reject) => {
    const res = mockRes();
    Promise.resolve(handler(req, res, (error) => error))
      .then(() => {
        resolve({
          statusCode: res.statusCode,
          body: res.body,
        });
      })
      .catch(reject);
  });

const providerUser = (id, role = 'provider') => ({
  id,
  role,
  email: `${id}@example.com`,
  name: id,
});

const requestFor = (user, body = {}, params = {}, query = {}) => ({
  user,
  body,
  params,
  query,
  ip: '127.0.0.1',
  headers: {},
});

const routeMethods = (router, routePath) => {
  const methods = new Set();

  for (const entry of router.stack) {
    if (!entry.route || entry.route.path !== routePath) continue;

    for (const method of Object.keys(entry.route.methods)) {
      if (entry.route.methods[method] && method !== 'head') methods.add(method);
    }
  }

  return [...methods].sort();
};

const runAdminGate = (user) =>
  new Promise((resolve) => {
    const gates = adminRoutes.stack.filter((layer) => !layer.route && layer.handle);
    const gate = gates[gates.length - 1];
    const res = mockRes();
    let settled = false;
    gate.handle({ user }, res, () => {
      if (settled) return;
      settled = true;
      resolve({ nextCalled: true, statusCode: res.statusCode, body: res.body });
    });
    if (!settled && res.body) {
      settled = true;
      resolve({ nextCalled: false, statusCode: res.statusCode, body: res.body });
    }
  });

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const seedProviders = () => {
  db.providers.push(
    {
      _id: 'provider-a',
      userId: 'user-a',
      institutionName: 'Alpha Foundation',
      representative: { workEmail: 'a.work@example.org' },
    },
    {
      _id: 'provider-b',
      userId: 'user-b',
      institutionName: 'Beta College',
      representative: { workEmail: 'b.work@example.org' },
    },
    {
      _id: 'provider-missing',
      userId: 'user-missing',
      institutionName: 'No Mail Org',
      representative: { workEmail: 'missing.work@example.org' },
    }
  );
};

const main = async () => {
  installStubs();
  seedProviders();

  const sent = [];
  emailService.sendEligibilityCriterionCompletedEmail = async (payload) => {
    sent.push(payload);
    return { id: `completion-${sent.length}` };
  };

  const providerA = providerUser('user-a');
  const providerB = providerUser('user-b');
  const providerMissing = providerUser('user-missing');
  const admin = { id: 'admin-1', role: 'admin', email: 'admin@example.com', name: 'Review Admin' };
  const superadmin = { id: 'super-1', role: 'superadmin', email: 'super@example.com', name: 'Super Admin' };
  const student = { id: 'student-1', role: 'student', email: 'student@example.com', name: 'Student' };

  await test('provider and admin routes expose the criterion workflow without a provider update route', async () => {
    assert.deepStrictEqual(routeMethods(providerRoutes, '/eligibility-criterion-requests'), ['get', 'post']);
    assert.deepStrictEqual(routeMethods(providerRoutes, '/eligibility-criterion-requests/:id'), ['get']);
    assert.deepStrictEqual(routeMethods(providerRoutes, '/eligibility-criterion-requests/:id/fulfillment'), []);
    assert.deepStrictEqual(routeMethods(adminRoutes, '/eligibility-criterion-requests'), ['get']);
    assert.deepStrictEqual(
      routeMethods(adminRoutes, '/eligibility-criterion-requests/:id/decision'),
      ['patch']
    );
    assert.deepStrictEqual(
      routeMethods(adminRoutes, '/eligibility-criterion-requests/:id/fulfillment'),
      ['patch']
    );

    const providerGet = providerRoutes.stack.find(
      (entry) => entry.route && entry.route.path === '/eligibility-criterion-requests/:id'
    );
    const handlerNames = providerGet.route.stack.map((entry) => entry.handle.name);
    assert.ok(handlerNames.includes('protect'));
    assert.ok(handlerNames.includes('authorizeRequest'));
    assert.ok(
      providerGet.route.stack.some((entry) => entry.handle === getMyEligibilityCriterionRequest)
    );

    const deniedProvider = await runAdminGate(providerA);
    assert.equal(deniedProvider.nextCalled, false);
    assert.equal(deniedProvider.statusCode, 403);

    const deniedStudent = await runAdminGate(student);
    assert.equal(deniedStudent.statusCode, 403);

    const allowedAdmin = await runAdminGate(admin);
    assert.equal(allowedAdmin.nextCalled, true);
  });

  await test('provider submission creates a Pending request owned by the authenticated provider', async () => {
    const created = await invoke(
      createEligibilityCriterionRequest,
      requestFor(providerA, {
        providerId: 'provider-b',
        status: 'Done',
        fulfillmentStatus: 'Done',
        criterionName: '  Barangay Scholar  ',
        criterionType: 'Exclusive Tag',
        description: 'Students who reside in the listed barangay.',
      })
    );

    assert.equal(created.statusCode, 201);
    assert.equal(created.body.request.status, 'Pending');
    assert.equal(created.body.request.fulfillmentStatus, null);
    assert.equal(created.body.request.criterionName, 'Barangay Scholar');
    assert.equal(sent.length, 0);

    const stored = db.requests.find((request) => request.criterionName === 'Barangay Scholar');
    assert.equal(stored.providerId, 'provider-a');
    assert.equal(stored.status, 'Pending');
    assert.equal(stored.fulfillmentStatus, 'Pending');
  });

  await test('each supported classification is saved with its canonical label', async () => {
    const cases = [
      ['Preferred Tag', 'Community Volunteer'],
      ['Exclusive Tag', 'First Generation College'],
      ['Hard Eligibility Tag', 'Mountain School Graduate'],
      ['Preferred Eligibility', 'Legacy Preferred Alias'],
      ['Required Eligibility', 'Legacy Exclusive Alias'],
      ['Hard Requirement', 'Legacy Hard Alias'],
    ];

    for (const [criterionType, criterionName] of cases) {
      const created = await invoke(
        createEligibilityCriterionRequest,
        requestFor(providerA, {
          criterionName,
          criterionType,
          description: `Needed for ${criterionName}.`,
        })
      );
      assert.equal(created.statusCode, 201, criterionType);
      const stored = db.requests.find((request) => request.criterionName === criterionName);
      const expected =
        criterionType === 'Preferred Eligibility'
          ? 'Preferred Tag'
          : criterionType === 'Required Eligibility'
            ? 'Exclusive Tag'
            : criterionType === 'Hard Requirement'
              ? 'Hard Eligibility Tag'
              : criterionType;
      assert.equal(stored.criterionType, expected);
      assert.equal(stored.status, 'Pending');
    }

    const duplicate = await invoke(
      createEligibilityCriterionRequest,
      requestFor(providerA, {
        criterionName: 'working student',
        criterionType: 'Preferred Tag',
        description: 'This tag already exists.',
      })
    );
    assert.equal(duplicate.statusCode, 400);
    assert.equal(
      db.requests.some((request) => request.criterionName.toLowerCase() === 'working student'),
      false
    );
  });

  await test('the request appears in the admin queue with provider and submission details', async () => {
    const queued = await invoke(getEligibilityCriterionRequests, requestFor(admin));
    assert.equal(queued.statusCode, 200);
    const item = queued.body.requests.find((request) => request.criterionName === 'Barangay Scholar');
    assert.ok(item);
    assert.equal(item.criterionType, 'Exclusive Tag');
    assert.equal(item.status, 'Pending');
    assert.equal(item.provider.institutionName, 'Alpha Foundation');
    assert.equal(item.provider.accountEmail, 'a.registered@example.com');
    assert.notEqual(item.provider.accountEmail, 'a.work@example.org');
    assert.ok(item.createdAt);

    const hidden = await invoke(getEligibilityCriterionRequests, requestFor(providerA));
    assert.equal(hidden.statusCode, 403);
  });

  let barangayId;
  await test('admin approval and rejection keep the existing authorization rules', async () => {
    barangayId = db.requests.find((request) => request.criterionName === 'Barangay Scholar')._id;
    const legacyHard = db.requests.find((request) => request.criterionName === 'Legacy Hard Alias');

    const unauthenticated = await invoke(
      reviewEligibilityCriterionRequest,
      requestFor(null, { decision: 'Approved' }, { id: barangayId })
    );
    assert.equal(unauthenticated.statusCode, 401);

    const asProvider = await invoke(
      reviewEligibilityCriterionRequest,
      requestFor(providerA, { decision: 'Approved' }, { id: barangayId })
    );
    assert.equal(asProvider.statusCode, 403);

    const asStudent = await invoke(
      reviewEligibilityCriterionRequest,
      requestFor(student, { decision: 'Rejected', rejectionReason: 'No' }, { id: barangayId })
    );
    assert.equal(asStudent.statusCode, 403);

    const missingReason = await invoke(
      reviewEligibilityCriterionRequest,
      requestFor(admin, { decision: 'Rejected' }, { id: legacyHard._id })
    );
    assert.equal(missingReason.statusCode, 400);
    assert.equal(legacyHard.status, 'Pending');

    const rejected = await invoke(
      reviewEligibilityCriterionRequest,
      requestFor(
        admin,
        { decision: 'Rejected', rejectionReason: 'This group is already covered by location filters.' },
        { id: legacyHard._id }
      )
    );
    assert.equal(rejected.statusCode, 200);
    assert.equal(rejected.body.request.status, 'Rejected');
    assert.equal(
      rejected.body.request.rejectionReason,
      'This group is already covered by location filters.'
    );
    assert.equal(sent.length, 0);

    const approved = await invoke(
      reviewEligibilityCriterionRequest,
      requestFor(superadmin, { decision: 'Approved' }, { id: barangayId })
    );
    assert.equal(approved.statusCode, 200);
    assert.equal(approved.body.request.status, 'Approved');
    assert.equal(approved.body.request.fulfillmentStatus, 'Pending');
    assert.notEqual(approved.body.request.fulfillmentStatus, 'Done');
    assert.equal(sent.length, 0);

    const secondDecision = await invoke(
      reviewEligibilityCriterionRequest,
      requestFor(admin, { decision: 'Rejected', rejectionReason: 'Changed our mind.' }, { id: barangayId })
    );
    assert.equal(secondDecision.statusCode, 400);
    assert.equal(db.requests.find((request) => request._id === barangayId).status, 'Approved');
  });

  await test('rejection reasons are saved and visible only to the requesting provider', async () => {
    const rejected = db.requests.find((request) => request.criterionName === 'Legacy Hard Alias');
    const ownList = await invoke(getMyEligibilityCriterionRequests, requestFor(providerA, {}, {}, {
      providerId: 'provider-b',
    }));
    assert.equal(ownList.statusCode, 200);
    const visible = ownList.body.requests.find((request) => request._id === rejected._id);
    assert.equal(visible.rejectionReason, 'This group is already covered by location filters.');
    assert.equal(
      ownList.body.requests.some((request) => request.providerId === 'provider-b'),
      false
    );

    const ownItem = await invoke(
      getMyEligibilityCriterionRequest,
      requestFor(providerA, {}, { id: rejected._id }, { providerId: 'provider-b' })
    );
    assert.equal(ownItem.statusCode, 200);
    assert.equal(ownItem.body.request.rejectionReason, visible.rejectionReason);

    const otherProvider = await invoke(
      createEligibilityCriterionRequest,
      requestFor(providerB, {
        criterionName: 'Beta Only Tag',
        criterionType: 'Preferred Tag',
        description: 'Belongs to provider B.',
      })
    );
    assert.equal(otherProvider.statusCode, 201);

    const crossRead = await invoke(
      getMyEligibilityCriterionRequest,
      requestFor(providerA, {}, { id: otherProvider.body.request._id })
    );
    assert.equal(crossRead.statusCode, 404);
    assert.equal(JSON.stringify(crossRead.body).includes('Beta Only Tag'), false);

    const listWithoutCrossAccess = await invoke(
      getMyEligibilityCriterionRequests,
      requestFor(providerA)
    );
    assert.equal(
      listWithoutCrossAccess.body.requests.some((request) => request.criterionName === 'Beta Only Tag'),
      false
    );

    const crossUpdate = await invoke(
      updateEligibilityCriterionFulfillment,
      requestFor(providerA, { fulfillmentStatus: 'Done', providerId: 'provider-a' }, { id: barangayId })
    );
    assert.equal(crossUpdate.statusCode, 403);
    assert.equal(db.requests.find((request) => request._id === barangayId).fulfillmentStatus, 'Pending');
  });

  await test('approved requests move Pending to In Progress to Done, and invalid transitions are rejected', async () => {
    const stored = db.requests.find((request) => request._id === barangayId);
    const beforeEmails = sent.length;

    const skipDone = await invoke(
      updateEligibilityCriterionFulfillment,
      requestFor(admin, { fulfillmentStatus: 'Done' }, { id: barangayId })
    );
    assert.equal(skipDone.statusCode, 400);
    assert.equal(stored.fulfillmentStatus, 'Pending');
    assert.equal(sent.length, beforeEmails);

    const samePending = await invoke(
      updateEligibilityCriterionFulfillment,
      requestFor(admin, { fulfillmentStatus: 'Pending' }, { id: barangayId })
    );
    assert.equal(samePending.statusCode, 400);

    const inProgress = await invoke(
      updateEligibilityCriterionFulfillment,
      requestFor(admin, { fulfillmentStatus: 'In Progress' }, { id: barangayId })
    );
    assert.equal(inProgress.statusCode, 200);
    assert.equal(inProgress.body.request.fulfillmentStatus, 'In Progress');
    assert.equal(sent.length, beforeEmails);

    const backward = await invoke(
      updateEligibilityCriterionFulfillment,
      requestFor(admin, { fulfillmentStatus: 'Pending' }, { id: barangayId })
    );
    assert.equal(backward.statusCode, 400);
    assert.equal(stored.fulfillmentStatus, 'In Progress');

    const unapproved = db.requests.find((request) => request.criterionName === 'Community Volunteer');
    const blocked = await invoke(
      updateEligibilityCriterionFulfillment,
      requestFor(admin, { fulfillmentStatus: 'In Progress' }, { id: unapproved._id })
    );
    assert.equal(blocked.statusCode, 400);
    assert.equal(unapproved.fulfillmentStatus, 'Pending');

    const rejected = db.requests.find((request) => request.criterionName === 'Legacy Hard Alias');
    const rejectedMove = await invoke(
      updateEligibilityCriterionFulfillment,
      requestFor(admin, { fulfillmentStatus: 'Done' }, { id: rejected._id })
    );
    assert.equal(rejectedMove.statusCode, 400);
    assert.equal(rejected.status, 'Rejected');

    const done = await invoke(
      updateEligibilityCriterionFulfillment,
      requestFor(admin, { fulfillmentStatus: 'Done', email: 'a.work@example.org' }, { id: barangayId })
    );
    assert.equal(done.statusCode, 200);
    assert.equal(done.body.success, true);
    assert.equal(done.body.request.fulfillmentStatus, 'Done');
    assert.equal(done.body.email.sent, true);
    assert.equal(sent.length, beforeEmails + 1);
    assert.equal(sent.at(-1).email, 'a.registered@example.com');
    assert.notEqual(sent.at(-1).email, 'a.work@example.org');
    assert.match(sent.at(-1).criterionName, /Barangay Scholar/);

    const providerView = await invoke(
      getMyEligibilityCriterionRequest,
      requestFor(providerA, {}, { id: barangayId })
    );
    assert.equal(providerView.body.request.status, 'Approved');
    assert.equal(providerView.body.request.fulfillmentStatus, 'Done');

    const afterDone = await invoke(
      updateEligibilityCriterionFulfillment,
      requestFor(admin, { fulfillmentStatus: 'In Progress' }, { id: barangayId })
    );
    assert.equal(afterDone.statusCode, 400);
    assert.equal(stored.fulfillmentStatus, 'Done');
  });

  await test('saving Done again does not send a duplicate email', async () => {
    const before = sent.length;
    const again = await invoke(
      updateEligibilityCriterionFulfillment,
      requestFor(admin, { fulfillmentStatus: 'Done' }, { id: barangayId })
    );
    assert.equal(again.statusCode, 200);
    assert.equal(again.body.email.sent, false);
    assert.equal(again.body.email.skipped, 'already-sent');
    assert.equal(sent.length, before);
  });

  await test('email failure does not undo the saved Done status', async () => {
    const target = db.requests.find((request) => request.criterionName === 'First Generation College');
    await invoke(
      reviewEligibilityCriterionRequest,
      requestFor(admin, { decision: 'Approved' }, { id: target._id })
    );
    await invoke(
      updateEligibilityCriterionFulfillment,
      requestFor(admin, { fulfillmentStatus: 'In Progress' }, { id: target._id })
    );

    let failures = 0;
    emailService.sendEligibilityCriterionCompletedEmail = async () => {
      failures += 1;
      throw new Error('mailbox unavailable');
    };

    const done = await invoke(
      updateEligibilityCriterionFulfillment,
      requestFor(admin, { fulfillmentStatus: 'Done' }, { id: target._id })
    );

    assert.equal(done.statusCode, 200);
    assert.equal(done.body.success, true);
    assert.equal(done.body.request.fulfillmentStatus, 'Done');
    assert.equal(done.body.email.sent, false);
    assert.equal(failures, 1);
    assert.equal(target.fulfillmentStatus, 'Done');
    assert.equal(target.status, 'Approved');
    assert.equal(target.completionEmailSentAt, null);

    emailService.sendEligibilityCriterionCompletedEmail = async (payload) => {
      sent.push(payload);
      return { id: `completion-${sent.length}` };
    };
  });

  await test('completion email is not sent to a representative work email when the account email is missing', async () => {
    const created = await invoke(
      createEligibilityCriterionRequest,
      requestFor(providerMissing, {
        criterionName: 'Island School Graduate',
        criterionType: 'Hard Eligibility Tag',
        description: 'Students who graduated from an island public school.',
      })
    );
    const id = created.body.request._id;
    await invoke(
      reviewEligibilityCriterionRequest,
      requestFor(admin, { decision: 'Approved' }, { id })
    );
    await invoke(
      updateEligibilityCriterionFulfillment,
      requestFor(admin, { fulfillmentStatus: 'In Progress' }, { id })
    );

    const before = sent.length;
    const done = await invoke(
      updateEligibilityCriterionFulfillment,
      requestFor(admin, { fulfillmentStatus: 'Done' }, { id })
    );
    const stored = db.requests.find((request) => request._id === id);

    assert.equal(done.statusCode, 200);
    assert.equal(done.body.request.fulfillmentStatus, 'Done');
    assert.equal(done.body.email.sent, false);
    assert.equal(done.body.email.skipped, 'missing-account-email');
    assert.equal(sent.length, before);
    assert.equal(stored.fulfillmentStatus, 'Done');
    assert.equal(
      sent.some((message) => message.email === 'missing.work@example.org'),
      false
    );
  });

  await test('unapproved requests do not affect scholarship matching', async () => {
    const engineSource = fs.readFileSync(
      path.resolve(__dirname, '../services/matchingEngine.js'),
      'utf8'
    );
    const serviceSource = fs.readFileSync(
      path.resolve(__dirname, '../services/matchingService.js'),
      'utf8'
    );
    assert.equal(engineSource.includes('EligibilityCriterionRequest'), false);
    assert.equal(serviceSource.includes('EligibilityCriterionRequest'), false);

    const { CATALOG_INDEX } = require('../utils/courseCanonical');
    const { evaluateScholarship } = require('../services/matchingEngine');
    const now = new Date('2026-10-28T04:00:00.000Z');
    const student = {
      academicLevel: 'College',
      course: 'BSIT',
      gwa: 1.5,
      gwaScale: '1.00-5.00',
      incomeBracket: 'Below ₱10,000 / month',
      region: 'Bicol Region',
      province: 'Camarines Sur',
      municipalityCity: 'Naga City',
      citizenship: 'Filipino',
      specialEligibilityFlags: {
        isIndigenous: false,
        isPWD: false,
        isSoloParentChild: false,
        isOrphan: false,
        isFarmerFisherfolkChild: false,
        isDisasterAffected: false,
        isWorkingStudent: false,
        is4PsBeneficiary: false,
      },
    };
    const scholarship = {
      name: 'Test Scholarship',
      status: 'Open',
      isArchived: false,
      deadline: '2026-12-31',
      academicRequirements: [{ gradingScale: '1.00-5.00', minimumGPA: 2.5 }],
      hardFilters: {
        academicLevel: 'College',
        courseProgram: ['BS Information Technology'],
        geographicLocation: {
          scope: 'Nationwide',
          regions: [],
          provinces: [],
          municipalities: [],
        },
        citizenshipStatus: 'Filipino',
      },
      incomeRequirement: { maxMonthlyIncome: null },
      specialTags: [],
      criteriaWeights: { gwaWeight: 0.4, incomeWeight: 0.4, tagsWeight: 0.2 },
    };

    const pending = db.requests.find((request) => request.criterionName === 'Community Volunteer');
    assert.equal(pending.status, 'Pending');
    assert.equal(pending.criterionType, 'Preferred Tag');
    const pendingExclusive = db.requests.find((request) => request.criterionName === 'Legacy Exclusive Alias');
    assert.equal(pendingExclusive.status, 'Pending');
    assert.equal(pendingExclusive.criterionType, 'Exclusive Tag');

    findCalls = 0;
    const untouched = evaluateScholarship(student, scholarship, CATALOG_INDEX, now);
    assert.ok(untouched);
    assert.equal(untouched.tagsScore, 100);
    assert.equal(findCalls, 0);

    const preferredApplied = evaluateScholarship(
      student,
      {
        ...scholarship,
        specialTags: [{ tagName: 'Community Volunteer', mode: 'Preferred' }],
      },
      CATALOG_INDEX,
      now
    );
    assert.ok(preferredApplied);
    assert.notEqual(preferredApplied.tagsScore, untouched.tagsScore);

    const exclusiveApplied = evaluateScholarship(
      student,
      {
        ...scholarship,
        specialTags: [{ tagName: 'Legacy Exclusive Alias', mode: 'Exclusive' }],
      },
      CATALOG_INDEX,
      now
    );
    assert.equal(exclusiveApplied, null);
  });

  const built = emailService.buildEligibilityCriterionCompletedEmail({
    recipientName: 'Provider A',
    criterionName: 'Barangay Scholar',
    criterionType: 'Exclusive Tag',
    signInUrl: 'http://localhost:5173/auth?mode=signin',
  });
  assert.equal(built.subject, 'Your Eligibility Criterion Request Is Complete');
  assert.match(built.text, /Barangay Scholar/);
  assert.match(built.text, /Exclusive Tag/);
  assert.equal(built.text.includes('a.work@example.org'), false);
};

main()
  .then(() => {
    restore();
    console.log('Eligibility criterion request tests passed.');
  })
  .catch((error) => {
    restore();
    console.error(error);
    process.exit(1);
  });
