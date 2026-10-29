/**
 * Operations dashboard counts, activity redaction, alerts, and admin authorization.
 * Model methods are stand-ins. This does not open a database connection.
 */
const assert = require('assert');
const express = require('express');
const jwt = require('jsonwebtoken');
const Module = require('module');

const secret = 'operations-dashboard-test-secret';
process.env.JWT_SECRET = secret;

const redisPath = require.resolve('../config/redis');
const redisModule = new Module(redisPath, module);
redisModule.filename = redisPath;
redisModule.loaded = true;
redisModule.exports = { isOpen: false, isReady: false, on() {} };
require.cache[redisPath] = redisModule;

const User = require('../models/User');
const Provider = require('../models/Provider');
const Scholarship = require('../models/Scholarship');
const Report = require('../models/Report');
const EligibilityCriterionRequest = require('../models/EligibilityCriterionRequest');
const SystemConfig = require('../models/SystemConfig');
const AuditLog = require('../models/AuditLog');
const { installMemoryRevocationStore } = require('./revocationStoreStub');

installMemoryRevocationStore();

const adminRoutes = require('../routes/adminRoutes');
const { getAdminDashboard, getAdminUsers } = require('../controllers/adminController');
const operations = require('../services/adminOperationsService');

const state = {
  fail: null,
  accounts: [],
  verification: [],
  open: 0,
  archived: 0,
  reports: 0,
  eligibility: 0,
  config: null,
  activity: [],
  providers: [],
};

const calls = {
  scholarships: [],
  reports: [],
  eligibility: [],
  audit: null,
  providerFind: null,
  scholarshipFind: 0,
  userList: [],
};

const queryChain = (result) => {
  const api = {
    select() { return api; },
    populate() { return api; },
    sort() { return api; },
    skip() { return api; },
    limit() { return api; },
    lean: async () => result,
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return api;
};

const accountsById = {
  'admin-1': { _id: 'admin-1', role: 'admin', status: 'active' },
  'super-1': { _id: 'super-1', role: 'superadmin', status: 'active' },
  'super-2': { _id: 'super-2', role: 'super_admin', status: 'active' },
  'student-1': { _id: 'student-1', role: 'student', status: 'active' },
  'provider-1': { _id: 'provider-1', role: 'provider', status: 'active' },
};

const tokenFor = (id) => jwt.sign(
  { id, role: accountsById[id].role, status: 'active' },
  secret,
  { expiresIn: '1h' }
);

const throwIf = (label) => {
  if (state.fail === label) {
    throw new Error('mongodb://admin:s3cret@localhost/iskolarmatch');
  }
};

User.findById = (id) => queryChain(accountsById[String(id)] || null);
User.aggregate = async () => {
  throwIf('accounts');
  return state.accounts;
};
User.find = (filter = {}) => {
  calls.userList.push(filter);
  return queryChain([]);
};
User.countDocuments = async (filter = {}) => {
  calls.userList.push(filter);
  return 0;
};

Provider.aggregate = async () => {
  throwIf('verification');
  return state.verification;
};
Provider.find = () => {
  calls.providerFind = (calls.providerFind || 0) + 1;
  throw new Error('Dashboard must not load provider contact records');
};
Provider.findOne = () => queryChain(null);

Scholarship.countDocuments = async (filter) => {
  calls.scholarships.push(filter);
  throwIf('scholarships');
  if (filter.status === 'Open') return state.open;
  return state.archived;
};
Scholarship.find = () => {
  calls.scholarshipFind += 1;
  throw new Error('Scholarship.find should not run for the operations dashboard');
};

Report.countDocuments = async (filter) => {
  calls.reports.push(filter);
  throwIf('reports');
  return state.reports;
};
EligibilityCriterionRequest.countDocuments = async (filter) => {
  calls.eligibility.push(filter);
  throwIf('eligibility');
  return state.eligibility;
};
SystemConfig.findOne = () => {
  throwIf('config');
  return queryChain(state.config);
};
AuditLog.find = (filter) => {
  calls.audit = filter;
  throwIf('activity');
  return queryChain(state.activity);
};

const errorHandler = require('../middleware/error');

const invoke = (handler, req = {}) => new Promise((resolve, reject) => {
  let settled = false;
  const finish = (result) => {
    if (settled) return;
    settled = true;
    resolve(result);
  };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      finish({ statusCode: this.statusCode, body });
    },
  };
  Promise.resolve(handler(req, res, (error) => {
    if (error) {
      errorHandler(error, req, res, () => {});
      return;
    }
    finish({ statusCode: res.statusCode, body: res.body, nextCalled: true });
  })).catch(reject);
});

const startServer = () => new Promise((resolve) => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin', adminRoutes);
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
});

const requestJson = async (server, path, token) => {
  const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: response.status, body: await response.json() };
};

const withExpectedConsoleErrors = async (fn) => {
  const original = console.error;
  console.error = (...args) => {
    const text = args.map((item) => (item instanceof Error ? item.message : String(item))).join(' ');
    if (text.includes('Admin operations dashboard error')) return;
    if (text.includes('mongodb://admin:s3cret@localhost/iskolarmatch')) return;
    original(...args);
    throw new Error(`unexpected console.error: ${text}`);
  };
  try {
    return await fn();
  } finally {
    console.error = original;
  }
};

const sampleAccounts = () => ([
  { _id: { role: 'student', status: 'active' }, count: 2 },
  { _id: { role: 'student', status: 'pending_consent' }, count: 1 },
  { _id: { role: 'student', status: 'suspended' }, count: 1 },
  { _id: { role: 'provider', status: 'active' }, count: 3 },
  { _id: { role: 'provider', status: 'suspended' }, count: 1 },
  { _id: { role: 'admin', status: 'active' }, count: 1 },
]);

const sampleVerification = () => ([
  { _id: 'Pending Review', count: 2 },
  { _id: 'Submitted', count: 1 },
  { _id: 'Verified', count: 3 },
  { _id: 'Approved', count: 1 },
  { _id: 'Rejected', count: 4 },
]);

const activityRow = (index, action, extra = {}) => ({
  _id: `audit-${index}`,
  action,
  severity: index % 2 === 0 ? 'Warning' : 'Info',
  createdAt: new Date(Date.UTC(2026, 0, 10, 12, index, 0)).toISOString(),
  actor: 'Ada Admin',
  details: 'Registered leak@student.test with password s3cret-password and token jwt-token-value',
  ipAddress: '10.1.1.1',
  ...extra,
});

const loadHappyState = () => {
  state.fail = null;
  state.accounts = sampleAccounts();
  state.verification = sampleVerification();
  state.open = 5;
  state.archived = 2;
  state.reports = 6;
  state.eligibility = 1;
  state.config = { maintenanceMode: true };
  state.activity = [
    {
      _id: 'audit-secret-only',
      action: 'PASSWORD_CHANGED',
      severity: 'Critical',
      createdAt: '2026-02-02T03:04:05.000Z',
      details: 'Password changed for leak@student.test. Token jwt-token-value.',
    },
    ...Array.from({ length: 9 }, (_, index) => activityRow(index, 'USER_REGISTER')),
    activityRow(20, 'USER_LOGIN'),
    activityRow(21, 'PASSWORD_CHANGED', { createdAt: null, severity: 'Info' }),
  ];
  calls.scholarships = [];
  calls.reports = [];
  calls.eligibility = [];
  calls.audit = null;
  calls.providerFind = 0;
  calls.scholarshipFind = 0;
};

const assertNoSensitiveActivity = (payload) => {
  const activity = JSON.stringify(payload.activity || []);
  assert.equal(activity.includes('leak@student.test'), false);
  assert.equal(activity.includes('s3cret-password'), false);
  assert.equal(activity.includes('jwt-token-value'), false);
  assert.equal(activity.includes('10.1.1.1'), false);
  assert.equal(activity.includes('Ada Admin'), false);
  (payload.activity || []).forEach((row) => {
    assert.deepEqual(Object.keys(row).sort(), ['action', 'createdAt', 'description', 'id', 'severity']);
    assert.equal(Object.prototype.hasOwnProperty.call(row, 'details'), false);
  });
};

const main = async () => {
  assert.equal(operations.matchesOpenScholarship({
    status: 'Open',
    isArchived: false,
    adminRemovedAt: null,
    providerStatus: 'suspended',
  }), true);
  assert.equal(operations.matchesOpenScholarship({
    status: 'Open',
    isArchived: false,
    adminRemovedAt: undefined,
  }), true);
  assert.equal(operations.matchesOpenScholarship({
    status: 'Closed',
    isArchived: false,
    adminRemovedAt: null,
  }), false);
  assert.equal(operations.matchesOpenScholarship({
    status: 'Open',
    isArchived: true,
    adminRemovedAt: null,
  }), false);
  assert.equal(operations.matchesOpenScholarship({
    status: 'Open',
    isArchived: false,
    adminRemovedAt: new Date('2026-01-01T00:00:00.000Z'),
  }), false);
  assert.equal(operations.matchesArchivedScholarship({
    status: 'Open',
    isArchived: false,
    adminRemovedAt: new Date('2026-01-01T00:00:00.000Z'),
  }), true);
  assert.equal(operations.matchesArchivedScholarship({ isArchived: true, adminRemovedAt: null }), true);
  assert.equal(operations.matchesArchivedScholarship({
    status: 'Open',
    isArchived: false,
    adminRemovedAt: null,
  }), false);

  assert.deepEqual(operations.OPEN_SCHOLARSHIP_FILTER, {
    status: 'Open',
    isArchived: false,
    adminRemovedAt: null,
  });
  assert.deepEqual(operations.ARCHIVED_SCHOLARSHIP_FILTER, {
    $or: [{ isArchived: true }, { adminRemovedAt: { $ne: null } }],
  });

  const tallied = operations.tallyAccounts(sampleAccounts());
  assert.equal(tallied.studentAccounts, 4);
  assert.equal(tallied.providerAccounts, 4);
  assert.equal(tallied.activeAccounts, 6);
  assert.equal(tallied.suspendedAccounts, 2);
  assert.equal(tallied.pendingConsentStudents, 1);
  assert.deepEqual(operations.tallyAccounts([]), {
    studentAccounts: 0,
    providerAccounts: 0,
    activeAccounts: 0,
    suspendedAccounts: 0,
    pendingConsentStudents: 0,
  });
  assert.deepEqual(operations.tallyVerification(sampleVerification()), {
    pendingProviderVerifications: 3,
    verifiedProviderOrganizations: 4,
  });
  assert.deepEqual(operations.tallyVerification([]), {
    pendingProviderVerifications: 0,
    verifiedProviderOrganizations: 0,
  });

  const hidden = operations.presentOperationalActivity({
    _id: 'secret-row',
    action: 'USER_REGISTER',
    severity: 'Info',
    createdAt: '2026-04-01T00:00:00.000Z',
    details: 'leak@student.test s3cret-password jwt-token-value',
    actor: 'Ada Admin',
  });
  assert.equal(hidden.description, 'A new account was registered.');
  assert.equal(JSON.stringify(hidden).includes('leak@student.test'), false);
  assert.equal(operations.presentOperationalActivity({
    action: 'USER_LOGIN',
    createdAt: '2026-04-01T00:00:00.000Z',
    details: 'signed in',
  }), null);
  assert.equal(operations.presentOperationalActivity({
    action: 'PASSWORD_CHANGED',
    createdAt: 'not-a-date',
  }), null);

  loadHappyState();
  const dashboard = await operations.loadOperationsDashboard();
  assert.equal(dashboard.summary.scope, 'current');
  assert.equal(dashboard.summary.studentAccounts, 4);
  assert.equal(dashboard.summary.providerAccounts, 4);
  assert.equal(dashboard.summary.activeAccounts, 6);
  assert.equal(dashboard.summary.suspendedAccounts, 2);
  assert.equal(dashboard.summary.verifiedProviderOrganizations, 4);
  assert.equal(dashboard.summary.openScholarships, 5);
  assert.equal(dashboard.summary.archivedScholarships, 2);
  assert.match(dashboard.summary.captions.openScholarships, /suspended providers/i);
  assert.match(dashboard.summary.captions.activeAccounts, /not the verified-organization count/i);
  assert.match(dashboard.summary.captions.providerAccounts, /Separate from verified organizations/i);
  assert.equal(dashboard.pendingActions.map((item) => item.count).join(','), '3,6,1,1');
  assert.deepEqual(dashboard.pendingActions.map((item) => item.path), [
    '/dashboard/admin/verification',
    '/dashboard/admin/moderation?status=Unresolved',
    '/dashboard/admin/eligibility-criteria?status=Pending',
    '/dashboard/admin/users?role=student&status=pending_consent',
  ]);
  assert.equal(dashboard.activity.length, 8);
  assert.equal(dashboard.activity.some((item) => item.action === 'USER_LOGIN'), false);
  assert.equal(dashboard.activity.some((item) => item.id === 'audit-secret-only'), true);
  assert.equal(dashboard.activity.find((item) => item.id === 'audit-secret-only').description, 'An account password was changed.');
  assertNoSensitiveActivity(dashboard);
  assert.equal(dashboard.alerts.length, 1);
  assert.equal(dashboard.alerts[0].id, 'maintenance-mode');
  assert.equal(dashboard.alerts[0].path, '/dashboard/admin/settings');
  assert.equal(/healthy/i.test(JSON.stringify(dashboard)), false);
  assert.equal(dashboard.pendingListings, undefined);
  assert.equal(dashboard.pendingConsents, undefined);
  assert.equal(dashboard.pendingProviders, undefined);
  assert.equal(JSON.stringify(dashboard).includes('ops@north.test'), false);
  assert.equal(JSON.stringify(dashboard).includes('@'), false);
  assert.equal(calls.scholarshipFind, 0);
  assert.equal(calls.scholarships.length, 2);
  assert.deepEqual(
    calls.scholarships.find((filter) => filter.status === 'Open'),
    operations.OPEN_SCHOLARSHIP_FILTER
  );
  assert.deepEqual(
    calls.scholarships.find((filter) => filter.$or),
    operations.ARCHIVED_SCHOLARSHIP_FILTER
  );
  assert.deepEqual(calls.reports[0], { status: { $in: ['Pending Review', 'Under Investigation'] } });
  assert.deepEqual(calls.eligibility[0], { status: 'Pending' });
  assert.deepEqual(calls.audit, { action: { $in: operations.ACTIVITY_ACTIONS } });
  assert.equal(operations.ACTIVITY_ACTIONS.includes('USER_LOGIN'), false);
  assert.equal(calls.providerFind, 0);
  assert.equal(Array.isArray(dashboard.metrics), true);

  state.accounts = [];
  state.verification = [];
  state.open = 0;
  state.archived = 0;
  state.reports = 0;
  state.eligibility = 0;
  state.config = null;
  state.activity = [];
  state.fail = null;
  const empty = await operations.loadOperationsDashboard();
  assert.equal(empty.summary.studentAccounts, 0);
  assert.equal(empty.summary.providerAccounts, 0);
  assert.equal(empty.summary.activeAccounts, 0);
  assert.equal(empty.summary.suspendedAccounts, 0);
  assert.equal(empty.summary.verifiedProviderOrganizations, 0);
  assert.equal(empty.summary.openScholarships, 0);
  assert.equal(empty.summary.archivedScholarships, 0);
  assert.deepEqual(empty.pendingActions.map((item) => item.count), [0, 0, 0, 0]);
  assert.deepEqual(empty.activity, []);
  assert.deepEqual(empty.alerts, []);
  assert.equal(empty.pendingProviders, undefined);
  assert.equal(/healthy/i.test(JSON.stringify(empty)), false);

  state.fail = 'accounts';
  await assert.rejects(() => operations.loadOperationsDashboard(), /mongodb:\/\/admin:s3cret/);
  const failed = await withExpectedConsoleErrors(() => invoke(getAdminDashboard, {}));
  assert.equal(failed.statusCode, 500);
  assert.equal(failed.body.success, false);
  assert.equal(failed.body.summary, undefined);
  assert.equal(failed.body.metrics, undefined);
  assert.equal(failed.body.alerts[0].id, 'database-read');
  assert.equal(JSON.stringify(failed.body).includes('mongodb://'), false);
  assert.equal(JSON.stringify(failed.body).includes('s3cret'), false);
  assert.equal(/healthy/i.test(JSON.stringify(failed.body)), false);
  state.fail = null;

  state.fail = null;
  calls.userList = [];
  const consentList = await invoke(getAdminUsers, {
    query: { role: 'student', status: 'pending_consent' },
  });
  assert.equal(consentList.statusCode, 200);
  assert.ok(calls.userList.length >= 1);
  calls.userList.forEach((filter) => {
    assert.deepEqual(filter, { role: 'student', status: 'pending_consent' });
  });
  const invalidStatus = await invoke(getAdminUsers, { query: { status: 'Published' } });
  assert.equal(invalidStatus.statusCode, 400);

  const dashboardRoute = adminRoutes.stack.find((layer) => layer.route && layer.route.path === '/dashboard');
  assert.ok(dashboardRoute);
  assert.equal(dashboardRoute.route.methods.get, true);
  const gates = adminRoutes.stack.filter((layer) => !layer.route);
  assert.equal(gates[0].handle.name, 'protect');
  const roleGate = gates[1].handle;
  const studentGate = await invoke(roleGate, { user: { role: 'student' } });
  assert.equal(studentGate.statusCode, 403);
  const providerGate = await invoke(roleGate, { user: { role: 'provider' } });
  assert.equal(providerGate.statusCode, 403);
  const anonymousGate = await invoke(roleGate, {});
  assert.equal(anonymousGate.statusCode, 401);
  const adminGate = await invoke(roleGate, { user: { role: 'admin' } });
  assert.equal(adminGate.body, null);
  const superGate = await invoke(roleGate, { user: { role: 'super_admin' } });
  assert.equal(superGate.body, null);

  loadHappyState();
  const server = await startServer();
  try {
    const missing = await requestJson(server, '/api/v1/admin/dashboard');
    assert.equal(missing.status, 401);
    const student = await requestJson(server, '/api/v1/admin/dashboard', tokenFor('student-1'));
    assert.equal(student.status, 403);
    const provider = await requestJson(server, '/api/v1/admin/dashboard', tokenFor('provider-1'));
    assert.equal(provider.status, 403);
    const admin = await requestJson(server, '/api/v1/admin/dashboard', tokenFor('admin-1'));
    assert.equal(admin.status, 200);
    assert.equal(admin.body.success, true);
    assert.equal(admin.body.summary.openScholarships, 5);
    assert.equal(admin.body.pendingProviders, undefined);
    assert.equal(admin.body.pendingListings, undefined);
    assert.equal(admin.body.pendingConsents, undefined);
    assert.equal(JSON.stringify(admin.body).includes('@'), false);
    assertNoSensitiveActivity(admin.body);
    const superadmin = await requestJson(server, '/api/v1/admin/dashboard', tokenFor('super-1'));
    assert.equal(superadmin.status, 200);
    const legacySuperadmin = await requestJson(server, '/api/v1/admin/dashboard', tokenFor('super-2'));
    assert.equal(legacySuperadmin.status, 200);

    state.fail = 'reports';
    const broken = await withExpectedConsoleErrors(() => (
      requestJson(server, '/api/v1/admin/dashboard', tokenFor('admin-1'))
    ));
    assert.equal(broken.status, 500);
    assert.equal(broken.body.summary, undefined);
    assert.equal(broken.body.alerts[0].id, 'database-read');
    assert.equal(broken.body.pendingActions, undefined);
    assert.equal(JSON.stringify(broken.body).includes('mongodb://'), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log('admin operations dashboard tests passed');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
