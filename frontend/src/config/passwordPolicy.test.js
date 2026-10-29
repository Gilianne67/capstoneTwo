import assert from 'node:assert/strict';
import {
  MIN_PASSWORD_LENGTH,
  SAME_PASSWORD_MESSAGE,
  unchangedPasswordMessage,
} from './passwordPolicy.js';

assert.equal(MIN_PASSWORD_LENGTH, 15);
assert.equal(SAME_PASSWORD_MESSAGE, 'Your new password must be different from your current password.');
assert.equal(
  unchangedPasswordMessage('current-secret-value', 'current-secret-value'),
  SAME_PASSWORD_MESSAGE
);
assert.equal(unchangedPasswordMessage('current-secret-value', 'replacement-secret'), '');
assert.equal(unchangedPasswordMessage('current-secret-value', ''), '');
assert.equal(unchangedPasswordMessage('', 'current-secret-value'), '');

console.log('password policy tests passed');
