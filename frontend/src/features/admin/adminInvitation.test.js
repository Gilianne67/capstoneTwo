import assert from 'node:assert/strict';
import {
  authorizationHeaders,
  createInvitationSubmitGuard,
  invitationFormAfterResponse,
  readStoredAuthorizationHeaders,
} from './adminInvitation.js';

const headers = authorizationHeaders('"Bearer session-token"');
assert.deepEqual(headers, { Authorization: 'Bearer session-token' });
assert.equal(headers.Authorization.startsWith('Bearer '), true);

const stored = readStoredAuthorizationHeaders({
  getItem(key) {
    assert.equal(key, 'token');
    return 'stored-token';
  },
});
assert.deepEqual(stored, { Authorization: 'Bearer stored-token' });
assert.deepEqual(readStoredAuthorizationHeaders(null), {});

const guard = createInvitationSubmitGuard();
assert.equal(guard.begin(), true);
assert.equal(guard.isPending(), true);
assert.equal(guard.begin(), false);
guard.end();
assert.equal(guard.isPending(), false);
assert.equal(guard.begin(), true);

const filled = { fullName: 'Maria Santos', email: 'maria@example.test', adminRole: 'admin' };
assert.deepEqual(invitationFormAfterResponse(filled, false), filled);
assert.deepEqual(invitationFormAfterResponse(filled, true), {
  fullName: '',
  email: '',
  adminRole: 'admin',
});

console.log('admin invitation request tests passed');
