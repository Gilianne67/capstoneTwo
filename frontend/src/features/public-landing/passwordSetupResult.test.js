import assert from 'node:assert/strict';
import {
  PASSWORD_SETUP_FAILED_MESSAGE,
  PASSWORD_SETUP_SAVED_MESSAGE,
  PASSWORD_SETUP_UNCONFIRMED_MESSAGE,
  presentPasswordSetupResult,
} from './passwordSetupResult.js';

const leaksInternals = (text) => /redis|session index|blocklist|blocklisted/i.test(String(text || ''));
const claimsEverySessionEnded = (text) => /all (other |older )?sessions were (invalidated|signed out|revoked)/i.test(String(text || ''));

const saved = presentPasswordSetupResult({
  httpStatus: 200,
  data: { success: true, message: 'Password reset successful and account unlocked.', token: 'next' },
});
assert.equal(saved.outcome, 'saved');
assert.equal(saved.text, 'Password reset successful and account unlocked.');
assert.equal(leaksInternals(saved.text), false);

const redisUnavailable = presentPasswordSetupResult({
  httpStatus: 503,
  data: {
    success: false,
    message: 'Password was reset. The Redis session index could not be read.',
    revocation: { success: false, reason: 'redis_unavailable' },
    token: 'replacement',
  },
});
assert.equal(redisUnavailable.outcome, 'saved');
assert.equal(redisUnavailable.text, PASSWORD_SETUP_UNCONFIRMED_MESSAGE);
assert.equal(leaksInternals(redisUnavailable.text), false);
assert.equal(claimsEverySessionEnded(redisUnavailable.text), false);
assert.equal(/could not be saved|failed/i.test(redisUnavailable.text), false);

const expired = presentPasswordSetupResult({
  httpStatus: 400,
  data: { success: false, error: 'Invalid or expired password reset token.' },
});
assert.equal(expired.outcome, 'failed');
assert.equal(expired.text, 'Invalid or expired password reset token.');
assert.notEqual(expired.text, PASSWORD_SETUP_SAVED_MESSAGE);
assert.notEqual(expired.text, PASSWORD_SETUP_UNCONFIRMED_MESSAGE);

const shortPassword = presentPasswordSetupResult({
  httpStatus: 400,
  data: { success: false, error: 'Password must be at least 15 characters long.' },
});
assert.equal(shortPassword.outcome, 'failed');
assert.equal(shortPassword.text, 'Password must be at least 15 characters long.');

const internalFailure = presentPasswordSetupResult({
  httpStatus: 500,
  data: { success: false, error: 'Password save failed because the Redis session index could not be read.' },
});
assert.equal(internalFailure.outcome, 'failed');
assert.equal(internalFailure.text, PASSWORD_SETUP_FAILED_MESSAGE);
assert.equal(leaksInternals(internalFailure.text), false);

console.log('password setup result tests passed');
