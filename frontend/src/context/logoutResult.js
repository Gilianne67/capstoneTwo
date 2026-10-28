export const LOGOUT_UNCONFIRMED_MESSAGE = 'Logout could not be confirmed. You are still signed in. Please try again.';
export const LOGOUT_NOT_REVOKED_MESSAGE = 'Logout could not revoke this session. Please try again.';

export function interpretLogoutResult({ networkError = false, ok = false, data = null } = {}) {
  if (networkError) {
    return {
      ok: false,
      clearSession: false,
      message: LOGOUT_UNCONFIRMED_MESSAGE,
    };
  }

  if (!ok) {
    return {
      ok: false,
      clearSession: false,
      message: data?.message || data?.error || LOGOUT_NOT_REVOKED_MESSAGE,
    };
  }

  return {
    ok: true,
    clearSession: true,
    message: data?.message || '',
  };
}
