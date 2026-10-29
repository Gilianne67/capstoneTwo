const TARGETS = ['All Users', 'Students Only', 'Grant Providers Only'];
const PRIORITIES = ['Info', 'Warning', 'Urgent'];
const PRIORITY_RANK = { Urgent: 3, Warning: 2, Info: 1 };
const MAX_TITLE_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 2000;

const SAVED_MESSAGE = 'Announcement saved. Matching dashboards will show it while it is active.';

const parseInstant = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const audienceTargetsForRole = (role) => {
  const value = String(role || '').trim().toLowerCase().replace(/-/g, '_');
  const targets = ['All Users'];
  if (value === 'student') targets.push('Students Only');
  if (value === 'provider') targets.push('Grant Providers Only');
  return targets;
};

/**
 * Live means status Active, the start instant has arrived, and expiration
 * has not. Equal start or expiration instants are still live.
 */
const broadcastPhase = (doc, now = new Date()) => {
  if (!doc || doc.status === 'Revoked') return 'revoked';

  const start = parseInstant(doc.startDate || 0);
  const expires = parseInstant(doc.expiresAt || 0);
  if (!start || !expires) return 'expired';
  if (expires.getTime() < now.getTime()) return 'expired';
  if (doc.status === 'Expired') return 'expired';
  if (start.getTime() > now.getTime()) return 'scheduled';
  if (doc.status && doc.status !== 'Active') return 'expired';
  return 'live';
};

const compareBroadcasts = (left, right) => {
  const rankDelta = (PRIORITY_RANK[right.priority] || 0) - (PRIORITY_RANK[left.priority] || 0);
  if (rankDelta !== 0) return rankDelta;
  return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
};

const validateBroadcastPayload = (body = {}, now = new Date()) => {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const expiresMissing = body.expiresAt === undefined || body.expiresAt === null || body.expiresAt === '';

  if (!title || !message || expiresMissing) {
    return {
      ok: false,
      message: 'Title, message, and expiration date are required.',
    };
  }

  if (title.length > MAX_TITLE_LENGTH) {
    return { ok: false, message: 'Banner title cannot exceed 120 characters.' };
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, message: 'Broadcast message cannot exceed 2000 characters.' };
  }

  const target = body.target === undefined || body.target === null || body.target === ''
    ? 'All Users'
    : body.target;
  if (!TARGETS.includes(target)) {
    return { ok: false, message: 'Target audience is not valid.' };
  }

  const priority = body.priority === undefined || body.priority === null || body.priority === ''
    ? 'Info'
    : body.priority;
  if (!PRIORITIES.includes(priority)) {
    return { ok: false, message: 'Priority level is not valid.' };
  }

  let startDate;
  const startMissing = body.startDate === undefined || body.startDate === null || body.startDate === '';
  if (startMissing) {
    startDate = new Date(now);
  } else {
    startDate = parseInstant(body.startDate);
    if (!startDate) return { ok: false, message: 'Start date is invalid.' };
  }

  const expiresAt = parseInstant(body.expiresAt);
  if (!expiresAt) return { ok: false, message: 'Expiration date is invalid.' };

  if (expiresAt.getTime() <= startDate.getTime()) {
    return { ok: false, message: 'Expiration date must be after the start date.' };
  }

  if (expiresAt.getTime() <= now.getTime()) {
    return { ok: false, message: 'Expiration date must be in the future.' };
  }

  return {
    ok: true,
    value: {
      title,
      message,
      target,
      priority,
      startDate,
      expiresAt,
    },
  };
};

const serializeBroadcast = (doc, now = new Date()) => {
  const source = doc && typeof doc.toObject === 'function'
    ? doc.toObject({ virtuals: false })
    : { ...doc };
  const phase = broadcastPhase(source, now);
  return {
    ...source,
    phase,
    isCurrentlyActive: phase === 'live',
  };
};

module.exports = {
  TARGETS,
  PRIORITIES,
  PRIORITY_RANK,
  MAX_TITLE_LENGTH,
  MAX_MESSAGE_LENGTH,
  SAVED_MESSAGE,
  audienceTargetsForRole,
  broadcastPhase,
  compareBroadcasts,
  validateBroadcastPayload,
  serializeBroadcast,
};
