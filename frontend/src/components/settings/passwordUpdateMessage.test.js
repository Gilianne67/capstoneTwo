import assert from 'node:assert/strict';
import {
  PASSWORD_UPDATED_MESSAGE,
  PASSWORD_UPDATE_FAILED_MESSAGE,
  presentPasswordUpdateFailure,
  presentPasswordUpdateResult,
  presentSavedPasswordResult,
} from './passwordUpdateMessage.js';

const leaksInternals = (text) => /redis|session index|blocklist|blocklisted|revocation_store/i.test(String(text || ''));
const mentionsOtherSessions = (text) => /other sessions|other devices|sign out/i.test(String(text || ''));
const technicalWarning = 'Password was updated. Older sessions are rejected from the account record. The Redis session index could not be read, so sessions stored only in Redis were not confirmed blocklisted.';

assert.equal(PASSWORD_UPDATED_MESSAGE, 'Your password has been updated successfully.');

const saved = presentPasswordUpdateResult({
  httpStatus: 200,
  data: {
    success: true,
    message: 'Your password has been updated successfully. Please sign in again on your other devices.',
    token: 'replacement',
  },
});
assert.equal(saved.type, 'success');
assert.equal(saved.text, PASSWORD_UPDATED_MESSAGE);
assert.equal(mentionsOtherSessions(saved.text), false);
assert.equal(leaksInternals(saved.text), false);

const savedWithInternalCopy = presentPasswordUpdateResult({
  httpStatus: 200,
  data: { success: true, message: 'Password updated. Redis blocklist confirmed.' },
});
assert.equal(savedWithInternalCopy.type, 'success');
assert.equal(savedWithInternalCopy.text, PASSWORD_UPDATED_MESSAGE);
assert.equal(leaksInternals(savedWithInternalCopy.text), false);

const unconfirmed = presentPasswordUpdateResult({
  httpStatus: 503,
  data: {
    success: false,
    message: technicalWarning,
    revocation: { success: false, reason: 'redis_unavailable' },
  },
});
assert.equal(unconfirmed.type, 'success');
assert.equal(unconfirmed.text, PASSWORD_UPDATED_MESSAGE);
assert.equal(mentionsOtherSessions(unconfirmed.text), false);
assert.equal(leaksInternals(unconfirmed.text), false);

const partial = presentPasswordUpdateResult({
  httpStatus: 503,
  data: {
    success: false,
    message: 'Password was updated. Only some sessions were revoked.',
    revocation: { success: false, reason: 'partial_failure' },
  },
});
assert.equal(partial.type, 'success');
assert.equal(partial.text, PASSWORD_UPDATED_MESSAGE);
assert.equal(mentionsOtherSessions(partial.text), false);

const wrongPassword = presentPasswordUpdateResult({
  httpStatus: 401,
  data: { success: false, error: 'Current password is incorrect.' },
});
assert.equal(wrongPassword.type, 'error');
assert.equal(wrongPassword.text, 'Current password is incorrect.');
assert.notEqual(wrongPassword.text, PASSWORD_UPDATED_MESSAGE);
assert.equal(/updated/i.test(wrongPassword.text), false);
assert.equal(leaksInternals(wrongPassword.text), false);

const shortPassword = presentPasswordUpdateFailure('Password must be at least 15 characters long.');
assert.equal(shortPassword.type, 'error');
assert.equal(shortPassword.text, 'Password must be at least 15 characters long.');

const reusedPassword = presentPasswordUpdateResult({
  httpStatus: 400,
  data: { success: false, error: 'Your new password must be different from your current password.' },
});
assert.equal(reusedPassword.type, 'error');
assert.equal(reusedPassword.text, 'Your new password must be different from your current password.');
assert.notEqual(reusedPassword.text, PASSWORD_UPDATED_MESSAGE);

const failedWithInternals = presentPasswordUpdateResult({
  httpStatus: 500,
  data: { success: false, message: 'Password update failed because the Redis session index could not be read.' },
});
assert.equal(failedWithInternals.type, 'error');
assert.equal(failedWithInternals.text, PASSWORD_UPDATE_FAILED_MESSAGE);
assert.equal(failedWithInternals.text === PASSWORD_UPDATED_MESSAGE, false);
assert.equal(/updated successfully|password was updated/i.test(failedWithInternals.text), false);
assert.equal(leaksInternals(failedWithInternals.text), false);

const displayed = presentSavedPasswordResult(unconfirmed);
assert.equal(displayed.type, 'success');
assert.equal(displayed.text, PASSWORD_UPDATED_MESSAGE);
assert.equal(mentionsOtherSessions(displayed.text), false);
assert.equal(leaksInternals(displayed.text), false);

const displayedFailure = presentSavedPasswordResult(wrongPassword);
assert.equal(displayedFailure.type, 'error');
assert.equal(displayedFailure.text, 'Current password is incorrect.');

console.log('password update message tests passed');
