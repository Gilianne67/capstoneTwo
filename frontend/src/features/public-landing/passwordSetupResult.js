export const PASSWORD_SETUP_SAVED_MESSAGE = 'Your password has been saved. You can sign in now.';
export const PASSWORD_SETUP_UNCONFIRMED_MESSAGE = "Your password has been saved. We couldn't verify that every older session was signed out. Sign in with your new password.";
export const PASSWORD_SETUP_FAILED_MESSAGE = 'The password could not be saved. Request a new invitation link if this one has expired.';

const INTERNAL_DETAIL = /redis|session index|blocklist|blocklisted|revocation_store/i;

const passwordWasSaved = (httpStatus, data) => Boolean(
  data
  && data.revocation
  && data.revocation.success === false
  && (httpStatus === 503 || data.success === false)
);

export function presentPasswordSetupResult({ httpStatus, data } = {}) {
  if (passwordWasSaved(httpStatus, data)) {
    return { outcome: 'saved', text: PASSWORD_SETUP_UNCONFIRMED_MESSAGE };
  }

  if (httpStatus >= 200 && httpStatus < 300 && (!data || data.success !== false)) {
    const message = data && typeof data.message === 'string' ? data.message.trim() : '';
    return {
      outcome: 'saved',
      text: message && !INTERNAL_DETAIL.test(message) ? message : PASSWORD_SETUP_SAVED_MESSAGE,
    };
  }

  const raw = data && (data.error || data.message);
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text || INTERNAL_DETAIL.test(text) || /password has been saved|password was reset/i.test(text)) {
    return { outcome: 'failed', text: PASSWORD_SETUP_FAILED_MESSAGE };
  }
  return { outcome: 'failed', text };
}
