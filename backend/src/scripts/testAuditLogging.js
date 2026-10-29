/**
 * Audit insert results and the security events added in phase 1.
 * MongoDB is not required. AuditLog.create is a stand-in except for the
 * disconnected-database check, which uses the real model method.
 */
const assert = require('assert');
const mongoose = require('mongoose');

const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const Provider = require('../models/Provider');
const Scholarship = require('../models/Scholarship');
const Report = require('../models/Report');
const auditController = require('../controllers/auditController');
const { login } = require('../controllers/authController');
const scholarshipController = require('../controllers/scholarshipController');
const { createScholarshipReport } = require('../controllers/scholarshipReportController');
const { updateModerationReport } = require('../controllers/moderationController');
const { exportReport } = require('../controllers/adminAnalyticsController');
const analytics = require('../services/adminAnalyticsService');
const documentRoutes = require('../routes/documentRoutes');
const searchSync = require('../services/scholarshipSearchSync');
const matchCache = require('../services/matchCache');
const errorHandler = require('../middleware/error');

const SECRET = 'horse-battery-correct';
const SCHOLARSHIP_ID = '64b000000000000000000009';

const audits = [];
let createImpl = async (entry) => {
  audits.push(entry);
  return { _id: `audit-${audits.length}`, ...entry };
};

const originalCreate = AuditLog.create;
const originalFind = AuditLog.find;
const originalCount = AuditLog.countDocuments;
const originals = {
  userFindOne: User.findOne,
  providerFindOne: Provider.findOne,
  providerFindById: Provider.findById,
  scholarshipCreate: Scholarship.create,
  scholarshipFindOne: Scholarship.findOne,
  scholarshipFindById: Scholarship.findById,
  reportFindOne: Report.findOne,
  reportFindById: Report.findById,
  reportCreate: Report.create,
  sync: searchSync.syncScholarshipSearch,
  invalidate: matchCache.invalidateMatchCache,
  bucket: mongoose.mongo.GridFSBucket,
  registrations: analytics.BUILDERS.registrations,
  render: analytics.renderReportCsv,
  db: mongoose.connection.db,
};

const emptyAuditQuery = () => ({
  sort() { return this; },
  skip() { return this; },
  limit() { return this; },
  lean: async () => [],
});

const restore = () => {
  AuditLog.create = originalCreate;
  AuditLog.find = originalFind;
  AuditLog.countDocuments = originalCount;
  User.findOne = originals.userFindOne;
  Provider.findOne = originals.providerFindOne;
  Provider.findById = originals.providerFindById;
  Scholarship.create = originals.scholarshipCreate;
  Scholarship.findOne = originals.scholarshipFindOne;
  Scholarship.findById = originals.scholarshipFindById;
  Report.findOne = originals.reportFindOne;
  Report.findById = originals.reportFindById;
  Report.create = originals.reportCreate;
  searchSync.syncScholarshipSearch = originals.sync;
  matchCache.invalidateMatchCache = originals.invalidate;
  mongoose.mongo.GridFSBucket = originals.bucket;
  analytics.BUILDERS.registrations = originals.registrations;
  analytics.renderReportCsv = originals.render;
  mongoose.connection.db = originals.db;
};

const installCreate = () => {
  AuditLog.create = (entry) => createImpl(entry);
};

const mockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
  return res;
};

const invoke = async (handler, req) => {
  const res = mockRes();
  await handler(req, res, (err) => {
    if (err) errorHandler(err, req, res, () => {});
  });
  return res;
};

const containsSecret = (value) => JSON.stringify(value).includes(SECRET);

const providerUser = {
  id: 'user-1',
  _id: 'user-1',
  name: 'Pat Provider',
  email: 'pat@example.com',
  role: 'provider',
};

const scholarshipBody = {
  name: 'City Grant',
  scholarshipType: 'Merit',
  description: 'For local students.',
  grantValue: '10000',
  deadline: '2026-12-31',
  applicationURL: 'https://example.test/apply',
};

const run = async () => {
  assert.notStrictEqual(mongoose.connection.readyState, 1);
  const disconnected = await auditController.recordAuditLog({
    actor: 'System',
    role: 'System',
    action: 'HEALTH_CHECK',
    details: 'Database was not connected.',
  });
  assert.strictEqual(disconnected.ok, false);
  assert.strictEqual(disconnected.message, auditController.AUDIT_NOT_SAVED);

  installCreate();
  searchSync.syncScholarshipSearch = async () => ({ synchronized: true });
  matchCache.invalidateMatchCache = async () => ({ ok: true });

  const saved = await auditController.recordAuditLog({
    actor: 'Ada Admin',
    role: 'admin',
    action: 'HEALTH_CHECK',
    details: 'Insert succeeded.',
    severity: 'Info',
  });
  assert.strictEqual(saved.ok, true);
  assert.ok(saved.id);
  assert.strictEqual(audits.at(-1).role, 'Admin');
  assert.strictEqual(audits.at(-1).action, 'HEALTH_CHECK');

  const beforeGuest = audits.length;
  const rejectedRole = await auditController.recordAuditLog({
    actor: 'Visitor',
    role: 'Guest',
    action: 'DOCUMENT_ACCESS',
    details: 'This role is not in the audit schema.',
  });
  assert.strictEqual(rejectedRole.ok, false);
  assert.strictEqual(audits.length, beforeGuest);

  createImpl = async () => {
    throw new Error('audit store unavailable');
  };
  const failedInsert = await auditController.recordAuditLog({
    actor: 'Ada Admin',
    role: 'Admin',
    action: 'HEALTH_CHECK',
    details: 'Insert failed.',
  });
  assert.strictEqual(failedInsert.ok, false);
  assert.strictEqual(failedInsert.message, auditController.AUDIT_NOT_SAVED);

  AuditLog.find = emptyAuditQuery;
  AuditLog.countDocuments = async () => 0;
  const exportFailure = await invoke(auditController.logExportAction, {
    user: { name: 'Ada Admin', email: 'ada@example.com', role: 'superadmin' },
    ip: '203.0.113.8',
    headers: {},
  });
  assert.strictEqual(exportFailure.statusCode, 500);
  assert.strictEqual(exportFailure.body.success, false);
  assert.strictEqual(exportFailure.body.message, 'Failed to record export audit action');
  assert.strictEqual(exportFailure.body.message.includes('recorded successfully'), false);
  assert.strictEqual(exportFailure.body.warnings[0].step, 'audit');

  createImpl = async (entry) => {
    audits.push(entry);
    return { _id: `audit-${audits.length}`, ...entry };
  };
  const exportSuccess = await invoke(auditController.logExportAction, {
    user: { name: 'Ada Admin', email: 'ada@example.com', role: 'admin' },
    ip: '203.0.113.8',
    headers: {},
  });
  assert.strictEqual(exportSuccess.statusCode, 200);
  assert.match(String(exportSuccess.headers['Content-Type']), /text\/csv/);
  assert.strictEqual(typeof exportSuccess.body, 'string');
  assert.match(exportSuccess.body, /Timestamp,Actor,Role,Action,Details,IP Address,Severity/);
  assert.strictEqual(String(exportSuccess.body).includes('recorded successfully'), false);
  assert.strictEqual(audits.at(-1).action, 'EXPORT_LOGS');
  assert.strictEqual(audits.at(-1).role, 'Admin');

  const missingPassword = await invoke(login, {
    body: { email: 'ada@example.com', password: '' },
    ip: '203.0.113.9',
    headers: {},
  });
  assert.strictEqual(missingPassword.statusCode, 400);
  assert.strictEqual(audits.at(-1).action, 'LOGIN_FAILED');
  assert.match(audits.at(-1).details, /email or password was missing/i);
  assert.strictEqual(containsSecret(audits.at(-1)), false);

  const missingEmail = await invoke(login, {
    body: { password: SECRET },
    ip: '203.0.113.9',
    headers: {},
  });
  assert.strictEqual(missingEmail.statusCode, 400);
  assert.strictEqual(audits.at(-1).actor, 'Unknown');
  assert.strictEqual(containsSecret(audits), false);

  User.findOne = () => ({ select: async () => null });
  const unknown = await invoke(login, {
    body: { email: 'missing@example.com', password: SECRET },
    ip: '203.0.113.10',
    headers: {},
  });
  assert.strictEqual(unknown.statusCode, 401);
  assert.match(unknown.body.error, /invalid credentials/i);
  assert.strictEqual(audits.at(-1).action, 'LOGIN_FAILED');
  assert.match(audits.at(-1).details, /No account matched/);
  assert.strictEqual(containsSecret(audits), false);

  const lockedUser = {
    _id: 'user-locked',
    email: 'locked@example.com',
    role: 'student',
    status: 'active',
    lockUntil: new Date(Date.now() + 60 * 1000),
    async matchPassword() {
      throw new Error('password must not be checked during an active lock');
    },
  };
  User.findOne = () => ({ select: async () => lockedUser });
  const locked = await invoke(login, {
    body: { email: lockedUser.email, password: SECRET },
    ip: '203.0.113.11',
    headers: {},
  });
  assert.strictEqual(locked.statusCode, 429);
  assert.strictEqual(audits.at(-1).action, 'LOGIN_FAILED');
  assert.match(audits.at(-1).details, /temporarily locked/);
  assert.match(audits.at(-1).details, /user-locked/);
  assert.strictEqual(containsSecret(audits), false);

  const wrongUser = {
    _id: 'user-wrong',
    email: 'wrong@example.com',
    role: 'student',
    status: 'active',
    isVerified: true,
    failedLoginAttempts: 0,
    async matchPassword() { return false; },
    async save() { return this; },
  };
  User.findOne = () => ({ select: async () => wrongUser });
  const wrong = await invoke(login, {
    body: { email: wrongUser.email, password: SECRET },
    ip: '203.0.113.12',
    headers: {},
  });
  assert.strictEqual(wrong.statusCode, 401);
  assert.strictEqual(audits.at(-1).action, 'LOGIN_FAILED');
  assert.strictEqual(wrongUser.failedLoginAttempts, 1);
  assert.strictEqual(containsSecret(audits), false);

  const declinedUser = {
    _id: 'user-declined',
    email: 'declined@example.com',
    role: 'provider',
    status: 'active',
    isVerified: true,
    failedLoginAttempts: 0,
    async matchPassword() { return true; },
    async save() { return this; },
    getSignedJwtToken() { return 'should-not-be-issued'; },
  };
  User.findOne = () => ({ select: async () => declinedUser });
  Provider.findOne = async () => ({
    _id: 'provider-declined',
    verificationStatus: 'Rejected',
    isFinalRejection: true,
    rejectionReason: 'Fraudulent documents.',
  });
  const declined = await invoke(login, {
    body: { email: declinedUser.email, password: SECRET },
    ip: '203.0.113.13',
    headers: {},
  });
  assert.strictEqual(declined.statusCode, 403);
  assert.strictEqual(declined.body.verificationDeclined, true);
  assert.strictEqual(declined.body.token, undefined);
  assert.strictEqual(audits.at(-1).action, 'LOGIN_FAILED');
  assert.strictEqual(audits.at(-1).role, 'Provider');
  assert.match(audits.at(-1).details, /provider-declined/);
  assert.strictEqual(audits.at(-1).details.includes('Fraudulent documents'), false);
  assert.strictEqual(containsSecret(audits), false);

  Provider.findOne = async () => ({
    _id: 'prov-1',
    verificationStatus: 'Verified',
    institutionName: 'Acme Foundation',
  });
  Scholarship.create = async (data) => ({ ...data, _id: 'sch-created', name: data.name });
  const created = await invoke(scholarshipController.createScholarship, {
    user: providerUser,
    body: scholarshipBody,
    ip: '203.0.113.20',
    headers: {},
  });
  assert.strictEqual(created.statusCode, 201);
  assert.strictEqual(created.body.success, true);
  assert.strictEqual(created.body.warnings, undefined);
  assert.strictEqual(audits.at(-1).action, 'SCHOLARSHIP_CREATED');
  assert.match(audits.at(-1).details, /sch-created/);
  assert.match(audits.at(-1).details, /prov-1/);

  const listing = {
    _id: 'sch-edit',
    name: 'City Grant',
    providerId: 'prov-1',
    isArchived: false,
    adminRemovedAt: null,
    status: 'Open',
    async save() { return this; },
  };
  Scholarship.findOne = async () => listing;
  const edited = await invoke(scholarshipController.updateScholarship, {
    user: providerUser,
    params: { id: 'sch-edit' },
    body: { description: 'Updated description.' },
    ip: '203.0.113.20',
    headers: {},
  });
  assert.strictEqual(edited.statusCode, 200);
  assert.strictEqual(edited.body.success, true);
  assert.strictEqual(audits.at(-1).action, 'SCHOLARSHIP_UPDATED');
  assert.match(audits.at(-1).details, /description/);
  assert.strictEqual(audits.at(-1).details.includes('Updated description'), false);

  const closed = await invoke(scholarshipController.updateScholarshipStatus, {
    user: providerUser,
    params: { id: 'sch-edit' },
    body: { status: 'Closed' },
    ip: '203.0.113.20',
    headers: {},
  });
  assert.strictEqual(closed.statusCode, 200);
  assert.strictEqual(audits.at(-1).action, 'SCHOLARSHIP_CLOSED');
  assert.strictEqual(listing.status, 'Closed');

  const archived = await invoke(scholarshipController.archiveScholarship, {
    user: providerUser,
    params: { id: 'sch-edit' },
    body: {},
    ip: '203.0.113.20',
    headers: {},
  });
  assert.strictEqual(archived.statusCode, 200);
  assert.strictEqual(archived.body.success, true);
  assert.strictEqual(listing.isArchived, true);
  assert.strictEqual(audits.at(-1).action, 'SCHOLARSHIP_ARCHIVED');
  assert.strictEqual(audits.at(-1).role, 'Provider');

  createImpl = async () => {
    throw new Error('audit store unavailable');
  };
  const createdAnyway = {
    _id: 'sch-kept',
    name: 'Kept Grant',
    providerId: 'prov-1',
    isArchived: false,
    adminRemovedAt: null,
    status: 'Open',
    async save() { return this; },
  };
  Scholarship.create = async (data) => ({ ...createdAnyway, ...data });
  const partial = await invoke(scholarshipController.createScholarship, {
    user: providerUser,
    body: scholarshipBody,
    ip: '203.0.113.21',
    headers: {},
  });
  assert.strictEqual(partial.statusCode, 201);
  assert.strictEqual(partial.body.success, true);
  assert.strictEqual(partial.body.message, 'Scholarship created successfully');
  assert.strictEqual(partial.body.scholarship._id, 'sch-kept');
  assert.strictEqual(partial.body.warnings[0].step, 'audit');
  assert.strictEqual(partial.body.warnings[0].message, auditController.AUDIT_NOT_SAVED);

  Scholarship.findById = () => ({
    select: async () => ({
      _id: SCHOLARSHIP_ID,
      name: 'Reported Grant',
      providerId: 'prov-1',
      status: 'Open',
      isArchived: false,
    }),
  });
  Report.findOne = () => ({ select: async () => null });
  Provider.findById = () => ({
    select: async () => ({ institutionName: 'Acme Foundation' }),
  });
  Report.create = async (doc) => ({ ...doc, _id: 'report-1' });
  createImpl = async (entry) => {
    audits.push(entry);
    return { _id: `audit-${audits.length}`, ...entry };
  };
  const reported = await invoke(createScholarshipReport, {
    user: { _id: 'student-1', id: 'student-1', name: 'Ari Student', email: 'ari@example.com', role: 'student' },
    params: { scholarshipId: SCHOLARSHIP_ID },
    body: { category: 'Suspicious or potentially fraudulent listing', details: SECRET },
    ip: '203.0.113.30',
    headers: {},
  });
  assert.strictEqual(reported.statusCode, 201);
  assert.strictEqual(reported.body.success, true);
  assert.strictEqual(audits.at(-1).action, 'SCHOLARSHIP_REPORTED');
  assert.match(audits.at(-1).details, /student-1/);
  assert.match(audits.at(-1).details, new RegExp(SCHOLARSHIP_ID));
  assert.match(audits.at(-1).details, /report-1/);
  assert.match(audits.at(-1).details, /Suspicious or potentially fraudulent listing/);
  assert.strictEqual(containsSecret(audits.at(-1)), false);

  let reportSaved = false;
  const pendingReport = {
    _id: 'report-mod',
    status: 'Pending Review',
    resolvedAt: null,
    listingId: null,
    async save() {
      reportSaved = true;
      return this;
    },
  };
  Report.findById = async () => pendingReport;
  createImpl = async () => {
    throw new Error('audit store unavailable');
  };
  const moderated = await invoke(updateModerationReport, {
    user: { _id: 'admin-1', name: 'Ada Admin', email: 'ada@example.com', role: 'admin' },
    params: { id: 'report-mod' },
    body: { action: 'WARN_PROVIDER', status: 'Resolved' },
    ip: '203.0.113.40',
    headers: {},
  });
  assert.strictEqual(reportSaved, true);
  assert.strictEqual(moderated.statusCode, 200);
  assert.strictEqual(moderated.body.success, true);
  assert.strictEqual(moderated.body.message, 'Report updated successfully.');
  assert.strictEqual(moderated.body.warnings[0].step, 'audit');

  const bucket = {
    streamed: false,
    find() {
      return {
        toArray: async () => [{
          _id: 'file-1',
          filename: 'sec-123.pdf',
          length: 8,
          contentType: 'application/pdf',
          metadata: { originalName: 'registration.pdf' },
        }],
      };
    },
    openDownloadStreamByName() {
      this.streamed = true;
      return { on() { return this; }, pipe() { return this; } };
    },
  };
  documentRoutes.setDocumentBucket(bucket);
  createImpl = async (entry) => {
    audits.push(entry);
    return { _id: 'audit-doc', ...entry };
  };
  const documentOk = mockRes();
  await documentRoutes.streamDocument({
    user: { _id: 'admin-1', name: 'Ada Admin', email: 'ada@example.com', role: 'admin' },
    params: { filename: 'sec-123.pdf' },
    ip: '203.0.113.50',
    headers: {},
  }, documentOk);
  assert.strictEqual(bucket.streamed, true);
  assert.strictEqual(audits.at(-1).action, 'DOCUMENT_ACCESS');
  assert.strictEqual(audits.at(-1).role, 'Admin');
  assert.match(audits.at(-1).details, /file-1/);
  assert.match(audits.at(-1).details, /sec-123\.pdf/);
  assert.strictEqual(audits.at(-1).details.includes('registration.pdf'), false);

  bucket.streamed = false;
  createImpl = async () => {
    throw new Error('audit store unavailable');
  };
  const documentBlocked = mockRes();
  await documentRoutes.streamDocument({
    user: { _id: 'admin-1', name: 'Ada Admin', email: 'ada@example.com', role: 'admin' },
    params: { filename: 'sec-123.pdf' },
    ip: '203.0.113.50',
    headers: {},
  }, documentBlocked);
  assert.strictEqual(bucket.streamed, false);
  assert.strictEqual(documentBlocked.statusCode, 500);
  assert.match(documentBlocked.body.message, /not sent because the access could not be recorded/i);
  assert.strictEqual(documentBlocked.body.warnings[0].step, 'audit');

  analytics.BUILDERS.registrations = async () => ({
    period: { from: '2026-01-01', to: '2026-01-31', timeZone: 'Asia/Manila' },
  });
  analytics.renderReportCsv = () => 'column\nvalue';
  let csvSent = false;
  const analyticsRes = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    set() { return this; },
    send(body) {
      csvSent = true;
      this.body = body;
      return this;
    },
  };
  await exportReport({
    user: { _id: 'admin-1', name: 'Ada Admin', role: 'admin' },
    query: { report: 'registrations' },
    ip: '203.0.113.60',
    headers: {},
  }, analyticsRes);
  assert.strictEqual(csvSent, false);
  assert.strictEqual(analyticsRes.statusCode, 500);
  assert.match(analyticsRes.body.message, /not sent because the export could not be recorded/i);
  assert.strictEqual(analyticsRes.body.success, false);

  console.log('audit logging tests passed');
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(restore);
