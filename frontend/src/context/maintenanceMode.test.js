import assert from 'node:assert/strict';
import { interpretLogoutResult } from './logoutResult.js';
import {
  MAINTENANCE_CODE,
  MAINTENANCE_LOGIN_PATH,
  MAINTENANCE_MESSAGE,
  completeMaintenanceLogout,
  hidesAppDuringMaintenance,
  isMaintenanceEntryPath,
  isMaintenanceResponse,
  maintenanceMessage,
  performMaintenanceCheckAgain,
  signOutFromMaintenanceScreen,
} from './maintenanceMode.js';

assert.equal(isMaintenanceResponse(503, { code: MAINTENANCE_CODE, message: MAINTENANCE_MESSAGE }), true);
assert.equal(isMaintenanceResponse(503, { message: 'Session revocation could not be verified.' }), false);
assert.equal(isMaintenanceResponse(401, { code: MAINTENANCE_CODE }), false);
assert.equal(isMaintenanceResponse(503, null), false);

assert.equal(maintenanceMessage({ message: 'Custom maintenance notice.' }), 'Custom maintenance notice.');
assert.equal(maintenanceMessage({}), MAINTENANCE_MESSAGE);

assert.equal(isMaintenanceEntryPath('/auth'), true);
assert.equal(isMaintenanceEntryPath('/login'), true);
assert.equal(isMaintenanceEntryPath('/reset-password/abc'), true);
assert.equal(isMaintenanceEntryPath('/dashboard/student'), false);
assert.equal(isMaintenanceEntryPath('/'), false);

assert.equal(hidesAppDuringMaintenance('/dashboard/student', 'student'), true);
assert.equal(hidesAppDuringMaintenance('/dashboard/provider', 'provider'), true);
assert.equal(hidesAppDuringMaintenance('/dashboard/admin/settings', null), true);
assert.equal(hidesAppDuringMaintenance('/dashboard/admin', 'admin'), false);
assert.equal(hidesAppDuringMaintenance('/dashboard/admin/settings', 'superadmin'), false);
assert.equal(hidesAppDuringMaintenance('/dashboard/admin/settings', 'super_admin'), false);
assert.equal(hidesAppDuringMaintenance('/dashboard/admin/settings', 'super-admin'), false);
assert.equal(hidesAppDuringMaintenance('/auth', 'student'), false);
assert.equal(hidesAppDuringMaintenance('/reset-password/token', 'provider'), false);
assert.equal(hidesAppDuringMaintenance('/dashboard/student', 'student'), true);

const success = await completeMaintenanceLogout(async () => {
  return interpretLogoutResult({
    ok: true,
    data: { message: 'User logged out successfully and token revoked' },
  });
});
assert.equal(success.path, MAINTENANCE_LOGIN_PATH);
assert.equal(success.path, '/auth?mode=signin');
assert.equal(success.error, '');

const apiFailure = await completeMaintenanceLogout(async () => {
  return interpretLogoutResult({
    ok: false,
    data: { message: 'Logout could not revoke this session. Please try again.' },
  });
});
assert.equal(apiFailure.path, null);
assert.equal(apiFailure.error, 'Logout could not revoke this session. Please try again.');

const clearedDespiteFailure = await completeMaintenanceLogout(async () => ({
  ok: false,
  clearSession: true,
  message: 'Local session was cleared.',
}));
assert.equal(clearedDespiteFailure.path, MAINTENANCE_LOGIN_PATH);

const navigations = [];
let logoutCalls = 0;
let pending = false;
const errors = [];
const signOut = () => signOutFromMaintenanceScreen({
  logout: async () => {
    logoutCalls += 1;
    return interpretLogoutResult({
      ok: true,
      data: { message: 'User logged out successfully and token revoked' },
    });
  },
  navigate: (path, options) => navigations.push({ path, options }),
  isPending: () => pending,
  setPending: (value) => { pending = value; },
  setError: (message) => errors.push(message),
});

const first = signOut();
const duplicate = signOut();
await first;
await duplicate;
assert.equal(logoutCalls, 1);
assert.deepEqual(navigations, [{
  path: '/auth?mode=signin',
  options: { replace: true },
}]);
assert.deepEqual(errors, ['']);

const failedNavigations = [];
let failedPending = false;
const failedErrors = [];
await signOutFromMaintenanceScreen({
  logout: async () => interpretLogoutResult({ networkError: true }),
  navigate: (path, options) => failedNavigations.push({ path, options }),
  isPending: () => failedPending,
  setPending: (value) => { failedPending = value; },
  setError: (message) => failedErrors.push(message),
});
assert.deepEqual(failedNavigations, []);
assert.equal(failedPending, false);
assert.equal(failedErrors[0], '');
assert.equal(failedErrors.at(-1), 'Logout could not be confirmed. You are still signed in. Please try again.');

const clearedFailureNavigations = [];
await signOutFromMaintenanceScreen({
  logout: async () => ({ ok: false, clearSession: true, message: 'Cleared locally.' }),
  navigate: (path, options) => clearedFailureNavigations.push({ path, options }),
  isPending: () => false,
  setPending: () => {},
  setError: () => {},
});
assert.deepEqual(clearedFailureNavigations, [{
  path: '/auth?mode=signin',
  options: { replace: true },
}]);

const refreshCalls = [];
const checkNavigations = [];
performMaintenanceCheckAgain(() => refreshCalls.push('reload'));
assert.deepEqual(refreshCalls, ['reload']);
assert.deepEqual(checkNavigations, []);

console.log('maintenance mode UI rules passed');
