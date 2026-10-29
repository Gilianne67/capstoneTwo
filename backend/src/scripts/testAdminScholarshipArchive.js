const assert = require('assert');
const fs = require('fs');
const path = require('path');

const Scholarship = require('../models/Scholarship');
const Provider = require('../models/Provider');
const Report = require('../models/Report');
const Application = require('../models/Application');
const SavedMatch = require('../models/SavedMatch');
const StudentProfile = require('../models/StudentProfile');
const AuditLog = require('../models/AuditLog');
const CourseAlias = require('../models/CourseAlias');
const scholarshipController = require('../controllers/scholarshipController');
const { saveScholarship } = require('../controllers/savedScholarshipController');
const { getAdminScholarships } = require('../controllers/adminScholarshipController');
const { getEligibleScholarships, passesHardFilters } = require('../services/matchingService');
const { isSearchableScholarship } = require('../services/scholarshipSearchService');
const searchSync = require('../services/scholarshipSearchSync');
const matchCache = require('../services/matchCache');
const notificationService = require('../services/notificationService');
const scholarshipRoutes = require('../routes/scholarshipRoutes');
const adminRoutes = require('../routes/adminRoutes');
const moderationRoutes = require('../routes/moderationRoutes');

const ids = {
  unreported: '64b000000000000000000001',
  reported: '64b000000000000000000002',
  archived: '64b000000000000000000003',
  providerOwned: '64b000000000000000000004',
  missing: '64b000000000000000000099',
  providerA: '64b0000000000000000000a1',
  providerB: '64b0000000000000000000b2',
};

const providers = [
  { _id: ids.providerA, institutionName: 'State University' },
  { _id: ids.providerB, institutionName: 'City College' },
];

const listing = (data) => ({
  status: 'Open',
  isArchived: false,
  adminRemovedAt: null,
  adminRemovalReason: '',
  deadline: '2026-12-31',
  updatedAt: new Date('2026-10-01T00:00:00.000Z'),
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
  academicRequirements: [{ gradingScale: '1.00-5.00', minimumGPA: 5 }],
  hardFilters: {
    academicLevel: 'College',
    courseProgram: [],
    geographicLocation: { scope: 'Nationwide', regions: [], provinces: [], municipalities: [] },
    citizenshipStatus: 'Filipino',
  },
  incomeRequirement: { maxMonthlyIncome: null },
  specialTags: [],
  ...data,
  async save() {
    return this;
  },
});

const scholarships = [
  listing({
    _id: ids.unreported,
    name: 'Unreported Merit Grant',
    providerId: ids.providerA,
  }),
  listing({
    _id: ids.reported,
    name: 'Reported Community Grant',
    providerId: ids.providerA,
  }),
  listing({
    _id: ids.archived,
    name: 'Archived Legacy Grant',
    providerId: ids.providerB,
    status: 'Closed',
    isArchived: true,
    adminRemovedAt: new Date('2026-09-01T00:00:00.000Z'),
    adminRemovalReason: 'Already removed',
  }),
  listing({
    _id: ids.providerOwned,
    name: 'Provider Owned Grant',
    providerId: ids.providerA,
  }),
];

const reports = [
  {
    _id: 'report-1',
    listingId: ids.reported,
    status: 'Pending Review',
    resolution: 'NONE',
    resolvedAt: null,
  },
];

const application = {
  _id: 'app-1',
  scholarshipId: ids.unreported,
  applicationStatus: 'Submitted',
};

const savedMatch = {
  _id: 'saved-1',
  scholarshipId: ids.unreported,
};

const audits = [];
const notifications = [];
const synced = [];
let reportMutations = 0;

const originals = {
  scholarshipFind: Scholarship.find,
  scholarshipFindById: Scholarship.findById,
  scholarshipFindOne: Scholarship.findOne,
  scholarshipFindByIdAndUpdate: Scholarship.findByIdAndUpdate,
  scholarshipCount: Scholarship.countDocuments,
  providerFind: Provider.find,
  providerFindOne: Provider.findOne,
  reportFind: Report.find,
  reportDistinct: Report.distinct,
  reportFindById: Report.findById,
  reportFindOneAndUpdate: Report.findOneAndUpdate,
  reportUpdate: Report.findByIdAndUpdate,
  applicationDeleteMany: Application.deleteMany,
  applicationDeleteOne: Application.deleteOne,
  savedDeleteMany: SavedMatch.deleteMany,
  savedDeleteOne: SavedMatch.deleteOne,
  auditCreate: AuditLog.create,
  courseFind: CourseAlias.find,
  sync: searchSync.syncScholarshipSearch,
  invalidate: matchCache.invalidateMatchCache,
  notify: notificationService.notifyProviderListingRemoved,
};

const adminUser = {
  id: 'admin-1',
  _id: 'admin-1',
  role: 'admin',
  firstName: 'Review',
  lastName: 'Admin',
  email: 'admin@example.com',
};

const chain = (value) => {
  const api = {
    select() { return api; },
    populate() { return api; },
    sort() { return api; },
    skip() { return api; },
    limit() { return api; },
    lean: async () => value,
  };
  return api;
};

const matchesClause = (doc, clause) => {
  if (!clause || Object.keys(clause).length === 0) return true;
  if (clause.$and) return clause.$and.every((part) => matchesClause(doc, part));
  if (clause.$or) return clause.$or.some((part) => matchesClause(doc, part));

  return Object.entries(clause).every(([key, expected]) => {
    const value = doc[key];
    if (expected instanceof RegExp) return expected.test(String(value || ''));
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if (Object.prototype.hasOwnProperty.call(expected, '$in')) {
        return expected.$in.map(String).includes(String(value));
      }
      if (Object.prototype.hasOwnProperty.call(expected, '$nin')) {
        return !expected.$nin.map(String).includes(String(value));
      }
      if (Object.prototype.hasOwnProperty.call(expected, '$ne')) {
        if (expected.$ne === null) return value !== null && value !== undefined;
        return String(value) !== String(expected.$ne);
      }
    }
    if (expected === null) return value === null || value === undefined;
    return String(value) === String(expected);
  });
};

const installStubs = () => {
  Scholarship.find = (filter) => chain(
    scholarships
      .filter((item) => matchesClause(item, filter))
      .map((item) => ({
        ...item,
        providerId: providers.find((provider) => String(provider._id) === String(item.providerId)) || item.providerId,
      }))
  );
  Scholarship.countDocuments = async (filter) =>
    scholarships.filter((item) => matchesClause(item, filter)).length;
  Scholarship.findById = (id) => {
    const doc = scholarships.find((item) => String(item._id) === String(id)) || null;
    const query = {
      select() { return query; },
      then(resolve, reject) {
        return Promise.resolve(doc).then(resolve, reject);
      },
    };
    return query;
  };
  Scholarship.findOne = async (query) =>
    scholarships.find((item) =>
      String(item._id) === String(query._id)
      && String(item.providerId) === String(query.providerId)
    ) || null;
  Scholarship.findByIdAndUpdate = async (id, update, options) => {
    const doc = scholarships.find((item) => String(item._id) === String(id));
    if (!doc) return null;
    assert.equal(options.new, true);
    Object.assign(doc, update);
    return doc;
  };

  Provider.find = (filter) => chain(
    providers.filter((provider) => !filter.institutionName || filter.institutionName.test(provider.institutionName))
  );
  Provider.findOne = async (query) => {
    const userId = String(query.userId || '');
    if (userId === 'provider-user') return { _id: ids.providerA, userId };
    if (userId === 'other-provider') return { _id: ids.providerB, userId };
    return null;
  };

  Report.find = (filter) => chain(
    reports.filter((report) => (filter.listingId?.$in || []).map(String).includes(String(report.listingId)))
  );
  Report.distinct = async () => reports.map((report) => report.listingId);
  Report.findById = async () => {
    reportMutations += 1;
    throw new Error('archive must not load reports for update');
  };
  Report.findOneAndUpdate = async () => {
    reportMutations += 1;
    throw new Error('archive must not change report records');
  };
  Report.findByIdAndUpdate = async () => {
    reportMutations += 1;
    throw new Error('archive must not change report records');
  };

  const trap = async () => {
    throw new Error('historical records must not be deleted');
  };
  Application.deleteMany = trap;
  Application.deleteOne = trap;
  Application.findOneAndDelete = trap;
  Application.findByIdAndDelete = trap;
  SavedMatch.deleteMany = trap;
  SavedMatch.deleteOne = trap;
  SavedMatch.findOneAndDelete = trap;
  SavedMatch.findByIdAndDelete = trap;

  AuditLog.create = async (entry) => {
    audits.push(entry);
    return entry;
  };
  CourseAlias.find = () => ({ lean: async () => [] });
  searchSync.syncScholarshipSearch = async (scholarship) => {
    synced.push(scholarship);
    return { synchronized: true };
  };
  matchCache.invalidateMatchCache = async () => ({ ok: true });
  notificationService.notifyProviderListingRemoved = async (payload) => {
    notifications.push(payload);
  };
};

const restore = () => {
  Scholarship.find = originals.scholarshipFind;
  Scholarship.findById = originals.scholarshipFindById;
  Scholarship.findOne = originals.scholarshipFindOne;
  Scholarship.findByIdAndUpdate = originals.scholarshipFindByIdAndUpdate;
  Scholarship.countDocuments = originals.scholarshipCount;
  Provider.find = originals.providerFind;
  Provider.findOne = originals.providerFindOne;
  Report.find = originals.reportFind;
  Report.distinct = originals.reportDistinct;
  Report.findById = originals.reportFindById;
  Report.findOneAndUpdate = originals.reportFindOneAndUpdate;
  Report.findByIdAndUpdate = originals.reportUpdate;
  Application.deleteMany = originals.applicationDeleteMany;
  Application.deleteOne = originals.applicationDeleteOne;
  SavedMatch.deleteMany = originals.savedDeleteMany;
  SavedMatch.deleteOne = originals.savedDeleteOne;
  AuditLog.create = originals.auditCreate;
  CourseAlias.find = originals.courseFind;
  searchSync.syncScholarshipSearch = originals.sync;
  matchCache.invalidateMatchCache = originals.invalidate;
  notificationService.notifyProviderListingRemoved = originals.notify;
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

const invoke = (handler, req) => {
  const res = mockRes();
  return Promise.resolve(handler(req, res)).then(() => ({
    statusCode: res.statusCode,
    body: res.body,
  }));
};

const routeMethods = (router, routePath) => {
  const methods = new Set();
  for (const entry of router.stack) {
    if (!entry.route || entry.route.path !== routePath) continue;
    for (const method of Object.keys(entry.route.methods)) methods.add(method);
  }
  return [...methods];
};

const runAuthorize = (user) => new Promise((resolve) => {
  const layer = scholarshipRoutes.stack.find((entry) =>
    entry.route && entry.route.path === '/:id/archive' && entry.route.methods.patch
  );
  const guard = layer.route.stack.find((entry) => entry.handle.name === 'authorizeRequest');
  const res = mockRes();
  guard.handle({ user }, res, () => resolve({ nextCalled: true, statusCode: res.statusCode, body: res.body }));
  if (res.body) resolve({ nextCalled: false, statusCode: res.statusCode, body: res.body });
});

const runAdminGate = (user) => new Promise((resolve) => {
  const gates = adminRoutes.stack.filter((layer) => !layer.route && layer.handle);
  const gate = gates[gates.length - 1];
  const res = mockRes();
  gate.handle(
    { user },
    res,
    () => resolve({ nextCalled: true, statusCode: res.statusCode, body: res.body })
  );
  if (res.body) resolve({ nextCalled: false, statusCode: res.statusCode, body: res.body });
});

const scholarshipById = (id) => scholarships.find((item) => String(item._id) === String(id));

const list = (user, query) => invoke(getAdminScholarships, {
  user,
  query,
  ip: '127.0.0.1',
  headers: {},
});

const archive = (user, id, body = {}) => invoke(scholarshipController.archiveScholarship, {
  user,
  params: { id },
  body,
  ip: '127.0.0.1',
  headers: {},
});

const idsOf = (response) => response.body.data.map((item) => String(item._id));

const studentProfile = {
  academicLevel: 'College',
  course: 'BS Information Technology',
  gwa: 1.5,
  gwaScale: '1.00-5.00',
  incomeBracket: 'Below ₱10,000 / month',
  region: 'Bicol Region',
  province: 'Camarines Sur',
  municipalityCity: 'Naga City',
  citizenship: 'Filipino',
  specialEligibilityFlags: {},
};

const main = async () => {
  installStubs();

  assert.deepStrictEqual(routeMethods(adminRoutes, '/scholarships'), ['get']);
  assert.deepStrictEqual(routeMethods(scholarshipRoutes, '/:id/archive'), ['patch']);
  assert.ok(routeMethods(moderationRoutes, '/reports').includes('get'));
  assert.ok(routeMethods(moderationRoutes, '/reports/:id').includes('patch'));

  const archiveLayer = scholarshipRoutes.stack.find((entry) =>
    entry.route && entry.route.path === '/:id/archive' && entry.route.methods.patch
  );
  const handlerNames = archiveLayer.route.stack.map((entry) => entry.handle.name);
  assert.ok(handlerNames.includes('protect'));
  assert.ok(handlerNames.includes('authorizeRequest'));

  const studentArchive = await runAuthorize({ role: 'student', status: 'active' });
  assert.equal(studentArchive.statusCode, 403);
  assert.equal(studentArchive.nextCalled, false);

  const providerArchive = await runAuthorize({ role: 'provider', status: 'active' });
  assert.equal(providerArchive.nextCalled, true);
  const adminArchive = await runAuthorize({ role: 'admin', status: 'active' });
  assert.equal(adminArchive.nextCalled, true);
  const superArchive = await runAuthorize({ role: 'super_admin', status: 'active' });
  assert.equal(superArchive.nextCalled, true);

  const studentDirect = await archive({ id: 'student-1', role: 'student' }, ids.unreported, {
    reason: 'Policy violation',
  });
  assert.equal(studentDirect.statusCode, 403);
  assert.equal(scholarshipById(ids.unreported).isArchived, false);

  const studentList = await runAdminGate({ role: 'student', status: 'active' });
  assert.equal(studentList.statusCode, 403);
  const providerList = await runAdminGate({ role: 'provider', status: 'active' });
  assert.equal(providerList.statusCode, 403);
  const adminListGate = await runAdminGate({ role: 'admin', status: 'active' });
  assert.equal(adminListGate.nextCalled, true);

  const studentControllerList = await list({ role: 'student' }, {});
  assert.equal(studentControllerList.statusCode, 403);

  const invalidId = await archive(adminUser, 'not-a-scholarship-id', { reason: 'Policy violation' });
  assert.equal(invalidId.statusCode, 400);
  assert.match(invalidId.body.message, /Invalid scholarship ID/);

  const missingReason = await archive(adminUser, ids.unreported, {});
  assert.equal(missingReason.statusCode, 400);
  assert.match(missingReason.body.message, /valid archive reason/i);
  assert.equal(scholarshipById(ids.unreported).isArchived, false);

  const otherMissing = await archive(adminUser, ids.unreported, { reason: 'Other' });
  assert.equal(otherMissing.statusCode, 400);
  assert.match(otherMissing.body.message, /Other/);

  const badStatus = await list(adminUser, { status: 'Published' });
  assert.equal(badStatus.statusCode, 400);
  const badPage = await list(adminUser, { page: 0 });
  assert.equal(badPage.statusCode, 400);

  const before = await list(adminUser, {});
  assert.equal(before.statusCode, 200);
  assert.equal(before.body.total, 4);
  assert.deepStrictEqual(idsOf(before).sort(), [
    ids.archived,
    ids.providerOwned,
    ids.reported,
    ids.unreported,
  ].sort());

  const openBefore = await list(adminUser, { status: 'Open' });
  assert.deepStrictEqual(idsOf(openBefore).sort(), [
    ids.providerOwned,
    ids.reported,
    ids.unreported,
  ].sort());
  assert.equal(openBefore.body.data.every((item) => item.listingState === 'Active'), true);

  const reportedOnly = await list(adminUser, { reportStatus: 'Reported' });
  assert.deepStrictEqual(idsOf(reportedOnly), [ids.reported]);
  assert.equal(reportedOnly.body.data[0].reportStatus, 'Reported');
  assert.equal(reportedOnly.body.data[0].openReportCount, 1);

  const byProvider = await list(adminUser, { search: 'State University' });
  assert.ok(idsOf(byProvider).includes(ids.unreported));
  assert.equal(idsOf(byProvider).includes(ids.archived), false);

  const unreportedArchive = await archive(adminUser, ids.unreported, {
    reason: 'Expired or outdated listing',
  });
  assert.equal(unreportedArchive.statusCode, 200);
  assert.equal(unreportedArchive.body.success, true);
  const unreported = scholarshipById(ids.unreported);
  assert.equal(unreported.isArchived, true);
  assert.equal(unreported.status, 'Closed');
  assert.ok(unreported.adminRemovedAt instanceof Date);
  assert.equal(unreported.adminRemovalReason, 'Expired or outdated listing');
  assert.equal(reports[0].status, 'Pending Review');
  assert.equal(reports[0].resolution, 'NONE');
  assert.equal(reportMutations, 0);
  assert.equal(application.applicationStatus, 'Submitted');
  assert.equal(String(application.scholarshipId), ids.unreported);
  assert.equal(String(savedMatch.scholarshipId), ids.unreported);
  assert.equal(synced.at(-1).isArchived, true);
  assert.equal(String(notifications.at(-1).scholarshipId), ids.unreported);
  assert.equal(notifications.at(-1).explanation, 'Expired or outdated listing');

  const audit = audits.at(-1);
  assert.equal(audit.action, 'SCHOLARSHIP_ARCHIVED');
  assert.equal(audit.role, 'Admin');
  assert.equal(audit.actor, 'Review Admin');
  assert.equal(audit.severity, 'Warning');
  assert.match(audit.details, new RegExp(ids.unreported));
  assert.match(audit.details, /Expired or outdated listing/);
  assert.equal(AuditLog.schema.options.timestamps, true);

  const openAfter = await list(adminUser, { status: 'Open' });
  assert.equal(idsOf(openAfter).includes(ids.unreported), false);
  assert.ok(idsOf(openAfter).includes(ids.providerOwned));

  const archivedAfter = await list(adminUser, { status: 'Archived' });
  assert.ok(idsOf(archivedAfter).includes(ids.unreported));
  const archivedRow = archivedAfter.body.data.find((item) => String(item._id) === ids.unreported);
  assert.equal(archivedRow.listingState, 'Archived');
  assert.equal(archivedRow.canArchive, false);
  assert.equal(archivedRow.reportStatus, 'Unreported');

  const originalProfileFind = StudentProfile.findOne;
  const originalSavedFind = SavedMatch.findOne;
  const originalSavedCreate = SavedMatch.create;
  let savedCreates = 0;
  StudentProfile.findOne = async () => ({ _id: 'profile-1', userId: 'student-1' });
  SavedMatch.findOne = async () => null;
  SavedMatch.find = () => ({
    populate() { return Promise.resolve([]); },
    sort() { return this; },
  });
  SavedMatch.create = async () => {
    savedCreates += 1;
    return { _id: 'saved-new', dateSaved: new Date() };
  };

  const blockedSave = await invoke(saveScholarship, {
    user: { id: 'student-1', role: 'student' },
    params: { scholarshipId: ids.unreported },
  });
  assert.equal(blockedSave.statusCode, 400);
  assert.match(blockedSave.body.message, /no longer available/i);
  assert.equal(savedCreates, 0);
  assert.equal(application.applicationStatus, 'Submitted');

  const allowedSave = await invoke(saveScholarship, {
    user: { id: 'student-1', role: 'student' },
    params: { scholarshipId: ids.providerOwned },
  });
  assert.equal(allowedSave.statusCode, 201);
  assert.equal(savedCreates, 1);

  StudentProfile.findOne = originalProfileFind;
  SavedMatch.findOne = originalSavedFind;
  SavedMatch.create = originalSavedCreate;

  const repeat = await archive(adminUser, ids.unreported, { reason: 'Duplicate listing' });
  assert.equal(repeat.statusCode, 400);
  assert.match(repeat.body.message, /already archived/i);

  const missing = await archive(adminUser, ids.missing, { reason: 'Duplicate listing' });
  assert.equal(missing.statusCode, 404);

  const reportedArchive = await archive(
    { ...adminUser, role: 'superadmin' },
    ids.reported,
    { reason: 'Other', otherReason: '  The same grant was posted twice.  ' }
  );
  assert.equal(reportedArchive.statusCode, 200);
  assert.equal(scholarshipById(ids.reported).isArchived, true);
  assert.equal(
    scholarshipById(ids.reported).adminRemovalReason,
    'Other: The same grant was posted twice.'
  );
  assert.equal(reports[0].status, 'Pending Review');
  assert.equal(reports[0].resolvedAt, null);
  assert.equal(reportMutations, 0);
  assert.match(audits.at(-1).details, /Other: The same grant was posted twice\./);

  const reportedStillThere = await list(adminUser, { reportStatus: 'Reported' });
  assert.deepStrictEqual(idsOf(reportedStillThere), [ids.reported]);
  assert.equal(reportedStillThere.body.data[0].listingState, 'Archived');
  assert.equal(reportedStillThere.body.data[0].reportStatus, 'Reported');

  const refreshedOpen = await list(adminUser, { status: 'Open', page: 1 });
  assert.deepStrictEqual(idsOf(refreshedOpen), [ids.providerOwned]);

  let capturedFilter = null;
  const originalFind = Scholarship.find;
  Scholarship.find = (filter) => {
    capturedFilter = filter;
    return originalFind(filter);
  };
  const eligible = await getEligibleScholarships(studentProfile, new Date('2026-10-28T00:00:00.000Z'));
  Scholarship.find = originalFind;
  assert.equal(capturedFilter.status, 'Open');
  assert.equal(capturedFilter.isArchived, false);
  assert.equal(capturedFilter.adminRemovedAt, null);
  const eligibleIds = eligible.map((item) => String(item._id));
  assert.deepStrictEqual(eligibleIds, [ids.providerOwned]);
  assert.equal(passesHardFilters(studentProfile, scholarshipById(ids.unreported)), false);
  assert.equal(isSearchableScholarship(scholarshipById(ids.unreported)), false);
  assert.equal(isSearchableScholarship(scholarshipById(ids.providerOwned)), true);

  const crossProvider = await archive(
    { id: 'other-provider', role: 'provider' },
    ids.providerOwned,
    { reason: 'Policy violation' }
  );
  assert.equal(crossProvider.statusCode, 404);
  assert.equal(scholarshipById(ids.providerOwned).isArchived, false);
  assert.equal(scholarshipById(ids.providerOwned).adminRemovedAt, null);

  const auditsBeforeProvider = audits.length;
  const providerSelf = await archive(
    { id: 'provider-user', role: 'provider' },
    ids.providerOwned,
    { reason: 'Policy violation' }
  );
  assert.equal(providerSelf.statusCode, 200);
  assert.equal(scholarshipById(ids.providerOwned).isArchived, true);
  assert.equal(scholarshipById(ids.providerOwned).adminRemovedAt, null);
  assert.equal(scholarshipById(ids.providerOwned).adminRemovalReason, '');
  assert.equal(scholarshipById(ids.providerOwned).status, 'Open');
  assert.equal(audits.length, auditsBeforeProvider + 1);
  const providerAudit = audits.at(-1);
  assert.equal(providerAudit.action, 'SCHOLARSHIP_ARCHIVED');
  assert.equal(providerAudit.role, 'Provider');
  assert.equal(providerAudit.actor, 'Provider User');
  assert.match(providerAudit.details, new RegExp(ids.providerOwned));
  assert.match(providerAudit.details, new RegExp(ids.providerA));
  assert.equal(providerAudit.details.includes('Policy violation'), false);

  const removedProviderAttempt = await archive(
    { id: 'provider-user', role: 'provider' },
    ids.unreported,
    {}
  );
  assert.equal(removedProviderAttempt.statusCode, 403);

  const archiveSource = fs.readFileSync(
    path.join(__dirname, '../services/scholarshipArchiveService.js'),
    'utf8'
  );
  assert.equal(archiveSource.includes('Application'), false);
  assert.equal(archiveSource.includes('SavedMatch'), false);
  assert.equal(archiveSource.includes("require('../models/Report')"), false);
  assert.equal(archiveSource.includes('isArchived = false'), false);

  const controllerSource = fs.readFileSync(
    path.join(__dirname, '../controllers/scholarshipController.js'),
    'utf8'
  );
  assert.equal(controllerSource.includes('isArchived = false'), false);

  console.log('admin scholarship archive tests passed');
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(restore);
