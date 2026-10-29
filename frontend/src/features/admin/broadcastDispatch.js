export const TARGETS = ['All Users', 'Students Only', 'Grant Providers Only'];
export const PRIORITIES = ['Info', 'Warning', 'Urgent'];
export const MAX_TITLE_LENGTH = 120;
export const MAX_MESSAGE_LENGTH = 2000;

export const SAVED_MESSAGE = 'Announcement saved. Matching dashboards will show it while it is active.';
export const LOAD_FAILED = 'Announcements could not be loaded. Please try again.';
export const SAVE_FAILED = 'The announcement could not be saved. Please try again.';

const PRIORITY_RANK = { Urgent: 3, Warning: 2, Info: 1 };

const parseInstant = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Live means the row is active, the start instant has arrived, and it has
 * not expired. This matches backend/src/utils/broadcastRules.js.
 */
export function broadcastPhase(item, now = new Date()) {
  if (!item || item.status === 'Revoked') return 'revoked';

  const start = parseInstant(item.startDate || 0);
  const expires = parseInstant(item.expiresAt || 0);
  if (!start || !expires) return 'expired';
  if (expires.getTime() < now.getTime()) return 'expired';
  if (item.status === 'Expired') return 'expired';
  if (start.getTime() > now.getTime()) return 'scheduled';
  if (item.status && item.status !== 'Active') return 'expired';
  return 'live';
}

export function countLiveBroadcasts(list, now = new Date()) {
  if (!Array.isArray(list)) return 0;
  return list.filter((item) => broadcastPhase(item, now) === 'live').length;
}

export function compareBroadcasts(left, right) {
  const rankDelta = (PRIORITY_RANK[right?.priority] || 0) - (PRIORITY_RANK[left?.priority] || 0);
  if (rankDelta !== 0) return rankDelta;
  return new Date(right?.createdAt || 0).getTime() - new Date(left?.createdAt || 0).getTime();
}

export function priorityTone(priority) {
  if (priority === 'Warning') return 'warning';
  if (priority === 'Urgent') return 'urgent';
  return 'info';
}

/**
 * Dashboard pages stay on a light surface. The banner keeps that pale tint,
 * so its text stays dark in every color scheme. A light `dark:` text color
 * would sit on the same pale background and become unreadable.
 */
export function bannerPresentation(priority) {
  if (priority === 'Warning') {
    return {
      tone: 'warning',
      card: 'bg-amber-500/10 border-amber-500/30 text-amber-950',
      icon: 'bg-amber-500 text-white',
      text: 'text-amber-950',
      badge: 'bg-amber-200 text-amber-950',
      dismiss: 'text-amber-950 hover:bg-amber-500/15',
    };
  }

  if (priority === 'Urgent') {
    return {
      tone: 'urgent',
      card: 'bg-rose-500/10 border-rose-500/30 text-rose-950',
      icon: 'bg-rose-500 text-white',
      text: 'text-rose-950',
      badge: 'bg-rose-200 text-rose-950',
      dismiss: 'text-rose-950 hover:bg-rose-500/15',
    };
  }

  return {
    tone: 'info',
    card: 'bg-blue-500/10 border-blue-500/30 text-blue-950',
    icon: 'bg-blue-500 text-white',
    text: 'text-blue-950',
    badge: 'bg-blue-200 text-blue-950',
    dismiss: 'text-blue-950 hover:bg-blue-500/15',
  };
}

export function phaseLabel(phase) {
  if (phase === 'scheduled') return 'Scheduled';
  if (phase === 'expired') return 'Expired';
  if (phase === 'revoked') return 'Revoked';
  return 'Live';
}

export function dispatchServiceLabel({ loading = false, loadError = false } = {}) {
  if (loading) return 'Checking';
  if (loadError) return 'Unavailable';
  return 'Connected';
}

export function formatBroadcastWhen(value) {
  const date = parseInstant(value);
  if (!date) return 'Not set';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function messageFromBody(body, fallback) {
  const message = body?.message;
  if (typeof message === 'string' && message.trim()) return message.trim();
  const error = body?.error;
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (Array.isArray(error) && error.length) {
    return error.map((item) => String(item)).join(' ');
  }
  return fallback;
}

export function warningText(body) {
  if (!Array.isArray(body?.warnings)) return '';
  return body.warnings
    .map((item) => (typeof item?.message === 'string' ? item.message.trim() : ''))
    .filter(Boolean)
    .join(' ');
}

export function validateBroadcastDraft(draft = {}, now = new Date()) {
  const title = typeof draft.title === 'string' ? draft.title.trim() : '';
  const message = typeof draft.message === 'string' ? draft.message.trim() : '';
  const expiresMissing = draft.expiresAt === undefined || draft.expiresAt === null || draft.expiresAt === '';

  if (!title || !message || expiresMissing) {
    return { ok: false, error: 'Title, message, and expiration date are required.' };
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return { ok: false, error: 'Banner title cannot exceed 120 characters.' };
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: 'Broadcast message cannot exceed 2000 characters.' };
  }

  const target = draft.target || 'All Users';
  if (!TARGETS.includes(target)) {
    return { ok: false, error: 'Target audience is not valid.' };
  }

  const priority = draft.priority || 'Info';
  if (!PRIORITIES.includes(priority)) {
    return { ok: false, error: 'Priority level is not valid.' };
  }

  const startMissing = draft.startDate === undefined || draft.startDate === null || draft.startDate === '';
  const startDate = startMissing ? new Date(now) : parseInstant(draft.startDate);
  if (!startDate) return { ok: false, error: 'Start date is invalid.' };

  const expiresAt = parseInstant(draft.expiresAt);
  if (!expiresAt) return { ok: false, error: 'Expiration date is invalid.' };
  if (expiresAt.getTime() <= startDate.getTime()) {
    return { ok: false, error: 'Expiration date must be after the start date.' };
  }
  if (expiresAt.getTime() <= now.getTime()) {
    return { ok: false, error: 'Expiration date must be in the future.' };
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
      includeStart: !startMissing,
    },
  };
}

export function buildBroadcastPayload(draft, now = new Date()) {
  const checked = validateBroadcastDraft(draft, now);
  if (!checked.ok) return checked;

  const body = {
    title: checked.value.title,
    message: checked.value.message,
    target: checked.value.target,
    priority: checked.value.priority,
    expiresAt: checked.value.expiresAt.toISOString(),
  };
  if (checked.value.includeStart) {
    body.startDate = checked.value.startDate.toISOString();
  }
  return { ok: true, body };
}

export function interpretBroadcastResponse(response) {
  if (!response?.ok) {
    return {
      outcome: 'error',
      message: messageFromBody(response?.body, SAVE_FAILED),
    };
  }

  const broadcast = response.body?.broadcast;
  if (!broadcast || !(broadcast._id || broadcast.id)) {
    return {
      outcome: 'error',
      message: 'The server did not confirm that the announcement was saved.',
    };
  }

  return {
    outcome: 'saved',
    broadcast,
    message: SAVED_MESSAGE,
    warning: warningText(response.body),
  };
}

export function interpretBroadcastList(response, now = new Date()) {
  if (!response?.ok) {
    return {
      outcome: 'error',
      message: messageFromBody(response?.body, LOAD_FAILED),
    };
  }

  const list = response.body?.broadcasts;
  if (!Array.isArray(list)) {
    return { outcome: 'error', message: LOAD_FAILED };
  }

  return {
    outcome: 'loaded',
    broadcasts: list,
    activeCount: countLiveBroadcasts(list, now),
  };
}

export function interpretRevokeResponse(response) {
  if (response?.ok || response?.status === 404) {
    return { outcome: 'removed' };
  }
  return {
    outcome: 'error',
    message: messageFromBody(response?.body, 'The announcement could not be revoked. Please try again.'),
  };
}

export function emptyBroadcastDraft() {
  return {
    target: 'All Users',
    priority: 'Info',
    title: '',
    message: '',
    startDate: '',
    expiresAt: '',
  };
}
