process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.CLIENT_URL = 'http://students.example';
delete process.env.FRONTEND_URL;

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const ParentConsent = require('../models/ParentalConsent');
const AuditLog = require('../models/AuditLog');
const emailService = require('../utils/emailService');
const {
  VERIFICATION_TTL_MS,
  FRESH_WINDOW_MS,
  buildVerificationUrl,
  hashToken,
} = require('../utils/verificationToken');
const { buildVerificationEmail: buildMessage, resolveFromAddress: resolveSender } = require('../utils/emailService');
const { register, login, verifyEmail, resendVerification } = require('../controllers/authController');
const { handleOnboarding } = require('../controllers/userController');

const users = new Map();
const emails = [];
const consentRecords = [];
let failVerification = false;
let sequence = 0;

const clauseMatches = (user, clause) => {
  if (!Object.prototype.hasOwnProperty.call(clause, 'emailVerificationExpire')) return false;
  const condition = clause.emailVerificationExpire;
  if (condition == null) return user.emailVerificationExpire == null;
  if (condition.$exists === false) return user.emailVerificationExpire == null;
  if (condition.$lt != null) {
    if (user.emailVerificationExpire == null) return false;
    return new Date(user.emailVerificationExpire).getTime() < new Date(condition.$lt).getTime();
  }
  return false;
};

const matches = (user, query = {}) => {
  if (query._id != null && String(user._id) !== String(query._id)) return false;
  if (query.email != null && user.email !== query.email) return false;
  if (query.emailVerificationToken != null && user.emailVerificationToken !== query.emailVerificationToken) {
    return false;
  }
  if (query.isVerified && query.isVerified.$ne === true && user.isVerified === true) return false;
  if (query.emailVerificationExpire && query.emailVerificationExpire.$gt != null) {
    if (user.emailVerificationExpire == null) return false;
    const expires = new Date(user.emailVerificationExpire).getTime();
    if (!(expires > new Date(query.emailVerificationExpire.$gt).getTime())) return false;
  }
  if (Array.isArray(query.$or) && !query.$or.some((clause) => clauseMatches(user, clause))) return false;
  return true;
};

const findUser = (query) => [...users.values()].find((user) => matches(user, query)) || null;

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

User.findById = async (id) =>
  [...users.values()].find((user) => String(user._id) === String(id)) || null;

User.findOneAndUpdate = async (filter, update) => {
  const user = findUser(filter);
  if (!user) return null;
  if (update.$set) Object.assign(user, update.$set);
  if (update.$unset) {
    for (const key of Object.keys(update.$unset)) user[key] = undefined;
  }
  return user;
};

User.updateOne = async (filter, update) => {
  const user = findUser(filter);
  if (!user) return { modifiedCount: 0 };
  if (update.$set) Object.assign(user, update.$set);
  if (update.$unset) {
    for (const key of Object.keys(update.$unset)) user[key] = undefined;
  }
  return { modifiedCount: 1 };
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
  return user;
};

StudentProfile.findOneAndUpdate = async () => ({});
ParentConsent.findOneAndUpdate = async (_filter, data) => {
  consentRecords.push(data);
  return data;
};
AuditLog.create = async () => ({});

emailService.sendVerificationEmail = async (email, name, verifyUrl) => {
  if (failVerification) {
    throw new Error('provider unavailable');
  }
  emails.push({ type: 'verify', email, name, verifyUrl });
  return { id: `email-${emails.length}` };
};

emailService.sendParentConsentEmail = async (payload) => {
  emails.push({ type: 'consent', ...payload });
  return { id: `email-${emails.length}` };
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
    clearCookie() {
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

const adultProfile = {
  dob: '2000-01-15',
  course: 'BSCS',
  academicLevel: 'College',
  yearLevel: '2',
  gpa: 1.5,
  gwaScale: '1.00-5.00',
  region: 'NCR',
  province: 'Metro Manila',
  municipality: 'Manila',
  householdIncome: 'Below 10000',
  isMinor: false,
};

const tokenFrom = (verifyUrl) => {
  const marker = '/verify-email/';
  const value = verifyUrl.slice(verifyUrl.indexOf(marker) + marker.length);
  assert.ok(value && !value.includes('/'), 'verification link must be a single path token');
  return value;
};

const verificationEmails = () => emails.filter((email) => email.type === 'verify');

const storedUser = (email) => findUser({ email });

const main = async () => {
  const signup = await invoke(register, {
    body: {
      name: 'Ava Santos',
      email: 'Ava@Example.com',
      password: 'password123',
      role: 'student',
    },
    ip: '127.0.0.1',
  });
  assert.strictEqual(signup.statusCode, 201);
  assert.strictEqual(signup.body.user.email, 'ava@example.com');
  assert.strictEqual(verificationEmails().length, 0);

  const duplicateSignup = await invoke(register, {
    body: {
      name: 'Ava Santos',
      email: 'ava@example.com',
      password: 'password123',
      role: 'student',
    },
    ip: '127.0.0.1',
  });
  assert.strictEqual(duplicateSignup.statusCode, 200);
  assert.strictEqual(users.size, 1);
  assert.strictEqual(verificationEmails().length, 0);

  const loginBeforeVerification = await invoke(login, {
    body: { email: 'ava@example.com', password: 'password123' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(loginBeforeVerification.statusCode, 200);
  assert.ok(loginBeforeVerification.body.token);

  const student = storedUser('ava@example.com');
  const onboard = await invoke(handleOnboarding, {
    user: { id: student._id },
    body: adultProfile,
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(onboard.statusCode, 200);
  assert.strictEqual(onboard.body.emailSent, true);
  assert.strictEqual(onboard.body.user.emailVerificationToken, undefined);
  assert.strictEqual(verificationEmails().length, 1);
  assert.strictEqual(verificationEmails()[0].email, 'ava@example.com');

  const firstUrl = verificationEmails()[0].verifyUrl;
  const firstToken = tokenFrom(firstUrl);
  assert.strictEqual(firstUrl, `http://students.example/verify-email/${firstToken}`);
  assert.notStrictEqual(student.emailVerificationToken, firstToken);
  assert.strictEqual(student.emailVerificationToken, hashToken(firstToken));
  assert.ok(student.emailVerificationExpire > Date.now());

  const duplicateOnboarding = await invoke(handleOnboarding, {
    user: { id: student._id },
    body: adultProfile,
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(duplicateOnboarding.statusCode, 200);
  assert.strictEqual(duplicateOnboarding.body.emailSent, true);
  assert.strictEqual(verificationEmails().length, 1);
  assert.strictEqual(student.emailVerificationToken, hashToken(firstToken));

  const immediateResend = await invoke(resendVerification, {
    body: { email: 'ava@example.com' },
    ip: '127.0.0.1',
  });
  assert.strictEqual(immediateResend.statusCode, 200);
  assert.match(immediateResend.body.message, /just sent/i);
  assert.strictEqual(verificationEmails().length, 1);
  assert.strictEqual(student.emailVerificationToken, hashToken(firstToken));

  const verified = await invoke(verifyEmail, {
    params: { token: firstToken },
    ip: '127.0.0.1',
  });
  assert.strictEqual(verified.statusCode, 200);
  assert.strictEqual(verified.body.success, true);
  assert.strictEqual(student.isVerified, true);
  assert.strictEqual(student.emailVerificationToken, undefined);

  const reused = await invoke(verifyEmail, {
    params: { token: firstToken },
    ip: '127.0.0.1',
  });
  assert.strictEqual(reused.statusCode, 400);
  assert.match(reused.body.message, /invalid or has expired/i);
  assert.strictEqual(student.isVerified, true);

  const loginAfterVerification = await invoke(login, {
    body: { email: 'ava@example.com', password: 'password123' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(loginAfterVerification.statusCode, 200);
  assert.strictEqual(loginAfterVerification.body.user.isVerified, true);

  const secondSignup = await invoke(register, {
    body: {
      name: 'Ben Cruz',
      email: 'ben@example.com',
      password: 'password123',
      role: 'student',
    },
    ip: '127.0.0.1',
  });
  assert.strictEqual(secondSignup.statusCode, 201);
  const ben = storedUser('ben@example.com');
  const [firstRace, secondRace] = await Promise.all([
    invoke(handleOnboarding, {
      user: { id: ben._id },
      body: adultProfile,
      ip: '127.0.0.1',
      headers: {},
    }),
    invoke(handleOnboarding, {
      user: { id: ben._id },
      body: adultProfile,
      ip: '127.0.0.1',
      headers: {},
    }),
  ]);
  assert.strictEqual(firstRace.statusCode, 200);
  assert.strictEqual(secondRace.statusCode, 200);
  const benEmails = verificationEmails().filter((email) => email.email === 'ben@example.com');
  assert.strictEqual(benEmails.length, 1);
  const benToken = tokenFrom(benEmails[0].verifyUrl);
  assert.strictEqual(ben.emailVerificationToken, hashToken(benToken));

  ben.emailVerificationExpire = new Date(Date.now() - 1000);
  const expired = await invoke(verifyEmail, {
    params: { token: benToken },
    ip: '127.0.0.1',
  });
  assert.strictEqual(expired.statusCode, 400);
  assert.match(expired.body.message, /invalid or has expired/i);
  assert.strictEqual(ben.isVerified, false);
  assert.strictEqual(ben.emailVerificationToken, hashToken(benToken));

  ben.emailVerificationExpire = new Date(Date.now() + 60 * 60 * 1000);
  const tampered = await invoke(verifyEmail, {
    params: { token: `${benToken}ff` },
    ip: '127.0.0.1',
  });
  assert.strictEqual(tampered.statusCode, 400);
  assert.strictEqual(ben.isVerified, false);
  assert.strictEqual(ben.emailVerificationToken, hashToken(benToken));

  ben.emailVerificationExpire = new Date(Date.now() + VERIFICATION_TTL_MS - FRESH_WINDOW_MS - 5000);
  const rotated = await invoke(resendVerification, {
    body: { email: 'ben@example.com' },
    ip: '127.0.0.1',
  });
  assert.strictEqual(rotated.statusCode, 200);
  const latestBenEmails = verificationEmails().filter((email) => email.email === 'ben@example.com');
  assert.strictEqual(latestBenEmails.length, 2);
  const latestToken = tokenFrom(latestBenEmails[1].verifyUrl);
  assert.notStrictEqual(latestToken, benToken);
  assert.strictEqual(ben.emailVerificationToken, hashToken(latestToken));

  const oldLink = await invoke(verifyEmail, {
    params: { token: benToken },
    ip: '127.0.0.1',
  });
  assert.strictEqual(oldLink.statusCode, 400);
  const latestLink = await invoke(verifyEmail, {
    params: { token: latestToken },
    ip: '127.0.0.1',
  });
  assert.strictEqual(latestLink.statusCode, 200);
  assert.strictEqual(ben.isVerified, true);

  const caraSignup = await invoke(register, {
    body: {
      name: 'Cara Diaz',
      email: 'cara@example.com',
      password: 'password123',
      role: 'student',
    },
    ip: '127.0.0.1',
  });
  assert.strictEqual(caraSignup.statusCode, 201);
  const cara = storedUser('cara@example.com');
  cara.emailVerificationToken = 'previous-hash';
  cara.emailVerificationExpire = new Date(Date.now() + 30 * 60 * 1000);
  failVerification = true;
  const failedOnboarding = await invoke(handleOnboarding, {
    user: { id: cara._id },
    body: adultProfile,
    ip: '127.0.0.1',
    headers: {},
  });
  failVerification = false;
  assert.strictEqual(failedOnboarding.statusCode, 200);
  assert.strictEqual(failedOnboarding.body.success, true);
  assert.strictEqual(failedOnboarding.body.emailSent, false);
  assert.strictEqual(cara.isOnboarded, true);
  assert.strictEqual(cara.emailVerificationToken, 'previous-hash');
  assert.strictEqual(verificationEmails().filter((email) => email.email === 'cara@example.com').length, 0);

  const recovered = await invoke(resendVerification, {
    body: { email: 'cara@example.com' },
    ip: '127.0.0.1',
  });
  assert.strictEqual(recovered.statusCode, 200);
  const caraEmails = verificationEmails().filter((email) => email.email === 'cara@example.com');
  assert.strictEqual(caraEmails.length, 1);
  assert.strictEqual(cara.emailVerificationToken, hashToken(tokenFrom(caraEmails[0].verifyUrl)));

  cara.emailVerificationExpire = new Date(Date.now() + VERIFICATION_TTL_MS - FRESH_WINDOW_MS - 5000);
  const tokenBeforeFailedResend = cara.emailVerificationToken;
  failVerification = true;
  const failedResend = await invoke(resendVerification, {
    body: { email: 'cara@example.com' },
    ip: '127.0.0.1',
  });
  failVerification = false;
  assert.strictEqual(failedResend.statusCode, 500);
  assert.strictEqual(cara.emailVerificationToken, tokenBeforeFailedResend);
  assert.strictEqual(
    verificationEmails().filter((email) => email.email === 'cara@example.com').length,
    1
  );

  const minorSignup = await invoke(register, {
    body: {
      name: 'Diego Ramos',
      email: 'diego@example.com',
      password: 'password123',
      role: 'student',
    },
    ip: '127.0.0.1',
  });
  assert.strictEqual(minorSignup.statusCode, 201);
  const diego = storedUser('diego@example.com');
  const minorOnboarding = await invoke(handleOnboarding, {
    user: { id: diego._id },
    body: {
      ...adultProfile,
      dob: '2012-04-02',
      isMinor: true,
      guardianName: 'Elena Ramos',
      guardianEmail: 'guardian@example.com',
    },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.strictEqual(minorOnboarding.statusCode, 200);
  assert.strictEqual(minorOnboarding.body.user.status, 'pending_consent');
  assert.strictEqual(diego.emailVerificationToken, undefined);
  assert.strictEqual(verificationEmails().filter((email) => email.email === 'diego@example.com').length, 0);
  const consentEmails = emails.filter((email) => email.type === 'consent');
  assert.strictEqual(consentEmails.length, 1);
  assert.strictEqual(consentEmails[0].guardianEmail, 'guardian@example.com');
  assert.ok(consentEmails[0].consentLink.startsWith('http://students.example/consent/verify?token='));
  assert.ok(!consentEmails[0].consentLink.includes('/verify-email/'));
  const consentToken = new URL(consentEmails[0].consentLink).searchParams.get('token');
  assert.strictEqual(consentRecords.at(-1).consentToken, consentToken);
  assert.strictEqual(consentRecords.at(-1).guardianEmail, 'guardian@example.com');

  delete process.env.CLIENT_URL;
  process.env.FRONTEND_URL = 'http://frontend.example/';
  assert.strictEqual(
    buildVerificationUrl('abc123'),
    'http://frontend.example/verify-email/abc123'
  );
  process.env.CLIENT_URL = 'http://students.example';

  const message = buildMessage('Ava <script>', 'http://students.example/verify-email/abc123');
  const urls = new Set([
    ...(message.text.match(/https?:\/\/\S+/g) || []),
    ...(message.html.match(/https?:\/\/[^"'\s<]+/g) || []),
  ]);
  assert.deepStrictEqual([...urls], ['http://students.example/verify-email/abc123']);
  assert.strictEqual(message.subject, 'Verify Your IskolarMatch Account');
  assert.ok(!message.html.includes('<script>'));

  const previousFrom = process.env.FROM_EMAIL;
  delete process.env.FROM_EMAIL;
  assert.match(resolveSender('IskolarMatch Support'), /<onboarding@resend\.dev>$/);
  process.env.FROM_EMAIL = 'IskolarMatch <verify@example.edu>';
  assert.strictEqual(resolveSender('IskolarMatch Support'), 'IskolarMatch <verify@example.edu>');
  if (previousFrom === undefined) delete process.env.FROM_EMAIL;
  else process.env.FROM_EMAIL = previousFrom;

  const emailSource = fs.readFileSync(path.resolve(__dirname, '../utils/emailService.js'), 'utf8');
  assert.ok(!emailSource.includes('DEBUG KEY'));
  assert.ok(!emailSource.includes('firstChars'));

  const appSource = fs.readFileSync(
    path.resolve(__dirname, '../../../frontend/src/App.jsx'),
    'utf8'
  );
  assert.ok(appSource.includes('path="/verify-email/:token"'));

  const holdingSource = fs.readFileSync(
    path.resolve(__dirname, '../../../frontend/src/features/public-landing/pages/VerifyHoldingPage.jsx'),
    'utf8'
  );
  assert.ok(holdingSource.includes("'/api/v1/auth/resend-verification'"));
  assert.strictEqual((holdingSource.match(/handleResend\(/g) || []).length, 0);

  console.log('email verification tests passed');
  process.exit(0);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
