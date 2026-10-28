/**
 * Scholarship report submission, admin retain/remove, and student notification.
 * Controller checks use stand-in model methods. When MONGO_URI is available,
 * the same controllers also write and read real documents.
 */
const assert = require('assert');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Scholarship = require('../models/Scholarship');
const Provider = require('../models/Provider');
const Report = require('../models/Report');
const StudentProfile = require('../models/StudentProfile');
const Notification = require('../models/Notification');
const ProviderNotification = require('../models/ProviderNotification');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const searchSync = require('../services/scholarshipSearchSync');
const matchCache = require('../services/matchCache');
const {
  createScholarshipReport,
  REPORT_CATEGORIES,
} = require('../controllers/scholarshipReportController');
const { updateModerationReport } = require('../controllers/moderationController');
const {
  updateScholarship,
  updateScholarshipStatus,
  archiveScholarship,
  getScholarshipById,
} = require('../controllers/scholarshipController');
const { authorize } = require('../middleware/auth');
const studentRoutes = require('../routes/studentRoutes');
const moderationRoutes = require('../routes/moderationRoutes');

const SCHOLARSHIP_ID = '507f1f77bcf86cd799439011';
const OTHER_SCHOLARSHIP_ID = '507f1f77bcf86cd799439013';
const STUDENT_ID = '507f191e810c19729de860ea';
const OTHER_STUDENT_ID = '507f191e810c19729de860eb';
const ADMIN_ID = '507f191e810c19729de860ec';
const PROVIDER_ID = '507f1f77bcf86cd799439012';

const originals = {
  scholarshipFindById: Scholarship.findById,
  scholarshipFindByIdAndUpdate: Scholarship.findByIdAndUpdate,
  providerFindById: Provider.findById,
  reportFindOne: Report.findOne,
  reportFindById: Report.findById,
  reportFind: Report.find,
  reportFindOneAndUpdate: Report.findOneAndUpdate,
  reportCreate: Report.create,
  profileFindOne: StudentProfile.findOne,
  notificationCreate: Notification.create,
  providerNotificationFindOne: ProviderNotification.findOne,
  providerNotificationCreate: ProviderNotification.create,
  auditCreate: AuditLog.create,
  sync: searchSync.syncScholarshipSearch,
  invalidate: matchCache.invalidateMatchCache,
};

const restoreModels = () => {
  Scholarship.findById = originals.scholarshipFindById;
  Scholarship.findByIdAndUpdate = originals.scholarshipFindByIdAndUpdate;
  Provider.findById = originals.providerFindById;
  Report.findOne = originals.reportFindOne;
  Report.findById = originals.reportFindById;
  Report.find = originals.reportFind;
  Report.findOneAndUpdate = originals.reportFindOneAndUpdate;
  Report.create = originals.reportCreate;
  StudentProfile.findOne = originals.profileFindOne;
  Notification.create = originals.notificationCreate;
  ProviderNotification.findOne = originals.providerNotificationFindOne;
  ProviderNotification.create = originals.providerNotificationCreate;
  AuditLog.create = originals.auditCreate;
  searchSync.syncScholarshipSearch = originals.sync;
  matchCache.invalidateMatchCache = originals.invalidate;
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
  },
});

const invoke = async (handler, req) => {
  const res = mockRes();
  await handler(req, res);
  return res;
};

const student = {
  _id: STUDENT_ID,
  id: STUDENT_ID,
  role: 'student',
  status: 'active',
};

const admin = {
  _id: ADMIN_ID,
  id: ADMIN_ID,
  role: 'admin',
  name: 'Review Admin',
  email: 'review.admin@example.com',
};

const selectable = (value) => ({
  select: async () => value,
});

const listing = (overrides = {}) => ({
  _id: SCHOLARSHIP_ID,
  name: 'Merit Grant',
  providerId: PROVIDER_ID,
  status: 'Open',
  isArchived: false,
  ...overrides,
});

const pendingReport = (overrides = {}) => ({
  _id: 'report-1',
  reportedBy: STUDENT_ID,
  listingId: SCHOLARSHIP_ID,
  listingTitle: 'Merit Grant',
  status: 'Pending Review',
  resolution: 'NONE',
  saved: false,
  async save() {
    this.saved = true;
    return this;
  },
  ...overrides,
});

const runAuthorize = (roles, user) => {
  const res = mockRes();
  let nextCalled = false;
  authorize(...roles)(
    { user },
    res,
    () => {
      nextCalled = true;
    }
  );
  return { res, nextCalled };
};

const runMiddleware = (handler, user) => {
  const res = mockRes();
  let nextCalled = false;
  handler(
    { user },
    res,
    () => {
      nextCalled = true;
    }
  );
  return { res, nextCalled };
};

const runUnitTests = async () => {
  const notifications = [];
  const providerNotifications = [];
  const scholarshipUpdates = [];
  let createdReport = null;
  let reportLookup = null;

  Scholarship.findById = () => selectable(listing());
  Provider.findById = () => selectable({ institutionName: 'QA Foundation' });
  Report.findOne = () => selectable(null);
  Report.create = async (doc) => {
    createdReport = doc;
    return { ...doc, _id: 'report-created' };
  };
  Report.findById = async () => reportLookup;
  Scholarship.findByIdAndUpdate = async (id, update) => {
    scholarshipUpdates.push({ id: String(id), update });
    return {
      _id: id,
      name: 'Merit Grant',
      providerId: PROVIDER_ID,
      status: update.status,
      isArchived: update.isArchived,
      adminRemovedAt: update.adminRemovedAt,
      adminRemovalReason: update.adminRemovalReason,
    };
  };
  StudentProfile.findOne = () => selectable({ _id: 'profile-1' });
  Notification.create = async (doc) => {
    notifications.push(doc);
    return doc;
  };
  ProviderNotification.findOne = (filter) => ({
    select: async () => providerNotifications.find((item) => (
      String(item.providerId) === String(filter.providerId)
      && item.type === filter.type
      && item.dedupeKey === filter.dedupeKey
    )) || null,
  });
  ProviderNotification.create = async (doc) => {
    providerNotifications.push(doc);
    return doc;
  };
  AuditLog.create = async () => ({});
  searchSync.syncScholarshipSearch = async () => ({ synchronized: true });
  matchCache.invalidateMatchCache = async () => ({ ok: true });

  try {
    const reportRoute = studentRoutes.stack.find(
      (layer) => layer.route
        && layer.route.path === '/scholarships/:scholarshipId/reports'
        && layer.route.methods.post
    );
    assert.ok(reportRoute);

    const studentAccess = runAuthorize(['student'], student);
    assert.equal(studentAccess.nextCalled, true);
    const providerAccess = runAuthorize(['student'], { role: 'provider', status: 'active' });
    assert.equal(providerAccess.nextCalled, false);
    assert.equal(providerAccess.res.statusCode, 403);
    const consentAccess = runAuthorize(
      ['student'],
      { role: 'student', status: 'pending_consent' }
    );
    assert.equal(consentAccess.nextCalled, false);
    assert.equal(consentAccess.res.statusCode, 403);
    const adminAccess = runAuthorize(
      ['admin', 'super_admin', 'superadmin'],
      admin
    );
    assert.equal(adminAccess.nextCalled, true);
    const studentAdminAccess = runAuthorize(
      ['admin', 'super_admin', 'superadmin'],
      student
    );
    assert.equal(studentAdminAccess.nextCalled, false);
    assert.equal(studentAdminAccess.res.statusCode, 403);

    const moderationGates = moderationRoutes.stack.filter((layer) => !layer.route && layer.handle);
    assert.equal(moderationGates[0].handle.name, 'protect');
    assert.equal(moderationGates[1].handle.name, 'authorizeRequest');
    const queueGate = moderationGates[1].handle;
    const anonymousQueue = runMiddleware(queueGate, null);
    assert.equal(anonymousQueue.nextCalled, false);
    assert.equal(anonymousQueue.res.statusCode, 401);
    const providerQueue = runMiddleware(queueGate, { role: 'provider', status: 'active' });
    assert.equal(providerQueue.nextCalled, false);
    assert.equal(providerQueue.res.statusCode, 403);
    const studentQueue = runMiddleware(queueGate, student);
    assert.equal(studentQueue.nextCalled, false);
    assert.equal(studentQueue.res.statusCode, 403);
    const adminQueue = runMiddleware(queueGate, admin);
    assert.equal(adminQueue.nextCalled, true);
    const superadminQueue = runMiddleware(queueGate, { ...admin, role: 'superadmin' });
    assert.equal(superadminQueue.nextCalled, true);

    let lookupFilter = null;
    Report.findOne = (filter) => {
      lookupFilter = filter;
      return selectable(null);
    };
    const created = await invoke(createScholarshipReport, {
      params: { scholarshipId: SCHOLARSHIP_ID },
      user: student,
      body: {
        category: REPORT_CATEGORIES[0],
        details: 'The deadline on the page is last year.',
        reportedBy: STUDENT_ID,
        providerName: 'Spoofed Provider',
        status: 'Removed',
      },
    });
    assert.equal(created.statusCode, 201);
    assert.equal(String(createdReport.reportedBy), STUDENT_ID);
    assert.equal(String(createdReport.listingId), SCHOLARSHIP_ID);
    assert.equal(createdReport.category, 'Incorrect or misleading information');
    assert.equal(createdReport.reason, 'Incorrect or misleading information');
    assert.equal(createdReport.details, 'The deadline on the page is last year.');
    assert.equal(createdReport.providerName, 'QA Foundation');
    assert.equal(createdReport.status, 'Pending Review');
    assert.equal(String(lookupFilter.reportedBy), STUDENT_ID);
    assert.deepEqual(lookupFilter.status.$in, ['Pending Review', 'Under Investigation']);

    const impersonated = await invoke(createScholarshipReport, {
      params: { scholarshipId: SCHOLARSHIP_ID },
      user: student,
      body: {
        category: REPORT_CATEGORIES[2],
        reportedBy: OTHER_STUDENT_ID,
      },
    });
    assert.equal(impersonated.statusCode, 403);

    const mismatchedListing = await invoke(createScholarshipReport, {
      params: { scholarshipId: SCHOLARSHIP_ID },
      user: student,
      body: {
        category: REPORT_CATEGORIES[1],
        scholarshipId: OTHER_SCHOLARSHIP_ID,
      },
    });
    assert.equal(mismatchedListing.statusCode, 400);

    const missingCategory = await invoke(createScholarshipReport, {
      params: { scholarshipId: SCHOLARSHIP_ID },
      user: student,
      body: { details: 'No category' },
    });
    assert.equal(missingCategory.statusCode, 400);

    const badDetails = await invoke(createScholarshipReport, {
      params: { scholarshipId: SCHOLARSHIP_ID },
      user: student,
      body: { category: REPORT_CATEGORIES[4], details: { note: 'no' } },
    });
    assert.equal(badDetails.statusCode, 400);

    Scholarship.findById = () => selectable(null);
    const missingListing = await invoke(createScholarshipReport, {
      params: { scholarshipId: SCHOLARSHIP_ID },
      user: student,
      body: { category: REPORT_CATEGORIES[4] },
    });
    assert.equal(missingListing.statusCode, 404);

    Scholarship.findById = () => selectable(listing({ isArchived: true }));
    const archivedListing = await invoke(createScholarshipReport, {
      params: { scholarshipId: SCHOLARSHIP_ID },
      user: student,
      body: { category: REPORT_CATEGORIES[1] },
    });
    assert.equal(archivedListing.statusCode, 400);

    Scholarship.findById = () => selectable(listing());
    Report.findOne = () => selectable({ _id: 'already-open' });
    const duplicate = await invoke(createScholarshipReport, {
      params: { scholarshipId: SCHOLARSHIP_ID },
      user: student,
      body: { category: REPORT_CATEGORIES[3] },
    });
    assert.equal(duplicate.statusCode, 409);

    Report.findOne = () => selectable(null);
    Report.create = async () => {
      const error = new Error('duplicate');
      error.code = 11000;
      throw error;
    };
    const duplicateIndex = await invoke(createScholarshipReport, {
      params: { scholarshipId: SCHOLARSHIP_ID },
      user: student,
      body: { category: REPORT_CATEGORIES[3] },
    });
    assert.equal(duplicateIndex.statusCode, 409);

    Report.create = async (doc) => ({ ...doc, _id: 'report-created' });
    const reportsById = new Map();
    let relatedReports = [];
    const trackReport = (report) => {
      reportsById.set(String(report._id), report);
      reportLookup = report;
      return report;
    };
    Report.findById = async (id) => reportsById.get(String(id)) || null;
    Report.find = () => selectable(relatedReports);
    Report.findOneAndUpdate = async (filter, update) => {
      const current = reportsById.get(String(filter._id));
      if (!current) return null;
      if (filter.status?.$in && !filter.status.$in.includes(current.status)) return null;
      if (typeof filter.status === 'string' && current.status !== filter.status) return null;
      if (filter.resolution && current.resolution !== filter.resolution) return null;
      if (Object.prototype.hasOwnProperty.call(filter, 'resolvedAt')
        && filter.resolvedAt === null
        && current.resolvedAt) {
        return null;
      }
      Object.assign(current, update.$set || {});
      for (const field of Object.keys(update.$unset || {})) {
        delete current[field];
      }
      current.saved = true;
      return current;
    };
    Scholarship.findById = () => selectable(listing());
    const updatesBeforeRetain = scholarshipUpdates.length;
    const retainTarget = trackReport(pendingReport());
    const missingExplanation = await invoke(updateModerationReport, {
      params: { id: 'report-1' },
      body: { action: 'RETAIN_LISTING', status: 'Retained', decisionReason: '   ' },
      user: admin,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(missingExplanation.statusCode, 400);
    assert.equal(retainTarget.saved, false);
    assert.equal(scholarshipUpdates.length, updatesBeforeRetain);

    const retained = await invoke(updateModerationReport, {
      params: { id: 'report-1' },
      body: {
        action: 'RETAIN_LISTING',
        status: 'Retained',
        decisionReason: 'The deadline and eligibility text match the provider record.',
        resolvedBy: OTHER_STUDENT_ID,
        scholarshipId: SCHOLARSHIP_ID,
      },
      user: admin,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(retained.statusCode, 200);
    assert.equal(retainTarget.status, 'Retained');
    assert.equal(retainTarget.resolution, 'RETAIN_LISTING');
    assert.equal(
      retainTarget.decisionReason,
      'The deadline and eligibility text match the provider record.'
    );
    assert.equal(String(retainTarget.resolvedBy), ADMIN_ID);
    assert.ok(retainTarget.resolvedAt instanceof Date);
    assert.equal(scholarshipUpdates.length, updatesBeforeRetain);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].type, 'report_decision');
    assert.equal(notifications[0].studentProfileId, 'profile-1');
    assert.equal(String(notifications[0].scholarshipId), SCHOLARSHIP_ID);
    assert.equal(notifications[0].title.includes('Merit Grant'), true);
    assert.equal(notifications[0].title.includes('Retained'), true);
    assert.equal(notifications[0].message.includes('Merit Grant'), true);
    assert.equal(notifications[0].message.includes('retained'), true);
    assert.equal(
      notifications[0].message.includes('The deadline and eligibility text match the provider record.'),
      true
    );

    const repeated = await invoke(updateModerationReport, {
      params: { id: 'report-1' },
      body: {
        action: 'REMOVE_LISTING',
        status: 'Removed',
        decisionReason: 'Trying to remove it after retain.',
      },
      user: admin,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(repeated.statusCode, 409);
    assert.equal(retainTarget.status, 'Retained');
    assert.equal(scholarshipUpdates.length, updatesBeforeRetain);

    const wrongListing = trackReport(pendingReport({ _id: 'report-wrong' }));
    const wrongTarget = await invoke(updateModerationReport, {
      params: { id: 'report-wrong' },
      body: {
        action: 'REMOVE_LISTING',
        status: 'Removed',
        decisionReason: 'This should not touch another listing.',
        scholarshipId: OTHER_SCHOLARSHIP_ID,
      },
      user: admin,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(wrongTarget.statusCode, 400);
    assert.equal(wrongListing.saved, false);
    assert.equal(scholarshipUpdates.length, updatesBeforeRetain);

    notifications.length = 0;
    const removal = trackReport(pendingReport({ _id: 'report-remove' }));
    const removed = await invoke(updateModerationReport, {
      params: { id: 'report-remove' },
      body: {
        action: 'REMOVE_LISTING',
        status: 'Removed',
        decisionReason: 'The application link asks for a fee.',
      },
      user: admin,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(removed.statusCode, 200);
    assert.equal(removal.status, 'Removed');
    assert.equal(removal.resolution, 'REMOVE_LISTING');
    assert.equal(removal.decisionReason, 'The application link asks for a fee.');
    assert.equal(scholarshipUpdates.length, updatesBeforeRetain + 1);
    assert.equal(scholarshipUpdates.at(-1).id, SCHOLARSHIP_ID);
    assert.equal(scholarshipUpdates.at(-1).update.status, 'Closed');
    assert.equal(scholarshipUpdates.at(-1).update.isArchived, true);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].message.includes('removed'), true);
    assert.equal(notifications[0].message.includes('The application link asks for a fee.'), true);
    assert.equal(scholarshipUpdates.at(-1).update.adminRemovalReason, 'The application link asks for a fee.');
    assert.ok(scholarshipUpdates.at(-1).update.adminRemovedAt instanceof Date);
    assert.equal(providerNotifications.length, 1);
    assert.equal(String(providerNotifications[0].providerId), PROVIDER_ID);
    assert.equal(String(providerNotifications[0].scholarshipId), SCHOLARSHIP_ID);
    assert.equal(providerNotifications[0].type, 'listing_removed');
    assert.equal(providerNotifications[0].title.includes('Merit Grant'), true);
    assert.equal(providerNotifications[0].message.includes('removed by an administrator'), true);
    assert.equal(providerNotifications[0].message.includes('The application link asks for a fee.'), true);
    assert.ok(providerNotifications[0].removedAt instanceof Date);
    assert.equal(JSON.stringify(providerNotifications[0]).includes(STUDENT_ID), false);
    assert.equal(JSON.stringify(providerNotifications[0]).includes('review.admin@example.com'), false);

    notifications.length = 0;
    const legacy = trackReport(pendingReport({ _id: 'report-legacy' }));
    const legacyRemoval = await invoke(updateModerationReport, {
      params: { id: 'report-legacy' },
      body: { action: 'REMOVE_LISTING', status: 'Resolved' },
      user: admin,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(legacyRemoval.statusCode, 200);
    assert.equal(legacy.status, 'Resolved');
    assert.equal(legacy.resolution, 'REMOVE_LISTING');
    assert.equal(notifications.length, 0);
    assert.equal(scholarshipUpdates.at(-1).update.isArchived, true);

    const unprofiled = trackReport(pendingReport({ _id: 'report-no-profile' }));
    StudentProfile.findOne = () => selectable(null);
    const missingProfile = await invoke(updateModerationReport, {
      params: { id: 'report-no-profile' },
      body: {
        action: 'RETAIN_LISTING',
        decisionReason: 'Kept, but the student profile is missing.',
      },
      user: admin,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(missingProfile.statusCode, 500);
    assert.equal(unprofiled.status, 'Retained');
    assert.equal(
      missingProfile.body.errors.some((item) => item.step === 'notification'),
      true
    );

    StudentProfile.findOne = () => selectable({ _id: 'profile-1' });
    Scholarship.findById = () => selectable(listing());
    const sameDecision = await invoke(updateModerationReport, {
      params: { id: 'report-1' },
      body: {
        action: 'RETAIN_LISTING',
        status: 'Retained',
        decisionReason: 'The deadline and eligibility text match the provider record.',
      },
      user: admin,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(sameDecision.statusCode, 409);
    assert.equal(retainTarget.status, 'Retained');

    const sibling = pendingReport({
      _id: 'report-sibling',
      reportedBy: OTHER_STUDENT_ID,
    });
    delete sibling.resolvedAt;
    delete sibling.resolvedBy;
    const sharedRemoval = trackReport(pendingReport({
      _id: 'report-shared-remove',
      reportedBy: STUDENT_ID,
    }));
    relatedReports = [sibling];
    notifications.length = 0;
    const sharedUpdatesBefore = scholarshipUpdates.length;
    const sharedRemoved = await invoke(updateModerationReport, {
      params: { id: 'report-shared-remove' },
      body: {
        action: 'REMOVE_LISTING',
        status: 'Removed',
        decisionReason: 'The shared listing is fraudulent.',
      },
      user: admin,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(sharedRemoved.statusCode, 200);
    assert.equal(sharedRemoval.status, 'Removed');
    assert.equal(sibling.status, 'Pending Review');
    assert.equal(sibling.resolution, 'NONE');
    assert.equal(sibling.resolvedBy, undefined);
    assert.equal(sibling.resolvedAt, undefined);
    assert.equal(sibling.decisionReason, undefined);
    assert.equal(scholarshipUpdates.length, sharedUpdatesBefore + 1);
    assert.equal(scholarshipUpdates.at(-1).update.status, 'Closed');
    assert.equal(scholarshipUpdates.at(-1).update.isArchived, true);
    assert.equal(scholarshipUpdates.some((item) => item.update.isArchived === false), false);
    assert.equal(notifications.length, 2);
    const individualNotice = notifications.find((item) => item.dedupeKey === 'report-decision:report-shared-remove');
    const sharedNotice = notifications.find((item) => item.dedupeKey === `listing-removed:${SCHOLARSHIP_ID}`);
    assert.ok(individualNotice);
    assert.equal(individualNotice.message.includes('not a decision on your own report'), false);
    assert.equal(individualNotice.message.includes('The shared listing is fraudulent.'), true);
    assert.ok(sharedNotice);
    assert.equal(sharedNotice.message.includes('not a decision on your own report'), true);
    assert.equal(sharedNotice.message.includes('Merit Grant'), true);
    assert.equal(sharedNotice.message.includes('The shared listing is fraudulent.'), true);
    assert.equal(providerNotifications.length, 1);
    relatedReports = [];

    const kept = trackReport(pendingReport({
      _id: 'report-kept',
      reportedBy: STUDENT_ID,
    }));
    const stillPending = pendingReport({
      _id: 'report-still-pending',
      reportedBy: OTHER_STUDENT_ID,
    });
    notifications.length = 0;
    const retainUpdatesBefore = scholarshipUpdates.length;
    const oneRetained = await invoke(updateModerationReport, {
      params: { id: 'report-kept' },
      body: {
        action: 'RETAIN_LISTING',
        decisionReason: 'This report does not show a listing problem.',
      },
      user: admin,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(oneRetained.statusCode, 200);
    assert.equal(kept.status, 'Retained');
    assert.equal(stillPending.status, 'Pending Review');
    assert.equal(stillPending.resolvedBy, undefined);
    assert.equal(scholarshipUpdates.length, retainUpdatesBefore);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].message.includes('retained'), true);

    Scholarship.findById = () => selectable(listing({ isArchived: true, status: 'Closed' }));
    const lateReport = trackReport(pendingReport({ _id: 'report-late' }));
    const lateRetain = await invoke(updateModerationReport, {
      params: { id: 'report-late' },
      body: {
        action: 'RETAIN_LISTING',
        decisionReason: 'Trying to put an archived listing back.',
      },
      user: admin,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(lateRetain.statusCode, 409);
    assert.equal(lateReport.status, 'Pending Review');
    assert.equal(lateReport.saved, false);
    assert.equal(scholarshipUpdates.some((item) => item.update.isArchived === false), false);

    let scholarshipReads = 0;
    Scholarship.findById = () => ({
      select: async () => {
        scholarshipReads += 1;
        return listing({ isArchived: scholarshipReads > 1, status: scholarshipReads > 1 ? 'Closed' : 'Open' });
      },
    });
    const raced = trackReport(pendingReport({ _id: 'report-race' }));
    const racedRetain = await invoke(updateModerationReport, {
      params: { id: 'report-race' },
      body: {
        action: 'RETAIN_LISTING',
        decisionReason: 'The listing changed while this report was open.',
      },
      user: admin,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(racedRetain.statusCode, 409);
    assert.equal(raced.status, 'Pending Review');
    assert.equal(raced.resolution, 'NONE');
    assert.equal(raced.resolvedAt, undefined);
    assert.equal(raced.resolvedBy, undefined);

    Scholarship.findById = () => selectable(listing());
    const concurrentReport = trackReport(pendingReport({ _id: 'report-concurrent' }));
    const archivesBeforeConcurrent = scholarshipUpdates.length;
    const concurrentResults = await Promise.all([
      invoke(updateModerationReport, {
        params: { id: 'report-concurrent' },
        body: {
          action: 'REMOVE_LISTING',
          status: 'Removed',
          decisionReason: 'First concurrent removal.',
        },
        user: admin,
        ip: '127.0.0.1',
        headers: {},
      }),
      invoke(updateModerationReport, {
        params: { id: 'report-concurrent' },
        body: {
          action: 'REMOVE_LISTING',
          status: 'Removed',
          decisionReason: 'Second concurrent removal.',
        },
        user: admin,
        ip: '127.0.0.1',
        headers: {},
      }),
    ]);
    assert.deepEqual(
      concurrentResults.map((result) => result.statusCode).sort(),
      [200, 409]
    );
    assert.equal(concurrentReport.status, 'Removed');
    assert.equal(scholarshipUpdates.length, archivesBeforeConcurrent + 1);
  } finally {
    restoreModels();
  }
};

const MARKER = `__QA_REPORT__${Date.now()}`;

const connectIfAvailable = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    return { connected: false, reason: 'MONGO_URI is not set' };
  }

  try {
    await mongoose.connect(uri, {
      dbName: 'scholarship_matching_db',
      serverSelectionTimeoutMS: 4000,
    });
    return { connected: true };
  } catch (error) {
    return {
      connected: false,
      reason: error.message || 'MongoDB connection failed',
    };
  }
};

const scholarshipBody = (name) => ({
  name,
  scholarshipType: 'Merit-Based',
  description: 'Temporary listing for scholarship report persistence.',
  grantValue: '15000',
  deadline: '2026-12-31',
  applicationURL: 'https://qa.example.com/apply',
  academicRequirements: [
    { gradingScale: '1.00-5.00', minimumGPA: 2.5 },
  ],
  hardFilters: {
    academicLevel: 'College',
    courseProgram: [],
    citizenshipStatus: 'Filipino',
    geographicLocation: {
      scope: 'Nationwide',
      regions: [],
      provinces: [],
      municipalities: [],
    },
  },
  criteriaWeights: {
    gwaWeight: 0.4,
    incomeWeight: 0.4,
    tagsWeight: 0.2,
  },
  rankingMode: 'Weighted',
  status: 'Open',
  isArchived: false,
});

const runDatabaseTests = async () => {
  const connection = await connectIfAvailable();
  if (!connection.connected) {
    console.log(`scholarship report database check skipped: ${connection.reason}`);
    return;
  }

  const ids = {
    userIds: [],
    providerIds: [],
    profileIds: [],
    scholarshipIds: [],
    reportIds: [],
  };

  searchSync.syncScholarshipSearch = async () => ({ synchronized: true });
  matchCache.invalidateMatchCache = async () => ({ ok: true });

  try {
    const studentUser = await User.create({
      name: `${MARKER} Student`,
      email: `qa.report.student.${Date.now()}@example.com`,
      password: 'Secret1-password',
      role: 'student',
      status: 'active',
      isVerified: true,
    });
    const adminUser = await User.create({
      name: `${MARKER} Admin`,
      email: `qa.report.admin.${Date.now()}@example.com`,
      password: 'Secret1-password',
      role: 'admin',
      status: 'active',
      isVerified: true,
    });
    const providerUser = await User.create({
      name: `${MARKER} Provider`,
      email: `qa.report.provider.${Date.now()}@example.com`,
      password: 'Secret1-password',
      role: 'provider',
      status: 'active',
      isVerified: true,
    });
    ids.userIds.push(studentUser._id, adminUser._id, providerUser._id);

    const provider = await Provider.create({
      userId: providerUser._id,
      institutionName: `${MARKER} Foundation`,
      institutionType: 'Non-Profit / NGO',
      verificationStatus: 'Verified',
    });
    ids.providerIds.push(provider._id);

    const profile = await StudentProfile.create({
      userId: studentUser._id,
      dateOfBirth: new Date('2004-04-12'),
      academicLevel: 'College',
      yearLevel: '2nd Year',
      course: 'BS Computer Science',
      gwa: 1.5,
      gwaScale: '1.00-5.00',
      incomeBracket: 'Below ₱10,000 / month',
      region: 'NCR',
      schoolName: `${MARKER} University`,
      schoolType: 'Public',
      province: 'Metro Manila',
      municipalityCity: 'Manila',
    });
    ids.profileIds.push(profile._id);

    const retainListing = await Scholarship.create({
      ...scholarshipBody(`${MARKER} Retain Grant`),
      providerId: provider._id,
    });
    const removeListing = await Scholarship.create({
      ...scholarshipBody(`${MARKER} Remove Grant`),
      providerId: provider._id,
    });
    const archivedListing = await Scholarship.create({
      ...scholarshipBody(`${MARKER} Archived Grant`),
      providerId: provider._id,
      isArchived: true,
      status: 'Closed',
    });
    ids.scholarshipIds.push(retainListing._id, removeListing._id, archivedListing._id);

    const reporter = {
      _id: studentUser._id,
      id: studentUser._id,
      role: 'student',
      status: 'active',
    };
    const reviewer = {
      _id: adminUser._id,
      id: adminUser._id,
      role: 'admin',
      name: adminUser.name,
      email: adminUser.email,
    };

    const submitted = await invoke(createScholarshipReport, {
      params: { scholarshipId: String(retainListing._id) },
      user: reporter,
      body: {
        category: 'Incorrect eligibility requirements',
        details: 'The year-level rule does not match the posted form.',
        reportedBy: String(studentUser._id),
      },
    });
    assert.equal(submitted.statusCode, 201);
    ids.reportIds.push(submitted.body.data._id);

    const stored = await Report.findById(submitted.body.data._id);
    assert.equal(String(stored.reportedBy), String(studentUser._id));
    assert.equal(String(stored.listingId), String(retainListing._id));
    assert.equal(stored.category, 'Incorrect eligibility requirements');
    assert.equal(stored.details, 'The year-level rule does not match the posted form.');
    assert.equal(stored.providerName, `${MARKER} Foundation`);
    assert.equal(stored.status, 'Pending Review');
    assert.ok(stored.createdAt instanceof Date);

    const duplicate = await invoke(createScholarshipReport, {
      params: { scholarshipId: String(retainListing._id) },
      user: reporter,
      body: { category: 'Other concern', details: 'Second try' },
    });
    assert.equal(duplicate.statusCode, 409);

    const archived = await invoke(createScholarshipReport, {
      params: { scholarshipId: String(archivedListing._id) },
      user: reporter,
      body: { category: 'Expired or closed scholarship' },
    });
    assert.equal(archived.statusCode, 400);

    const impersonated = await invoke(createScholarshipReport, {
      params: { scholarshipId: String(removeListing._id) },
      user: reporter,
      body: {
        category: 'Suspicious or potentially fraudulent listing',
        reportedBy: String(adminUser._id),
      },
    });
    assert.equal(impersonated.statusCode, 403);

    const retained = await invoke(updateModerationReport, {
      params: { id: String(stored._id) },
      body: {
        action: 'RETAIN_LISTING',
        status: 'Retained',
        decisionReason: 'Eligibility text matches the provider submission.',
      },
      user: reviewer,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(retained.statusCode, 200);

    const retainedRecord = await Report.findById(stored._id);
    const retainedListing = await Scholarship.findById(retainListing._id);
    const retainNotice = await Notification.findOne({
      studentProfileId: profile._id,
      type: 'report_decision',
      scholarshipId: retainListing._id,
    });
    assert.equal(retainedRecord.status, 'Retained');
    assert.equal(retainedRecord.decisionReason, 'Eligibility text matches the provider submission.');
    assert.equal(String(retainedRecord.resolvedBy), String(adminUser._id));
    assert.ok(retainedRecord.resolvedAt instanceof Date);
    assert.equal(retainedListing.status, 'Open');
    assert.equal(retainedListing.isArchived, false);
    assert.ok(retainNotice);
    assert.equal(retainNotice.title.includes(`${MARKER} Retain Grant`), true);
    assert.equal(retainNotice.title.includes('Retained'), true);
    assert.equal(retainNotice.message.includes('Eligibility text matches the provider submission.'), true);

    const removalSubmission = await invoke(createScholarshipReport, {
      params: { scholarshipId: String(removeListing._id) },
      user: reporter,
      body: { category: 'Suspicious or potentially fraudulent listing' },
    });
    assert.equal(removalSubmission.statusCode, 201);
    ids.reportIds.push(removalSubmission.body.data._id);

    const removed = await invoke(updateModerationReport, {
      params: { id: String(removalSubmission.body.data._id) },
      body: {
        action: 'REMOVE_LISTING',
        status: 'Removed',
        decisionReason: 'The listing requests payment before review.',
        scholarshipId: String(retainListing._id),
      },
      user: reviewer,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(removed.statusCode, 400);
    const untouchedRemoval = await Scholarship.findById(removeListing._id);
    const untouchedReport = await Report.findById(removalSubmission.body.data._id);
    assert.equal(untouchedRemoval.isArchived, false);
    assert.equal(untouchedReport.status, 'Pending Review');

    const removedForReal = await invoke(updateModerationReport, {
      params: { id: String(removalSubmission.body.data._id) },
      body: {
        action: 'REMOVE_LISTING',
        status: 'Removed',
        decisionReason: 'The listing requests payment before review.',
      },
      user: reviewer,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(removedForReal.statusCode, 200);

    const removedRecord = await Report.findById(removalSubmission.body.data._id);
    const removedListing = await Scholarship.findById(removeListing._id);
    const removalNotice = await Notification.findOne({
      studentProfileId: profile._id,
      scholarshipId: removeListing._id,
      type: 'report_decision',
    });
    assert.equal(removedRecord.status, 'Removed');
    assert.equal(removedRecord.decisionReason, 'The listing requests payment before review.');
    assert.equal(String(removedRecord.resolvedBy), String(adminUser._id));
    assert.equal(removedListing.status, 'Closed');
    assert.equal(removedListing.isArchived, true);
    assert.ok(removedListing.adminRemovedAt instanceof Date);
    assert.equal(removedListing.adminRemovalReason, 'The listing requests payment before review.');
    assert.ok(removalNotice);
    assert.equal(removalNotice.message.includes('removed'), true);
    assert.equal(removalNotice.message.includes('The listing requests payment before review.'), true);

    const providerNotice = await ProviderNotification.findOne({
      providerId: provider._id,
      scholarshipId: removeListing._id,
      type: 'listing_removed',
    });
    assert.ok(providerNotice);
    assert.equal(String(providerNotice.providerId), String(provider._id));
    assert.equal(String(providerNotice.scholarshipId), String(removeListing._id));
    assert.equal(providerNotice.title.includes(`${MARKER} Remove Grant`), true);
    assert.equal(providerNotice.message.includes('removed by an administrator'), true);
    assert.equal(providerNotice.message.includes('The listing requests payment before review.'), true);
    assert.ok(providerNotice.removedAt instanceof Date);
    assert.equal(providerNotice.message.includes(studentUser.name), false);
    assert.equal(providerNotice.message.includes(studentUser.email), false);

    const otherProviderUser = await User.create({
      name: `${MARKER} Other Provider`,
      email: `qa.report.provider.other.${Date.now()}@example.com`,
      password: 'Secret1-password',
      role: 'provider',
      status: 'active',
      isVerified: true,
    });
    const otherProvider = await Provider.create({
      userId: otherProviderUser._id,
      institutionName: `${MARKER} Other Foundation`,
      institutionType: 'Non-Profit / NGO',
      verificationStatus: 'Verified',
    });
    ids.userIds.push(otherProviderUser._id);
    ids.providerIds.push(otherProvider._id);
    assert.equal(await ProviderNotification.countDocuments({ providerId: otherProvider._id }), 0);

    const repeatedRemoval = await invoke(updateModerationReport, {
      params: { id: String(removalSubmission.body.data._id) },
      body: {
        action: 'REMOVE_LISTING',
        status: 'Removed',
        decisionReason: 'The listing requests payment before review.',
      },
      user: reviewer,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(repeatedRemoval.statusCode, 409);
    assert.equal(await ProviderNotification.countDocuments({ scholarshipId: removeListing._id }), 1);

    const providerActor = {
      id: providerUser._id,
      _id: providerUser._id,
      role: 'provider',
    };
    const reopenAttempt = await invoke(updateScholarshipStatus, {
      user: providerActor,
      params: { id: String(removeListing._id) },
      body: { status: 'Open', isArchived: false },
    });
    assert.equal(reopenAttempt.statusCode, 403);
    const editAttempt = await invoke(updateScholarship, {
      user: providerActor,
      params: { id: String(removeListing._id) },
      body: {
        description: 'Provider tried to rewrite the removed listing.',
        status: 'Open',
        isArchived: false,
      },
    });
    assert.equal(editAttempt.statusCode, 403);
    const archiveAttempt = await invoke(archiveScholarship, {
      user: providerActor,
      params: { id: String(removeListing._id) },
    });
    assert.equal(archiveAttempt.statusCode, 403);
    const stillRemovedListing = await Scholarship.findById(removeListing._id);
    assert.equal(stillRemovedListing.status, 'Closed');
    assert.equal(stillRemovedListing.isArchived, true);
    assert.ok(stillRemovedListing.adminRemovedAt instanceof Date);
    assert.equal(stillRemovedListing.description.includes('Provider tried'), false);
    const providerView = await invoke(getScholarshipById, {
      user: providerActor,
      params: { id: String(removeListing._id) },
    });
    assert.equal(providerView.statusCode, 200);
    assert.equal(
      providerView.body.scholarship.adminRemovalReason,
      'The listing requests payment before review.'
    );

    const retainListingAfterRemoval = await Scholarship.findById(retainListing._id);
    assert.equal(retainListingAfterRemoval.status, 'Open');
    assert.equal(retainListingAfterRemoval.isArchived, false);
    assert.equal(retainListingAfterRemoval.adminRemovedAt, null);

    const ordinaryStatus = await invoke(updateScholarshipStatus, {
      user: providerActor,
      params: { id: String(retainListing._id) },
      body: { status: 'Closed' },
    });
    assert.equal(ordinaryStatus.statusCode, 200);
    const ordinaryListing = await Scholarship.findById(retainListing._id);
    assert.equal(ordinaryListing.status, 'Closed');
    assert.equal(ordinaryListing.isArchived, false);
    assert.equal(ordinaryListing.adminRemovedAt, null);

    const secondDecision = await invoke(updateModerationReport, {
      params: { id: String(removalSubmission.body.data._id) },
      body: {
        action: 'RETAIN_LISTING',
        status: 'Retained',
        decisionReason: 'Changed my mind.',
      },
      user: reviewer,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(secondDecision.statusCode, 409);
    const stillRemoved = await Report.findById(removalSubmission.body.data._id);
    assert.equal(stillRemoved.status, 'Removed');

    const secondStudent = await User.create({
      name: `${MARKER} Student Two`,
      email: `qa.report.student.two.${Date.now()}@example.com`,
      password: 'Secret1-password',
      role: 'student',
      status: 'active',
      isVerified: true,
    });
    const thirdStudent = await User.create({
      name: `${MARKER} Student Three`,
      email: `qa.report.student.three.${Date.now()}@example.com`,
      password: 'Secret1-password',
      role: 'student',
      status: 'active',
      isVerified: true,
    });
    ids.userIds.push(secondStudent._id, thirdStudent._id);

    const secondProfile = await StudentProfile.create({
      userId: secondStudent._id,
      dateOfBirth: new Date('2004-05-02'),
      academicLevel: 'College',
      yearLevel: '3rd Year',
      course: 'BS Information Technology',
      gwa: 1.75,
      gwaScale: '1.00-5.00',
      incomeBracket: 'Below ₱10,000 / month',
      region: 'NCR',
      schoolName: `${MARKER} University`,
      schoolType: 'Public',
      province: 'Metro Manila',
      municipalityCity: 'Quezon City',
    });
    const thirdProfile = await StudentProfile.create({
      userId: thirdStudent._id,
      dateOfBirth: new Date('2005-01-20'),
      academicLevel: 'College',
      yearLevel: '1st Year',
      course: 'BS Computer Science',
      gwa: 1.25,
      gwaScale: '1.00-5.00',
      incomeBracket: 'Below ₱10,000 / month',
      region: 'NCR',
      schoolName: `${MARKER} University`,
      schoolType: 'Private',
      province: 'Metro Manila',
      municipalityCity: 'Makati',
    });
    ids.profileIds.push(secondProfile._id, thirdProfile._id);

    const sharedListing = await Scholarship.create({
      ...scholarshipBody(`${MARKER} Shared Grant`),
      providerId: provider._id,
    });
    ids.scholarshipIds.push(sharedListing._id);

    const reporterTwo = {
      _id: secondStudent._id,
      id: secondStudent._id,
      role: 'student',
      status: 'active',
    };
    const reporterThree = {
      _id: thirdStudent._id,
      id: thirdStudent._id,
      role: 'student',
      status: 'active',
    };
    const sharedReports = [];
    for (const reporterUser of [reporter, reporterTwo, reporterThree]) {
      const sharedSubmission = await invoke(createScholarshipReport, {
        params: { scholarshipId: String(sharedListing._id) },
        user: reporterUser,
        body: { category: 'Suspicious or potentially fraudulent listing' },
      });
      assert.equal(sharedSubmission.statusCode, 201);
      sharedReports.push(sharedSubmission.body.data);
      ids.reportIds.push(sharedSubmission.body.data._id);
    }
    assert.equal(await Report.countDocuments({ listingId: sharedListing._id }), 3);

    const sharedRetained = await invoke(updateModerationReport, {
      params: { id: String(sharedReports[0]._id) },
      body: {
        action: 'RETAIN_LISTING',
        decisionReason: 'The first report does not justify removing the shared listing.',
      },
      user: reviewer,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(sharedRetained.statusCode, 200);

    const firstShared = await Report.findById(sharedReports[0]._id);
    const secondShared = await Report.findById(sharedReports[1]._id);
    const thirdShared = await Report.findById(sharedReports[2]._id);
    const sharedAfterRetain = await Scholarship.findById(sharedListing._id);
    assert.equal(firstShared.status, 'Retained');
    assert.equal(secondShared.status, 'Pending Review');
    assert.equal(secondShared.resolvedBy, undefined);
    assert.equal(secondShared.resolvedAt, null);
    assert.equal(thirdShared.status, 'Pending Review');
    assert.equal(sharedAfterRetain.status, 'Open');
    assert.equal(sharedAfterRetain.isArchived, false);
    const retainNoticeForFirst = await Notification.findOne({
      studentProfileId: profile._id,
      dedupeKey: `report-decision:${sharedReports[0]._id}`,
    });
    const prematureGlobalNotice = await Notification.findOne({
      dedupeKey: `listing-removed:${sharedListing._id}`,
    });
    assert.ok(retainNoticeForFirst);
    assert.equal(retainNoticeForFirst.message.includes('retained'), true);
    assert.equal(prematureGlobalNotice, null);

    const sharedRemoved = await invoke(updateModerationReport, {
      params: { id: String(sharedReports[1]._id) },
      body: {
        action: 'REMOVE_LISTING',
        status: 'Removed',
        decisionReason: 'Later reports confirm the shared listing is not legitimate.',
      },
      user: reviewer,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(sharedRemoved.statusCode, 200);

    const firstAfterRemoval = await Report.findById(sharedReports[0]._id);
    const secondAfterRemoval = await Report.findById(sharedReports[1]._id);
    const thirdAfterRemoval = await Report.findById(sharedReports[2]._id);
    const removedShared = await Scholarship.findById(sharedListing._id);
    const stillVisible = await Scholarship.find({
      _id: sharedListing._id,
      status: 'Open',
      isArchived: false,
    });
    assert.equal(await Report.countDocuments({ listingId: sharedListing._id }), 3);
    assert.equal(firstAfterRemoval.status, 'Retained');
    assert.equal(firstAfterRemoval.decisionReason, 'The first report does not justify removing the shared listing.');
    assert.equal(secondAfterRemoval.status, 'Removed');
    assert.equal(thirdAfterRemoval.status, 'Pending Review');
    assert.equal(thirdAfterRemoval.resolvedBy, null);
    assert.equal(removedShared.status, 'Closed');
    assert.equal(removedShared.isArchived, true);
    assert.equal(stillVisible.length, 0);

    const individualRemovalNotice = await Notification.findOne({
      studentProfileId: secondProfile._id,
      dedupeKey: `report-decision:${sharedReports[1]._id}`,
    });
    const globalNoticeForRetainedReporter = await Notification.findOne({
      studentProfileId: profile._id,
      dedupeKey: `listing-removed:${sharedListing._id}`,
    });
    const globalNoticeForPendingReporter = await Notification.findOne({
      studentProfileId: thirdProfile._id,
      dedupeKey: `listing-removed:${sharedListing._id}`,
    });
    assert.ok(individualRemovalNotice);
    assert.equal(individualRemovalNotice.message.includes('not a decision on your own report'), false);
    assert.equal(individualRemovalNotice.message.includes('Later reports confirm the shared listing is not legitimate.'), true);
    assert.ok(globalNoticeForRetainedReporter);
    assert.ok(globalNoticeForPendingReporter);
    assert.equal(globalNoticeForPendingReporter.message.includes('not a decision on your own report'), true);
    assert.equal(globalNoticeForPendingReporter.message.includes(`${MARKER} Shared Grant`), true);

    const reportAfterArchive = await invoke(createScholarshipReport, {
      params: { scholarshipId: String(sharedListing._id) },
      user: reporter,
      body: { category: 'Other concern' },
    });
    assert.equal(reportAfterArchive.statusCode, 400);

    const retainArchived = await invoke(updateModerationReport, {
      params: { id: String(sharedReports[2]._id) },
      body: {
        action: 'RETAIN_LISTING',
        decisionReason: 'This should not restore the shared listing.',
      },
      user: reviewer,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(retainArchived.statusCode, 409);
    const thirdStillPending = await Report.findById(sharedReports[2]._id);
    const sharedStillArchived = await Scholarship.findById(sharedListing._id);
    assert.equal(thirdStillPending.status, 'Pending Review');
    assert.equal(sharedStillArchived.isArchived, true);
    assert.equal(sharedStillArchived.status, 'Closed');
    assert.ok(sharedStillArchived.adminRemovedAt instanceof Date);

    const concurrentListing = await Scholarship.create({
      ...scholarshipBody(`${MARKER} Concurrent Grant`),
      providerId: provider._id,
    });
    ids.scholarshipIds.push(concurrentListing._id);
    const concurrentSubmission = await invoke(createScholarshipReport, {
      params: { scholarshipId: String(concurrentListing._id) },
      user: reporterTwo,
      body: { category: 'Incorrect or misleading information' },
    });
    assert.equal(concurrentSubmission.statusCode, 201);
    ids.reportIds.push(concurrentSubmission.body.data._id);
    const concurrentBody = {
      action: 'REMOVE_LISTING',
      status: 'Removed',
      decisionReason: 'Two admins reviewed this report at the same time.',
    };
    const concurrentResults = await Promise.all([
      invoke(updateModerationReport, {
        params: { id: String(concurrentSubmission.body.data._id) },
        body: concurrentBody,
        user: reviewer,
        ip: '127.0.0.1',
        headers: {},
      }),
      invoke(updateModerationReport, {
        params: { id: String(concurrentSubmission.body.data._id) },
        body: concurrentBody,
        user: reviewer,
        ip: '127.0.0.1',
        headers: {},
      }),
    ]);
    assert.deepEqual(
      concurrentResults.map((result) => result.statusCode).sort(),
      [200, 409]
    );
    const concurrentRecord = await Report.findById(concurrentSubmission.body.data._id);
    const concurrentScholarship = await Scholarship.findById(concurrentListing._id);
    assert.equal(concurrentRecord.status, 'Removed');
    assert.equal(concurrentScholarship.isArchived, true);
    assert.equal(concurrentScholarship.status, 'Closed');
    assert.ok(concurrentScholarship.adminRemovedAt instanceof Date);
    assert.equal(
      await ProviderNotification.countDocuments({ scholarshipId: concurrentListing._id }),
      1
    );

    console.log('scholarship report database check passed');
  } finally {
    await Report.deleteMany({ _id: { $in: ids.reportIds } });
    await Notification.deleteMany({ studentProfileId: { $in: ids.profileIds } });
    await ProviderNotification.deleteMany({ providerId: { $in: ids.providerIds } });
    await Scholarship.deleteMany({ _id: { $in: ids.scholarshipIds } });
    await Scholarship.deleteMany({ name: new RegExp(`^${MARKER}`) });
    await StudentProfile.deleteMany({ _id: { $in: ids.profileIds } });
    await Provider.deleteMany({ _id: { $in: ids.providerIds } });
    await User.deleteMany({ _id: { $in: ids.userIds } });
    await AuditLog.deleteMany({ actor: new RegExp(MARKER) });
    restoreModels();
    await mongoose.disconnect();
  }
};

const main = async () => {
  await runUnitTests();
  await runDatabaseTests();
  console.log('scholarship report tests passed');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
