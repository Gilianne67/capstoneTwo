export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password. Please try again.';

export function getApiErrorMessage(data, fallback = INVALID_CREDENTIALS_MESSAGE) {
  return data?.message || data?.error || fallback;
}

export function isRateLimitError(error) {
  return /too many (requests|attempts|email requests)/i.test(String(error?.message || ''));
}

export function isPendingConsentError(error) {
  const message = String(error?.message || '').toLowerCase();
  return Boolean(
    error?.requiresConsent ||
    message.includes('parental consent') ||
    message.includes('pending_consent')
  );
}

export function isVerificationDeclinedError(error) {
  const message = String(error?.message || '').toLowerCase();
  return Boolean(
    error?.verificationDeclined ||
    message.includes('organization verification was declined') ||
    message.includes('provider application was declined') ||
    message.includes('provider application was rejected')
  );
}

export function resolveLoginFormMessage(error) {
  if (isRateLimitError(error)) {
    return {
      kind: 'rate-limit',
      message: error.message,
    };
  }

  if (isPendingConsentError(error)) {
    return {
      kind: 'consent',
      message:
        error?.message ||
        'Your account is pending parental consent. Please ask your parent/guardian to approve the verification email.',
    };
  }

  if (isVerificationDeclinedError(error)) {
    return {
      kind: 'declined',
      message: error?.message || 'Your organization verification was declined.',
    };
  }

  return {
    kind: 'credentials',
    message: INVALID_CREDENTIALS_MESSAGE,
  };
}

export const DUPLICATE_EMAIL_MESSAGE =
  'An account with this email address is already registered. Please sign in or use a different email.';

export function isDuplicateEmailError(error) {
  const message = String(error?.message || '').toLowerCase();
  return Boolean(error?.emailTaken || message.includes('already registered'));
}

export function resolveRegistrationFormOutcome(error) {
  const message = String(error?.message || '').toLowerCase();
  if (error?.canResubmit || message.includes('sign in to update your documents')) {
    return {
      kind: 'resubmit',
      message: error?.message || 'An account with this email already exists. Sign in to update your documents and resubmit for review.',
    };
  }

  if (isVerificationDeclinedError(error)) {
    return {
      kind: 'declined',
      message: error?.message || 'Your organization verification was declined. You cannot register again with this email.',
    };
  }

  if (isDuplicateEmailError(error)) {
    return {
      kind: 'duplicate',
      message: error?.message || DUPLICATE_EMAIL_MESSAGE,
    };
  }

  return { kind: 'inbox' };
}
