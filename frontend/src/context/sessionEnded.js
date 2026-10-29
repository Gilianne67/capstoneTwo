export const SESSION_ENDED_EVENT = 'iskolar-session-ended';

const ENDED_CODES = new Set(['ACCOUNT_SUSPENDED', 'SESSION_REVOKED']);

export function endedSessionReason(status, data) {
  const code = data && data.code;
  if (ENDED_CODES.has(code)) return code;

  const message = String((data && (data.message || data.error)) || '');
  if (status === 403 && /account has been suspended/i.test(message)) return 'ACCOUNT_SUSPENDED';
  if (
    status === 401
    && /session has been revoked|session has expired or is invalid|could not find your account/i.test(message)
  ) {
    return 'SESSION_REVOKED';
  }
  return null;
}

export function shouldIgnoreSessionEnd(url) {
  const path = String(url || '');
  return /\/auth\/(login|register|forgotpassword|resetpassword|logout|resend-verification)(?:\?|$|\/)/.test(path);
}

export function isPublicAuthPath(pathname) {
  const path = String(pathname || '');
  return path === '/'
    || path.startsWith('/auth')
    || path.startsWith('/login')
    || path.startsWith('/verify-email')
    || path.startsWith('/verify-holding')
    || path.startsWith('/reset-password')
    || path.startsWith('/consent/verify');
}

export function signInPathAfterSessionEnd(pathname) {
  if (isPublicAuthPath(pathname)) return null;
  return '/auth?mode=signin';
}

export function clearStoredSession(storage) {
  if (!storage) return;
  storage.removeItem('token');
  storage.removeItem('iskolar_session');
  storage.removeItem('accessToken');
  storage.removeItem('authToken');
}

export function storageEventEndsSession(event) {
  return Boolean(event) && event.key === 'token' && (event.newValue === null || event.newValue === '');
}
