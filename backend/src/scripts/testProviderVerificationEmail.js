const assert = require('assert');

const Provider = require('../models/Provider');
const User = require('../models/User');
const emailService = require('../utils/emailService');
const {
  updateProviderVerification
} = require('../controllers/adminController');
const { handleOnboarding } = require('../controllers/providerController');
const auditController = require('../controllers/auditController');
const AuditLog = require('../models/AuditLog');
const adminRoutes = require('../routes/adminRoutes');
const {
  buildProviderApprovalEmail,
  buildProviderRejectionEmail
} = require('../utils/emailService');

const originals = {
  providerFindById: Provider.findById,
  providerFindOne: Provider.findOne,
  userFindById: User.findById,
  userFindByIdAndUpdate: User.findByIdAndUpdate,
  approval: emailService.sendProviderApprovalEmail,
  rejection: emailService.sendProviderRejectionEmail,
  confirmation: emailService.sendProviderConfirmation,
  adminNotification: emailService.sendProviderAdminNotification,
  audit: auditController.recordAuditLog,
  auditCreate: AuditLog.create
};

const restore = () => {
  Provider.findById = originals.providerFindById;
  Provider.findOne = originals.providerFindOne;
  User.findById = originals.userFindById;
  User.findByIdAndUpdate = originals.userFindByIdAndUpdate;
  emailService.sendProviderApprovalEmail = originals.approval;
  emailService.sendProviderRejectionEmail = originals.rejection;
  emailService.sendProviderConfirmation = originals.confirmation;
  emailService.sendProviderAdminNotification = originals.adminNotification;
  if (originals.audit) auditController.recordAuditLog = originals.audit;
  if (originals.auditCreate) AuditLog.create = originals.auditCreate;
};

const mockRes = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

const invoke = (handler, req) =>
  new Promise((resolve, reject) => {
    const res = mockRes();
    handler(req, res, (error) => {
      if (error) {
        resolve({
          nextCalled: true,
          statusCode: error.statusCode || 500,
          message: error.message,
          body: res.body
        });
        return;
      }
      resolve({
        nextCalled: true,
        statusCode: res.statusCode,
        body: res.body
      });
    }).then(() => {
      resolve({
        nextCalled: false,
        statusCode: res.statusCode,
        body: res.body
      });
    }).catch(reject);
  });

const makeProvider = (overrides = {}) => {
  const provider = {
    _id: 'provider-1',
    institutionName: 'QA Org Foundation',
    verificationStatus: 'Pending Review',
    rejectionReason: null,
    isFinalRejection: false,
    verifiedAt: null,
    representative: {
      name: 'Maria Santos',
      workEmail: 'maria.santos@example.org'
    },
    userId: {
      _id: 'user-1',
      email: 'provider.registered@example.com',
      name: 'QA Provider'
    },
    saveCount: 0,
    saveShouldFail: false,
    async save() {
      this.saveCount += 1;
      if (this.saveShouldFail) {
        throw new Error('database write failed');
      }
      return this;
    },
    toObject() {
      return {
        _id: this._id,
        institutionName: this.institutionName,
        verificationStatus: this.verificationStatus,
        rejectionReason: this.rejectionReason,
        isFinalRejection: this.isFinalRejection,
        verifiedAt: this.verifiedAt
      };
    },
    ...overrides
  };

  return provider;
};

const stubProvider = (provider) => {
  Provider.findById = () => ({
    populate: async () => provider
  });
};

const runAdminGate = (user) =>
  new Promise((resolve) => {
    const gates = adminRoutes.stack.filter((layer) => !layer.route && layer.handle);
    const gate = gates[gates.length - 1];
    assert.ok(gate, 'Missing admin authorization middleware');

    const res = mockRes();
    gate.handle(
      { user },
      res,
      () => resolve({ nextCalled: true, statusCode: res.statusCode, body: res.body })
    );

    if (res.body) {
      resolve({ nextCalled: false, statusCode: res.statusCode, body: res.body });
    }
  });

const main = async () => {
  auditController.recordAuditLog = async () => ({});
  AuditLog.create = async () => ({});

  const sent = [];
  let userUpdates = [];
  User.findByIdAndUpdate = async (id, update) => {
    userUpdates.push({ id: String(id), update });
    return { _id: id, ...update };
  };
  User.findById = async (id) => {
    if (String(id) === 'user-unpopulated' || String(id) === 'user-onboard-1') {
      return { _id: id, email: 'provider.registered@example.com', name: 'QA Provider' };
    }
    if (String(id) === 'user-missing-email') {
      return { _id: id, name: 'QA Provider' };
    }
    return null;
  };

  emailService.sendProviderApprovalEmail = async (payload) => {
    sent.push({ type: 'approval', ...payload });
    return { id: `approval-${sent.length}` };
  };
  emailService.sendProviderRejectionEmail = async (payload) => {
    sent.push({ type: 'rejection', ...payload });
    return { id: `rejection-${sent.length}` };
  };

  const approvalEmail = buildProviderApprovalEmail({
    recipientName: 'QA Provider',
    organizationName: 'QA Org Foundation',
    signInUrl: 'http://localhost:5173/auth?mode=signin'
  });
  assert.equal(approvalEmail.subject, 'Your Organization Verification Has Been Approved');
  assert.match(approvalEmail.text, /QA Org Foundation/);
  assert.match(approvalEmail.text, /scholarship listings/i);

  const rejectionEmail = buildProviderRejectionEmail({
    recipientName: 'QA Provider',
    organizationName: 'QA Org Foundation',
    rejectionReason: 'Documents were expired.'
  });
  assert.equal(rejectionEmail.subject, 'Update on Your Organization Verification');
  assert.match(rejectionEmail.text, /Documents were expired/);
  assert.match(rejectionEmail.text, /sign in/i);
  assert.match(rejectionEmail.text, /updated documents/i);

  const finalRejectionEmail = buildProviderRejectionEmail({
    recipientName: 'QA Provider',
    organizationName: 'QA Org Foundation',
    rejectionReason: 'Fraudulent documents.',
    isFinalRejection: true
  });
  assert.match(finalRejectionEmail.text, /decision is final/i);
  assert.doesNotMatch(finalRejectionEmail.text, /updated documents/i);
  assert.doesNotMatch(finalRejectionEmail.html, /Sign In to IskolarMatch/);

  const adminReq = (body, params = { id: 'provider-1' }) => ({
    params,
    body,
    user: { role: 'admin', name: 'Review Admin', email: 'admin@example.com' },
    ip: '127.0.0.1',
    headers: {}
  });

  const pending = makeProvider();
  stubProvider(pending);
  const approved = await invoke(updateProviderVerification, adminReq({ status: 'APPROVED' }));
  assert.equal(approved.statusCode, 200);
  assert.equal(pending.verificationStatus, 'Verified');
  assert.equal(pending.saveCount, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, 'approval');
  assert.equal(sent[0].email, 'provider.registered@example.com');
  assert.notEqual(sent[0].email, 'injected@example.com');
  assert.equal(userUpdates[0].update.isVerified, true);
  assert.equal(approved.body.notification.sent, true);

  const alreadyVerified = await invoke(updateProviderVerification, adminReq({
    status: 'VERIFIED',
    email: 'injected@example.com'
  }));
  assert.equal(alreadyVerified.statusCode, 200);
  assert.equal(alreadyVerified.body.notification.sent, false);
  assert.equal(alreadyVerified.body.notification.reason, 'unchanged');
  assert.equal(sent.length, 1);
  assert.equal(pending.saveCount, 1);

  sent.length = 0;
  userUpdates = [];
  const pendingReject = makeProvider({ _id: 'provider-2' });
  stubProvider(pendingReject);
  const rejected = await invoke(
    updateProviderVerification,
    adminReq(
      { status: 'REJECTED', rejectionReason: 'SEC registration is incomplete.' },
      { id: 'provider-2' }
    )
  );
  assert.equal(rejected.statusCode, 200);
  assert.equal(pendingReject.verificationStatus, 'Rejected');
  assert.equal(pendingReject.rejectionReason, 'SEC registration is incomplete.');
  assert.equal(pendingReject.isFinalRejection, false);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, 'rejection');
  assert.equal(sent[0].email, 'provider.registered@example.com');
  assert.equal(sent[0].rejectionReason, 'SEC registration is incomplete.');
  assert.equal(sent[0].isFinalRejection, false);
  assert.equal(userUpdates[0].update.isVerified, false);
  assert.equal(rejected.body.notification.sent, true);

  const alreadyRejected = await invoke(
    updateProviderVerification,
    adminReq(
      { status: 'REJECTED', rejectionReason: 'SEC registration is incomplete.' },
      { id: 'provider-2' }
    )
  );
  assert.equal(alreadyRejected.body.notification.reason, 'unchanged');
  assert.equal(sent.length, 1);
  assert.equal(pendingReject.saveCount, 1);

  const finalReject = await invoke(
    updateProviderVerification,
    adminReq(
      {
        status: 'REJECTED',
        rejectionReason: 'SEC registration is incomplete.',
        isFinalRejection: true
      },
      { id: 'provider-2' }
    )
  );
  assert.equal(finalReject.statusCode, 200);
  assert.equal(pendingReject.isFinalRejection, true);
  assert.equal(pendingReject.verificationStatus, 'Rejected');
  assert.equal(sent.length, 2);
  assert.equal(sent[1].isFinalRejection, true);
  assert.equal(sent[1].email, 'provider.registered@example.com');
  assert.notEqual(sent[1].email, 'maria.santos@example.org');

  sent.length = 0;
  const unpopulated = makeProvider({
    _id: 'provider-unpopulated',
    userId: 'user-unpopulated'
  });
  stubProvider(unpopulated);
  const unpopulatedApproval = await invoke(
    updateProviderVerification,
    adminReq({ status: 'APPROVED' }, { id: 'provider-unpopulated' })
  );
  assert.equal(unpopulatedApproval.statusCode, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].email, 'provider.registered@example.com');
  assert.notEqual(sent[0].email, 'maria.santos@example.org');

  sent.length = 0;
  const missingEmail = makeProvider({
    _id: 'provider-missing-email',
    userId: { _id: 'user-missing-email', name: 'QA Provider' }
  });
  stubProvider(missingEmail);
  const skipped = await invoke(
    updateProviderVerification,
    adminReq({ status: 'APPROVED' }, { id: 'provider-missing-email' })
  );
  assert.equal(skipped.statusCode, 200);
  assert.equal(missingEmail.verificationStatus, 'Verified');
  assert.equal(sent.length, 0);
  assert.equal(skipped.body.notification.sent, false);
  assert.match(skipped.body.notification.warning, /no registered email/);

  sent.length = 0;
  const orphan = makeProvider({
    _id: 'provider-orphan',
    userId: 'user-does-not-exist'
  });
  stubProvider(orphan);
  const orphanResult = await invoke(
    updateProviderVerification,
    adminReq({ status: 'APPROVED' }, { id: 'provider-orphan' })
  );
  assert.equal(orphanResult.statusCode, 200);
  assert.equal(orphan.verificationStatus, 'Verified');
  assert.equal(sent.length, 0);
  assert.equal(orphanResult.body.notification.sent, false);

  sent.length = 0;
  const failing = makeProvider({ _id: 'provider-3', saveShouldFail: true });
  stubProvider(failing);
  const failedSave = await invoke(
    updateProviderVerification,
    adminReq({ status: 'APPROVED' }, { id: 'provider-3' })
  );
  assert.equal(failedSave.nextCalled, true);
  assert.match(failedSave.message, /database write failed/);
  assert.equal(sent.length, 0);

  sent.length = 0;
  const emailFailProvider = makeProvider({ _id: 'provider-4' });
  stubProvider(emailFailProvider);
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => {
    errors.push(args.map(String).join(' '));
  };
  emailService.sendProviderApprovalEmail = async () => {
    throw new Error('Resend unavailable');
  };
  const emailFailed = await invoke(
    updateProviderVerification,
    adminReq({ status: 'APPROVED' }, { id: 'provider-4' })
  );
  console.error = originalError;
  assert.equal(emailFailed.statusCode, 200);
  assert.equal(emailFailProvider.verificationStatus, 'Verified');
  assert.equal(emailFailed.body.success, true);
  assert.equal(emailFailed.body.notification.sent, false);
  assert.match(emailFailed.body.notification.warning, /could not be sent/);
  assert.ok(errors.some((line) => /Failed to dispatch provider verification email/.test(line)));
  assert.ok(!errors.some((line) => /RESEND_API_KEY|Secret1/.test(line)));

  emailService.sendProviderApprovalEmail = async (payload) => {
    sent.push({ type: 'approval', ...payload });
    return { id: `approval-${sent.length}` };
  };

  const confirmations = [];
  emailService.sendProviderConfirmation = async (email, name, organizationName) => {
    confirmations.push({ email, name, organizationName });
    return { id: `confirmation-${confirmations.length}` };
  };
  emailService.sendProviderAdminNotification = async () => ({ id: 'admin-1' });

  const onboardingBody = {
    institutionName: 'QA Org Foundation',
    institutionType: 'Non-Profit',
    website: 'https://example.org',
    contactNumber: '09171234567',
    street: '1 Test Street',
    city: 'Legazpi',
    province: 'Albay',
    region: 'Bicol Region',
    repName: 'Maria Santos',
    repTitle: 'Director',
    repEmail: 'maria.santos@example.org'
  };

  const firstProvider = {
    representative: {},
    verificationDocuments: [],
    async save() {
      return this;
    }
  };
  Provider.findOne = async () => firstProvider;
  const firstOnboarding = mockRes();
  await handleOnboarding(
    {
      user: {
        id: 'user-onboard-1',
        email: 'provider.registered@example.com',
        name: 'QA Provider',
        role: 'provider'
      },
      body: onboardingBody,
      file: { filename: 'sec.pdf', originalname: 'sec.pdf' },
      ip: '127.0.0.1'
    },
    firstOnboarding
  );
  assert.equal(firstOnboarding.statusCode, 200);
  assert.equal(firstProvider.verificationStatus, 'Pending Review');
  assert.equal(firstProvider.representative.workEmail, 'maria.santos@example.org');
  assert.equal(confirmations.length, 1);
  assert.equal(confirmations[0].email, 'provider.registered@example.com');
  assert.notEqual(confirmations[0].email, 'maria.santos@example.org');

  Provider.findOne = async () => ({
    userId: 'user-onboard-1',
    representative: { name: 'Maria Santos', workEmail: 'maria.santos@example.org' },
    verificationStatus: 'Rejected',
    isFinalRejection: false,
    verificationDocuments: [],
    async save() {
      return this;
    }
  });
  const resubmitOnboarding = mockRes();
  await handleOnboarding(
    {
      user: { id: 'user-onboard-1', role: 'provider' },
      body: onboardingBody,
      file: { filename: 'sec-2.pdf', originalname: 'sec-2.pdf' },
      ip: '127.0.0.1'
    },
    resubmitOnboarding
  );
  assert.equal(resubmitOnboarding.statusCode, 200);
  assert.equal(confirmations.length, 2);
  assert.equal(confirmations[1].email, 'provider.registered@example.com');
  assert.notEqual(confirmations[1].email, 'maria.santos@example.org');

  const unauthenticated = await runAdminGate(null);
  assert.equal(unauthenticated.nextCalled, false);
  assert.equal(unauthenticated.statusCode, 401);

  const providerBlocked = await runAdminGate({ role: 'provider' });
  assert.equal(providerBlocked.nextCalled, false);
  assert.equal(providerBlocked.statusCode, 403);

  const studentBlocked = await runAdminGate({ role: 'student' });
  assert.equal(studentBlocked.nextCalled, false);
  assert.equal(studentBlocked.statusCode, 403);

  const adminAllowed = await runAdminGate({ role: 'admin' });
  assert.equal(adminAllowed.nextCalled, true);

  const verificationLayer = adminRoutes.stack.find(
    (layer) =>
      layer.route &&
      layer.route.path === '/providers/:id/verification' &&
      layer.route.methods.patch
  );
  assert.ok(verificationLayer, 'Missing PATCH /providers/:id/verification');

  console.log('provider verification email tests passed');
};

main()
  .then(() => {
    restore();
    process.exit(0);
  })
  .catch((error) => {
    restore();
    console.error(error);
    process.exit(1);
  });
