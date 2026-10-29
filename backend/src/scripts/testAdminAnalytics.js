/**
 * Admin analytics periods, scholarship supply rules, and CSV exports.
 * Aggregations run on fixture documents. This does not query a live database.
 */
const assert = require('assert');
const express = require('express');
const jwt = require('jsonwebtoken');
const Module = require('module');

const secret = process.env.JWT_SECRET || 'admin-analytics-test-secret';
process.env.JWT_SECRET = secret;

const createRedisMock = () => {
  const strings = new Map();
  return {
    isOpen: true,
    isReady: true,
    async set(key, value) {
      strings.set(key, value);
      return 'OK';
    },
    async get(key) {
      return strings.has(key) ? strings.get(key) : null;
    },
    async del(key) {
      strings.delete(key);
      return 1;
    },
    async expire() {
      return 1;
    },
    async ttl() {
      return -1;
    },
  };
};

const redisPath = require.resolve('../config/redis');
const redisModule = new Module(redisPath, module);
redisModule.filename = redisPath;
redisModule.loaded = true;
redisModule.exports = createRedisMock();
require.cache[redisPath] = redisModule;

const { installMemoryRevocationStore } = require('./revocationStoreStub');
installMemoryRevocationStore();

const User = require('../models/User');
const Provider = require('../models/Provider');
const Scholarship = require('../models/Scholarship');
const SavedMatch = require('../models/SavedMatch');
const Application = require('../models/Application');
const StudentProfile = require('../models/StudentProfile');
const CategoryDemandEvent = require('../models/CategoryDemandEvent');
const suspendedProviderFilter = require('../services/suspendedProviderFilter');
const { executeAggregate } = require('../services/adminAnalyticsAggregate');
const {
  resolveAnalyticsQuery,
  buildOverview,
  buildRegistrations,
  buildScholarships,
  buildCategoryDemand,
  buildStudentInsights,
  buildProviderInsights,
  renderReportCsv,
} = require('../services/adminAnalyticsService');
const { createDemandRecorder, normalizeDemandInput } = require('../services/categoryDemandService');
const { recordFilterDemand } = require('../controllers/categoryDemandController');
const auditController = require('../controllers/auditController');
const adminRoutes = require('../routes/adminRoutes');
const studentRoutes = require('../routes/studentRoutes');
const errorHandler = require('../middleware/error');

const NOW = new Date('2026-10-29T02:00:00.000Z');
const IN_PERIOD = new Date('2026-10-25T04:00:00.000Z');
const BEFORE_PERIOD = new Date('2026-09-01T04:00:00.000Z');
const APPROACHING = new Date('2026-11-05T04:00:00.000Z');
const PAST_DEADLINE = new Date('2026-10-01T04:00:00.000Z');

const db = {
  users: [],
  providers: [],
  scholarships: [],
  savedmatches: [],
  applications: [],
  studentprofiles: [],
  categorydemandevents: [],
  suspendedIds: ['provider-suspended'],
};

const collectionMap = () => ({
  [User.collection.collectionName]: db.users,
  [Provider.collection.collectionName]: db.providers,
  [Scholarship.collection.collectionName]: db.scholarships,
  [SavedMatch.collection.collectionName]: db.savedmatches,
  [Application.collection.collectionName]: db.applications,
  [StudentProfile.collection.collectionName]: db.studentprofiles,
  [CategoryDemandEvent.collection.collectionName]: db.categorydemandevents,
});

const bindAggregate = (model, key) => {
  model.aggregate = (pipeline) => Promise.resolve(executeAggregate(db[key], pipeline, collectionMap()));
};

bindAggregate(User, 'users');
bindAggregate(Provider, 'providers');
bindAggregate(Scholarship, 'scholarships');
bindAggregate(SavedMatch, 'savedmatches');
bindAggregate(Application, 'applications');
bindAggregate(StudentProfile, 'studentprofiles');
bindAggregate(CategoryDemandEvent, 'categorydemandevents');

suspendedProviderFilter.suspendedProviderIds = async () => db.suspendedIds;

const accounts = new Map();
User.findById = (id) => ({
  select() {
    return Promise.resolve(accounts.get(String(id)) || null);
  },
});
Provider.findOne = () => ({
  select() {
    return Promise.resolve(null);
  },
});

const audits = [];
auditController.recordAuditLog = async (entry) => {
  audits.push(entry);
};

const insertedDemand = [];
CategoryDemandEvent.insertMany = async (docs) => {
  insertedDemand.push(...docs);
  return docs;
};

const listing = (id, overrides = {}) => ({
  _id: id,
  providerId: 'provider-active',
  scholarshipType: 'STEM',
  status: 'Open',
  isArchived: false,
  adminRemovedAt: null,
  createdAt: IN_PERIOD,
  deadline: APPROACHING,
  hardFilters: {
    academicLevel: 'College',
    geographicLocation: {
      scope: 'Nationwide',
      regions: [],
      provinces: [],
      municipalities: [],
    },
  },
  specialTags: [],
  ...overrides,
  hardFilters: overrides.hardFilters || {
    academicLevel: 'College',
    geographicLocation: {
      scope: 'Nationwide',
      regions: [],
      provinces: [],
      municipalities: [],
    },
  },
});

const loadFixtures = () => {
  db.users = [
    { _id: 'admin-1', name: 'Ada Admin', role: 'admin', status: 'active', isVerified: true, createdAt: new Date('2026-01-01T00:00:00.000Z') },
    { _id: 'student-1', name: 'Ana Cruz', role: 'student', status: 'active', isVerified: true, createdAt: new Date('2026-10-22T16:00:00.000Z') },
    { _id: 'student-2', name: 'Ben Santos', role: 'student', status: 'suspended', isVerified: false, createdAt: new Date('2026-10-22T15:59:59.000Z') },
    { _id: 'provider-user', name: 'North Contact', role: 'provider', status: 'active', isVerified: true, createdAt: new Date('2026-10-29T15:59:59.000Z') },
    { _id: 'provider-user-suspended', name: 'South Contact', role: 'provider', status: 'suspended', isVerified: false, createdAt: new Date('2026-05-01T00:00:00.000Z') },
    { _id: 'super-1', name: 'Super Admin', role: 'superadmin', status: 'active', isVerified: true, createdAt: new Date('2026-10-29T16:00:00.000Z') },
  ];
  accounts.clear();
  db.users.forEach((user) => accounts.set(user._id, user));
  accounts.set('student-http', { _id: 'student-http', name: 'Student HTTP', role: 'student', status: 'active', isVerified: true });
  accounts.set('provider-http', { _id: 'provider-http', name: 'Provider HTTP', role: 'provider', status: 'active', isVerified: true });

  db.providers = [
    { _id: 'provider-active', userId: 'provider-user', institutionName: 'North Foundation', verificationStatus: 'Approved' },
    { _id: 'provider-suspended', userId: 'provider-user-suspended', institutionName: 'South Office', verificationStatus: 'Rejected' },
  ];
  db.scholarships = [
    listing('stem-open', {
      specialTags: [{ tagName: 'Person with Disability (PWD)' }, { tagName: 'Indigenous Peoples (IP)' }],
    }),
    listing('stem-archived', { status: 'Closed', isArchived: true }),
    listing('merit-suspended', { scholarshipType: 'Merit-Based', providerId: 'provider-suspended' }),
    listing('need-closed', { scholarshipType: 'Need-Based', status: 'Closed' }),
    listing('agri-removed', {
      scholarshipType: 'Agricultural',
      status: 'Closed',
      isArchived: true,
      adminRemovedAt: new Date('2026-10-20T00:00:00.000Z'),
    }),
    listing('local-multi', {
      scholarshipType: 'Municipal / Local',
      hardFilters: {
        academicLevel: 'College',
        geographicLocation: {
          scope: 'Region',
          regions: ['Ilocos Region', 'Cagayan Valley'],
          provinces: [],
          municipalities: [],
        },
      },
    }),
    listing('province-pang', {
      scholarshipType: 'Merit-Based',
      hardFilters: {
        academicLevel: 'Senior High School',
        geographicLocation: {
          scope: 'Province',
          regions: [],
          provinces: ['Pangasinan'],
          municipalities: [],
        },
      },
    }),
    listing('formula', { scholarshipType: '=HYPERLINK("http://evil")' }),
    listing('blank-type', { scholarshipType: '   ' }),
    listing('davao-only', {
      deadline: PAST_DEADLINE,
      hardFilters: {
        academicLevel: 'College',
        geographicLocation: {
          scope: 'Region',
          regions: ['Davao Region'],
          provinces: [],
          municipalities: [],
        },
      },
    }),
  ];
  db.studentprofiles = [
    { _id: 'profile-1', userId: 'student-1', academicLevel: 'College', course: 'Computer Science', region: 'Ilocos Region' },
    { _id: 'profile-2', userId: 'student-2', academicLevel: 'Senior High School', course: 'ABM', region: 'Davao Region' },
  ];
  db.savedmatches = [
    { _id: 'save-1', studentProfileId: 'profile-1', scholarshipId: 'stem-open', dateSaved: IN_PERIOD },
    { _id: 'save-2', studentProfileId: 'profile-1', scholarshipId: 'davao-only', dateSaved: IN_PERIOD },
    { _id: 'save-3', studentProfileId: 'profile-1', scholarshipId: 'stem-open', dateSaved: BEFORE_PERIOD },
    { _id: 'save-4', studentProfileId: 'profile-1', scholarshipId: 'missing-scholarship', dateSaved: IN_PERIOD },
  ];
  db.applications = [
    { _id: 'app-1', studentProfileId: 'profile-1', scholarshipId: 'stem-open', dateApplied: IN_PERIOD, applicationStatus: 'Submitted' },
    { _id: 'app-2', studentProfileId: 'profile-1', scholarshipId: 'stem-open', dateApplied: BEFORE_PERIOD, applicationStatus: 'Submitted' },
  ];
  db.categorydemandevents = [
    { dimension: 'eligibilityTag', value: 'Person with Disability (PWD)', createdAt: IN_PERIOD },
    { dimension: 'academicLevel', value: 'College', createdAt: BEFORE_PERIOD },
  ];
};

const parsedFor = (query) => {
  const parsed = resolveAnalyticsQuery(query, NOW, { paginate: true });
  assert.strictEqual(parsed.ok, true, parsed.message);
  return parsed;
};

const categoryRow = (report, name) => {
  const row = report.categoryDemand.rows.find((item) => item.category === name);
  assert.ok(row, `Missing category ${name}`);
  return row;
};

const tokenFor = (id, role) => jwt.sign({ id, role }, secret);

const startServer = () => new Promise((resolve) => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/students', studentRoutes);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
});

const request = async (server, path, { token, method = 'GET', body } = {}) => {
  const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    return { status: response.status, text: await response.text(), contentType, disposition: response.headers.get('content-disposition') };
  }
  return { status: response.status, body: await response.json() };
};

const invoke = (handler, req) => new Promise((resolve, reject) => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      resolve({ statusCode: this.statusCode, body: payload });
    },
  };
  Promise.resolve(handler(req, res)).catch(reject);
});

const main = async () => {
  const invalidRange = resolveAnalyticsQuery({ range: '12d' }, NOW);
  assert.strictEqual(invalidRange.ok, false);
  assert.match(invalidRange.message, /7d, 30d, or 90d/);

  const mixed = resolveAnalyticsQuery({ range: '7d', from: '2026-10-01' }, NOW);
  assert.strictEqual(mixed.ok, false);

  const backwards = resolveAnalyticsQuery({ from: '2026-10-10', to: '2026-10-01' }, NOW);
  assert.strictEqual(backwards.ok, false);

  const future = resolveAnalyticsQuery({ from: '2026-10-01', to: '2026-10-30' }, NOW);
  assert.strictEqual(future.ok, false);

  const impossibleDay = resolveAnalyticsQuery({ from: '2026-02-31', to: '2026-03-01' }, NOW);
  assert.strictEqual(impossibleDay.ok, false);

  const ignoredFilters = resolveAnalyticsQuery({
    range: '7d',
    academicLevel: 'Elementary',
    region: 'Narnia',
  }, NOW);
  assert.strictEqual(ignoredFilters.ok, true);
  assert.strictEqual(Object.hasOwn(ignoredFilters, 'academicLevel'), false);
  assert.strictEqual(Object.hasOwn(ignoredFilters, 'region'), false);
  assert.strictEqual(ignoredFilters.period.from, '2026-10-23');

  const badPage = resolveAnalyticsQuery({ page: '0' }, NOW, { paginate: true });
  assert.strictEqual(badPage.ok, false);
  const badLimit = resolveAnalyticsQuery({ limit: '51' }, NOW, { paginate: true });
  assert.strictEqual(badLimit.ok, false);

  const week = parsedFor({ range: '7d' });
  assert.strictEqual(week.period.from, '2026-10-23');
  assert.strictEqual(week.period.to, '2026-10-29');
  assert.strictEqual(week.period.start.toISOString(), '2026-10-22T16:00:00.000Z');
  assert.strictEqual(week.period.end.toISOString(), '2026-10-29T16:00:00.000Z');
  assert.strictEqual(week.period.grouping, 'day');
  assert.strictEqual(week.period.buckets.length, 7);
  assert.ok(week.period.buckets.every((bucket) => bucket.key >= '2026-10-23' && bucket.key <= '2026-10-29'));

  const longRange = parsedFor({ from: '2026-01-01', to: '2026-10-29' });
  assert.strictEqual(longRange.period.grouping, 'month');
  assert.strictEqual(longRange.period.buckets[0].key, '2026-01');
  assert.strictEqual(longRange.period.buckets[longRange.period.buckets.length - 1].key, '2026-10');

  const boundary = new Date('2026-10-01T16:00:00.000Z');
  const shifted = resolveAnalyticsQuery({ range: '7d' }, boundary);
  assert.strictEqual(shifted.ok, true);
  assert.strictEqual(shifted.period.to, '2026-10-02');
  assert.strictEqual(shifted.period.from, '2026-09-26');
  assert.strictEqual(shifted.period.start.toISOString(), '2026-09-25T16:00:00.000Z');

  loadFixtures();
  const registrations = await buildRegistrations(week);
  const current = registrations.registrations.current;
  assert.strictEqual(current.totalRegisteredUsers, 6);
  assert.strictEqual(current.totalStudents, 2);
  assert.strictEqual(current.totalProviders, 2);
  assert.strictEqual(current.totalAdministrators, 2);
  assert.strictEqual(current.totalActiveAccounts, 4);
  assert.strictEqual(current.totalSuspendedAccounts, 2);
  assert.strictEqual(current.totalPendingConsentAccounts, 0);
  assert.strictEqual(current.email.studentsVerified, 1);
  assert.strictEqual(current.email.studentsUnverified, 1);
  assert.strictEqual(current.email.providersVerified, 1);
  assert.strictEqual(current.email.providersUnverified, 1);
  assert.strictEqual(registrations.registrations.inPeriod.students, 1);
  assert.strictEqual(registrations.registrations.inPeriod.providers, 1);
  assert.strictEqual(registrations.registrations.inPeriod.total, 2);
  assert.strictEqual(registrations.registrations.cumulative.beforePeriod.total, 3);
  assert.strictEqual(registrations.registrations.cumulative.throughPeriodEnd.total, 5);
  assert.strictEqual(registrations.registrations.series.length, 7);
  assert.ok(registrations.registrations.series.some((bucket) => bucket.total === 0));
  assert.strictEqual(
    registrations.registrations.series.reduce((sum, bucket) => sum + bucket.total, 0),
    2
  );
  const firstDay = registrations.registrations.series.find((bucket) => bucket.key === '2026-10-23');
  const lastDay = registrations.registrations.series.find((bucket) => bucket.key === '2026-10-29');
  assert.strictEqual(firstDay.students, 1);
  assert.strictEqual(lastDay.providers, 1);
  assert.strictEqual(registrations.registrations.roleDistribution.find((row) => row.role === 'student').count, 2);

  const supply = await buildScholarships(week);
  const scholarships = supply.scholarships;
  assert.strictEqual(scholarships.totalListings, 10);
  assert.strictEqual(scholarships.activeOpenScholarships, 6);
  assert.strictEqual(scholarships.archivedScholarships, 2);
  assert.strictEqual(scholarships.administrativelyRemovedScholarships, 1);
  assert.strictEqual(scholarships.suspendedProviderListings, 1);
  assert.strictEqual(scholarships.openListingsIncludingSuspendedProviders, 7);
  assert.strictEqual(scholarships.closedNotArchived, 1);
  assert.strictEqual(scholarships.approachingDeadline, 5);
  assert.strictEqual(scholarships.pastDeadlineStillOpen, 1);
  assert.strictEqual(scholarships.suspendedProviderApproachingDeadline, 1);
  assert.strictEqual(
    scholarships.byCategory.reduce((sum, row) => sum + row.listings, 0),
    scholarships.totalListings
  );
  assert.strictEqual(
    scholarships.byGeography.reduce((sum, row) => sum + row.listings, 0),
    scholarships.totalListings
  );
  assert.strictEqual(scholarships.byGeography.find((row) => row.bucket === 'Multiple regions').listings, 1);
  assert.strictEqual(scholarships.byGeography.find((row) => row.bucket === 'Pangasinan').listings, 1);
  assert.strictEqual(
    scholarships.createdSeries.reduce((sum, bucket) => sum + bucket.count, 0),
    10
  );
  assert.ok(scholarships.createdSeries.some((bucket) => bucket.count === 0));

  const demand = await buildCategoryDemand(week);
  const stem = categoryRow(demand, 'STEM');
  assert.strictEqual(stem.totalListings, 3);
  assert.strictEqual(stem.availableScholarships, 2);
  assert.strictEqual(stem.savedInterest, 2);
  assert.strictEqual(stem.recordedApplications, 1);
  assert.strictEqual(stem.structuredSearchEvents, null);
  assert.strictEqual(stem.savedInterestPerAvailableScholarship, 1);
  assert.notStrictEqual(stem.savedInterest, stem.recordedApplications);
  assert.strictEqual(
    demand.categoryDemand.rows.reduce((sum, row) => sum + row.totalListings, 0),
    10
  );
  const tags = demand.categoryDemand.eligibilityTagComparison.rows;
  assert.strictEqual(tags.find((row) => row.tag === 'Person with Disability (PWD)').availableScholarships, 1);
  assert.strictEqual(tags.find((row) => row.tag === 'Indigenous Peoples (IP)').availableScholarships, 1);
  assert.strictEqual(tags.find((row) => row.tag === 'Person with Disability (PWD)').structuredFilterEvents, 1);
  assert.ok(tags.reduce((sum, row) => sum + row.availableScholarships, 0) > 1);
  assert.strictEqual(demand.categoryDemand.eligibilityTagSupply.additive, false);
  assert.strictEqual(demand.categoryDemand.savedMatchesUnlinked, 1);
  assert.strictEqual(demand.categoryDemand.recordedApplicationsInPeriod, 1);
  assert.ok(demand.categoryDemand.rows.some((row) => row.category === 'Merit-Based' && row.totalListings === 2));
  assert.ok(demand.categoryDemand.rows.some((row) => row.category === 'Unspecified'));
  assert.ok(demand.limitations.some((item) => /recommendations are not stored/i.test(item)));

  const withStaleFilters = parsedFor({
    range: '7d',
    academicLevel: 'Graduate Studies',
    region: 'Caraga',
  });
  const unchangedStudents = await buildStudentInsights(withStaleFilters);
  assert.strictEqual(unchangedStudents.studentInsights.profiles.total, 2);
  assert.strictEqual(
    unchangedStudents.studentInsights.savedSeries.reduce((sum, bucket) => sum + bucket.count, 0),
    2
  );
  assert.strictEqual(unchangedStudents.period.academicLevel, undefined);
  assert.strictEqual(unchangedStudents.period.region, undefined);
  const unchangedDemand = await buildCategoryDemand(withStaleFilters);
  assert.strictEqual(categoryRow(unchangedDemand, 'STEM').savedInterest, stem.savedInterest);
  assert.strictEqual(categoryRow(unchangedDemand, 'STEM').totalListings, stem.totalListings);
  assert.strictEqual(unchangedDemand.categoryDemand.recordedApplicationsInPeriod, 1);
  const oneDay = await buildRegistrations(parsedFor({ from: '2026-10-23', to: '2026-10-23' }));
  assert.strictEqual(oneDay.registrations.inPeriod.students, 1);
  assert.strictEqual(oneDay.registrations.series.length, 1);
  const quietSaves = await buildStudentInsights(parsedFor({ from: '2026-10-23', to: '2026-10-23' }));
  assert.strictEqual(quietSaves.studentInsights.profiles.total, 2);
  assert.strictEqual(
    quietSaves.studentInsights.savedSeries.reduce((sum, bucket) => sum + bucket.count, 0),
    0
  );

  const overview = await buildOverview(week);
  assert.strictEqual(overview.overview.totalStudents, current.totalStudents);
  assert.strictEqual(overview.overview.activeOpenScholarships, scholarships.activeOpenScholarships);
  assert.strictEqual(overview.overview.archivedScholarships, 2);
  assert.strictEqual(overview.overview.totalSavedScholarships, 4);
  assert.strictEqual(overview.overview.savedScholarshipsInPeriod, 2);
  assert.strictEqual(overview.overview.totalRecordedApplications, 2);
  assert.strictEqual(overview.overview.recordedApplicationsInPeriod, 1);
  assert.strictEqual(overview.overview.structuredSearchEventsInPeriod, 1);
  assert.strictEqual(overview.overview.registrationsInPeriod.total, 2);

  const students = await buildStudentInsights(week);
  assert.strictEqual(students.studentInsights.profiles.total, 2);
  assert.strictEqual(students.studentInsights.profiles.academicLevel.find((row) => row.label === 'College').count, 1);
  assert.strictEqual(students.studentInsights.savers.academicLevel.find((row) => row.label === 'College').count, 1);
  assert.strictEqual(students.studentInsights.categoriesMostSaved[0].category, 'STEM');
  assert.strictEqual(students.studentInsights.categoriesMostSaved[0].savedInterest, 2);
  assert.strictEqual(
    students.studentInsights.savedSeries.reduce((sum, bucket) => sum + bucket.count, 0),
    2
  );
  assert.ok(!JSON.stringify(students).includes('Ana Cruz'));
  assert.ok(!JSON.stringify(students).includes('@'));

  const providers = await buildProviderInsights(week);
  assert.strictEqual(providers.providerInsights.emailVerification.verified, 1);
  assert.strictEqual(providers.providerInsights.emailVerification.unverified, 1);
  assert.strictEqual(providers.providerInsights.organizationVerification.find((row) => row.status === 'Approved').count, 1);
  assert.strictEqual(providers.providerInsights.organizationVerification.find((row) => row.status === 'Pending Review').count, 0);
  assert.strictEqual(providers.providerInsights.accountStatus.suspended, 1);
  assert.strictEqual(providers.providerInsights.scholarshipsByProvider.rows[0].institutionName, 'North Foundation');
  assert.strictEqual(providers.providerInsights.scholarshipsByProvider.rows[0].availableScholarships, 6);
  assert.strictEqual(providers.providerInsights.scholarshipsByProvider.rows[1].accountSuspended, true);
  assert.strictEqual(providers.providerInsights.scholarshipsByProvider.rows[1].availableScholarships, 0);
  assert.ok(!JSON.stringify(providers.providerInsights.scholarshipsByProvider).includes('North Contact'));

  const emptyWeek = parsedFor({ range: '7d' });
  const savedUsers = db.users;
  const savedScholarships = db.scholarships;
  db.users = [];
  db.scholarships = [];
  db.savedmatches = [];
  db.applications = [];
  db.studentprofiles = [];
  db.categorydemandevents = [];
  db.providers = [];
  const empty = await buildOverview(emptyWeek);
  assert.strictEqual(empty.overview.totalRegisteredUsers, 0);
  assert.strictEqual(empty.overview.activeOpenScholarships, 0);
  assert.strictEqual(empty.overview.totalSavedScholarships, 0);
  assert.strictEqual(empty.overview.totalRecordedApplications, 0);
  const emptyRegistrations = await buildRegistrations(emptyWeek);
  assert.strictEqual(emptyRegistrations.registrations.series.length, 7);
  assert.ok(emptyRegistrations.registrations.series.every((bucket) => bucket.total === 0));
  db.users = savedUsers;
  db.scholarships = savedScholarships;
  loadFixtures();

  const csv = renderReportCsv('Scholarship category demand matrix', demand, NOW);
  const formulaLine = csv.split('\n').find((line) => line.includes('HYPERLINK'));
  assert.ok(formulaLine, 'Expected the formula-like category in the CSV');
  assert.ok(formulaLine.startsWith(`"'=HYPERLINK`) || formulaLine.includes(`"'=HYPERLINK`));
  assert.ok(!csv.split('\n').some((line) => line.startsWith('=HYPERLINK')));
  assert.ok(csv.includes('Saved interest'));
  assert.ok(csv.includes('Recorded applications'));
  assert.match(csv, /STEM,2,/);
  assert.ok(csv.includes(NOW.toISOString()));
  assert.ok(csv.includes('2026-10-23'));
  assert.ok(csv.includes('2026-10-29'));
  assert.ok(!csv.includes('Academic level filter'));
  assert.ok(!csv.includes('Region filter'));

  const rejectedText = normalizeDemandInput({ query: 'Juan Dela Cruz scholarship', region: 'Ilocos Region' });
  assert.strictEqual(rejectedText.ok, false);
  const normalized = normalizeDemandInput({
    academicLevel: 'Undergraduate',
    region: 'Ilocos Region',
    eligibilityTags: ['isPWD'],
  });
  assert.strictEqual(normalized.ok, true);
  assert.deepStrictEqual(normalized.events, [
    { dimension: 'academicLevel', value: 'College' },
    { dimension: 'region', value: 'Ilocos Region' },
    { dimension: 'eligibilityTag', value: 'Person with Disability (PWD)' },
  ]);

  const seen = [];
  let clock = new Date('2026-10-29T02:00:00.000Z').getTime();
  const recorder = createDemandRecorder({
    insertMany: async (docs) => {
      seen.push(...docs);
    },
    now: () => new Date(clock),
  });
  const firstRecord = await recorder({ userId: 'student-1', body: { region: 'Ilocos Region' } });
  const duplicate = await recorder({ userId: 'student-1', body: { region: 'Ilocos Region' } });
  assert.strictEqual(firstRecord.recorded, 1);
  assert.strictEqual(duplicate.recorded, 0);
  assert.strictEqual(duplicate.skippedDuplicates, 1);
  assert.deepStrictEqual(Object.keys(seen[0]).sort(), ['dimension', 'value']);
  clock += 11 * 60 * 1000;
  const later = await recorder({ userId: 'student-1', body: { region: 'Ilocos Region' } });
  assert.strictEqual(later.recorded, 1);

  const demandResponse = await invoke(recordFilterDemand, {
    user: { _id: 'student-1' },
    body: { academicLevel: 'College', email: 'student@example.com' },
  });
  assert.strictEqual(demandResponse.statusCode, 400);
  const acceptedDemand = await invoke(recordFilterDemand, {
    user: { _id: 'student-1', email: 'student@example.com' },
    body: { region: 'Davao Region' },
  });
  assert.strictEqual(acceptedDemand.statusCode, 200);
  assert.strictEqual(acceptedDemand.body.recorded, 1);
  assert.deepStrictEqual(insertedDemand.at(-1), { dimension: 'region', value: 'Davao Region' });

  const server = await startServer();
  try {
    const adminToken = tokenFor('admin-1', 'admin');
    const studentToken = tokenFor('student-http', 'student');
    const providerToken = tokenFor('provider-http', 'provider');

    const missing = await request(server, '/api/v1/admin/analytics/overview');
    assert.strictEqual(missing.status, 401);

    const forbidden = await request(server, '/api/v1/admin/analytics/overview', { token: studentToken });
    assert.strictEqual(forbidden.status, 403);

    const providerForbidden = await request(server, '/api/v1/admin/analytics/category-demand', { token: providerToken });
    assert.strictEqual(providerForbidden.status, 403);

    const allowed = await request(server, '/api/v1/admin/analytics/overview', { token: adminToken });
    assert.strictEqual(allowed.status, 200);
    assert.strictEqual(allowed.body.success, true);
    assert.strictEqual(typeof allowed.body.overview.totalRegisteredUsers, 'number');

    const badQuery = await request(server, '/api/v1/admin/analytics/registrations?range=12d', { token: adminToken });
    assert.strictEqual(badQuery.status, 400);

    const jsonReport = await request(server, '/api/v1/admin/analytics/category-demand?range=30d', { token: adminToken });
    const exported = await request(server, '/api/v1/admin/analytics/export?report=category-demand&range=30d', { token: adminToken });
    assert.strictEqual(exported.status, 200);
    assert.match(exported.contentType, /text\/csv/);
    assert.match(exported.disposition, /iskolarmatch-category-demand-/);
    const stemAvailable = jsonReport.body.categoryDemand.rows.find((row) => row.category === 'STEM').availableScholarships;
    assert.match(exported.text, new RegExp(`STEM,${stemAvailable},`));
    assert.ok(exported.text.includes('HYPERLINK'));
    assert.ok(!exported.text.split('\n').some((line) => line.startsWith('=')));
    assert.strictEqual(audits.at(-1).action, 'ANALYTICS_REPORT_EXPORT');
    assert.match(audits.at(-1).details, /category-demand/);
    assert.ok(!audits.at(-1).details.includes('@'));

    const badExport = await request(server, '/api/v1/admin/analytics/export?report=passwords', { token: adminToken });
    assert.strictEqual(badExport.status, 400);

    const badProviderPage = await request(server, '/api/v1/admin/analytics/provider-insights?limit=0', { token: adminToken });
    assert.strictEqual(badProviderPage.status, 400);

    const plainStudents = await request(server, '/api/v1/admin/analytics/student-insights?range=7d', { token: adminToken });
    const staleFilters = await request(
      server,
      '/api/v1/admin/analytics/student-insights?range=7d&academicLevel=Senior+High+School&region=Davao+Region',
      { token: adminToken }
    );
    assert.strictEqual(staleFilters.status, 200);
    assert.strictEqual(staleFilters.body.filters, undefined);
    assert.strictEqual(staleFilters.body.period.academicLevel, undefined);
    assert.strictEqual(staleFilters.body.period.region, undefined);
    assert.strictEqual(
      staleFilters.body.studentInsights.profiles.total,
      plainStudents.body.studentInsights.profiles.total
    );
    assert.strictEqual(staleFilters.body.studentInsights.profiles.total, 2);

    const staleOverview = await request(
      server,
      '/api/v1/admin/analytics/overview?range=7d&academicLevel=Graduate%20Studies&region=Caraga',
      { token: adminToken }
    );
    assert.strictEqual(staleOverview.status, 200);
    assert.strictEqual(staleOverview.body.overview.totalStudents, 2);
    assert.strictEqual(staleOverview.body.overview.activeOpenScholarships, 6);
    assert.strictEqual(staleOverview.body.overview.savedScholarshipsInPeriod, 2);
    assert.strictEqual(staleOverview.body.overview.recordedApplicationsInPeriod, 1);

    const ignoredLevel = await request(
      server,
      '/api/v1/admin/analytics/scholarships?range=30d&academicLevel=Elementary',
      { token: adminToken }
    );
    assert.strictEqual(ignoredLevel.status, 200);
    assert.strictEqual(ignoredLevel.body.scholarships.totalListings, 10);

    const ignoredRegion = await request(
      server,
      '/api/v1/admin/analytics/category-demand?range=30d&region=Narnia',
      { token: adminToken }
    );
    assert.strictEqual(ignoredRegion.status, 200);
    assert.strictEqual(
      ignoredRegion.body.categoryDemand.rows.reduce((sum, row) => sum + row.totalListings, 0),
      10
    );

    const exportedStudents = await request(
      server,
      '/api/v1/admin/analytics/export?report=student-insights&range=7d&academicLevel=College&region=Ilocos+Region',
      { token: adminToken }
    );
    assert.strictEqual(exportedStudents.status, 200);
    assert.ok(!exportedStudents.text.includes('Academic level filter'));
    assert.ok(!exportedStudents.text.includes('Region filter'));
    assert.ok(exportedStudents.text.includes('Academic level,Students'));
    assert.ok(exportedStudents.text.includes('Student region,Students'));
    assert.ok(exportedStudents.text.includes(`Student profiles,${plainStudents.body.studentInsights.profiles.total}`));
    assert.strictEqual(audits.at(-1).action, 'ANALYTICS_REPORT_EXPORT');
    assert.match(audits.at(-1).details, /student-insights/);

    const demandDenied = await request(server, '/api/v1/students/analytics/filter-demand', {
      method: 'POST',
      token: providerToken,
      body: { region: 'Ilocos Region' },
    });
    assert.strictEqual(demandDenied.status, 403);

    const demandAnon = await request(server, '/api/v1/students/analytics/filter-demand', {
      method: 'POST',
      body: { region: 'Ilocos Region' },
    });
    assert.strictEqual(demandAnon.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log('Admin analytics tests passed');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
