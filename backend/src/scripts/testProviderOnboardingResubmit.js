const assert = require('assert');

const Provider = require('../models/Provider');
const User = require('../models/User');
const emailService = require('../utils/emailService');
const { handleOnboarding, getProfile } = require('../controllers/providerController');
const AuditLog = require('../models/AuditLog');

const originals = {
  providerFindOne: Provider.findOne,
  userFindById: User.findById,
  userFindByIdAndUpdate: User.findByIdAndUpdate,
  confirmation: emailService.sendProviderConfirmation,
  adminNotification: emailService.sendProviderAdminNotification,
  auditCreate: AuditLog.create,
};

const restore = () => {
  Provider.findOne = originals.providerFindOne;
  User.findById = originals.userFindById;
  User.findByIdAndUpdate = originals.userFindByIdAndUpdate;
  emailService.sendProviderConfirmation = originals.confirmation;
  emailService.sendProviderAdminNotification = originals.adminNotification;
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
  },
});

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
  repEmail: 'maria.santos@example.org',
  documentType: 'SEC_DTI',
};

const makeExistingProvider = (overrides = {}) => ({
  _id: 'provider-1',
  userId: 'user-a',
  institutionName: 'Old Org Foundation',
  institutionType: 'Non-Profit',
  website: 'https://old.example.org',
  contactNumber: '09170000000',
  address: {
    street: '1 Test Street',
    city: 'Legazpi',
    province: 'Albay',
    region: 'Bicol Region',
  },
  representative: {
    name: 'Maria Santos',
    title: 'Director',
    workEmail: 'maria.santos@example.org',
  },
  verificationStatus: 'Rejected',
  rejectionReason: 'SEC registration is incomplete.',
  isFinalRejection: false,
  verificationDocuments: [
    {
      documentType: 'SEC_DTI',
      fileUrl: '/api/v1/documents/old-sec.pdf',
      originalName: 'old-sec.pdf',
    },
  ],
  saveCount: 0,
  async save() {
    this.saveCount += 1;
    return this;
  },
  ...overrides,
});

const main = async () => {
  AuditLog.create = async () => ({});
  User.findByIdAndUpdate = async (id, update) => ({ _id: id, ...update });
  User.findById = async (id) => ({
    _id: id,
    email: 'provider.registered@example.com',
    name: 'QA Provider',
  });
  emailService.sendProviderConfirmation = async () => ({ id: 'confirmation-1' });
  emailService.sendProviderAdminNotification = async () => ({ id: 'admin-1' });

  let queriedUserId = null;
  const existing = makeExistingProvider();
  const otherProvider = makeExistingProvider({
    _id: 'provider-b',
    userId: 'user-b',
    institutionName: 'Other Org',
    verificationStatus: 'Pending Review',
    verificationDocuments: [],
  });
  Provider.findOne = async (query) => {
    queriedUserId = query?.userId;
    if (String(query.userId) === 'user-a') return existing;
    if (String(query.userId) === 'user-b') return otherProvider;
    return null;
  };

  const resubmitNoFile = mockRes();
  await handleOnboarding(
    {
      user: { id: 'user-a', email: 'provider.registered@example.com', role: 'provider' },
      body: {
        ...onboardingBody,
        institutionName: 'Updated Org Foundation',
        userId: 'user-b',
        providerId: 'provider-other',
      },
      ip: '127.0.0.1',
    },
    resubmitNoFile
  );

  assert.equal(resubmitNoFile.statusCode, 200);
  assert.equal(queriedUserId, 'user-a');
  assert.equal(existing._id, 'provider-1');
  assert.equal(existing.userId, 'user-a');
  assert.equal(existing.institutionName, 'Updated Org Foundation');
  assert.equal(existing.website, 'https://example.org');
  assert.equal(existing.verificationStatus, 'Pending Review');
  assert.equal(existing.isFinalRejection, false);
  assert.equal(existing.verificationDocuments.length, 1);
  assert.equal(existing.verificationDocuments[0].fileUrl, '/api/v1/documents/old-sec.pdf');
  assert.equal(existing.saveCount, 1);

  const resubmitWithFile = mockRes();
  await handleOnboarding(
    {
      user: { id: 'user-a', email: 'provider.registered@example.com', role: 'provider' },
      body: onboardingBody,
      file: { filename: 'new-sec.pdf', originalname: 'new-sec.pdf' },
      ip: '127.0.0.1',
    },
    resubmitWithFile
  );
  assert.equal(resubmitWithFile.statusCode, 200);
  assert.equal(existing._id, 'provider-1');
  assert.equal(existing.verificationDocuments.length, 2);
  assert.equal(existing.verificationDocuments[0].fileUrl, '/api/v1/documents/old-sec.pdf');
  assert.equal(existing.verificationDocuments[1].originalName, 'new-sec.pdf');
  assert.equal(existing.verificationStatus, 'Pending Review');

  const profileA = mockRes();
  await getProfile({ user: { id: 'user-a' } }, profileA);
  assert.equal(profileA.statusCode, 200);
  assert.equal(profileA.body.provider._id, 'provider-1');
  assert.equal(profileA.body.provider.institutionName, existing.institutionName);
  assert.equal(profileA.body.provider.verificationStatus, 'Pending Review');

  const profileB = mockRes();
  await getProfile({ user: { id: 'user-b' } }, profileB);
  assert.equal(profileB.statusCode, 200);
  assert.equal(profileB.body.provider._id, 'provider-b');
  assert.notEqual(profileB.body.provider.institutionName, existing.institutionName);

  const profileMissing = mockRes();
  await getProfile({ user: { id: 'user-c' } }, profileMissing);
  assert.equal(profileMissing.statusCode, 404);

  const foreignUpdate = mockRes();
  await handleOnboarding(
    {
      user: { id: 'user-b', email: 'other@example.com', role: 'provider' },
      body: {
        ...onboardingBody,
        institutionName: 'Hijacked Org',
        providerId: 'provider-1',
      },
      file: { filename: 'hack.pdf', originalname: 'hack.pdf' },
      ip: '127.0.0.1',
    },
    foreignUpdate
  );
  assert.notEqual(existing.institutionName, 'Hijacked Org');
  assert.equal(existing.userId, 'user-a');
  assert.equal(existing._id, 'provider-1');
  assert.equal(otherProvider.userId, 'user-b');
  assert.notEqual(otherProvider._id, existing._id);

  const finalProvider = makeExistingProvider({
    _id: 'provider-final',
    userId: 'user-final',
    isFinalRejection: true,
    rejectionReason: 'Fraudulent documents.',
  });
  Provider.findOne = async (query) => (
    String(query.userId) === 'user-final' ? finalProvider : null
  );
  const finalBlocked = mockRes();
  await handleOnboarding(
    {
      user: { id: 'user-final', role: 'provider' },
      body: onboardingBody,
      file: { filename: 'retry.pdf', originalname: 'retry.pdf' },
      ip: '127.0.0.1',
    },
    finalBlocked
  );
  assert.equal(finalBlocked.statusCode, 403);
  assert.equal(finalProvider.saveCount, 0);
  assert.equal(finalProvider.verificationStatus, 'Rejected');
  assert.equal(finalProvider.verificationDocuments.length, 1);

  const firstTime = {
    userId: 'user-new',
    representative: {},
    verificationDocuments: [],
    saveCount: 0,
    async save() {
      this.saveCount += 1;
      return this;
    },
  };
  Provider.findOne = async (query) => (
    String(query.userId) === 'user-new' ? firstTime : null
  );
  const firstMissingFile = mockRes();
  await handleOnboarding(
    {
      user: { id: 'user-new', email: 'new.provider@example.com', role: 'provider' },
      body: onboardingBody,
      ip: '127.0.0.1',
    },
    firstMissingFile
  );
  assert.equal(firstMissingFile.statusCode, 400);
  assert.equal(firstTime.saveCount, 0);

  const firstSuccess = mockRes();
  await handleOnboarding(
    {
      user: { id: 'user-new', email: 'new.provider@example.com', role: 'provider' },
      body: onboardingBody,
      file: { filename: 'first-sec.pdf', originalname: 'first-sec.pdf' },
      ip: '127.0.0.1',
    },
    firstSuccess
  );
  assert.equal(firstSuccess.statusCode, 200);
  assert.equal(firstTime.verificationStatus, 'Pending Review');
  assert.equal(firstTime.institutionName, 'QA Org Foundation');
  assert.equal(firstTime.verificationDocuments.length, 1);
  assert.equal(firstTime.verificationDocuments[0].originalName, 'first-sec.pdf');
  assert.equal(firstTime.saveCount, 1);

  console.log('provider onboarding resubmit tests passed');
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
