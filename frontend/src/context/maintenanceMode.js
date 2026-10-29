import { LOGOUT_NOT_REVOKED_MESSAGE } from './logoutResult.js';

export const MAINTENANCE_EVENT = 'iskolar-maintenance';
export const MAINTENANCE_CODE = 'MAINTENANCE';
export const MAINTENANCE_MESSAGE = 'IskolarMatch is under maintenance. Students and providers cannot use the app right now. Please try again later.';
export const MAINTENANCE_LOGIN_PATH = '/auth?mode=signin';

const canonicalRole = (role) => String(role || '').trim().toLowerCase().replace(/-/g, '_');

export function isAdministratorRole(role) {
  const value = canonicalRole(role);
  return value === 'admin' || value === 'superadmin' || value === 'super_admin';
}

export function isMaintenanceResponse(status, data) {
  return status === 503 && Boolean(data) && data.code === MAINTENANCE_CODE;
}

export function maintenanceMessage(data) {
  const text = data && (data.message || data.error);
  return text ? String(text) : MAINTENANCE_MESSAGE;
}

export function isMaintenanceEntryPath(pathname) {
  const path = String(pathname || '');
  return path === '/auth'
    || path.startsWith('/auth/')
    || path === '/login'
    || path.startsWith('/login/')
    || path.startsWith('/reset-password');
}

export function hidesAppDuringMaintenance(pathname, role) {
  if (isAdministratorRole(role)) return false;
  if (isMaintenanceEntryPath(pathname)) return false;
  return true;
}

export function publishMaintenance(data) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MAINTENANCE_EVENT, { detail: data || null }));
}

export function maintenanceLogoutDestination(result) {
  if (result && result.clearSession === true) {
    return { path: MAINTENANCE_LOGIN_PATH, error: '' };
  }
  const message = result && result.message ? String(result.message) : LOGOUT_NOT_REVOKED_MESSAGE;
  return { path: null, error: message };
}

export async function completeMaintenanceLogout(logout) {
  const result = await logout();
  return maintenanceLogoutDestination(result);
}

export async function signOutFromMaintenanceScreen({
  logout,
  navigate,
  isPending,
  setPending,
  setError,
}) {
  if (isPending()) return;
  setPending(true);
  setError('');
  let next;
  try {
    next = await completeMaintenanceLogout(logout);
  } catch {
    setPending(false);
    setError(LOGOUT_NOT_REVOKED_MESSAGE);
    return;
  }
  if (!next.path) {
    setPending(false);
    setError(next.error);
    return;
  }
  navigate(next.path, { replace: true });
}

export function performMaintenanceCheckAgain(reload) {
  if (typeof reload === 'function') {
    reload();
    return;
  }
  if (typeof window !== 'undefined') window.location.reload();
}
