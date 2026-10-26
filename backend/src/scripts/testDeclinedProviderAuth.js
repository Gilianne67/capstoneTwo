process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
const User = require('../models/User');
const Provider = require('../models/Provider');
const AuditLog = require('../models/AuditLog');
const { register, login, getMe } = require('../controllers/authController');
const {
  FINAL_REJECTION_REGISTRATION_MESSAGE,
  RESUBMIT_REGISTRATION_MESSAGE,
  declinedProviderLoginMessage,
} = require('../utils/providerVerification');

const users = new Map();
const providers = new Map();
let sequence = 0;
const createdEmails = [];

const matchesUser = (user, query = {}) => {
  if (query._id != null && String(user._id) !== String(query._id)) return false;
  if (query.email != null && user.email !== query.email) return false;
  if (query.userId != null && String(user._id) !== String(query.userId)) return false;
  return true;
};

const findUser = (query) => [...users.values()].find((user) => matchesUser(user, query)) || null;

User.findOne = (query) => {
  const user = findUser(query);
  return {
    select() {
      return Promise.resolve(user);
    },
    then(resolve, reject) {
      return Promise.resolve(user).then(resolve, reject);
    },
  };
};

User.create = async (data) => {
  sequence += 1;
  const user = {
    ...data,
    _id: `user-${sequence}`,
    isVerified: data.isVerified ?? false,
    isOnboarded: data.isOnboarded ?? false,
    status: data.status || 'active',
    _plainPassword: data.password,
    async matchPassword(entered) {
      return entered === this._plainPassword;
    },
    getSignedJwtToken() {
      return `jwt-${this._id}`;
    },
    async save() {
      users.set(String(this._id), this);
      return this;
    },
  };
  users.set(String(user._id), user);
  createdEmails.push(user.email);
  return user;
};

Provider.findOne = async (query = {}) => {
  if (query.userId == null) return null;
  return (
    [...providers.values()].find((provider) => String(provider.userId) === String(query.userId)) ||
    null
  );
};

AuditLog.create = async () => ({});

const invoke = async (handler, req) => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    cookie() {
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let error = null;
  await handler(req, res, (err) => {
    error = err;
  });
  return {
    statusCode: error?.statusCode || res.statusCode,
    body: error ? { success: false, message: error.message } : res.body,
  };
};

const addUser = async (data) => User.create(data);

const addProvider = (user, overrides = {}) => {
  const provider = {
    _id: `provider-${user._id}`,
    userId: user._id,
    institutionName: user.organization || 'Test Org',
    verificationStatus: 'Pending Review',
    rejectionReason: null,
    ...overrides,
  };
  providers.set(String(provider._id), provider);
  return provider;
};

const snapshotProvider = (provider) => ({
  _id: provider._id,
  userId: provider.userId,
  institutionName: provider.institutionName,
  verificationStatus: provider.verificationStatus,
  rejectionReason: provider.rejectionReason,
  isFinalRejection: Boolean(provider.isFinalRejection),
});

const main = async () => {
  const student = await addUser({
    name: 'Ava Santos',
    email: 'ava@example.com',
    password: 'correct-password-15',
    role: 'student',
    isVerified: true,
    isOnboarded: true,
    status: 'active',
  });

  const pendingConsent = await addUser({
    name: 'Diego Ramos',
    email: 'diego@example.com',
    password: 'correct-password-15',
    role: 'student',
    isVerified: true,
    isOnboarded: true,
    status: 'pending_consent',
  });

  const verifiedProviderUser = await addUser({
    name: 'Verified Org',
    email: 'verified.provider@example.com',
    password: 'correct-password-15',
    role: 'provider',
    organization: 'Verified Org',
    isVerified: true,
    isOnboarded: true,
    status: 'active',
  });
  addProvider(verifiedProviderUser, {
    verificationStatus: 'Verified',
    representative: { name: 'Gilianne Rose' },
  });

  const rejectedProviderUser = await addUser({
    name: 'Rejected Org',
    email: 'rejected.provider@example.com',
    password: 'correct-password-15',
    role: 'provider',
    organization: 'Rejected Org',
    isVerified: false,
    isOnboarded: true,
    status: 'active',
  });
  const rejectedProvider = addProvider(rejectedProviderUser, {
    verificationStatus: 'Rejected',
    rejectionReason: 'SEC registration is incomplete.',
    isFinalRejection: false,
  });
  const rejectedBeforeAttempt = snapshotProvider(rejectedProvider);
  const rejectedUserBeforeAttempt = {
    email: rejectedProviderUser.email,
    role: rejectedProviderUser.role,
    status: rejectedProviderUser.status,
    verificationStatus: rejectedProvider.verificationStatus,
    isOnboarded: rejectedProviderUser.isOnboarded,
  };

  const finalProviderUser = await addUser({
    name: 'Final Org',
    email: 'final.provider@example.com',
    password: 'correct-password-15',
    role: 'provider',
    organization: 'Final Org',
    isVerified: false,
    isOnboarded: true,
    status: 'active',
  });
  const finalProvider = addProvider(finalProviderUser, {
    verificationStatus: 'Rejected',
    rejectionReason: 'Fraudulent documents.',
    isFinalRejection: true,
  });
  const finalBeforeAttempt = snapshotProvider(finalProvider);

  const resubmittableLogin = await invoke(login, {
    body: { email: 'rejected.provider@example.com', password: 'correct-password-15' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(resubmittableLogin.statusCode, 200);
  assert.ok(resubmittableLogin.body.token);
  assert.strictEqual(resubmittableLogin.body.user.verificationStatus, 'Rejected');
  assert.strictEqual(resubmittableLogin.body.user.isFinalRejection, false);

  const declinedLogin = await invoke(login, {
    body: { email: 'final.provider@example.com', password: 'correct-password-15' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(declinedLogin.statusCode, 403);
  assert.strictEqual(declinedLogin.body.success, false);
  assert.strictEqual(declinedLogin.body.verificationDeclined, true);
  assert.strictEqual(
    declinedLogin.body.message,
    declinedProviderLoginMessage(finalProvider)
  );
  assert.match(declinedLogin.body.message, /decision is final/i);
  assert.match(declinedLogin.body.message, /Fraudulent documents/);
  assert.ok(!declinedLogin.body.token);

  const wrongPassword = await invoke(login, {
    body: { email: 'final.provider@example.com', password: 'wrong-password' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(wrongPassword.statusCode, 401);
  assert.match(wrongPassword.body.message, /invalid credentials/i);
  assert.ok(!wrongPassword.body.verificationDeclined);

  const unknownEmail = await invoke(login, {
    body: { email: 'missing@example.com', password: 'correct-password-15' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(unknownEmail.statusCode, 401);
  assert.match(unknownEmail.body.message, /invalid credentials/i);

  const studentLogin = await invoke(login, {
    body: { email: 'ava@example.com', password: 'correct-password-15' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(studentLogin.statusCode, 200);
  assert.ok(studentLogin.body.token);
  assert.strictEqual(studentLogin.body.user.email, student.email);
  assert.strictEqual(studentLogin.body.user.role, 'student');
  assert.strictEqual(studentLogin.body.user.name, 'Ava Santos');
  assert.strictEqual(studentLogin.body.user.representativeName, undefined);
  assert.strictEqual(studentLogin.body.user.isFinalRejection, undefined);

  const verifiedLogin = await invoke(login, {
    body: { email: 'verified.provider@example.com', password: 'correct-password-15' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(verifiedLogin.statusCode, 200);
  assert.ok(verifiedLogin.body.token);
  assert.strictEqual(verifiedLogin.body.user.role, 'provider');
  assert.strictEqual(verifiedLogin.body.user.verificationStatus, 'Verified');
  assert.strictEqual(verifiedLogin.body.user.name, 'Verified Org');
  assert.strictEqual(verifiedLogin.body.user.representativeName, 'Gilianne Rose');
  assert.strictEqual(verifiedLogin.body.user.isFinalRejection, false);

  const verifiedSession = await invoke(getMe, {
    user: { id: verifiedProviderUser._id },
  });
  assert.strictEqual(verifiedSession.statusCode, 200);
  assert.strictEqual(verifiedSession.body.user.representativeName, 'Gilianne Rose');
  assert.strictEqual(verifiedSession.body.data.representativeName, 'Gilianne Rose');
  assert.strictEqual(verifiedSession.body.user.isFinalRejection, false);

  const consentLogin = await invoke(login, {
    body: { email: 'diego@example.com', password: 'correct-password-15' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(consentLogin.statusCode, 403);
  assert.strictEqual(consentLogin.body.requiresConsent, true);
  assert.match(consentLogin.body.message, /parental consent/i);
  assert.strictEqual(pendingConsent.status, 'pending_consent');

  const usersBeforeDuplicate = users.size;
  const createdBeforeDuplicate = createdEmails.length;
  const duplicateResubmittable = await invoke(register, {
    body: {
      name: 'Rejected Org Again',
      email: 'rejected.provider@example.com',
      password: 'another-password-15',
      role: 'provider',
      organization: 'Rejected Org Again',
    },
    ip: '127.0.0.1',
  });
  assert.strictEqual(duplicateResubmittable.statusCode, 409);
  assert.strictEqual(duplicateResubmittable.body.success, false);
  assert.strictEqual(duplicateResubmittable.body.canResubmit, true);
  assert.strictEqual(duplicateResubmittable.body.message, RESUBMIT_REGISTRATION_MESSAGE);
  assert.ok(!duplicateResubmittable.body.token);
  assert.ok(!duplicateResubmittable.body.user);
  assert.strictEqual(users.size, usersBeforeDuplicate);
  assert.strictEqual(createdEmails.length, createdBeforeDuplicate);
  assert.deepStrictEqual(snapshotProvider(rejectedProvider), rejectedBeforeAttempt);
  assert.strictEqual(rejectedProviderUser.email, rejectedUserBeforeAttempt.email);
  assert.strictEqual(rejectedProvider.verificationStatus, 'Rejected');
  assert.strictEqual(rejectedProvider.isFinalRejection, false);

  const duplicateDeclined = await invoke(register, {
    body: {
      name: 'Final Org Again',
      email: 'final.provider@example.com',
      password: 'another-password-15',
      role: 'provider',
      organization: 'Final Org Again',
    },
    ip: '127.0.0.1',
  });
  assert.strictEqual(duplicateDeclined.statusCode, 409);
  assert.strictEqual(duplicateDeclined.body.verificationDeclined, true);
  assert.strictEqual(duplicateDeclined.body.message, FINAL_REJECTION_REGISTRATION_MESSAGE);
  assert.ok(!duplicateDeclined.body.token);
  assert.deepStrictEqual(snapshotProvider(finalProvider), finalBeforeAttempt);
  assert.strictEqual(finalProvider.verificationStatus, 'Rejected');
  assert.strictEqual(finalProvider.isFinalRejection, true);
  assert.strictEqual(findUser({ email: 'rejected.provider@example.com' })._id, rejectedProviderUser._id);

  const studentDuplicate = await invoke(register, {
    body: {
      name: 'Ava Santos',
      email: 'ava@example.com',
      password: 'correct-password-15',
      role: 'student',
    },
    ip: '127.0.0.1',
  });
  assert.strictEqual(studentDuplicate.statusCode, 200);
  assert.strictEqual(studentDuplicate.body.success, true);
  assert.strictEqual(users.size, usersBeforeDuplicate);

  const freshStudent = await invoke(register, {
    body: {
      name: 'Ben Cruz',
      email: 'ben@example.com',
      password: 'correct-password-15',
      role: 'student',
    },
    ip: '127.0.0.1',
  });
  assert.strictEqual(freshStudent.statusCode, 201);
  assert.ok(freshStudent.body.token);
  assert.strictEqual(freshStudent.body.user.role, 'student');
  assert.strictEqual(freshStudent.body.user.isOnboarded, false);
  assert.strictEqual(freshStudent.body.user.isFinalRejection, undefined);
  assert.strictEqual(freshStudent.body.user.representativeName, undefined);

  const freshProvider = await invoke(register, {
    body: {
      name: 'New Foundation',
      email: 'new.provider@example.com',
      password: 'correct-password-15',
      role: 'provider',
      organization: 'New Foundation',
    },
    ip: '127.0.0.1',
  });
  assert.strictEqual(freshProvider.statusCode, 201);
  assert.ok(freshProvider.body.token);
  assert.strictEqual(freshProvider.body.user.role, 'provider');
  assert.strictEqual(freshProvider.body.user.isOnboarded, false);
  assert.strictEqual(freshProvider.body.user.representativeName, '');
  assert.strictEqual(freshProvider.body.user.isFinalRejection, false);
  assert.strictEqual(
    [...providers.values()].filter((provider) => String(provider.userId) === String(freshProvider.body.user.id)).length,
    0
  );

  const frontendPath = path.resolve(
    __dirname,
    '../../../frontend/src/features/auth/authFormErrors.js'
  );
  const {
    resolveLoginFormMessage,
    resolveRegistrationFormOutcome,
    INVALID_CREDENTIALS_MESSAGE,
  } = await import(pathToFileURL(frontendPath).href);

  const loginMessage = resolveLoginFormMessage({
    verificationDeclined: declinedLogin.body.verificationDeclined,
    message: declinedLogin.body.message,
  });
  assert.equal(loginMessage.kind, 'declined');
  assert.equal(loginMessage.message, declinedLogin.body.message);
  assert.doesNotMatch(loginMessage.message, /invalid email/i);

  const credentialMessage = resolveLoginFormMessage({ message: wrongPassword.body.message });
  assert.equal(credentialMessage.kind, 'credentials');
  assert.equal(credentialMessage.message, INVALID_CREDENTIALS_MESSAGE);

  const resubmitOutcome = resolveRegistrationFormOutcome({
    canResubmit: duplicateResubmittable.body.canResubmit,
    message: duplicateResubmittable.body.message,
  });
  assert.equal(resubmitOutcome.kind, 'resubmit');

  const registrationOutcome = resolveRegistrationFormOutcome({
    verificationDeclined: duplicateDeclined.body.verificationDeclined,
    message: duplicateDeclined.body.message,
  });
  assert.equal(registrationOutcome.kind, 'declined');
  assert.doesNotMatch(registrationOutcome.message, /invalid email/i);

  console.log('declined provider auth tests passed');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
