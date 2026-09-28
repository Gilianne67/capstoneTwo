const SavedMatch = require('../models/SavedMatch');
const Notification = require('../models/Notification');

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
  },
  '3d': {
    title: 'Scholarship deadline in 3 days',
    lead: 'closes within 3 days'
  },
  '24h': {
    title: 'Scholarship deadline in 24 hours',
    lead: 'closes within 24 hours'
  }
};

const currentAlertWindow = (deadline, now = new Date()) => {
  const parsed = new Date(deadline);

  if (Number.isNaN(parsed.getTime())) return null;

  const remaining = parsed.getTime() - now.getTime();

  if (remaining <= 0) return null;
  if (remaining <= DAY_MS) return '24h';
  if (remaining <= 3 * DAY_MS) return '3d';
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
    .populate('scholarshipId', 'name deadline');

  const now = new Date();

  await Promise.all(saved.map(async (item) => {
    const scholarship = item.scholarshipId;

    if (!scholarship || typeof scholarship !== 'object' || !scholarship._id) {
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
  const saved = await SavedMatch.find({ studentProfileId }).select('scholarshipId');
  const scholarshipIds = saved
    .map((item) => item.scholarshipId)
    .filter(Boolean);

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

module.exports = {
  currentAlertWindow,
  syncDeadlineNotifications,
  countUnreadDeadlineAlerts,
  notifyProfileChange,
  safeSyncDeadlineNotifications,
  safeNotifyProfileChange
};
