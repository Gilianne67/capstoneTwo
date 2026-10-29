/**
 * Security fixes for admin invitation, account status, FAQs, and moderation.
 * Redis and email delivery are stand-ins. No passwords are printed.
 */
const assert = require('assert');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Module = require('module');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'admin-security-test-secret';

const install = (relativePath, exports) => {
  const filename = require.resolve(relativePath);
  const mock = new Module(filename);
  mock.filename = filename;
  mock.loaded = true;
  mock.exports = exports;
  require.cache[filename] = mock;
  return exports;
};

install('../config/redis', {
  isOpen: false,
  isReady: false,
  async set() { return 'OK'; },
  async get() { return null; },
  async del() { return 1; },
});

const audits = [];
const { withAuditWarning } = require('../controllers/auditController');
install('../controllers/auditController', {
  async recordAuditLog(entry) {
    audits.push(entry);
    return entry;
  },
  withAuditWarning,
});

const revocations = [];
const sessions = new Map();
const blocklist = new Set();
const tokenApi = {
  async registerIssuedToken(userId, token) {
    if (!token) return { ok: false, reason: 'missing_token' };
    const key = String(userId);
    const list = sessions.get(key) || [];
    list.push(token);
    sessions.set(key, list);
    return { ok: true };
  },
  failNextRevoke: false,
  async revokeUserSessions(userId) {
    const key = String(userId);
    revocations.push(key);
    if (tokenApi.failNextRevoke) {
      const reason = tokenApi.failNextRevoke === true ? 'redis_unavailable' : tokenApi.failNextRevoke;
      tokenApi.failNextRevoke = false;
      return {
        success: false,
        blocklisted: reason === 'partial_failure' ? 1 : 0,
        failed: reason === 'partial_failure' ? 1 : 0,
        skipped: 0,
        reason,
        elapsedMs: null,
      };
    }
    const list = sessions.get(key) || [];
    list.forEach((token) => blocklist.add(token));
    sessions.set(key, []);
    return {
      success: true,
      blocklisted: list.length,
      failed: 0,
      skipped: 0,
      reason: list.length ? null : 'no_tracked_sessions',
      elapsedMs: 1,
    };
  },
  async blacklistToken(token) {
    if (token) blocklist.add(token);
    return { ok: true };
  },
  async forgetIssuedToken() {},
  async isTokenBlacklisted(token) {
    return blocklist.has(token);
  },
};
install('../services/tokenService', tokenApi);

const syncState = { mode: 'ok' };
install('../services/scholarshipSearchSync', {
  async syncScholarshipSearch() {
    if (syncState.mode === 'throw') throw new Error('search down');
    if (syncState.mode === 'failed') return { synchronized: false, reason: 'failed' };
    return { synchronized: true };
  },
});

const cacheState = { calls: 0 };
install('../services/matchCache', {
  async invalidateMatchCache() {
    cacheState.calls += 1;
    return { ok: true };
  },
});

const User = require('../models/User');
const emailService = require('../utils/emailService');
const FAQ = require('../models/FAQ');
const Report = require('../models/Report');
const Scholarship = require('../models/Scholarship');
const errorHandler = require('../middleware/error');
const { authorize, protect } = require('../middleware/auth');
const { inviteAdmin, updateUserAccountStatus } = require('../controllers/adminController');
const { updatePassword, resetPassword, login } = require('../controllers/authController');
const { getFAQs } = require('../controllers/faqController');
const { updateModerationReport } = require('../controllers/moderationController');

const users = new Map();
const sentMail = [];
let mailShouldFail = false;
const deletedIds = [];
const faqQueries = [];

const makeUser = (overrides) => {
  const user = {
    _id: overrides._id,
    email: overrides.email,
    role: overrides.role || 'student',
    status: overrides.status || 'active',
    name: overrides.name || 'Test User',
    password: overrides.password || 'current-secret',
    _secret: overrides.password || 'current-secret',
    isVerified: overrides.isVerified !== false,
    issued: 0,
    saveCount: 0,
    getSignedJwtToken() {
      this.issued += 1;
      const payload = { id: this._id, role: this.role };
      if (this.passwordChangedAt) {
        payload.passwordChangedAt = new Date(this.passwordChangedAt).getTime();
      }
      return jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: '1h', jwtid: `${this._id}-${this.issued}` }
      );
    },
    async matchPassword(entered) {
      return entered === this._secret;
    },
    async save() {
      if (typeof this.password === 'string') this._secret = this.password;
      this.saveCount += 1;
      return this;
    },
  };
  users.set(String(user._id), user);
  return user;
};

User.findById = (id) => {
  const doc = users.get(String(id)) || null;
  return {
    select() {
      return Promise.resolve(doc);
    },
    then(resolve, reject) {
      return Promise.resolve(doc).then(resolve, reject);
    },
  };
};

User.findOne = (query = {}) => {
  const doc = [...users.values()].find((user) => {
    if (query.email && user.email !== query.email) return false;
    if (query.resetPasswordToken && user.resetPasswordToken !== query.resetPasswordToken) return false;
    if (query.resetPasswordExpire && query.resetPasswordExpire.$gt != null) {
      if (!(Number(user.resetPasswordExpire) > Number(query.resetPasswordExpire.$gt))) return false;
    }
    return Boolean(query.email || query.resetPasswordToken);
  }) || null;
  return {
    select() {
      return Promise.resolve(doc);
    },
    then(resolve, reject) {
      return Promise.resolve(doc).then(resolve, reject);
    },
  };
};

User.findByIdAndDelete = async (id) => {
  deletedIds.push(String(id));
  users.delete(String(id));
  return { _id: id };
};

User.create = async (data) => {
  const doc = makeUser({
    _id: `created-${users.size + 1}`,
    email: data.email,
    role: data.role,
    name: data.name,
  });
  doc.password = data.password;
  doc.isVerified = data.isVerified;
  return doc;
};

emailService.sendAdminInvitationEmail = async (email, setupUrl, recipientName) => {
  if (mailShouldFail) throw new Error('mailbox unavailable');
  sentMail.push({ email, setupUrl, recipientName });
  return { id: 'mail-1' };
};

FAQ.find = (query) => {
  faqQueries.push(query);
  return {
    sort() {
      return Promise.resolve([]);
    },
  };
};

const callProtect = (token, overrides = {}) => new Promise((resolve) => {
  const req = {
    headers: { authorization: `Bearer ${token}` },
    method: overrides.method || 'GET',
    originalUrl: overrides.originalUrl || '/api/v1/auth/me',
  };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      resolve({ statusCode: this.statusCode, body, nextCalled: false });
    },
  };
  Promise.resolve(protect(req, res, () => {
    resolve({ statusCode: 200, nextCalled: true, user: req.user });
  })).catch((error) => {
    resolve({ statusCode: 500, body: { message: error.message }, nextCalled: false });
  });
});

const invoke = (handler, req) => new Promise((resolve, reject) => {
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
      resolve({ statusCode: this.statusCode, body });
    },
  };

  Promise.resolve(handler(req, res, (error) => {
    if (!error) {
      resolve({ statusCode: res.statusCode, body: res.body, nextCalled: true });
      return;
    }
    errorHandler(error, req, res, () => {});
  })).catch(reject);
});

const PASSWORD_UPDATED_MESSAGE = 'Your password has been updated successfully. Please sign in again on your other devices.';
const PASSWORD_UPDATED_UNCONFIRMED_MESSAGE = "Your password was updated, but we couldn't verify that all other sessions were signed out. Please sign out of your other devices.";
const leaksSessionInternals = (message) => /redis|session index|blocklist|blocklisted|revocation_store/i.test(String(message || ''));

const run = async () => {
  const admin = makeUser({ _id: 'admin-1', email: 'admin@example.test', role: 'admin' });
  const superadmin = makeUser({ _id: 'super-1', email: 'super@example.test', role: 'superadmin' });
  const student = makeUser({ _id: 'student-1', email: 'student@example.test', role: 'student' });
  const peerAdmin = makeUser({ _id: 'admin-2', email: 'peer@example.test', role: 'admin' });

  const invited = await invoke(inviteAdmin, {
    body: { fullName: 'New Admin', email: 'new.admin@example.test', adminRole: 'admin' },
    user: admin,
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(invited.statusCode, 201);
  assert.equal(Object.prototype.hasOwnProperty.call(invited.body.data, 'tempPassword'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(invited.body.data, 'password'), false);
  const created = [...users.values()].find((user) => user.email === 'new.admin@example.test');
  assert.ok(created);
  assert.equal(created.role, 'admin');
  assert.ok(created.password && created.password.length >= 32);
  const responseText = JSON.stringify(invited.body);
  assert.equal(responseText.includes(created.password), false);
  assert.equal(sentMail.length, 1);
  assert.equal(sentMail[0].email, 'new.admin@example.test');
  assert.equal(sentMail[0].setupUrl.includes(created.password), false);
  const setupToken = sentMail[0].setupUrl.split('/').pop();
  const tokenHash = crypto.createHash('sha256').update(setupToken).digest('hex');
  assert.equal(created.resetPasswordToken, tokenHash);
  assert.equal(responseText.includes(setupToken), false);
  assert.equal(audits.at(-1).action, 'ADMIN_ACCOUNT_PROVISIONED');
  assert.equal(audits.at(-1).details.includes(created.password), false);
  assert.equal(audits.at(-1).details.includes(setupToken), false);

  const createdBeforeDenied = users.size;
  const denied = await invoke(inviteAdmin, {
    body: { fullName: 'Root', email: 'root@example.test', adminRole: 'super_admin' },
    user: admin,
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(denied.statusCode, 403);
  assert.equal(users.size, createdBeforeDenied);
  assert.equal(JSON.stringify(denied.body).includes('tempPassword'), false);

  const promoted = await invoke(inviteAdmin, {
    body: { fullName: 'Root', email: 'root@example.test', adminRole: 'super_admin' },
    user: superadmin,
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(promoted.statusCode, 201);
  assert.equal(promoted.body.data.role, 'superadmin');
  assert.equal(Object.prototype.hasOwnProperty.call(promoted.body.data, 'tempPassword'), false);

  mailShouldFail = true;
  const mailed = users.size;
  const failedMail = await invoke(inviteAdmin, {
    body: { fullName: 'Missing', email: 'missing@example.test', adminRole: 'admin' },
    user: admin,
    ip: '127.0.0.1',
    headers: {},
  });
  mailShouldFail = false;
  assert.equal(failedMail.statusCode, 500);
  assert.equal(users.size, mailed);
  assert.ok(deletedIds.length > 0);
  assert.equal(failedMail.body.error, 'The invitation email could not be sent. No admin account was created.');
  assert.equal(JSON.stringify(failedMail.body).toLowerCase().includes('password'), false);

  const savedEnv = {
    NODE_ENV: process.env.NODE_ENV,
    CLIENT_URL: process.env.CLIENT_URL,
    FRONTEND_URL: process.env.FRONTEND_URL,
  };
  const restoreInvitationEnv = () => {
    ['NODE_ENV', 'CLIENT_URL', 'FRONTEND_URL'].forEach((key) => {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    });
  };

  try {
    process.env.NODE_ENV = 'development';
    process.env.CLIENT_URL = 'https://students.example';
    delete process.env.FRONTEND_URL;
    const clientInvite = await invoke(inviteAdmin, {
      body: { fullName: 'Client Linked', email: 'client.linked@example.test', adminRole: 'admin' },
      user: admin,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(clientInvite.statusCode, 201);
    assert.equal(clientInvite.body.data.role, 'admin');
    const clientMail = sentMail.at(-1);
    assert.ok(clientMail.setupUrl.startsWith('https://students.example/reset-password/'));
    assert.equal(clientMail.setupUrl.includes('localhost'), false);
    const setupToken = clientMail.setupUrl.split('/').pop();
    const invitedUser = [...users.values()].find((user) => user.email === 'client.linked@example.test');
    const placeholder = invitedUser._secret;
    tokenApi.failNextRevoke = 'redis_unavailable';
    const setup = await invoke(resetPassword, {
      params: { resettoken: setupToken },
      body: { password: 'replacement-secret' },
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(setup.statusCode, 503);
    assert.equal(setup.body.success, false);
    assert.equal(setup.body.revocation.reason, 'redis_unavailable');
    assert.equal(setup.body.revocation.success, false);
    assert.equal(invitedUser.resetPasswordToken, undefined);
    assert.equal(invitedUser._secret, 'replacement-secret');
    assert.equal(String(setup.body.message).toLowerCase().includes('redis'), false);
    assert.equal(/could not be saved|password change failed/i.test(setup.body.message), false);
    const newSignIn = await invoke(login, {
      body: { email: invitedUser.email, password: 'replacement-secret' },
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(newSignIn.statusCode, 200);
    assert.ok(newSignIn.body.token);
    const oldSignIn = await invoke(login, {
      body: { email: invitedUser.email, password: placeholder },
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(oldSignIn.statusCode, 401);
    const reused = await invoke(resetPassword, {
      params: { resettoken: setupToken },
      body: { password: 'another-secret-value' },
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(reused.statusCode, 400);
    assert.equal(reused.body.error, 'Invalid or expired password reset token.');
    assert.equal(invitedUser._secret, 'replacement-secret');

    const invalidToken = await invoke(resetPassword, {
      params: { resettoken: 'not-a-real-invitation-token' },
      body: { password: 'replacement-secret' },
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(invalidToken.statusCode, 400);
    assert.equal(invalidToken.body.error, 'Invalid or expired password reset token.');

    delete process.env.CLIENT_URL;
    process.env.FRONTEND_URL = 'https://frontend.example/';
    const frontendInvite = await invoke(inviteAdmin, {
      body: { fullName: 'Frontend Linked', email: 'frontend.linked@example.test', adminRole: 'admin' },
      user: admin,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(frontendInvite.statusCode, 201);
    const frontendMail = sentMail.at(-1);
    assert.ok(frontendMail.setupUrl.startsWith('https://frontend.example/reset-password/'));
    assert.equal(frontendMail.setupUrl.includes('localhost'), false);
    const expiringUser = [...users.values()].find((user) => user.email === 'frontend.linked@example.test');
    const expiringSecret = expiringUser._secret;
    const expiringToken = frontendMail.setupUrl.split('/').pop();
    expiringUser.resetPasswordExpire = Date.now() - 1000;
    const expired = await invoke(resetPassword, {
      params: { resettoken: expiringToken },
      body: { password: 'replacement-secret' },
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(expired.statusCode, 400);
    assert.equal(expired.body.error, 'Invalid or expired password reset token.');
    assert.equal(expiringUser._secret, expiringSecret);
    assert.ok(expiringUser.resetPasswordToken);

    process.env.NODE_ENV = 'production';
    process.env.CLIENT_URL = 'http://localhost:5173';
    process.env.FRONTEND_URL = 'https://app.example';
    const publicFallback = await invoke(inviteAdmin, {
      body: { fullName: 'Public Fallback', email: 'public.fallback@example.test', adminRole: 'admin' },
      user: admin,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(publicFallback.statusCode, 201);
    assert.ok(sentMail.at(-1).setupUrl.startsWith('https://app.example/reset-password/'));
    assert.equal(sentMail.at(-1).setupUrl.includes('localhost'), false);

    process.env.CLIENT_URL = 'http://127.0.0.1:5173';
    delete process.env.FRONTEND_URL;
    const beforeUnusable = users.size;
    const mailBeforeUnusable = sentMail.length;
    const unusable = await invoke(inviteAdmin, {
      body: { fullName: 'Unusable Link', email: 'unusable.link@example.test', adminRole: 'admin' },
      user: admin,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(unusable.statusCode, 500);
    assert.equal(users.size, beforeUnusable);
    assert.equal(sentMail.length, mailBeforeUnusable);
    assert.equal(JSON.stringify(unusable.body).includes('localhost'), false);
    assert.equal(String(unusable.body.error).includes('email could not be sent'), false);

    process.env.NODE_ENV = 'development';
    process.env.CLIENT_URL = 'https://students.example';
    const duplicate = await invoke(inviteAdmin, {
      body: { fullName: 'Duplicate', email: 'client.linked@example.test', adminRole: 'admin' },
      user: admin,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(duplicate.statusCode, 409);
    assert.equal(duplicate.body.error, 'An account with this email address already exists.');

    const beforeUnsupported = users.size;
    const unsupported = await invoke(inviteAdmin, {
      body: { fullName: 'Student Role', email: 'student.role@example.test', adminRole: 'student' },
      user: admin,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(unsupported.statusCode, 400);
    assert.equal(unsupported.body.error, 'Select a valid administrator role.');
    assert.equal(users.size, beforeUnsupported);

    const beforeInvalidEmail = users.size;
    const invalidEmail = await invoke(inviteAdmin, {
      body: { fullName: 'Bad Email', email: 'not-an-email', adminRole: 'admin' },
      user: admin,
      ip: '127.0.0.1',
      headers: {},
    });
    assert.equal(invalidEmail.statusCode, 400);
    assert.equal(invalidEmail.body.error, 'Please provide a valid official email address.');
    assert.equal(String(invalidEmail.body.error).includes('email could not be sent'), false);
    assert.equal(users.size, beforeInvalidEmail);

    const originalCreate = User.create;
    User.create = async () => {
      const error = new Error('E11000 duplicate key');
      error.code = 11000;
      throw error;
    };
    const raced = await invoke(inviteAdmin, {
      body: { fullName: 'Race', email: 'race.admin@example.test', adminRole: 'admin' },
      user: admin,
      ip: '127.0.0.1',
      headers: {},
    });
    User.create = originalCreate;
    assert.equal(raced.statusCode, 409);
    assert.equal(raced.body.error, 'An account with this email address already exists.');
    assert.equal([...users.values()].some((user) => user.email === 'race.admin@example.test'), false);
  } finally {
    restoreInvitationEnv();
  }

  const selfStatus = await invoke(updateUserAccountStatus, {
    params: { id: admin._id },
    body: { status: 'suspended' },
    user: admin,
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(selfStatus.statusCode, 403);
  assert.equal(admin.status, 'active');
  assert.equal(admin.saveCount, 0);

  const peerStatus = await invoke(updateUserAccountStatus, {
    params: { id: peerAdmin._id },
    body: { status: 'suspended' },
    user: admin,
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(peerStatus.statusCode, 403);
  assert.equal(peerAdmin.status, 'active');
  assert.equal(revocations.includes(String(peerAdmin._id)), false);

  const studentStatus = await invoke(updateUserAccountStatus, {
    params: { id: student._id },
    body: { status: 'suspended' },
    user: admin,
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(studentStatus.statusCode, 200);
  assert.equal(student.status, 'suspended');
  assert.equal(studentStatus.body.revocation.required, true);
  assert.ok(revocations.includes(String(student._id)));

  peerAdmin.status = 'active';
  const superStatus = await invoke(updateUserAccountStatus, {
    params: { id: peerAdmin._id },
    body: { status: 'suspended' },
    user: superadmin,
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(superStatus.statusCode, 200);
  assert.equal(peerAdmin.status, 'suspended');
  assert.ok(revocations.includes(String(peerAdmin._id)));

  const wrongPassword = 'not-the-current-secret';
  const rejectedPassword = await invoke(updatePassword, {
    body: { currentPassword: wrongPassword, newPassword: 'replacement-secret' },
    user: admin,
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(rejectedPassword.statusCode, 401);
  assert.equal(rejectedPassword.body.error, 'Current password is incorrect.');
  assert.equal(/password was updated|has been updated/i.test(rejectedPassword.body.error), false);
  assert.equal(leaksSessionInternals(rejectedPassword.body.error), false);
  assert.equal(admin._secret, 'current-secret');
  assert.equal(JSON.stringify(rejectedPassword.body).includes(wrongPassword), false);
  assert.equal(JSON.stringify(rejectedPassword.body).includes('replacement-secret'), false);

  const shortChange = await invoke(updatePassword, {
    body: { currentPassword: 'current-secret', newPassword: '12345678901234' },
    user: admin,
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(shortChange.statusCode, 400);
  assert.equal(shortChange.body.error, 'Password must be at least 15 characters long.');
  assert.equal(/password was updated|has been updated/i.test(shortChange.body.error), false);
  assert.equal(leaksSessionInternals(shortChange.body.error), false);
  assert.equal(admin._secret, 'current-secret');

  const sameUser = makeUser({
    _id: 'same-password-1',
    email: 'same-password@example.test',
    role: 'admin',
    password: 'current-secret-value',
  });
  sameUser.password = '$2a$10$stored-hash-not-plaintext';
  const comparedPasswords = [];
  const originalMatch = sameUser.matchPassword.bind(sameUser);
  sameUser.matchPassword = async (entered) => {
    comparedPasswords.push(entered);
    return originalMatch(entered);
  };
  const revocationsBeforeSame = revocations.length;
  const samePassword = await invoke(updatePassword, {
    body: { currentPassword: 'current-secret-value', newPassword: 'current-secret-value' },
    user: sameUser,
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(samePassword.statusCode, 400);
  assert.equal(samePassword.body.error, 'Your new password must be different from your current password.');
  assert.equal(sameUser._secret, 'current-secret-value');
  assert.equal(sameUser.password, '$2a$10$stored-hash-not-plaintext');
  assert.equal(sameUser.saveCount, 0);
  assert.equal(sameUser.passwordChangedAt, undefined);
  assert.equal(revocations.length, revocationsBeforeSame);
  assert.deepEqual(comparedPasswords, ['current-secret-value', 'current-secret-value']);
  assert.equal(await sameUser.matchPassword('current-secret-value'), true);
  assert.equal(JSON.stringify(samePassword.body).includes('current-secret-value'), false);
  sameUser.matchPassword = originalMatch;

  const changedSameUser = await invoke(updatePassword, {
    body: { currentPassword: 'current-secret-value', newPassword: 'replacement-secret' },
    user: sameUser,
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(changedSameUser.statusCode, 200);
  assert.equal(sameUser._secret, 'replacement-secret');

  const previousToken = admin.getSignedJwtToken();
  const otherSession = admin.getSignedJwtToken();
  await tokenApi.registerIssuedToken(admin._id, previousToken);
  await tokenApi.registerIssuedToken(admin._id, otherSession);

  const changedPassword = await invoke(updatePassword, {
    body: { currentPassword: 'current-secret', newPassword: 'replacement-secret' },
    user: admin,
    token: previousToken,
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(changedPassword.statusCode, 200);
  assert.equal(changedPassword.body.success, true);
  assert.equal(changedPassword.body.message, PASSWORD_UPDATED_MESSAGE);
  assert.equal(leaksSessionInternals(changedPassword.body.message), false);
  assert.equal(admin._secret, 'replacement-secret');
  assert.equal(JSON.stringify(changedPassword.body).includes('replacement-secret'), false);
  assert.equal(audits.at(-1).action, 'PASSWORD_CHANGED');
  assert.equal(audits.at(-1).details.includes('replacement-secret'), false);
  assert.equal(await tokenApi.isTokenBlacklisted(previousToken), true);
  assert.equal(await tokenApi.isTokenBlacklisted(otherSession), true);
  assert.ok(changedPassword.body.token);
  assert.notEqual(changedPassword.body.token, previousToken);
  assert.equal(await tokenApi.isTokenBlacklisted(changedPassword.body.token), false);
  assert.ok(admin.passwordChangedAt instanceof Date);
  const revokedSession = await callProtect(previousToken);
  assert.equal(revokedSession.nextCalled, false);
  assert.equal(revokedSession.statusCode, 401);
  const keptSession = await callProtect(changedPassword.body.token);
  assert.equal(keptSession.nextCalled, true);

  const oldPasswordLogin = await invoke(login, {
    body: { email: admin.email, password: 'current-secret' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(oldPasswordLogin.statusCode, 401);

  const newPasswordLogin = await invoke(login, {
    body: { email: admin.email, password: 'replacement-secret' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(newPasswordLogin.statusCode, 200);
  assert.ok(newPasswordLogin.body.token);
  assert.equal(await tokenApi.isTokenBlacklisted(newPasswordLogin.body.token), false);

  const offlineUser = makeUser({
    _id: 'offline-1',
    email: 'offline@example.test',
    role: 'student',
    password: 'current-secret',
  });
  const staleToken = jwt.sign(
    {
      id: offlineUser._id,
      role: offlineUser.role,
      iat: Math.floor(Date.now() / 1000) - 120,
    },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );
  tokenApi.failNextRevoke = true;
  const offlineChange = await invoke(updatePassword, {
    body: { currentPassword: 'current-secret', newPassword: 'replacement-secret' },
    user: offlineUser,
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(offlineChange.statusCode, 503);
  assert.equal(offlineChange.body.success, false);
  assert.equal(offlineChange.body.revocation.reason, 'redis_unavailable');
  assert.equal(offlineChange.body.message, PASSWORD_UPDATED_UNCONFIRMED_MESSAGE);
  assert.equal(leaksSessionInternals(offlineChange.body.message), false);
  assert.equal(offlineUser._secret, 'replacement-secret');
  const offlineAudit = audits.find((entry) => entry.action === 'PASSWORD_CHANGED' && String(entry.details).includes('offline@example.test'));
  assert.ok(offlineAudit);
  assert.equal(offlineAudit.details.includes('redis_unavailable'), true);
  assert.ok(offlineChange.body.token);
  assert.equal(await tokenApi.isTokenBlacklisted(staleToken), false);
  assert.equal(await tokenApi.isTokenBlacklisted(offlineChange.body.token), false);
  assert.ok(offlineUser.passwordChangedAt instanceof Date);
  assert.equal(JSON.stringify(offlineChange.body).includes('replacement-secret'), false);
  const staleAccess = await callProtect(staleToken);
  assert.equal(staleAccess.nextCalled, false);
  assert.equal(staleAccess.statusCode, 401);
  const replacementAccess = await callProtect(offlineChange.body.token);
  assert.equal(replacementAccess.nextCalled, true);

  const partialUser = makeUser({
    _id: 'partial-1',
    email: 'partial@example.test',
    role: 'student',
    password: 'current-secret',
  });
  tokenApi.failNextRevoke = 'partial_failure';
  const partialChange = await invoke(updatePassword, {
    body: { currentPassword: 'current-secret', newPassword: 'replacement-secret' },
    user: partialUser,
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(partialChange.statusCode, 503);
  assert.equal(partialChange.body.success, false);
  assert.equal(partialChange.body.revocation.reason, 'partial_failure');
  assert.equal(partialUser._secret, 'replacement-secret');
  assert.equal(partialChange.body.message, PASSWORD_UPDATED_UNCONFIRMED_MESSAGE);
  assert.equal(leaksSessionInternals(partialChange.body.message), false);
  assert.ok(partialChange.body.token);

  const sameSecondUser = makeUser({
    _id: 'same-second-1',
    email: 'same-second@example.test',
    role: 'student',
    password: 'current-secret',
  });
  const issuedSecond = Math.floor(Date.now() / 1000);
  const sameSecondToken = jwt.sign(
    {
      id: sameSecondUser._id,
      role: sameSecondUser.role,
      iat: issuedSecond,
    },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );
  sameSecondUser.passwordChangedAt = new Date((issuedSecond * 1000) + 500);
  const sameSecondReplacement = sameSecondUser.getSignedJwtToken();
  assert.equal(jwt.decode(sameSecondToken).iat, issuedSecond);
  assert.equal(Math.floor(sameSecondUser.passwordChangedAt.getTime() / 1000), issuedSecond);
  assert.equal(jwt.decode(sameSecondReplacement).passwordChangedAt, sameSecondUser.passwordChangedAt.getTime());
  assert.equal(await tokenApi.isTokenBlacklisted(sameSecondToken), false);
  const sameSecondAccess = await callProtect(sameSecondToken);
  assert.equal(sameSecondAccess.nextCalled, false);
  assert.equal(sameSecondAccess.statusCode, 401);
  const sameSecondReplacementAccess = await callProtect(sameSecondReplacement);
  assert.equal(sameSecondReplacementAccess.nextCalled, true);
  const sameSecondLogout = await callProtect(sameSecondToken, {
    method: 'GET',
    originalUrl: '/api/v1/auth/logout',
  });
  assert.equal(sameSecondLogout.nextCalled, true);

  const resetUser = makeUser({
    _id: 'reset-1',
    email: 'reset@example.test',
    role: 'admin',
    password: 'current-secret',
  });
  const resetSession = resetUser.getSignedJwtToken();
  await tokenApi.registerIssuedToken(resetUser._id, resetSession);
  const rawResetToken = crypto.randomBytes(32).toString('hex');
  resetUser.resetPasswordToken = crypto.createHash('sha256').update(rawResetToken).digest('hex');
  resetUser.resetPasswordExpire = Date.now() + (30 * 60 * 1000);
  const shortReset = await invoke(resetPassword, {
    params: { resettoken: rawResetToken },
    body: { password: '12345678901234' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(shortReset.statusCode, 400);
  assert.equal(resetUser.resetPasswordToken, crypto.createHash('sha256').update(rawResetToken).digest('hex'));
  const resetResult = await invoke(resetPassword, {
    params: { resettoken: rawResetToken },
    body: { password: 'reset-password-value' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(resetResult.statusCode, 200);
  assert.equal(resetUser.resetPasswordToken, undefined);
  assert.ok(resetUser.passwordChangedAt instanceof Date);
  const resetOldAccess = await callProtect(resetSession);
  assert.equal(resetOldAccess.nextCalled, false);
  assert.equal(resetOldAccess.statusCode, 401);
  const resetNewAccess = await callProtect(resetResult.body.token);
  assert.equal(resetNewAccess.nextCalled, true);
  assert.equal(await tokenApi.isTokenBlacklisted(resetSession), true);
  assert.ok(resetResult.body.token);
  assert.equal(await tokenApi.isTokenBlacklisted(resetResult.body.token), false);
  assert.equal(JSON.stringify(resetResult.body).includes('reset-password-value'), false);

  const resetOldLogin = await invoke(login, {
    body: { email: resetUser.email, password: 'current-secret' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(resetOldLogin.statusCode, 401);
  const resetNewLogin = await invoke(login, {
    body: { email: resetUser.email, password: 'reset-password-value' },
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(resetNewLogin.statusCode, 200);
  assert.equal(await tokenApi.isTokenBlacklisted(resetNewLogin.body.token), false);

  const queriesBefore = faqQueries.length;
  const hiddenAdminFaqs = await invoke(getFAQs, { query: { role: 'admin' }, headers: {} });
  assert.equal(hiddenAdminFaqs.statusCode, 401);
  assert.equal(faqQueries.length, queriesBefore);

  const studentFaqs = await invoke(getFAQs, {
    query: { role: 'admin' },
    user: { role: 'student' },
    headers: {},
  });
  assert.equal(studentFaqs.statusCode, 200);
  assert.deepEqual(faqQueries.at(-1).targetRole.$in, ['student', 'all']);
  assert.equal(faqQueries.at(-1).isPublished, true);

  const adminFaqs = await invoke(getFAQs, {
    query: { role: 'student' },
    user: { role: 'super_admin' },
    headers: {},
  });
  assert.equal(adminFaqs.statusCode, 200);
  assert.deepEqual(faqQueries.at(-1), {});

  const report = {
    _id: 'report-1',
    listingId: 'listing-1',
    status: 'Open',
    saved: false,
    async save() {
      this.saved = true;
      return this;
    },
  };
  Report.findById = async () => report;
  Scholarship.findByIdAndUpdate = async () => ({ _id: 'listing-1', status: 'Closed' });
  syncState.mode = 'throw';
  cacheState.calls = 0;
  const failedSync = await invoke(updateModerationReport, {
    params: { id: 'report-1' },
    body: { status: 'Resolved', action: 'REMOVE_LISTING' },
    user: admin,
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(report.saved, true);
  assert.equal(report.status, 'Resolved');
  assert.equal(cacheState.calls, 1);
  assert.equal(failedSync.statusCode, 500);
  assert.equal(failedSync.body.errors.some((item) => item.step === 'searchSync'), true);
  assert.equal(audits.at(-1).action, 'MODERATION_REPORT_RESOLVED');

  syncState.mode = 'failed';
  report.saved = false;
  const returnedFailure = await invoke(updateModerationReport, {
    params: { id: 'report-1' },
    body: { status: 'Resolved', action: 'REMOVE_LISTING' },
    user: admin,
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(returnedFailure.statusCode, 500);
  assert.equal(report.saved, false);
  assert.equal(report.status, 'Resolved');
  assert.equal(cacheState.calls, 2);
  assert.equal(audits.at(-1).action, 'MODERATION_REPORT_RETRY');

  const conflictingRetry = await invoke(updateModerationReport, {
    params: { id: 'report-1' },
    body: { status: 'Dismissed', action: 'DISMISS' },
    user: admin,
    ip: '127.0.0.1',
    headers: {},
  });
  assert.equal(conflictingRetry.statusCode, 409);
  assert.equal(report.status, 'Resolved');
  assert.equal(report.resolution, 'REMOVE_LISTING');
  assert.equal(cacheState.calls, 2);

  let allowed = false;
  authorize('admin', 'super_admin')(
    { user: { role: 'superadmin' } },
    { status() { return this; }, json() {} },
    () => { allowed = true; }
  );
  assert.equal(allowed, true);

  console.log('admin security fix tests passed');
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
