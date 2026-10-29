export const PASSWORD_UPDATED_MESSAGE = 'Your password has been updated successfully.';
export const PASSWORD_UPDATE_FAILED_MESSAGE = 'Your password could not be updated. Please try again.';

const INTERNAL_DETAIL = /redis|session index|blocklist|blocklisted|revocation_store|token hash/i;
const CLAIMS_PASSWORD_CHANGED = /password (was|has been) (updated|changed|reset)/i;

export function userFacingPasswordMessage(text, fallback) {
  const value = typeof text === 'string' ? text.trim() : '';
  if (!value || INTERNAL_DETAIL.test(value)) return fallback;
  return value;
}

const sessionsWereNotConfirmed = (httpStatus, data) => Boolean(
  data
  && data.revocation
  && data.revocation.success === false
  && (httpStatus === 503 || data.success === false)
);

const passwordUpdateSucceeded = (httpStatus, data) => (
  sessionsWereNotConfirmed(httpStatus, data)
  || (httpStatus >= 200 && httpStatus < 300 && (!data || data.success !== false))
);

export function presentPasswordUpdateResult({ httpStatus, data, thrownMessage } = {}) {
  if (passwordUpdateSucceeded(httpStatus, data)) {
    return { type: 'success', text: PASSWORD_UPDATED_MESSAGE };
  }

  return presentPasswordUpdateFailure((data && (data.message || data.error)) || thrownMessage);
}

export function presentPasswordUpdateFailure(message) {
  let text = userFacingPasswordMessage(message, PASSWORD_UPDATE_FAILED_MESSAGE);
  if (CLAIMS_PASSWORD_CHANGED.test(text)) text = PASSWORD_UPDATE_FAILED_MESSAGE;
  return { type: 'error', text };
}

export function presentSavedPasswordResult(result) {
  if (result && typeof result === 'object' && result.type === 'error') {
    return presentPasswordUpdateFailure(result.text);
  }

  return { type: 'success', text: PASSWORD_UPDATED_MESSAGE };
}
