import assert from 'node:assert/strict';
import {
  interpretStatusResult,
  providerVerificationPath,
  reduceStatusDialog,
  roleLabel,
  statusActionFor,
} from './userManagement.js';

const admin = { id: 'admin-1', role: 'admin' };
const superadmin = { id: 'super-1', role: 'superadmin' };
const student = { id: 'student-1', role: 'student', status: 'active' };
const provider = { id: 'provider-1', role: 'provider', status: 'suspended', providerId: 'profile-1' };
const otherAdmin = { id: 'admin-2', role: 'admin', status: 'active' };
const consentStudent = { id: 'student-2', role: 'student', status: 'pending_consent' };

const suspendStudent = statusActionFor(admin, student);
assert.equal(suspendStudent.allowed, true);
assert.equal(suspendStudent.action, 'suspend');
assert.equal(suspendStudent.nextStatus, 'suspended');

const restoreProvider = statusActionFor(admin, provider);
assert.equal(restoreProvider.allowed, true);
assert.equal(restoreProvider.action, 'restore');
assert.equal(restoreProvider.nextStatus, 'active');

assert.equal(statusActionFor(admin, { ...admin, status: 'active' }).reason, 'self');
assert.equal(statusActionFor({ _id: 'admin-1', role: 'admin' }, { id: 'admin-1', role: 'student', status: 'active' }).reason, 'self');
assert.equal(statusActionFor(admin, otherAdmin).reason, 'admin-restricted');
assert.equal(statusActionFor(admin, { id: 'super-2', role: 'super_admin', status: 'suspended' }).reason, 'admin-restricted');
assert.equal(statusActionFor(superadmin, otherAdmin).action, 'suspend');
assert.equal(statusActionFor(admin, consentStudent).reason, 'unsupported-status');
assert.equal(statusActionFor(admin, consentStudent).nextStatus, undefined);

assert.equal(providerVerificationPath(provider.providerId), '/dashboard/admin/verification?providerId=profile-1');
assert.equal(providerVerificationPath('id/with space'), '/dashboard/admin/verification?providerId=id%2Fwith%20space');
assert.equal(providerVerificationPath(''), null);
assert.equal(providerVerificationPath(null), null);

assert.equal(roleLabel('student'), 'Student');
assert.equal(roleLabel('provider'), 'Scholarship Provider');
assert.equal(roleLabel('admin'), 'Administrator');
assert.equal(roleLabel('superadmin'), 'Super Admin');

const suspendAction = { user: student, action: 'suspend', nextStatus: 'suspended' };
const restoreAction = { user: provider, action: 'restore', nextStatus: 'active' };

const revocationFailure = {
  ok: false,
  body: {
    success: false,
    statusUpdated: true,
    message: 'Account status was updated to suspended. Active sessions are rejected while the account stays suspended. The Redis session index could not be read, so sessions stored only in Redis were not blocklisted.',
  },
};

const runConfirmedAction = (action, response) => {
  const opened = reduceStatusDialog(null, { type: 'open', action });
  assert.equal(opened.phase, 'open');
  assert.equal(reduceStatusDialog(opened, { type: 'open', action }).phase, 'open');
  const confirmed = reduceStatusDialog(opened, { type: 'confirm' });
  assert.equal(confirmed.requests, 1);
  assert.equal(confirmed.phase, 'submitting');
  assert.equal(reduceStatusDialog(confirmed, { type: 'confirm' }).requests, 1);
  const result = interpretStatusResult(response);
  const finished = result.outcome === 'completed'
    ? reduceStatusDialog(confirmed, { type: 'finish' })
    : reduceStatusDialog(confirmed, { type: 'fail' });
  return { opened, confirmed, result, finished };
};

const suspended = runConfirmedAction(suspendAction, {
  ok: true,
  body: { success: true, statusUpdated: true, message: 'Account status updated to suspended and tracked sessions were revoked.' },
});
assert.equal(suspended.result.outcome, 'completed');
assert.equal(suspended.finished.phase, 'closed');
assert.equal(suspended.finished.requests, 1);
assert.equal(reduceStatusDialog(suspended.finished, { type: 'refresh' }).phase, 'closed');

const partialSuspension = runConfirmedAction(suspendAction, revocationFailure);
assert.equal(partialSuspension.result.outcome, 'completed');
assert.equal(partialSuspension.finished.phase, 'closed');
assert.equal(partialSuspension.finished.action, null);
assert.equal(partialSuspension.finished.requests, 1);

const restored = runConfirmedAction(restoreAction, {
  ok: true,
  body: { success: true, statusUpdated: true, message: 'Account status updated to active.' },
});
assert.equal(restored.confirmed.requests, 1);
assert.equal(restored.finished.phase, 'closed');

const cancelledSuspend = reduceStatusDialog(
  reduceStatusDialog(null, { type: 'open', action: suspendAction }),
  { type: 'cancel' }
);
assert.equal(cancelledSuspend.phase, 'closed');
assert.equal(cancelledSuspend.requests, 0);

const cancelledRestore = reduceStatusDialog(
  reduceStatusDialog(null, { type: 'open', action: restoreAction }),
  { type: 'cancel' }
);
assert.equal(cancelledRestore.phase, 'closed');
assert.equal(cancelledRestore.requests, 0);

const denied = interpretStatusResult({
  ok: false,
  body: { success: false, error: 'You cannot change your own account status.' },
});
assert.equal(denied.outcome, 'failed');
const deniedDialog = reduceStatusDialog(
  reduceStatusDialog(reduceStatusDialog(null, { type: 'open', action: suspendAction }), { type: 'confirm' }),
  { type: 'fail' }
);
assert.equal(deniedDialog.phase, 'open');
assert.equal(deniedDialog.requests, 1);

console.log('admin user management UI rules passed');
