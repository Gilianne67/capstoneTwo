const SavedMatch = require('../models/SavedMatch');
const Notification = require('../models/Notification');
const ProviderNotification = require('../models/ProviderNotification');
const StudentProfile = require('../models/StudentProfile');
const {
  isDeadlineOpen,
  manilaDeadlineEnd
} = require('./matchingService');

const DAY_MS = 24 * 60 * 60 * 1000;

const CRITICAL_FIELDS = [
  'academicLevel',
  'yearLevel',
  'course',
  'gwa',
  'gwaScale',
  'incomeBracket',
  'region',
  'specialEligibilityFlags'
];

const COMPLETION_FIELDS = [
  'schoolName',
  'schoolType',
  'province',
  'municipalityCity'
];

const FIELD_LABELS = {
  academicLevel: 'academic level',
  yearLevel: 'year level',
  course: 'course',
  gwa: 'GWA',
  gwaScale: 'GWA scale',
  incomeBracket: 'income bracket',
  region: 'region',
  specialEligibilityFlags: 'special eligibility'
};

const WINDOW_COPY = {
  '7d': {
    title: 'Scholarship deadline in 7 days',
    lead: 'closes within 7 days'
  }
};

const isActiveDeadlineScholarship = (scholarship, now = new Date()) => {
  if (!scholarship || typeof scholarship !== 'object' || !scholarship._id) {
    return false;
  }

  if (scholarship.status && scholarship.status !== 'Open') {
    return false;
  }

  if (scholarship.isArchived === true) {
    return false;
  }

  return isDeadlineOpen(scholarship.deadline, now);
};

const currentAlertWindow = (deadline, now = new Date()) => {
  const end = manilaDeadlineEnd(deadline);

  if (end === null) return null;

  const remaining = end - now.getTime();

  // Deadlines inside the old 3-day and 24-hour windows use the 7-day reminder.
  if (remaining <= 0) return null;
  if (remaining <= 7 * DAY_MS) return '7d';

  return null;
};

const formatDeadline = (deadline) => {
  const parsed = new Date(deadline);

  if (Number.isNaN(parsed.getTime())) return '';

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila'
  });
};

const isDuplicateKeyError = (error) => error && error.code === 11000;

const createOnce = async (payload) => {
  try {
    await Notification.create(payload);
  } catch (error) {
    if (isDuplicateKeyError(error)) return;
    throw error;
  }
};

const syncDeadlineNotifications = async (studentProfileId, savedItems) => {
  const saved = savedItems || await SavedMatch.find({ studentProfileId })
    .populate('scholarshipId', 'name deadline status isArchived');

  const now = new Date();

  await Promise.all(saved.map(async (item) => {
    const scholarship = item.scholarshipId;

    if (!isActiveDeadlineScholarship(scholarship, now)) {
      return;
    }

    const alertWindow = currentAlertWindow(scholarship.deadline, now);

    if (!alertWindow) return;

    const copy = WINDOW_COPY[alertWindow];
    const name = scholarship.name || 'Saved scholarship';
    const due = formatDeadline(scholarship.deadline);
    const dueText = due ? ` Due ${due}.` : '';

    await createOnce({
      studentProfileId,
      type: 'deadline',
      title: copy.title,
      message: `${name} ${copy.lead}.${dueText}`.replace(/\s+/g, ' ').trim(),
      scholarshipId: scholarship._id,
      alertWindow,
      dedupeKey: `${scholarship._id}:${alertWindow}`,
      isRead: false
    });
  }));
};

const valueSnapshot = (value) => {
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value ?? null);
};

const changedCriticalFields = (before, after) => {
  const previous = before?.toObject ? before.toObject() : (before || {});
  const next = after?.toObject ? after.toObject() : (after || {});

  return CRITICAL_FIELDS.filter(
    (field) => valueSnapshot(previous[field]) !== valueSnapshot(next[field])
  );
};

const isProfileComplete = (profile) => {
  const source = profile?.toObject ? profile.toObject() : (profile || {});

  return COMPLETION_FIELDS.every((field) => {
    const value = source[field];
    return value !== null && value !== undefined && String(value).trim() !== '';
  });
};

const notifyProfileUpdate = async (studentProfileId, changedFields) => {
  if (!changedFields.length) return;

  const unread = await Notification.findOne({
    studentProfileId,
    type: 'profile_update',
    isRead: false
  }).select('_id');

  if (unread) return;

  const labels = changedFields.map((field) => FIELD_LABELS[field] || field);

  await Notification.create({
    studentProfileId,
    type: 'profile_update',
    title: 'Profile updated',
    message: `Your student profile changed (${labels.join(', ')}). Your scholarship matches may change.`,
    scholarshipId: null,
    isRead: false
  });
};

const notifyProfileCompletion = async (studentProfileId) => {
  await createOnce({
    studentProfileId,
    type: 'profile_completion',
    title: 'Profile complete',
    message: 'Your student profile is complete. School and location details are now saved.',
    scholarshipId: null,
    dedupeKey: 'profile-completion',
    isRead: false
  });
};

const notifyProfileChange = async (before, after) => {
  if (!after?._id) return;

  const studentProfileId = after._id;
  const changedFields = before ? changedCriticalFields(before, after) : [];
  const becameComplete = isProfileComplete(after) && (!before || !isProfileComplete(before));

  if (changedFields.length) {
    await notifyProfileUpdate(studentProfileId, changedFields);
  }

  if (becameComplete) {
    await notifyProfileCompletion(studentProfileId);
  }
};

const countUnreadDeadlineAlerts = async (studentProfileId) => {
  const now = new Date();
  const saved = await SavedMatch.find({ studentProfileId })
    .populate('scholarshipId', 'deadline status isArchived');
  const scholarshipIds = saved
    .map((item) => item.scholarshipId)
    .filter((scholarship) => isActiveDeadlineScholarship(scholarship, now))
    .map((scholarship) => scholarship._id);

  if (!scholarshipIds.length) {
    return 0;
  }

  return Notification.countDocuments({
    studentProfileId,
    type: 'deadline',
    isRead: false,
    scholarshipId: { $in: scholarshipIds }
  });
};

const countUnreadAlertNotifications = async (studentProfileId) => {
  const [deadlineCount, decisionCount] = await Promise.all([
    countUnreadDeadlineAlerts(studentProfileId),
    Notification.countDocuments({
      studentProfileId,
      type: 'report_decision',
      isRead: false
    })
  ]);

  return deadlineCount + decisionCount;
};

const safeSyncDeadlineNotifications = async (studentProfileId, savedItems) => {
  try {
    await syncDeadlineNotifications(studentProfileId, savedItems);
  } catch (error) {
    console.error('Deadline notification sync failed:', error);
  }
};

const safeNotifyProfileChange = async (before, after) => {
  try {
    await notifyProfileChange(before, after);
  } catch (error) {
    console.error('Profile notification failed:', error);
  }
};

const notifyScholarshipReportDecision = async ({
  studentUserId,
  reportId,
  scholarshipId,
  scholarshipTitle,
  decision,
  explanation
}) => {
  const profile = await StudentProfile.findOne({ userId: studentUserId }).select('_id');

  if (!profile) {
    const error = new Error('Reporting student profile was not found.');
    error.code = 'STUDENT_PROFILE_MISSING';
    throw error;
  }

  const titleName = String(scholarshipTitle || 'Scholarship').trim() || 'Scholarship';
  const decisionLabel = String(decision || '').trim();
  const adminExplanation = String(explanation || '').trim();

  await createOnce({
    studentProfileId: profile._id,
    type: 'report_decision',
    title: `${titleName}: ${decisionLabel}`,
    message: `${titleName} was ${decisionLabel.toLowerCase()}. Admin explanation: ${adminExplanation}`,
    scholarshipId: scholarshipId || null,
    dedupeKey: `report-decision:${reportId}`,
    isRead: false
  });
};

const notifyScholarshipListingRemoved = async ({
  studentUserId,
  scholarshipId,
  scholarshipTitle,
  explanation
}) => {
  const profile = await StudentProfile.findOne({ userId: studentUserId }).select('_id');

  if (!profile) {
    const error = new Error('Reporting student profile was not found.');
    error.code = 'STUDENT_PROFILE_MISSING';
    throw error;
  }

  const titleName = String(scholarshipTitle || 'Scholarship').trim() || 'Scholarship';
  const adminExplanation = String(explanation || '').trim();

  await createOnce({
    studentProfileId: profile._id,
    type: 'report_decision',
    title: `${titleName}: listing removed`,
    message: `${titleName} was removed from scholarship listings for every student. This notice is about the shared scholarship listing, not a decision on your own report. Admin explanation: ${adminExplanation}`,
    scholarshipId: scholarshipId || null,
    dedupeKey: `listing-removed:${scholarshipId}`,
    isRead: false
  });
};

const notifyProviderListingRemoved = async ({
  providerId,
  scholarshipId,
  scholarshipTitle,
  explanation,
  removedAt
}) => {
  if (!providerId || !scholarshipId) {
    const error = new Error('The scholarship provider could not be identified.');
    error.code = 'PROVIDER_MISSING';
    throw error;
  }

  const titleName = String(scholarshipTitle || 'Scholarship').trim() || 'Scholarship';
  const adminExplanation = String(explanation || '').trim();
  const removalDate = removedAt instanceof Date && !Number.isNaN(removedAt.getTime())
    ? removedAt
    : new Date();
  const dedupeKey = `provider-listing-removed:${scholarshipId}`;
  const existing = await ProviderNotification.findOne({
    providerId,
    type: 'listing_removed',
    dedupeKey
  }).select('_id');

  if (existing) return;

  try {
    await ProviderNotification.create({
      providerId,
      type: 'listing_removed',
      title: `${titleName} was removed`,
      message: `${titleName} was removed by an administrator on ${removalDate.toISOString()}. Admin explanation: ${adminExplanation}`,
      scholarshipId,
      removedAt: removalDate,
      dedupeKey,
      isRead: false
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) return;
    throw error;
  }
};

module.exports = {
  currentAlertWindow,
  syncDeadlineNotifications,
  countUnreadDeadlineAlerts,
  countUnreadAlertNotifications,
  notifyProfileChange,
  notifyScholarshipReportDecision,
  notifyScholarshipListingRemoved,
  notifyProviderListingRemoved,
  safeSyncDeadlineNotifications,
  safeNotifyProfileChange
};
