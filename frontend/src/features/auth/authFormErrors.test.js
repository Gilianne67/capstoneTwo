import assert from 'node:assert/strict';
import {
  INVALID_CREDENTIALS_MESSAGE,
  getApiErrorMessage,
  DUPLICATE_EMAIL_MESSAGE,
  isDuplicateEmailError,
  isUnderageStudentError,
  isDobAccessError,
  isRateLimitError,
  isVerificationDeclinedError,
  resolveLoginFormMessage,
  resolveRegistrationFormOutcome,
} from './authFormErrors.js';

const check = (name, fn) => {
  fn();
  console.log(`ok - ${name}`);
};

check('reads message or error from API payloads', () => {
  assert.equal(getApiErrorMessage({ message: 'Declined' }), 'Declined');
  assert.equal(getApiErrorMessage({ error: 'Declined' }), 'Declined');
  assert.equal(getApiErrorMessage({}, 'fallback'), 'fallback');
});

check('login shows the declined verification message instead of Invalid email', () => {
  const declined = resolveLoginFormMessage({
    verificationDeclined: true,
    message: 'Your organization verification was declined. Reason: Missing permit.',
  });

  assert.equal(declined.kind, 'declined');
  assert.match(declined.message, /organization verification was declined/i);
  assert.doesNotMatch(declined.message, /invalid email/i);
  assert.ok(isVerificationDeclinedError(declined));
});

check('login shows a rate-limit response instead of an invalid-password error', () => {
  const limited = resolveLoginFormMessage(new Error('Too many attempts from this IP, please try again later.'));
  assert.equal(limited.kind, 'rate-limit');
  assert.match(limited.message, /too many attempts/i);
  assert.equal(isRateLimitError(limited), true);
  assert.doesNotMatch(limited.message, /invalid email/i);
});

check('login still uses a generic credential message for ordinary failures', () => {
  const invalid = resolveLoginFormMessage(new Error('Invalid credentials or account temporarily locked. Please try again later.'));
  assert.equal(invalid.kind, 'credentials');
  assert.equal(invalid.message, INVALID_CREDENTIALS_MESSAGE);
  assert.equal(isVerificationDeclinedError(invalid), false);
});

check('underage login shows the 18+ message', () => {
  const underage = resolveLoginFormMessage({
    underage: true,
    message: 'ISKOLARMATCH is currently available only to students aged 18 and above.',
  });
  assert.equal(underage.kind, 'underage');
  assert.equal(isUnderageStudentError(underage), true);
  assert.equal(underage.message, 'ISKOLARMATCH is currently available only to students aged 18 and above.');
});

check('missing or conflicting date of birth stays on the login form', () => {
  const missing = resolveLoginFormMessage({
    code: 'DOB_UNVERIFIED',
    message: 'This account cannot access the platform until a valid date of birth is provided and verified.',
  });
  const conflict = resolveLoginFormMessage({
    code: 'DOB_CONFLICT',
    message: 'This account has conflicting dates of birth and cannot access the platform until a valid date of birth is verified.',
  });
  assert.equal(missing.kind, 'dob-access');
  assert.match(missing.message, /provided and verified/);
  assert.equal(isDobAccessError({ code: 'DOB_UNVERIFIED' }), true);
  assert.equal(conflict.kind, 'dob-access');
  assert.match(conflict.message, /conflicting dates of birth/);
  assert.doesNotMatch(missing.message, /invalid email/i);
});

check('underage registration keeps the server message', () => {
  const outcome = resolveRegistrationFormOutcome({
    underage: true,
    message: 'ISKOLARMATCH is currently available only to students aged 18 and above.',
  });
  assert.equal(outcome.kind, 'underage');
  assert.equal(outcome.message, 'ISKOLARMATCH is currently available only to students aged 18 and above.');
});

check('duplicate registration for a declined provider stays on the form', () => {
  const outcome = resolveRegistrationFormOutcome({
    verificationDeclined: true,
    message: 'Your organization verification was declined and this decision is final. You cannot register again with this email.',
  });
  assert.equal(outcome.kind, 'declined');
  assert.match(outcome.message, /cannot register again/i);
});

check('duplicate registration for a resubmittable provider asks them to sign in', () => {
  const outcome = resolveRegistrationFormOutcome({
    canResubmit: true,
    message: 'An account with this email already exists. Sign in to update your documents and resubmit for review.',
  });
  assert.equal(outcome.kind, 'resubmit');
  assert.match(outcome.message, /sign in to update your documents/i);
});

check('duplicate registration stays on the form with a clear message', () => {
  const outcome = resolveRegistrationFormOutcome({
    emailTaken: true,
    message: DUPLICATE_EMAIL_MESSAGE,
  });
  assert.equal(outcome.kind, 'duplicate');
  assert.equal(outcome.message, DUPLICATE_EMAIL_MESSAGE);
  assert.equal(isDuplicateEmailError(outcome), true);
  assert.match(outcome.message, /already registered/i);
  assert.doesNotMatch(outcome.message, /invalid email/i);
});

check('other registration failures still use the privacy-safe inbox confirmation', () => {
  const outcome = resolveRegistrationFormOutcome(new Error('Registration failed.'));
  assert.equal(outcome.kind, 'inbox');
  assert.equal(isDuplicateEmailError(outcome), false);
});

console.log('\n9 auth form error checks passed');
