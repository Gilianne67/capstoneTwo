/**
 * Phase 3 audit attribution, sensitive details, consent failures, and seed safety.
 * MongoDB is not required.
 */
const assert = require('assert');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'audit-phase3-secret';

const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const Scholarship = require('../models/Scholarship');
const Report = require('../models/Report');
const auditController = require('../controllers/auditController');
const { updatePassword } = require('../controllers/authController');
const { updateScholarshipStatus } = require('../controllers/adminController');
const { updateModerationReport } = require('../controllers/moderationController');
const { updateProfile } = require('../controllers/studentProfileController');
const { verifyConsent } = require('../controllers/userController');
const matchCache = require('../services/matchCache');
const errorHandler = require('../middleware/error');
const { seedAuditLogs, resetRequested } = require('./seedAuditLogs');

const SECRET_PASSWORD = 'current-secret-value';
const SECRET_TOKEN = 'not-a-real-consent-token';
const GWA = '1.25';
const INCOME = 'Below 10000 / month';

const audits = [];
let createImpl = async (entry) => {
  audits.push(entry);
  return { _id: `audit-${audits.length}`, ...entry };
};

const originalCreate = AuditLog.create;
const originals = {
  userFindById: User.findById,
  profileFindOne: StudentProfile.findOne,
  profileUpdate: StudentProfile.findOneAndUpdate,
  scholarshipUpdate: Scholarship.findByIdAndUpdate,
  reportFindById: Report.findById,
  invalidate: matchCache.invalidateMatchCache,
};

const restore = () => {
  AuditLog.create = originalCreate;
  User.findById = originals.userFindById;
  StudentProfile.findOne = originals.profileFindOne;
  StudentProfile.findOneAndUpdate = originals.profileUpdate;
  Scholarship.findByIdAndUpdate = originals.scholarshipUpdate;
  Report.findById = originals.reportFindById;
  matchCache.invalidateMatchCache = originals.invalidate;
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

const invoke = async (handler, req) => {
  const res = mockRes();
  await handler(req, res, (err) => {
    if (err) errorHandler(err, req, res, () => {});
  });
  return res;
};

const run = async () => {
  assert.notStrictEqual(mongoose.connection.readyState, 1);
  AuditLog.create = (entry) => createImpl(entry);
  matchCache.invalidateMatchCache = async () => ({ ok: true });

  const historical = new AuditLog({
    actor: 'Old Admin',
    role: 'Admin',
    action: 'USER_LOGIN',
    details: 'Historical row without an actor id.',
  });
  await historical.validate();
  assert.strictEqual(historical.actorId, undefined);

  const modern = new AuditLog({
    actor: 'Ada Super',
    actorId: 'super-1',
    role: 'Superadmin',
    action: 'USER_LOGIN',
    details: 'New superadmin row.',
  });
  await modern.validate();

  const superadmin = await auditController.recordAuditLog({
    actor: 'Ada Super',
    actorId: 'super-1',
    role: 'superadmin',
    action: 'HEALTH_CHECK',
    details: 'Role mapping check.',
  });
  assert.strictEqual(superadmin.ok, true);
  assert.strictEqual(audits.at(-1).actor, 'Ada Super');
  assert.strictEqual(audits.at(-1).actorId, 'super-1');
  assert.strictEqual(audits.at(-1).role, 'Superadmin');

  const admin = await auditController.recordAuditLog({
    actor: 'Bea Admin',
    actorId: 'admin-1',
    role: 'admin',
    action: 'HEALTH_CHECK',
    details: 'Admin role mapping check.',
  });
  assert.strictEqual(admin.ok, true);
  assert.strictEqual(audits.at(-1).role, 'Admin');
  assert.strictEqual(audits.at(-1).actor, 'Bea Admin');

  Scholarship.findByIdAndUpdate = async () => ({
    _id: 'sch-1',
    name: 'City Grant',
  });
  const moderated = await invoke(updateScholarshipStatus, {
    params: { id: 'sch-1' },
    body: { status: 'REJECTED' },
    user: { _id: 'super-1', name: 'Ada Super', email: 'ada@example.com', role: 'superadmin' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(moderated.statusCode, 200);
  assert.strictEqual(audits.at(-1).action, 'SCHOLARSHIP_MODERATED');
  assert.match(audits.at(-1).details, /City Grant/);
  assert.match(audits.at(-1).details, /sch-1/);
  assert.match(audits.at(-1).details, /Rejected/);
  assert.strictEqual(audits.at(-1).details.includes('undefined'), false);
  assert.strictEqual(audits.at(-1).role, 'Superadmin');
  assert.strictEqual(audits.at(-1).actor, 'Ada Super');
  assert.strictEqual(audits.at(-1).actorId, 'super-1');

  const report = {
    _id: 'report-1',
    status: 'Pending Review',
    resolution: 'NONE',
    resolvedAt: null,
    listingId: 'sch-9',
    listingTitle: 'Harbor Scholarship',
    async save() {
      this.saved = true;
      return this;
    },
  };
  Report.findById = async () => report;
  const resolved = await invoke(updateModerationReport, {
    params: { id: 'report-1' },
    body: { action: 'WARN_PROVIDER', status: 'Resolved' },
    user: { _id: 'admin-9', name: 'Review Admin', role: 'admin' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(resolved.statusCode, 200);
  assert.strictEqual(audits.at(-1).action, 'MODERATION_REPORT_RESOLVED');
  assert.match(audits.at(-1).details, /Harbor Scholarship/);
  assert.match(audits.at(-1).details, /sch-9/);
  assert.match(audits.at(-1).details, /WARN_PROVIDER/);
  assert.strictEqual(audits.at(-1).role, 'Admin');
  assert.strictEqual(audits.at(-1).actorId, 'admin-9');

  StudentProfile.findOne = async () => ({ userId: 'student-1' });
  StudentProfile.findOneAndUpdate = async () => ({
    userId: 'student-1',
    gwa: GWA,
    incomeBracket: INCOME,
  });
  const profile = await invoke(updateProfile, {
    user: { id: 'student-1', name: 'Cara Student', email: 'cara@example.com', role: 'student' },
    body: { gwa: GWA, incomeBracket: INCOME },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(profile.statusCode, 200);
  assert.strictEqual(audits.at(-1).action, 'PROFILE_UPDATE');
  assert.match(audits.at(-1).details, /student-1/);
  assert.strictEqual(audits.at(-1).details.includes(GWA), false);
  assert.strictEqual(audits.at(-1).details.includes(INCOME), false);
  assert.strictEqual(audits.at(-1).details.includes('cara@example.com'), false);
  assert.strictEqual(audits.at(-1).actor, 'Cara Student');
  assert.strictEqual(audits.at(-1).actorId, 'student-1');

  const account = {
    _id: 'user-7',
    id: 'user-7',
    email: 'ada@example.com',
    role: 'superadmin',
    async matchPassword(password) {
      return password === 'correct-password';
    },
  };
  User.findById = () => ({
    select: async () => account,
  });
  const rejected = await invoke(updatePassword, {
    user: account,
    body: { currentPassword: SECRET_PASSWORD, newPassword: 'replacement-secret-value' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(rejected.statusCode, 401);
  assert.strictEqual(rejected.body.error, 'Current password is incorrect.');
  assert.strictEqual(audits.at(-1).action, 'PASSWORD_CHANGE_FAILED');
  assert.strictEqual(audits.at(-1).role, 'Superadmin');
  assert.strictEqual(audits.at(-1).actorId, 'user-7');
  assert.strictEqual(JSON.stringify(audits.at(-1)).includes(SECRET_PASSWORD), false);
  assert.strictEqual(JSON.stringify(rejected.body).includes(SECRET_PASSWORD), false);

  createImpl = async () => {
    throw new Error('audit store unavailable');
  };
  const rejectedUnstored = await invoke(updatePassword, {
    user: account,
    body: { currentPassword: SECRET_PASSWORD, newPassword: 'replacement-secret-value' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(rejectedUnstored.statusCode, 401);
  assert.strictEqual(rejectedUnstored.body.error, 'Current password is incorrect.');
  assert.strictEqual(rejectedUnstored.body.warnings[0].step, 'audit');
  createImpl = async (entry) => {
    audits.push(entry);
    return { _id: `audit-${audits.length}`, ...entry };
  };

  const invalidConsent = await invoke(verifyConsent, {
    query: { token: SECRET_TOKEN },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(invalidConsent.statusCode, 400);
  assert.strictEqual(invalidConsent.body.message, 'The consent link is invalid or has expired.');
  assert.strictEqual(invalidConsent.body.warnings, undefined);
  assert.strictEqual(audits.at(-1).action, 'CONSENT_TOKEN_REJECTED');
  assert.strictEqual(JSON.stringify(invalidConsent.body).includes(SECRET_TOKEN), false);
  assert.strictEqual(JSON.stringify(audits.at(-1)).includes(SECRET_TOKEN), false);
  assert.strictEqual(audits.at(-1).details.includes('jwt'), false);

  const expiredToken = jwt.sign(
    {
      userId: 'student-9',
      purpose: 'parental_consent',
      exp: Math.floor(Date.now() / 1000) - 60,
    },
    process.env.JWT_SECRET
  );
  const expiredConsent = await invoke(verifyConsent, {
    query: { token: expiredToken },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(expiredConsent.statusCode, 400);
  assert.match(expiredConsent.body.message, /expired/i);
  assert.strictEqual(expiredConsent.body.message.includes(expiredToken), false);
  assert.strictEqual(audits.at(-1).action, 'CONSENT_TOKEN_REJECTED');
  assert.match(audits.at(-1).details, /expired/);
  assert.match(audits.at(-1).details, /student-9/);
  assert.strictEqual(audits.at(-1).actorId, 'student-9');
  assert.strictEqual(JSON.stringify(audits.at(-1)).includes(expiredToken), false);

  createImpl = async () => {
    throw new Error('audit store unavailable');
  };
  const unstoredConsent = await invoke(verifyConsent, {
    query: { token: SECRET_TOKEN },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(unstoredConsent.statusCode, 400);
  assert.strictEqual(unstoredConsent.body.warnings, undefined);
  assert.strictEqual(unstoredConsent.body.message.includes('audit'), false);

  let deleted = 0;
  let connected = 0;
  const preserved = await seedAuditLogs({
    reset: false,
    connect: async () => { connected += 1; },
    deleteMany: async () => { deleted += 1; },
    insertMany: async () => { throw new Error('should not insert'); },
    log() {},
    warn() {},
  });
  assert.strictEqual(preserved.deleted, false);
  assert.strictEqual(deleted, 0);
  assert.strictEqual(connected, 0);
  assert.strictEqual(resetRequested(['node', 'seedAuditLogs.js'], {}), false);
  assert.strictEqual(resetRequested(['node', 'seedAuditLogs.js', '--reset'], {}), true);
  assert.strictEqual(resetRequested(['node', 'seedAuditLogs.js'], { ALLOW_AUDIT_LOG_RESET: 'true' }), true);

  const wiped = await seedAuditLogs({
    reset: true,
    connect: async () => { connected += 1; },
    deleteMany: async () => { deleted += 1; },
    insertMany: async (rows) => rows,
    log() {},
    warn() {},
  });
  assert.strictEqual(wiped.deleted, true);
  assert.strictEqual(deleted, 1);
  assert.strictEqual(connected, 1);
  assert.strictEqual(wiped.inserted, 3);

  const failedInsert = await auditController.recordAuditLog({
    actor: 'Ada Super',
    role: 'Superadmin',
    action: 'HEALTH_CHECK',
    details: 'Insert failed.',
  });
  assert.strictEqual(failedInsert.ok, false);
  assert.strictEqual(failedInsert.message, auditController.AUDIT_NOT_SAVED);

  console.log('audit attribution tests passed');
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(restore);
