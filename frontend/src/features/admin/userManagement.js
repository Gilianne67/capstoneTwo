export const ROLE_FILTERS = [
  { value: 'all', label: 'All roles' },
  { value: 'student', label: 'Student' },
  { value: 'provider', label: 'Scholarship Provider' },
  { value: 'administrator', label: 'Administrator' },
];

export const ACCOUNT_STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'pending_consent', label: 'Pending consent' },
];

const readSearchValue = (params, key) => {
  if (params && typeof params.get === 'function') return params.get(key);
  if (params && typeof params === 'object') return params[key];
  return null;
};

/**
 * Initial directory filters from a dashboard link.
 * Unknown values fall back to the unfiltered directory.
 */
export function directoryFiltersFromSearch(params) {
  const roleValue = readSearchValue(params, 'role');
  const statusValue = readSearchValue(params, 'status');
  return {
    role: ROLE_FILTERS.some((item) => item.value === roleValue) ? roleValue : 'all',
    status: ACCOUNT_STATUS_FILTERS.some((item) => item.value === statusValue) ? statusValue : 'all',
  };
}

export function directorySearchWithFilters(current, { role, status } = {}) {
  const next = new URLSearchParams(current);
  const filters = directoryFiltersFromSearch({ role, status });
  if (filters.role === 'all') next.delete('role');
  else next.set('role', filters.role);
  if (filters.status === 'all') next.delete('status');
  else next.set('status', filters.status);
  return next;
}

const canonicalRole = (role) => String(role || '').trim().toLowerCase().replace(/-/g, '_');

export function isSuperAdminRole(role) {
  const value = canonicalRole(role);
  return value === 'superadmin' || value === 'super_admin';
}

export function isAdministratorRole(role) {
  const value = canonicalRole(role);
  return value === 'admin' || value === 'superadmin' || value === 'super_admin';
}

export function sameAccount(actor, targetId) {
  const actorId = actor?.id || actor?._id;
  if (!actorId || targetId === undefined || targetId === null || targetId === '') return false;
  return String(actorId) === String(targetId);
}

export function roleLabel(role) {
  if (role === 'student') return 'Student';
  if (role === 'provider') return 'Scholarship Provider';
  if (role === 'admin') return 'Administrator';
  if (isSuperAdminRole(role)) return 'Super Admin';
  return role || 'Unknown';
}

export function providerVerificationPath(providerId) {
  if (!providerId) return null;
  return `/dashboard/admin/verification?providerId=${encodeURIComponent(String(providerId))}`;
}

/**
 * UI hint only. The status endpoint still rejects unauthorized changes.
 * pending_consent is not an action this screen can send.
 */
export function statusActionFor(actor, target) {
  if (!target) return { allowed: false, reason: 'missing' };
  if (sameAccount(actor, target.id)) return { allowed: false, reason: 'self' };
  if (isAdministratorRole(target.role) && !isSuperAdminRole(actor?.role)) {
    return { allowed: false, reason: 'admin-restricted' };
  }
  if (target.status === 'suspended') {
    return { allowed: true, action: 'restore', nextStatus: 'active' };
  }
  if (target.status === 'active') {
    return { allowed: true, action: 'suspend', nextStatus: 'suspended' };
  }
  return { allowed: false, reason: 'unsupported-status' };
}

const closedDialog = (requests = 0) => ({
  phase: 'closed',
  action: null,
  requests,
});

/**
 * One confirmation at a time. A second open is ignored while a dialog is
 * already open or submitting, and a second confirm does not add a request.
 */
export function reduceStatusDialog(state, event) {
  const current = state || closedDialog();

  if (event.type === 'open') {
    if (current.phase !== 'closed') return current;
    return {
      phase: 'open',
      action: event.action,
      requests: current.requests,
    };
  }

  if (event.type === 'confirm') {
    if (current.phase !== 'open') return current;
    return {
      ...current,
      phase: 'submitting',
      requests: current.requests + 1,
    };
  }

  if (event.type === 'cancel') {
    if (current.phase === 'submitting') return current;
    return closedDialog(current.requests);
  }

  if (event.type === 'finish') return closedDialog(current.requests);

  if (event.type === 'fail') {
    if (current.phase !== 'submitting') return current;
    return { ...current, phase: 'open' };
  }

  return current;
}

/**
 * The status endpoint saves the account before revoking sessions. A 503 can
 * mean the account is already suspended and only the revocation index failed.
 * That result must close the confirmation. Asking the admin to confirm again
 * sends another status request for a change that already happened.
 */
export function interpretStatusResult({ ok, body }) {
  const payload = body && typeof body === 'object' ? body : {};
  const message = String(payload.message || payload.error || '');
  if (payload.statusUpdated === true || (ok && payload.success !== false)) {
    return { outcome: 'completed', message };
  }
  return { outcome: 'failed', message };
}
