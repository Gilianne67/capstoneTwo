export const SCHOLARSHIP_STATUS_FILTERS = ['All', 'Open', 'Closed', 'Archived'];

export const PENDING_ACTION_PATHS = {
  'provider-verification': '/dashboard/admin/verification',
  'scholarship-reports': '/dashboard/admin/moderation?status=Unresolved',
  'eligibility-reviews': '/dashboard/admin/eligibility-criteria?status=Pending',
  'guardian-consent': '/dashboard/admin/users?role=student&status=pending_consent',
};

const SUMMARY_FIELDS = [
  ['studentAccounts', 'Student accounts', 'Current total. Not limited to a date range.', '/dashboard/admin/users?role=student', 'blue'],
  ['providerAccounts', 'Provider accounts', 'Registered provider accounts. Separate from verified organizations.', '/dashboard/admin/users?role=provider', 'indigo'],
  ['activeAccounts', 'Active accounts', 'Current user accounts with status active, across all roles. This is not the verified-organization count.', '/dashboard/admin/users?status=active', 'emerald'],
  ['suspendedAccounts', 'Suspended accounts', 'Current user accounts with status suspended, across all roles.', '/dashboard/admin/users?status=suspended', 'rose'],
  ['verifiedProviderOrganizations', 'Verified organizations', 'Provider profiles with verification status Approved or Verified.', '/dashboard/admin/verification?status=Verified', 'emerald'],
  ['openScholarships', 'Open scholarships', 'Matches the All Scholarships Open filter. Includes listings from suspended providers.', '/dashboard/admin/scholarships?status=Open', 'amber'],
  ['archivedScholarships', 'Archived scholarships', 'Matches the All Scholarships Archived filter.', '/dashboard/admin/scholarships?status=Archived', 'blue'],
];

export function eligibilityStatusFromSearch(value) {
  return value === 'Pending' ? 'Pending' : 'All';
}

export function scholarshipStatusFromSearch(value) {
  return SCHOLARSHIP_STATUS_FILTERS.includes(value) ? value : 'All';
}

export function scholarshipSearchWithStatus(current, status) {
  const next = new URLSearchParams(current);
  const selected = scholarshipStatusFromSearch(status);
  if (selected === 'All') next.delete('status');
  else next.set('status', selected);
  return next;
}

const finiteCount = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * Current-total cards. Missing counts stay hidden so a failed read is not shown as zero.
 */
export function summaryCards(summary) {
  if (!summary || summary.scope !== 'current') return [];
  const captions = summary.captions || {};
  const cards = [];
  for (const [key, label, fallback, href, color] of SUMMARY_FIELDS) {
    if (!finiteCount(summary[key])) return [];
    cards.push({
      id: key,
      label,
      value: summary[key],
      caption: typeof captions[key] === 'string' && captions[key].trim()
        ? captions[key]
        : fallback,
      href,
      color,
    });
  }
  return cards;
}

/**
 * Keep server counts and only the known admin destinations.
 */
export function visiblePendingActions(actions) {
  if (!Array.isArray(actions)) return [];
  return actions.flatMap((action) => {
    if (!action || !finiteCount(action.count)) return [];
    const path = PENDING_ACTION_PATHS[action.id];
    if (!path || action.path !== path || typeof action.label !== 'string' || !action.label.trim()) {
      return [];
    }
    return [{
      id: action.id,
      label: action.label,
      count: action.count,
      path,
      note: typeof action.note === 'string' ? action.note : '',
    }];
  });
}

const ACTIVITY_KEYS = ['id', 'action', 'description', 'severity', 'createdAt'];

/**
 * Activity rows expose only the fixed description, timestamp, and severity.
 */
export function visibleActivity(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row.description !== 'string' || !row.description.trim()) return [];
    const createdAt = row.createdAt ? new Date(row.createdAt) : null;
    if (!createdAt || Number.isNaN(createdAt.getTime())) return [];
    return [{
      id: row.id ? String(row.id) : `${row.action || 'event'}:${createdAt.toISOString()}`,
      action: typeof row.action === 'string' ? row.action : '',
      description: row.description,
      severity: row.severity === 'Warning' || row.severity === 'Critical' ? row.severity : 'Info',
      createdAt: createdAt.toISOString(),
    }];
  }).slice(0, 8).map((row) => {
    const visible = {};
    ACTIVITY_KEYS.forEach((key) => {
      visible[key] = row[key];
    });
    return visible;
  });
}

export function visibleAlerts(alerts) {
  if (!Array.isArray(alerts)) return [];
  return alerts.flatMap((alert) => {
    if (!alert || alert.id !== 'maintenance-mode' || typeof alert.message !== 'string') return [];
    return [{
      id: 'maintenance-mode',
      severity: 'warning',
      message: alert.message,
      path: '/dashboard/admin/settings',
    }];
  });
}
