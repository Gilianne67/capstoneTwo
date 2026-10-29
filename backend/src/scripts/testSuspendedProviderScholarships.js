const assert = require('assert');
const mongoose = require('mongoose');

const User = require('../models/User');
const Provider = require('../models/Provider');
const Scholarship = require('../models/Scholarship');
const SavedMatch = require('../models/SavedMatch');
const StudentProfile = require('../models/StudentProfile');
const CourseAlias = require('../models/CourseAlias');
const Report = require('../models/Report');
const AuditLog = require('../models/AuditLog');
const matchingService = require('../services/matchingService');
const matchCache = require('../services/matchCache');
const adminController = require('../controllers/adminController');
const scholarshipController = require('../controllers/scholarshipController');
const savedScholarshipController = require('../controllers/savedScholarshipController');
const { createScholarshipReport } = require('../controllers/scholarshipReportController');
const { CATALOG_INDEX } = require('../utils/courseCanonical');
const { closeMatchingPool } = require('../services/matchingWorkerRunner');

const FIXED_NOW = new Date('2026-09-26T04:00:00.000Z');
const BELOW_10K = 'Below ₱10,000 / month';

const studentUserId = new mongoose.Types.ObjectId();
const profileId = new mongoose.Types.ObjectId();
const activeUserId = new mongoose.Types.ObjectId();
const suspendedUserId = new mongoose.Types.ObjectId();
const pendingUserId = new mongoose.Types.ObjectId();
const otherStudentId = new mongoose.Types.ObjectId();
const activeProviderId = new mongoose.Types.ObjectId();
const suspendedProviderId = new mongoose.Types.ObjectId();
const pendingProviderId = new mongoose.Types.ObjectId();
const adminId = new mongoose.Types.ObjectId();

const scholarship = (id, providerId, overrides = {}) => ({
  _id: id,
  providerId,
  name: overrides.name || String(id),
  scholarshipType: 'Merit',
  description: overrides.description || 'Information technology support.',
  status: overrides.status || 'Open',
  isArchived: overrides.isArchived === true,
  adminRemovedAt: overrides.adminRemovedAt || null,
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
});

const activeListing = scholarship(new mongoose.Types.ObjectId(), activeProviderId, {
  name: 'Active Information Technology Grant',
});
const suspendedListing = scholarship(new mongoose.Types.ObjectId(), suspendedProviderId, {
  name: 'Suspended Information Technology Grant',
});
const pendingListing = scholarship(new mongoose.Types.ObjectId(), pendingProviderId, {
  name: 'Pending Review Information Technology Grant',
});
const archivedListing = scholarship(new mongoose.Types.ObjectId(), activeProviderId, {
  name: 'Archived Information Technology Grant',
  isArchived: true,
});
const removedListing = scholarship(new mongoose.Types.ObjectId(), activeProviderId, {
  name: 'Removed Information Technology Grant',
  adminRemovedAt: new Date('2026-10-01T00:00:00.000Z'),
});
const records = [
  activeListing,
  suspendedListing,
  pendingListing,
  archivedListing,
  removedListing,
];
const listingSnapshot = JSON.stringify(records);

const account = (id, role, status) => ({
  _id: id,
  role,
  status,
  email: `${role}-${String(id).slice(-6)}@example.test`,
  firstName: role,
  lastName: 'Account',
  name: `${role} Account`,
  async save() {
    return this;
  },
});

const users = [
  account(activeUserId, 'provider', 'active'),
  account(suspendedUserId, 'provider', 'suspended'),
  account(pendingUserId, 'provider', 'active'),
  account(otherStudentId, 'student', 'active'),
];

const providers = [
  { _id: activeProviderId, userId: activeUserId, verificationStatus: 'Verified' },
  { _id: suspendedProviderId, userId: suspendedUserId, verificationStatus: 'Verified' },
  { _id: pendingProviderId, userId: pendingUserId, verificationStatus: 'Pending Review' },
];

const studentProfile = {
  _id: profileId,
  userId: studentUserId,
  academicLevel: 'College',
  course: 'BSIT',
  gwa: 1.5,
  gwaScale: '1.00-5.00',
  incomeBracket: BELOW_10K,
  region: 'Bicol Region',
  province: 'Camarines Sur',
  municipalityCity: 'Naga City',
  citizenship: 'Filipino',
  dateOfBirth: '2004-01-01',
  yearLevel: '2nd Year',
  specialEligibilityFlags: {},
};

const savedRecords = [{
  _id: new mongoose.Types.ObjectId(),
  studentProfileId: profileId,
  scholarshipId: suspendedListing._id,
  dateSaved: new Date('2026-09-01T00:00:00.000Z'),
}];

const queryOf = (value) => {
  const query = {
    select() {
      return query;
    },
    lean() {
      return Promise.resolve(value);
    },
    populate() {
      return query;
    },
    sort() {
      return Promise.resolve(value);
    },
    then(onFulfilled, onRejected) {
      return Promise.resolve(value).then(onFulfilled, onRejected);
    },
  };
  return query;
};

const matchesFilter = (doc, filter) => {
  if (filter.status && doc.status !== filter.status) return false;
  if (filter.isArchived === false && doc.isArchived === true) return false;
  if (filter.adminRemovedAt === null && doc.adminRemovedAt) return false;
  if (filter._id && Array.isArray(filter._id.$in)) {
    const ids = filter._id.$in.map(String);
    if (!ids.includes(String(doc._id))) return false;
  }
  if (filter.providerId && Array.isArray(filter.providerId.$nin)) {
    const hidden = filter.providerId.$nin.map(String);
    if (hidden.includes(String(doc.providerId))) return false;
  }
  return true;
};

const idsOf = (matches) => matches.map((match) => String(match.scholarship._id));

const responseOf = () => {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return response;
};

const callJson = (handler, req) => new Promise((resolve, reject) => {
  const res = responseOf();
  const finish = () => resolve({ statusCode: res.statusCode, body: res.body });
  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    originalJson(payload);
    finish();
    return res;
  };
  Promise.resolve(handler(req, res, (error) => {
    if (!error) {
      finish();
      return;
    }
    resolve({
      statusCode: error.statusCode || 500,
      body: { success: false, message: error.message },
    });
  })).catch(reject);
});

const memoryRedis = () => {
  const store = new Map();
  return {
    isOpen: true,
    isReady: true,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async set(key, value) {
      store.set(key, String(value));
      return 'OK';
    },
    async incr(key) {
      const next = Number(store.get(key) || 0) + 1;
      store.set(key, String(next));
      return next;
    },
  };
};

const rank = (client, query, events) => matchingService.getRankedScholarships(studentProfile, {
  now: FIXED_NOW,
  query,
  matchCacheClient: client,
  loadAliasIndex: async () => CATALOG_INDEX,
  onMatchCache: (detail) => events.push(detail.event),
  searchScholarships: async () => ({
    total: records.length,
    hits: records.map((doc) => ({ id: doc._id })),
  }),
  findScholarships: async (filter) => records.filter((doc) => matchesFilter(doc, filter)),
});

const installStubs = () => {
  const scholarshipWrites = [];
  const noteWrite = (label) => async () => {
    scholarshipWrites.push(label);
    return { acknowledged: true };
  };

  User.find = (filter = {}) => queryOf(
    users.filter((user) => !filter.status || user.status === filter.status)
  );
  User.findById = (id) => queryOf(
    users.find((user) => String(user._id) === String(id)) || null
  );
  Provider.find = (filter = {}) => {
    const allowed = filter.userId && Array.isArray(filter.userId.$in)
      ? filter.userId.$in.map(String)
      : null;
    return queryOf(providers.filter((provider) => (
      !allowed || allowed.includes(String(provider.userId))
    )));
  };
  Provider.findById = (id) => queryOf(
    providers.find((provider) => String(provider._id) === String(id)) || null
  );
  Scholarship.find = (filter = {}) => queryOf(
    records.filter((doc) => matchesFilter(doc, filter))
  );
  Scholarship.findById = (id) => queryOf(
    records.find((doc) => String(doc._id) === String(id)) || null
  );
  Scholarship.updateOne = noteWrite('updateOne');
  Scholarship.updateMany = noteWrite('updateMany');
  Scholarship.findByIdAndUpdate = noteWrite('findByIdAndUpdate');
  Scholarship.deleteOne = noteWrite('deleteOne');
  Scholarship.deleteMany = noteWrite('deleteMany');
  CourseAlias.find = () => queryOf([]);
  StudentProfile.findOne = async (query = {}) => (
    String(query.userId) === String(studentUserId) ? studentProfile : null
  );
  SavedMatch.find = () => queryOf(savedRecords.map((row) => ({
    ...row,
    scholarshipId: records.find((doc) => String(doc._id) === String(row.scholarshipId)) || null,
  })));
  SavedMatch.findOne = async (query = {}) => savedRecords.find((row) => (
    String(row.studentProfileId) === String(query.studentProfileId)
    && String(row.scholarshipId) === String(query.scholarshipId)
  )) || null;
  SavedMatch.create = async (doc) => {
    const row = {
      _id: new mongoose.Types.ObjectId(),
      studentProfileId: doc.studentProfileId,
      scholarshipId: doc.scholarshipId,
      dateSaved: new Date('2026-10-02T00:00:00.000Z'),
    };
    savedRecords.push(row);
    return row;
  };
  Report.create = async () => {
    throw new Error('A report was created for a hidden scholarship.');
  };
  AuditLog.create = async () => ({});

  return scholarshipWrites;
};

const run = async () => {
  const previousReadyState = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;
  assert.strictEqual(mongoose.connection.readyState, 1);
  const scholarshipWrites = installStubs();
  const savedCount = savedRecords.length;

  const openClient = memoryRedis();
  const openEvents = [];
  const first = await rank(openClient, '', openEvents);
  const second = await rank(openClient, '', openEvents);
  assert.deepStrictEqual(idsOf(first).sort(), [
    String(activeListing._id),
    String(pendingListing._id),
  ].sort());
  assert.deepStrictEqual(idsOf(second), idsOf(first));
  assert.ok(openEvents.includes('hit'));

  const keywordEvents = [];
  const keyword = await rank(memoryRedis(), 'information technology', keywordEvents);
  assert.deepStrictEqual(idsOf(keyword).sort(), idsOf(first).sort());
  assert.ok(!idsOf(keyword).includes(String(suspendedListing._id)));
  assert.ok(!idsOf(keyword).includes(String(archivedListing._id)));
  assert.ok(!idsOf(keyword).includes(String(removedListing._id)));

  const offlineEvents = [];
  const offline = await rank(
    { isOpen: false, isReady: false },
    '',
    offlineEvents
  );
  assert.ok(offlineEvents.includes('bypass'));
  assert.deepStrictEqual(idsOf(offline).sort(), idsOf(first).sort());

  const suspendedUser = users.find((user) => String(user._id) === String(suspendedUserId));
  const activeUser = users.find((user) => String(user._id) === String(activeUserId));
  suspendedUser.status = 'active';
  const restoredEvents = [];
  const restoredClient = memoryRedis();
  await rank(restoredClient, '', restoredEvents);
  assert.ok(idsOf(await rank(restoredClient, '', restoredEvents)).includes(String(suspendedListing._id)));
  suspendedUser.status = 'suspended';
  const stale = await rank(restoredClient, '', restoredEvents);
  assert.ok(idsOf(stale).includes(String(suspendedListing._id)));
  assert.strictEqual(restoredEvents.filter((event) => event === 'hit').length, 2);
  const invalidated = await matchCache.invalidateMatchCache(restoredClient);
  assert.strictEqual(invalidated.ok, true);
  const afterInvalidation = await rank(restoredClient, '', restoredEvents);
  assert.ok(!idsOf(afterInvalidation).includes(String(suspendedListing._id)));
  assert.ok(restoredEvents.includes('miss'));

  suspendedUser.status = 'active';
  await matchCache.invalidateMatchCache(restoredClient);
  const afterRestore = await rank(restoredClient, '', restoredEvents);
  assert.ok(idsOf(afterRestore).includes(String(suspendedListing._id)));
  assert.ok(idsOf(afterRestore).includes(String(activeListing._id)));
  suspendedUser.status = 'suspended';

  const studentRequest = {
    user: { id: studentUserId, _id: studentUserId, role: 'student' },
    params: { id: String(suspendedListing._id), scholarshipId: String(suspendedListing._id) },
  };
  const hidden = await callJson(scholarshipController.getScholarshipById, studentRequest);
  assert.strictEqual(hidden.statusCode, 404);
  assert.strictEqual(hidden.body.message, 'Scholarship not found');

  const adminView = await callJson(scholarshipController.getScholarshipById, {
    user: { id: adminId, _id: adminId, role: 'admin' },
    params: { id: String(suspendedListing._id) },
  });
  assert.strictEqual(adminView.statusCode, 200);
  assert.strictEqual(adminView.body.scholarship.name, suspendedListing.name);

  const visible = await callJson(scholarshipController.getScholarshipById, {
    user: { id: studentUserId, _id: studentUserId, role: 'student' },
    params: { id: String(activeListing._id) },
  });
  assert.strictEqual(visible.statusCode, 200);
  assert.strictEqual(visible.body.scholarship.name, activeListing.name);

  const report = await callJson(createScholarshipReport, {
    user: { id: studentUserId, _id: studentUserId, role: 'student' },
    params: { scholarshipId: String(suspendedListing._id) },
    body: { category: 'Incorrect or misleading information' },
  });
  assert.strictEqual(report.statusCode, 404);
  assert.strictEqual(report.body.message, 'Scholarship not found.');

  const duplicateSave = await callJson(savedScholarshipController.saveScholarship, studentRequest);
  assert.strictEqual(duplicateSave.statusCode, 200);
  assert.strictEqual(duplicateSave.body.alreadySaved, true);
  assert.strictEqual(savedRecords.length, savedCount);

  const blockedSave = await callJson(savedScholarshipController.saveScholarship, {
    user: { id: studentUserId, _id: studentUserId, role: 'student' },
    params: { scholarshipId: String(pendingListing._id) },
  });
  assert.strictEqual(blockedSave.statusCode, 201);
  const pendingRow = savedRecords.find((row) => String(row.scholarshipId) === String(pendingListing._id));
  assert.ok(pendingRow);

  const newSuspended = scholarship(new mongoose.Types.ObjectId(), suspendedProviderId, {
    name: 'Another Suspended Grant',
  });
  records.push(newSuspended);
  const refused = await callJson(savedScholarshipController.saveScholarship, {
    user: { id: studentUserId, _id: studentUserId, role: 'student' },
    params: { scholarshipId: String(newSuspended._id) },
  });
  assert.strictEqual(refused.statusCode, 400);
  assert.strictEqual(refused.body.message, 'This scholarship is no longer available.');
  assert.ok(!savedRecords.some((row) => String(row.scholarshipId) === String(newSuspended._id)));

  const hiddenSaved = await callJson(savedScholarshipController.getSavedScholarships, {
    user: { id: studentUserId, _id: studentUserId, role: 'student' },
  });
  assert.strictEqual(hiddenSaved.statusCode, 200);
  const hiddenIds = hiddenSaved.body.savedScholarships.map((item) => String(item._id));
  assert.ok(!hiddenIds.includes(String(suspendedListing._id)));
  assert.ok(hiddenIds.includes(String(pendingListing._id)));
  assert.ok(savedRecords.some((row) => String(row.scholarshipId) === String(suspendedListing._id)));

  suspendedUser.status = 'active';
  const restoredSaved = await callJson(savedScholarshipController.getSavedScholarships, {
    user: { id: studentUserId, _id: studentUserId, role: 'student' },
  });
  const restoredIds = restoredSaved.body.savedScholarships.map((item) => String(item._id));
  assert.ok(restoredIds.includes(String(suspendedListing._id)));
  suspendedUser.status = 'suspended';

  const realInvalidate = matchCache.invalidateMatchCache.bind(matchCache);
  let invalidations = 0;
  matchCache.invalidateMatchCache = async (client) => {
    invalidations += 1;
    return realInvalidate(client);
  };

  mongoose.connection.readyState = previousReadyState;
  const actor = { _id: adminId, id: adminId, role: 'admin', email: 'admin@example.test' };
  const studentStatus = await callJson(adminController.updateUserAccountStatus, {
    params: { id: String(otherStudentId) },
    body: { status: 'suspended' },
    user: actor,
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(studentStatus.body.statusUpdated, true);
  assert.strictEqual(invalidations, 0);

  const providerStatus = await callJson(adminController.updateUserAccountStatus, {
    params: { id: String(activeUserId) },
    body: { status: 'suspended' },
    user: actor,
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(providerStatus.body.statusUpdated, true);
  assert.strictEqual(activeUser.status, 'suspended');
  assert.strictEqual(invalidations, 1);

  const providerRestore = await callJson(adminController.updateUserAccountStatus, {
    params: { id: String(activeUserId) },
    body: { status: 'active' },
    user: actor,
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(providerRestore.statusCode, 200);
  assert.strictEqual(activeUser.status, 'active');
  assert.strictEqual(invalidations, 2);
  assert.deepStrictEqual(scholarshipWrites, []);
  records.pop();
  assert.strictEqual(JSON.stringify(records), listingSnapshot);

  console.log('Suspended provider scholarship tests passed.');
};

run()
  .then(() => closeMatchingPool())
  .catch(async (error) => {
    console.error(error);
    await closeMatchingPool();
    process.exit(1);
  });
