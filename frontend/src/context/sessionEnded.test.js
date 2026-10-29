import assert from 'node:assert/strict';
import {
  clearStoredSession,
  endedSessionReason,
  isPublicAuthPath,
  signInPathAfterSessionEnd,
  storageEventEndsSession,
  shouldIgnoreSessionEnd,
} from './sessionEnded.js';

assert.equal(endedSessionReason(403, {
  code: 'ACCOUNT_SUSPENDED',
  message: 'Your account has been suspended due to security concerns. Please contact support.',
}), 'ACCOUNT_SUSPENDED');

assert.equal(endedSessionReason(401, {
  code: 'SESSION_REVOKED',
  message: 'Your session has been revoked. Please log in again.',
}), 'SESSION_REVOKED');

assert.equal(endedSessionReason(403, {
  error: 'Your account has been suspended due to security concerns. Please contact support.',
}), 'ACCOUNT_SUSPENDED');

assert.equal(endedSessionReason(403, {
  success: false,
  error: 'Not authorized to access this route',
}), null);

assert.equal(endedSessionReason(403, {
  success: false,
  verificationDeclined: true,
  message: 'Your organization verification was declined. Reason: Missing permit.',
}), null);

assert.equal(endedSessionReason(403, {
  success: false,
  requiresConsent: true,
  message: 'Your account is waiting for parental consent.',
}), null);

assert.equal(endedSessionReason(401, {
  message: 'Please log in to continue.',
}), null);

assert.equal(endedSessionReason(400, {
  error: 'Unsupported account status.',
}), null);

assert.equal(endedSessionReason(503, {
  code: 'MAINTENANCE',
  message: 'IskolarMatch is under maintenance. Students and providers cannot use the app right now. Please try again later.',
}), null);

assert.equal(shouldIgnoreSessionEnd('http://localhost:5000/api/v1/auth/login'), true);
assert.equal(shouldIgnoreSessionEnd('/api/v1/auth/logout'), true);
assert.equal(shouldIgnoreSessionEnd('/api/v1/auth/me'), false);
assert.equal(shouldIgnoreSessionEnd('/api/v1/students/profile'), false);

assert.equal(isPublicAuthPath('/auth'), true);
assert.equal(isPublicAuthPath('/auth?mode=signin'), true);
assert.equal(isPublicAuthPath('/login'), true);
assert.equal(isPublicAuthPath('/reset-password/abc'), true);
assert.equal(isPublicAuthPath('/verify-email/abc'), true);
assert.equal(isPublicAuthPath('/verify-holding'), true);
assert.equal(isPublicAuthPath('/consent/verify'), true);
assert.equal(isPublicAuthPath('/'), true);
assert.equal(isPublicAuthPath('/dashboard/student'), false);

assert.equal(signInPathAfterSessionEnd('/dashboard/student'), '/auth?mode=signin');
assert.equal(signInPathAfterSessionEnd('/dashboard/provider'), '/auth?mode=signin');
assert.equal(signInPathAfterSessionEnd('/auth'), null);
assert.equal(signInPathAfterSessionEnd('/reset-password/token'), null);

const removed = [];
clearStoredSession({
  removeItem(key) { removed.push(key); },
});
assert.deepEqual(removed, ['token', 'iskolar_session', 'accessToken', 'authToken']);

assert.equal(storageEventEndsSession({ key: 'token', newValue: null }), true);
assert.equal(storageEventEndsSession({ key: 'token', newValue: '' }), true);
assert.equal(storageEventEndsSession({ key: 'token', newValue: 'still-signed-in' }), false);
assert.equal(storageEventEndsSession({ key: 'theme', newValue: null }), false);

console.log('session end detection tests passed');
