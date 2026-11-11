/**
 * Students must be 18 or older. Guardian consent is not part of registration,
 * onboarding, or access. Existing underage records are kept and blocked.
 */
process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.CLIENT_URL = 'http://students.example';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { installMemoryRevocationStore } = require('./revocationStoreStub');

installMemoryRevocationStore();

const User = require('../models/User');
const Provider = require('../models/Provider');
const StudentProfile = require('../models/StudentProfile');
const AuditLog = require('../models/AuditLog');
const emailService = require('../utils/emailService');
const { register, login } = require('../controllers/authController');
const { handleOnboarding } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const userRoutes = require('../routes/userRoutes');
const {
  UNDERAGE_STUDENT_MESSAGE,
  MISSING_DOB_ACCESS_MESSAGE,
  DOB_CONFLICT_MESSAGE,
} = require('../utils/studentAge');

const users = new Map();
const profiles = [];
const profilesByUser = new Map();
const verificationEmails = [];
let sequence = 0;

const isoDate = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const now = new Date();
const exactly18 = isoDate(new Date(now.getFullYear() - 18, now.getMonth(), now.getDate()));
const age17 = isoDate(new Date(now.getFullYear() - 18, now.getMonth(), now.getDate() + 1));
const age19 = isoDate(new Date(now.getFullYear() - 19, now.getMonth(), now.getDate()));
const tomorrow = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

const findUser = (query = {}) => [...users.values()].find((user) => {
  if (query._id != null && String(user._id) !== String(query._id)) return false;
  if (query.email != null && user.email !== query.email) return false;
  return true;
}) || null;

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

User.findById = (id) => {
  const user = users.get(String(id)) || null;
  return {
    select() {
      return Promise.resolve(user);
    },
    then(resolve, reject) {
      return Promise.resolve(user).then(resolve, reject);
    },
  };
};

User.findOneAndUpdate = async (filter, update) => {
  const user = users.get(String(filter._id));
  if (!user) return null;
  if (update && update.$set) Object.assign(user, update.$set);
  return user;
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
      return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    },
    async save() {
      users.set(String(this._id), this);
      return this;
    },
  };
  users.set(String(user._id), user);
  return user;
};

Provider.findOne = () => ({
  select: async () => null,
});
AuditLog.create = async () => ({});
StudentProfile.findOneAndUpdate = async (_filter, update) => {
  profiles.push(update);
  return update;
};
StudentProfile.findOne = (query) => {
  const profile = profilesByUser.get(String(query.userId)) || null;
  return {
    select: async () => profile,
    then(resolve, reject) {
      return Promise.resolve(profile).then(resolve, reject);
    },
  };
};
emailService.sendVerificationEmail = async (...args) => {
  verificationEmails.push(args);
  return { id: 'verify-1' };
};

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

const run = async (handler, req) => {
  const res = {
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
  };
  let nextCalled = false;
  await handler(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
};

const registerStudent = (email, dateOfBirth, extra = {}) => invoke(register, {
  body: {
    name: 'Test Student',
    email,
    password: 'password-12345678',
    role: 'student',
    dateOfBirth,
    ...extra,
  },
  ip: '127.0.0.1',
});

const main = async () => {
  const age17Result = await registerStudent('age17@example.com', age17);
  assert.strictEqual(age17Result.statusCode, 400);
  assert.strictEqual(age17Result.body.message, UNDERAGE_STUDENT_MESSAGE);
  assert.strictEqual([...users.values()].some((user) => user.email === 'age17@example.com'), false);

  const directApi = await registerStudent('direct17@example.com', '2012-04-02');
  assert.strictEqual(directApi.statusCode, 400);
  assert.strictEqual(directApi.body.message, UNDERAGE_STUDENT_MESSAGE);
  assert.strictEqual(users.size, 0);

  const exactly = await registerStudent('age18@example.com', exactly18);
  assert.strictEqual(exactly.statusCode, 201);
  assert.strictEqual(exactly.body.user.role, 'student');
  assert.ok(users.get(String(exactly.body.user.id || exactly.body.user._id)).dob);

  const older = await registerStudent('age19@example.com', age19);
  assert.strictEqual(older.statusCode, 201);

  const invalid = await registerStudent('invalid@example.com', '2024-02-31');
  assert.strictEqual(invalid.statusCode, 400);
  assert.strictEqual(invalid.body.message, 'Date of birth is invalid.');

  const future = await registerStudent('future@example.com', tomorrow);
  assert.strictEqual(future.statusCode, 400);
  assert.strictEqual(future.body.message, 'Date of birth cannot be in the future.');

  const missing = await registerStudent('missing@example.com', undefined);
  assert.strictEqual(missing.statusCode, 400);
  assert.strictEqual(missing.body.message, 'Date of birth is required.');

  const provider = await invoke(register, {
    body: {
      name: 'North Foundation',
      email: 'provider@example.com',
      password: 'password-12345678',
      role: 'provider',
      organization: 'North Foundation',
    },
    ip: '127.0.0.1',
  });
  assert.strictEqual(provider.statusCode, 201);
  assert.strictEqual(provider.body.user.role, 'provider');

  const adult = await User.create({
    name: 'Adult Student',
    email: 'adult@example.com',
    password: 'password-12345678',
    role: 'student',
    dob: new Date('2000-01-15T00:00:00.000Z'),
    isVerified: true,
    isOnboarded: true,
    status: 'active',
  });
  const underageExisting = await User.create({
    name: 'Underage Student',
    email: 'underage@example.com',
    password: 'password-12345678',
    role: 'student',
    dob: new Date('2010-06-01T00:00:00.000Z'),
    isVerified: true,
    isOnboarded: true,
    status: 'active',
  });
  const providerUser = await User.create({
    name: 'Provider Login',
    email: 'provider.login@example.com',
    password: 'password-12345678',
    role: 'provider',
    isVerified: true,
    isOnboarded: true,
    status: 'active',
  });
  const admin = await User.create({
    name: 'Admin Login',
    email: 'admin@example.com',
    password: 'password-12345678',
    role: 'admin',
    isVerified: true,
    isOnboarded: true,
    status: 'active',
  });

  const adultLogin = await invoke(login, {
    body: { email: 'adult@example.com', password: 'password-12345678' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(adultLogin.statusCode, 200);
  assert.strictEqual(adultLogin.body.user.role, 'student');
  assert.ok(adultLogin.body.token);

  const underageLogin = await invoke(login, {
    body: { email: 'underage@example.com', password: 'password-12345678' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(underageLogin.statusCode, 403);
  assert.strictEqual(underageLogin.body.message, UNDERAGE_STUDENT_MESSAGE);
  assert.ok(!underageLogin.body.token);
  assert.strictEqual(users.has(String(underageExisting._id)), true);
  assert.strictEqual(underageExisting.email, 'underage@example.com');

  const providerLogin = await invoke(login, {
    body: { email: 'provider.login@example.com', password: 'password-12345678' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(providerLogin.statusCode, 200);
  assert.strictEqual(providerLogin.body.user.role, 'provider');

  const adminLogin = await invoke(login, {
    body: { email: 'admin@example.com', password: 'password-12345678' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(adminLogin.statusCode, 200);
  assert.strictEqual(adminLogin.body.user.role, 'admin');

  const newAdult = users.get(String(exactly.body.user.id || exactly.body.user._id));
  const profilesBefore = profiles.length;
  const onboarded = await invoke(handleOnboarding, {
    user: { id: newAdult._id },
    body: {
      dob: exactly18,
      course: 'BS Information Technology',
      academicLevel: 'College',
      yearLevel: '1st Year',
      gpa: 1.75,
      gwaScale: '1.00-5.00',
      region: 'NCR',
      province: 'Metro Manila',
      municipality: 'Manila',
      householdIncome: 'Below ₱10,000 / month',
      guardianName: 'Should Not Be Stored',
      guardianEmail: 'guardian@example.com',
    },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(onboarded.statusCode, 200);
  assert.strictEqual(onboarded.body.user.status, 'active');
  assert.strictEqual(onboarded.body.user.isOnboarded, true);
  assert.strictEqual(newAdult.isOnboarded, true);
  assert.strictEqual(profiles.length, profilesBefore + 1);
  assert.strictEqual(profiles.at(-1).course, 'BS Information Technology');
  assert.strictEqual(profiles.at(-1).region, 'NCR');
  assert.strictEqual(profiles.at(-1).isMinor, false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(profiles.at(-1), 'guardianEmail'), false);
  assert.strictEqual(verificationEmails.length, 1);
  assert.strictEqual(typeof emailService.sendParentConsentEmail, 'undefined');

  const minorOnboardingUser = await User.create({
    name: 'Still Onboarding',
    email: 'onboarding17@example.com',
    password: 'password-12345678',
    role: 'student',
    dob: new Date('2004-01-15T00:00:00.000Z'),
    isVerified: false,
    isOnboarded: false,
    status: 'active',
  });
  const rejectedOnboarding = await invoke(handleOnboarding, {
    user: { id: minorOnboardingUser._id },
    body: {
      dob: '2012-04-02',
      course: 'BSIT',
      academicLevel: 'College',
      yearLevel: '1st Year',
      gpa: 1.5,
      region: 'NCR',
      householdIncome: 'Below ₱10,000 / month',
    },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(rejectedOnboarding.statusCode, 400);
  assert.strictEqual(rejectedOnboarding.body.message, UNDERAGE_STUDENT_MESSAGE);
  assert.strictEqual(minorOnboardingUser.isOnboarded, false);
  assert.strictEqual(profiles.length, profilesBefore + 1);

  const underageToken = jwt.sign(
    { id: underageExisting._id, role: 'student' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  const blocked = await run(protect, {
    headers: { authorization: `Bearer ${underageToken}` },
    method: 'GET',
    originalUrl: '/api/v1/students/profile',
  });
  assert.strictEqual(blocked.nextCalled, false);
  assert.strictEqual(blocked.res.statusCode, 403);
  assert.strictEqual(blocked.res.body.message, UNDERAGE_STUDENT_MESSAGE);

  const blockedRole = await run(authorize('student'), {
    user: underageExisting,
  });
  assert.strictEqual(blockedRole.nextCalled, false);
  assert.strictEqual(blockedRole.res.statusCode, 403);

  const adultToken = jwt.sign({ id: adult._id, role: 'student' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const adultAccess = await run(protect, {
    headers: { authorization: `Bearer ${adultToken}` },
    method: 'GET',
    originalUrl: '/api/v1/students/profile',
  });
  assert.strictEqual(adultAccess.nextCalled, true);

  const providerToken = jwt.sign(
    { id: providerUser._id, role: 'provider' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  const providerAccess = await run(protect, {
    headers: { authorization: `Bearer ${providerToken}` },
    method: 'GET',
    originalUrl: '/api/v1/provider/dashboard',
  });
  assert.strictEqual(providerAccess.nextCalled, true);

  const adminToken = jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const adminAccess = await run(protect, {
    headers: { authorization: `Bearer ${adminToken}` },
    method: 'GET',
    originalUrl: '/api/v1/admin/users',
  });
  assert.strictEqual(adminAccess.nextCalled, true);

  assert.equal(
    userRoutes.stack.some((entry) => entry.route && String(entry.route.path).includes('consent')),
    false
  );
  assert.equal(fs.existsSync(path.join(__dirname, '../routes/consentRoutes.js')), false);
  assert.equal(fs.existsSync(path.join(__dirname, '../models/ParentalConsent.js')), false);
  assert.equal(fs.existsSync(path.join(__dirname, '../models/GuardianConsent.js')), false);
  assert.equal(
    fs.existsSync(path.join(__dirname, '../../../frontend/src/features/public-landing/pages/ParentConsentPage.jsx')),
    false
  );

  const missingDob = await User.create({
    name: 'No Birth Date',
    email: 'missing-dob@example.com',
    password: 'password-12345678',
    role: 'student',
    isVerified: true,
    isOnboarded: false,
    status: 'active',
  });
  const missingBefore = {
    status: missingDob.status,
    dob: missingDob.dob,
    email: missingDob.email,
  };
  const missingLogin = await invoke(login, {
    body: { email: 'missing-dob@example.com', password: 'password-12345678' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(missingLogin.statusCode, 403);
  assert.strictEqual(missingLogin.body.code, 'DOB_UNVERIFIED');
  assert.strictEqual(missingLogin.body.underage, false);
  assert.strictEqual(missingLogin.body.message, MISSING_DOB_ACCESS_MESSAGE);
  assert.ok(!missingLogin.body.token);
  assert.strictEqual(missingDob.status, missingBefore.status);
  assert.strictEqual(missingDob.dob, missingBefore.dob);
  assert.strictEqual(users.has(String(missingDob._id)), true);

  const missingToken = missingDob.getSignedJwtToken();
  const missingAccess = await run(protect, {
    headers: { authorization: `Bearer ${missingToken}` },
    method: 'GET',
    originalUrl: '/api/v1/students/profile',
  });
  assert.strictEqual(missingAccess.nextCalled, false);
  assert.strictEqual(missingAccess.res.statusCode, 403);
  assert.strictEqual(missingAccess.res.body.code, 'DOB_UNVERIFIED');
  assert.strictEqual(missingAccess.res.body.message, MISSING_DOB_ACCESS_MESSAGE);

  const missingCookie = await run(protect, {
    headers: {},
    cookies: { token: missingToken },
    method: 'GET',
    originalUrl: '/api/v1/auth/me',
  });
  assert.strictEqual(missingCookie.nextCalled, false);
  assert.strictEqual(missingCookie.res.body.code, 'DOB_UNVERIFIED');

  const missingLogout = await run(protect, {
    headers: { authorization: `Bearer ${missingToken}` },
    method: 'GET',
    originalUrl: '/api/v1/auth/logout',
  });
  assert.strictEqual(missingLogout.nextCalled, true);
  assert.strictEqual(missingDob.status, 'active');

  const profileOnlyAdult = await User.create({
    name: 'Profile Adult',
    email: 'profile-adult@example.com',
    password: 'password-12345678',
    role: 'student',
    isVerified: true,
    isOnboarded: true,
    status: 'active',
  });
  profilesByUser.set(String(profileOnlyAdult._id), {
    userId: profileOnlyAdult._id,
    dateOfBirth: new Date('2004-05-15T00:00:00.000Z'),
  });
  const profileAdultLogin = await invoke(login, {
    body: { email: 'profile-adult@example.com', password: 'password-12345678' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(profileAdultLogin.statusCode, 200);
  assert.ok(profileAdultLogin.body.token);
  assert.strictEqual(profileOnlyAdult.dob, undefined);
  assert.strictEqual(profileOnlyAdult.status, 'active');
  const profileAdultToken = jwt.sign(
    { id: profileOnlyAdult._id, role: 'student' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  const profileAdultRequest = {
    headers: { authorization: `Bearer ${profileAdultToken}` },
    method: 'GET',
    originalUrl: '/api/v1/students/profile',
  };
  const profileAdultAccess = await run(protect, profileAdultRequest);
  assert.strictEqual(profileAdultAccess.nextCalled, true);
  const profileAdultRole = await run(authorize('student'), profileAdultRequest);
  assert.strictEqual(profileAdultRole.nextCalled, true);

  const profileOnlyMinor = await User.create({
    name: 'Profile Minor',
    email: 'profile-minor@example.com',
    password: 'password-12345678',
    role: 'student',
    isVerified: true,
    isOnboarded: true,
    status: 'pending_consent',
  });
  profilesByUser.set(String(profileOnlyMinor._id), {
    userId: profileOnlyMinor._id,
    dateOfBirth: new Date('2012-01-15T00:00:00.000Z'),
  });
  const profileMinorLogin = await invoke(login, {
    body: { email: 'profile-minor@example.com', password: 'password-12345678' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(profileMinorLogin.statusCode, 403);
  assert.strictEqual(profileMinorLogin.body.code, 'UNDERAGE_STUDENT');
  assert.strictEqual(profileMinorLogin.body.underage, true);
  assert.strictEqual(profileMinorLogin.body.message, UNDERAGE_STUDENT_MESSAGE);
  assert.ok(!profileMinorLogin.body.token);
  assert.strictEqual(profileOnlyMinor.status, 'pending_consent');
  assert.strictEqual(profileOnlyMinor.dob, undefined);
  assert.strictEqual(users.has(String(profileOnlyMinor._id)), true);

  const conflictUser = await User.create({
    name: 'Conflict Student',
    email: 'conflict@example.com',
    password: 'password-12345678',
    role: 'student',
    dob: new Date('2000-01-15T00:00:00.000Z'),
    isVerified: true,
    isOnboarded: true,
    status: 'active',
  });
  const conflictProfile = {
    userId: conflictUser._id,
    dateOfBirth: new Date('2001-06-01T00:00:00.000Z'),
  };
  profilesByUser.set(String(conflictUser._id), conflictProfile);
  const conflictLogin = await invoke(login, {
    body: { email: 'conflict@example.com', password: 'password-12345678' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(conflictLogin.statusCode, 403);
  assert.strictEqual(conflictLogin.body.code, 'DOB_CONFLICT');
  assert.strictEqual(conflictLogin.body.underage, false);
  assert.strictEqual(conflictLogin.body.message, DOB_CONFLICT_MESSAGE);
  assert.ok(!conflictLogin.body.token);
  assert.strictEqual(conflictUser.dob.toISOString(), '2000-01-15T00:00:00.000Z');
  assert.strictEqual(conflictProfile.dateOfBirth.toISOString(), '2001-06-01T00:00:00.000Z');
  assert.strictEqual(conflictUser.status, 'active');
  const conflictToken = jwt.sign(
    { id: conflictUser._id, role: 'student' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  const conflictAccess = await run(protect, {
    headers: { authorization: `Bearer ${conflictToken}` },
    method: 'GET',
    originalUrl: '/api/v1/students/profile',
  });
  assert.strictEqual(conflictAccess.nextCalled, false);
  assert.strictEqual(conflictAccess.res.body.code, 'DOB_CONFLICT');

  const sameDayUser = await User.create({
    name: 'Same Day',
    email: 'same-day@example.com',
    password: 'password-12345678',
    role: 'student',
    dob: new Date('2000-01-15T00:00:00.000Z'),
    isVerified: true,
    isOnboarded: true,
    status: 'active',
  });
  profilesByUser.set(String(sameDayUser._id), {
    userId: sameDayUser._id,
    dateOfBirth: '2000-01-15',
  });
  const sameDayLogin = await invoke(login, {
    body: { email: 'same-day@example.com', password: 'password-12345678' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(sameDayLogin.statusCode, 200);
  assert.ok(sameDayLogin.body.token);

  const invalidStored = await User.create({
    name: 'Invalid Stored',
    email: 'invalid-stored@example.com',
    password: 'password-12345678',
    role: 'student',
    dob: 'not-a-date',
    isVerified: true,
    isOnboarded: true,
    status: 'active',
  });
  const invalidStoredLogin = await invoke(login, {
    body: { email: 'invalid-stored@example.com', password: 'password-12345678' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(invalidStoredLogin.statusCode, 403);
  assert.strictEqual(invalidStoredLogin.body.code, 'DOB_INVALID');
  assert.strictEqual(invalidStoredLogin.body.message, 'Date of birth is invalid.');
  assert.strictEqual(invalidStored.status, 'active');

  const futureStored = await User.create({
    name: 'Future Stored',
    email: 'future-stored@example.com',
    password: 'password-12345678',
    role: 'student',
    dob: new Date(`${tomorrow}T00:00:00.000Z`),
    isVerified: true,
    isOnboarded: true,
    status: 'active',
  });
  const futureStoredLogin = await invoke(login, {
    body: { email: 'future-stored@example.com', password: 'password-12345678' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(futureStoredLogin.statusCode, 403);
  assert.strictEqual(futureStoredLogin.body.code, 'DOB_FUTURE');
  assert.strictEqual(futureStoredLogin.body.message, 'Date of birth cannot be in the future.');
  assert.strictEqual(futureStored.dob.toISOString(), `${tomorrow}T00:00:00.000Z`);

  console.log('student age restriction tests passed');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
