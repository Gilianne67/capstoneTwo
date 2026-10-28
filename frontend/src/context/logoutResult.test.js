import assert from 'node:assert/strict';
import {
  interpretLogoutResult,
  LOGOUT_NOT_REVOKED_MESSAGE,
  LOGOUT_UNCONFIRMED_MESSAGE,
} from './logoutResult.js';

const check = (name, fn) => {
  fn();
  console.log(`ok - ${name}`);
};

check('logout 200 clears the session', () => {
  const result = interpretLogoutResult({
    ok: true,
    data: { success: true, message: 'User logged out successfully and token revoked' },
  });
  assert.equal(result.ok, true);
  assert.equal(result.clearSession, true);
});

check('logout 503 keeps the session and shows the server message', () => {
  const result = interpretLogoutResult({
    ok: false,
    data: { success: false, message: 'Logout could not revoke this session. Please try again.' },
  });
  assert.equal(result.ok, false);
  assert.equal(result.clearSession, false);
  assert.equal(result.message, 'Logout could not revoke this session. Please try again.');
  assert.equal(result.message.includes('successfully'), false);
});

check('logout 503 without a message uses the revocation fallback', () => {
  const result = interpretLogoutResult({ ok: false, data: {} });
  assert.equal(result.clearSession, false);
  assert.equal(result.message, LOGOUT_NOT_REVOKED_MESSAGE);
});

check('logout network failure keeps the session', () => {
  const result = interpretLogoutResult({ networkError: true });
  assert.equal(result.ok, false);
  assert.equal(result.clearSession, false);
  assert.equal(result.message, LOGOUT_UNCONFIRMED_MESSAGE);
});

check('logout 401 from another auth failure does not clear the session', () => {
  const result = interpretLogoutResult({
    ok: false,
    data: { success: false, message: 'Please log in to continue.' },
  });
  assert.equal(result.ok, false);
  assert.equal(result.clearSession, false);
  assert.equal(result.message, 'Please log in to continue.');
});

console.log('logout result unit tests passed');
