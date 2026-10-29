/**
 * Admin user directory, status changes, and preservation of related records.
 * Redis is an in-memory stand-in. This does not measure live Redis latency.
 */
const assert = require('assert');
const express = require('express');
const jwt = require('jsonwebtoken');
const Module = require('module');

const secret = process.env.JWT_SECRET || 'admin-user-management-test-secret';
process.env.JWT_SECRET = secret;

const createRedisMock = () => {
  const strings = new Map();
  const sets = new Map();
  const expiresAt = new Map();
  return {
    isOpen: true,
    isReady: true,
    async set(key, value) {
      strings.set(key, value);
      return 'OK';
    },
    async get(key) {
      return strings.has(key) ? strings.get(key) : null;
    },
    async del(key) {
      strings.delete(key);
      sets.delete(key);
      expiresAt.delete(key);
      return 1;
    },
    async zAdd(key, members) {
      const set = sets.get(key) || new Map();
      for (const member of members) set.set(member.value, member.score);
      sets.set(key, set);
      return members.length;
    },
    async zRem(key, value) {
      const set = sets.get(key);
      if (!set) return 0;
      const removed = set.delete(value) ? 1 : 0;
      if (set.size === 0) sets.delete(key);
      return removed;
    },
    async zRangeWithScores(key) {
      const set = sets.get(key) || new Map();
      return [...set.entries()].map(([value, score]) => ({ value, score }));
    },
    async zRemRangeByScore(key, min, max) {
      const set = sets.get(key);
      if (!set) return 0;
      let removed = 0;
      for (const [value, score] of [...set.entries()]) {
        if (score >= Number(min) && score <= Number(max)) {
          set.delete(value);
          removed += 1;
        }
      }
      if (set.size === 0) sets.delete(key);
      return removed;
    },
    async expire(key, seconds) {
      expiresAt.set(key, Math.floor(Date.now() / 1000) + Number(seconds));
      return 1;
    },
    async ttl(key) {
      if (!sets.has(key) && !strings.has(key)) return -2;
      if (!expiresAt.has(key)) return -1;
      return expiresAt.get(key) - Math.floor(Date.now() / 1000);
    },
  };
};

const redisPath = require.resolve('../config/redis');
const redisModule = new Module(redisPath, module);
redisModule.filename = redisPath;
redisModule.loaded = true;
redisModule.exports = createRedisMock();
require.cache[redisPath] = redisModule;

const { installMemoryRevocationStore } = require('./revocationStoreStub');
installMemoryRevocationStore();

const User = require('../models/User');
const Provider = require('../models/Provider');
const Application = require('../models/Application');
const SavedMatch = require('../models/SavedMatch');
const StudentProfile = require('../models/StudentProfile');
const AuditLog = require('../models/AuditLog');
const { login } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');
const adminRoutes = require('../routes/adminRoutes');
const errorHandler = require('../middleware/error');
const { isTokenBlacklisted } = require('../services/tokenService');

const users = new Map();
const audits = [];
const unexpectedDeletes = [];
let lastLimit = null;
let listShouldFail = false;

const studentProfile = {
  _id: 'profile-anna',
  userId: 'student-anna',
  course: 'Computer Science',
};
const application = {
  _id: 'application-anna',
  studentProfileId: 'profile-anna',
  scholarshipId: 'scholarship-1',
  applicationStatus: 'Submitted',
};
const savedMatch = {
  _id: 'saved-anna',
  studentProfileId: 'profile-anna',
  scholarshipId: 'scholarship-1',
};
const providerProfile = {
  _id: 'provider-profile-1',
  userId: 'provider-north',
  verificationStatus: 'Pending Review',
  rejectionReason: 'INTERNAL_REJECTION_REASON',
};
const preserved = {
  studentProfile: JSON.stringify(studentProfile),
  application: JSON.stringify(application),
  savedMatch: JSON.stringify(savedMatch),
  providerProfile: JSON.stringify(providerProfile),
};

const matchesFilter = (user, filter = {}) => {
  if (filter.role) {
    if (typeof filter.role === 'string' && user.role !== filter.role) return false;
    if (filter.role.$in && !filter.role.$in.includes(user.role)) return false;
  }
  if (filter.status && user.status !== filter.status) return false;
  if (Array.isArray(filter.$or)) {
    const matched = filter.$or.some((clause) => {
      if (clause.name instanceof RegExp) return clause.name.test(String(user.name || ''));
      if (clause.email instanceof RegExp) return clause.email.test(String(user.email || ''));
      return false;
    });
    if (!matched) return false;
  }
  return true;
};

const trap = (label) => async () => {
  unexpectedDeletes.push(label);
  return { deletedCount: 0 };
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
  const doc = [...users.values()].find((user) => user.email === query.email) || null;
  return {
    select() {
      return Promise.resolve(doc);
    },
    then(resolve, reject) {
      return Promise.resolve(doc).then(resolve, reject);
    },
  };
};

User.find = (filter = {}) => {
  const matched = [...users.values()]
    .filter((user) => matchesFilter(user, filter))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  let skip = 0;
  let limit = matched.length;
  const api = {
    select() { return api; },
    sort() { return api; },
    skip(n) { skip = Number(n) || 0; return api; },
    limit(n) { limit = Number(n); lastLimit = limit; return api; },
    async lean() {
      if (listShouldFail) throw new Error('database unavailable');
      return matched.slice(skip, skip + limit);
    },
  };
  return api;
};

User.countDocuments = async (filter = {}) =>
  [...users.values()].filter((user) => matchesFilter(user, filter)).length;

User.findByIdAndDelete = trap('User.findByIdAndDelete');
User.deleteOne = trap('User.deleteOne');
User.deleteMany = trap('User.deleteMany');

Provider.findOne = (query = {}) => {
  const doc = String(providerProfile.userId) === String(query.userId) ? providerProfile : null;
  return {
    select() { return this; },
    then(resolve, reject) {
      return Promise.resolve(doc).then(resolve, reject);
    },
  };
};

Provider.find = (filter = {}) => {
  const ids = filter.userId && filter.userId.$in ? filter.userId.$in.map(String) : null;
  const matched = ids && ids.includes(String(providerProfile.userId)) ? [providerProfile] : [];
  const api = {
    select() { return api; },
    lean: async () => matched,
  };
  return api;
};
Provider.findByIdAndDelete = trap('Provider.findByIdAndDelete');
Provider.deleteOne = trap('Provider.deleteOne');
Provider.deleteMany = trap('Provider.deleteMany');

Application.deleteMany = trap('Application.deleteMany');
Application.deleteOne = trap('Application.deleteOne');
Application.findByIdAndDelete = trap('Application.findByIdAndDelete');
SavedMatch.deleteMany = trap('SavedMatch.deleteMany');
SavedMatch.deleteOne = trap('SavedMatch.deleteOne');
SavedMatch.findOneAndDelete = trap('SavedMatch.findOneAndDelete');
SavedMatch.findByIdAndDelete = trap('SavedMatch.findByIdAndDelete');
StudentProfile.deleteMany = trap('StudentProfile.deleteMany');
StudentProfile.deleteOne = trap('StudentProfile.deleteOne');
StudentProfile.findByIdAndDelete = trap('StudentProfile.findByIdAndDelete');
StudentProfile.findOneAndDelete = trap('StudentProfile.findOneAndDelete');
AuditLog.deleteMany = trap('AuditLog.deleteMany');
AuditLog.findByIdAndDelete = trap('AuditLog.findByIdAndDelete');
AuditLog.create = async (entry) => {
  audits.push(entry);
  return entry;
};

const createUser = (overrides) => {
  const user = {
    _id: overrides._id,
    id: overrides._id,
    name: overrides.name,
    email: overrides.email,
    role: overrides.role,
    status: overrides.status || 'active',
    isVerified: overrides.isVerified !== false,
    isOnboarded: overrides.isOnboarded !== false,
    createdAt: overrides.createdAt,
    password: overrides.password || 'SECRET_PASSWORD_HASH',
    emailVerificationToken: 'EMAIL_TOKEN_SECRET',
    resetPasswordToken: 'RESET_TOKEN_SECRET',
    consentToken: 'CONSENT_TOKEN_SECRET',
    issued: 0,
    saveCount: 0,
    _plainPassword: 'secret123',
    async matchPassword(entered) {
      return entered === this._plainPassword;
    },
    getSignedJwtToken() {
      this.issued += 1;
      return jwt.sign(
        { id: this._id, role: this.role, status: this.status },
        secret,
        { expiresIn: '1h', jwtid: `${this._id}-${this.issued}` }
      );
    },
    async save() {
      this.saveCount += 1;
      users.set(String(this._id), this);
      return this;
    },
  };
  users.set(String(user._id), user);
  return user;
};

const signAccessToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role, status: user.status, isVerified: true, isOnboarded: true },
    secret,
    { expiresIn: '1h', jwtid: `${user._id}-access` }
  );

const invoke = (handler, req) =>
  new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      cookie() { return this; },
      json(body) {
        this.body = body;
        resolve({ statusCode: this.statusCode, body });
      },
    };
    Promise.resolve(handler(req, res, (error) => {
      if (error) {
        errorHandler(error, req, res, () => {});
        return;
      }
      resolve({ statusCode: res.statusCode, body: res.body, req, nextCalled: true });
    })).catch(reject);
  });

const run = (middleware, req) =>
  new Promise((resolve, reject) => {
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
    Promise.resolve(middleware(req, res, (error) => {
      if (error) {
        errorHandler(error, req, res, () => {});
        return;
      }
      resolve({ statusCode: res.statusCode, body: res.body, req, nextCalled: true });
    })).catch(reject);
  });

const startServer = () =>
  new Promise((resolve) => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/admin', adminRoutes);
    app.use(errorHandler);
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });

const requestJson = async (server, path, { method = 'GET', token, body } = {}) => {
  const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
};

const withExpectedConsoleErrors = async (fn, isExpected) => {
  const originalError = console.error;
  let unexpected = 0;
  console.error = (...args) => {
    if (isExpected(...args)) return;
    unexpected += 1;
    originalError(...args);
  };
  try {
    const result = await fn();
    if (unexpected > 0) {
      throw new Error(`${unexpected} unexpected console.error call(s) during a negative test`);
    }
    return result;
  } finally {
    console.error = originalError;
  }
};

const isValidationLog = (...args) => args[0] instanceof Error;
const isUserListFailureLog = (...args) =>
  args[0] === 'Admin user list error:'
  || (args[0] instanceof Error && args[0].message === 'Unable to load users. Please try again.');

const assertPreserved = () => {
  assert.equal(JSON.stringify(studentProfile), preserved.studentProfile);
  assert.equal(JSON.stringify(application), preserved.application);
  assert.equal(JSON.stringify(savedMatch), preserved.savedMatch);
  assert.equal(JSON.stringify(providerProfile), preserved.providerProfile);
  assert.deepEqual(unexpectedDeletes, []);
};

const assertNoSecrets = (payload) => {
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes('SECRET_PASSWORD_HASH'), false);
  assert.equal(serialized.includes('EMAIL_TOKEN_SECRET'), false);
  assert.equal(serialized.includes('RESET_TOKEN_SECRET'), false);
  assert.equal(serialized.includes('CONSENT_TOKEN_SECRET'), false);
  assert.equal(serialized.includes('INTERNAL_REJECTION_REASON'), false);
  for (const row of payload.data || []) {
    assert.equal(Object.prototype.hasOwnProperty.call(row, 'password'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(row, 'emailVerificationToken'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(row, 'resetPasswordToken'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(row, 'consentToken'), false);
  }
};

const main = async () => {
  const listRoute = adminRoutes.stack.find((layer) => layer.route && layer.route.path === '/users');
  assert.ok(listRoute);
  assert.equal(listRoute.route.methods.get, true);
  const gates = adminRoutes.stack.filter((layer) => !layer.route);
  assert.equal(gates[0].handle.name, 'protect');

  const admin = createUser({
    _id: 'admin-1',
    name: 'Audit Admin',
    email: 'admin@example.test',
    role: 'admin',
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  const superadmin = createUser({
    _id: 'super-1',
    name: 'Root Admin',
    email: 'root@example.test',
    role: 'superadmin',
    createdAt: '2026-01-02T00:00:00.000Z',
  });
  const peerAdmin = createUser({
    _id: 'admin-2',
    name: 'Peer Admin',
    email: 'peer@example.test',
    role: 'admin',
    createdAt: '2026-01-03T00:00:00.000Z',
  });
  const anna = createUser({
    _id: 'student-anna',
    name: 'Anna Student',
    email: 'anna@example.test',
    role: 'student',
    createdAt: '2026-03-01T00:00:00.000Z',
  });
  const bob = createUser({
    _id: 'student-bob',
    name: 'Bob Student',
    email: 'bob@example.test',
    role: 'student',
    isVerified: false,
    isOnboarded: false,
    createdAt: '2026-04-01T00:00:00.000Z',
  });
  createUser({
    _id: 'student-adot',
    name: 'A. Student',
    email: 'adot@example.test',
    role: 'student',
    createdAt: '2026-06-01T00:00:00.000Z',
  });
  createUser({
    _id: 'student-ax',
    name: 'AX Student',
    email: 'ax@example.test',
    role: 'student',
    createdAt: '2026-06-02T00:00:00.000Z',
  });
  const provider = createUser({
    _id: 'provider-north',
    name: 'North Grant Office',
    email: 'grants@north.test',
    role: 'provider',
    createdAt: '2026-05-01T00:00:00.000Z',
  });

  const server = await startServer();
  try {
    const adminToken = signAccessToken(admin);
    const superadminToken = signAccessToken(superadmin);
    const studentToken = signAccessToken(anna);
    const providerToken = signAccessToken(provider);

    const missingAuth = await requestJson(server, '/api/v1/admin/users');
    const studentList = await requestJson(server, '/api/v1/admin/users', { token: studentToken });
    const providerList = await requestJson(server, '/api/v1/admin/users', { token: providerToken });
    assert.equal(missingAuth.status, 401);
    assert.equal(studentList.status, 403);
    assert.equal(providerList.status, 403);

    const allUsers = await requestJson(server, '/api/v1/admin/users?limit=20', { token: adminToken });
    assert.equal(allUsers.status, 200);
    assert.equal(allUsers.body.success, true);
    assert.equal(allUsers.body.total, 8);
    assert.equal(allUsers.body.count, 8);
    assert.equal(allUsers.body.page, 1);
    assert.equal(allUsers.body.pages, 1);
    assertNoSecrets(allUsers.body);
    const annaRow = allUsers.body.data.find((row) => row.id === 'student-anna');
    const providerRow = allUsers.body.data.find((row) => row.id === 'provider-north');
    assert.equal(annaRow.email, 'anna@example.test');
    assert.equal(annaRow.role, 'student');
    assert.equal(annaRow.status, 'active');
    assert.equal(annaRow.isVerified, true);
    assert.equal(annaRow.isOnboarded, true);
    assert.ok(annaRow.createdAt);
    assert.equal(Object.prototype.hasOwnProperty.call(annaRow, 'verificationStatus'), false);
    const bobRow = allUsers.body.data.find((row) => row.id === 'student-bob');
    assert.equal(bobRow.isVerified, false);
    assert.equal(bobRow.isOnboarded, false);
    assert.equal(providerRow.verificationStatus, 'Pending Review');
    assert.equal(providerRow.providerId, 'provider-profile-1');

    const byName = await requestJson(server, '/api/v1/admin/users?search=anna', { token: adminToken });
    assert.equal(byName.body.total, 1);
    assert.equal(byName.body.data[0].id, 'student-anna');
    const byEmail = await requestJson(server, '/api/v1/admin/users?search=grants@north.test', { token: adminToken });
    assert.equal(byEmail.body.total, 1);
    assert.equal(byEmail.body.data[0].id, 'provider-north');
    const literalDot = await requestJson(
      server,
      `/api/v1/admin/users?search=${encodeURIComponent('A. Student')}`,
      { token: adminToken }
    );
    assert.equal(literalDot.body.total, 1);
    assert.equal(literalDot.body.data[0].id, 'student-adot');

    const students = await requestJson(server, '/api/v1/admin/users?role=student&limit=2&page=1', { token: adminToken });
    assert.equal(students.body.total, 4);
    assert.equal(students.body.pages, 2);
    assert.equal(students.body.count, 2);
    assert.deepEqual(students.body.data.map((row) => row.id), ['student-ax', 'student-adot']);
    const studentsPage2 = await requestJson(server, '/api/v1/admin/users?role=Student&limit=2&page=2', { token: adminToken });
    assert.deepEqual(studentsPage2.body.data.map((row) => row.id), ['student-bob', 'student-anna']);
    const providers = await requestJson(server, '/api/v1/admin/users?role=Scholarship%20Provider', { token: adminToken });
    assert.equal(providers.body.total, 1);
    assert.equal(providers.body.data[0].role, 'provider');
    const administrators = await requestJson(server, '/api/v1/admin/users?role=administrator', { token: adminToken });
    assert.equal(administrators.body.total, 3);
    assert.deepEqual(
      administrators.body.data.map((row) => row.role).sort(),
      ['admin', 'admin', 'superadmin']
    );
    const combined = await requestJson(server, '/api/v1/admin/users?role=student&search=bob', { token: adminToken });
    assert.equal(combined.body.total, 1);
    assert.equal(combined.body.data[0].id, 'student-bob');

    lastLimit = null;
    const capped = await requestJson(server, '/api/v1/admin/users?limit=80', { token: adminToken });
    assert.equal(capped.status, 200);
    assert.equal(lastLimit, 50);

    const invalidRole = await withExpectedConsoleErrors(
      () => requestJson(server, '/api/v1/admin/users?role=faculty', { token: adminToken }),
      isValidationLog
    );
    const invalidPage = await withExpectedConsoleErrors(
      () => requestJson(server, '/api/v1/admin/users?page=0', { token: adminToken }),
      isValidationLog
    );
    assert.equal(invalidRole.status, 400);
    assert.equal(invalidPage.status, 400);
    assert.match(invalidRole.body.error, /Role filter/i);

    listShouldFail = true;
    const dbError = await withExpectedConsoleErrors(
      () => requestJson(server, '/api/v1/admin/users', { token: adminToken }),
      isUserListFailureLog
    );
    listShouldFail = false;
    assert.equal(dbError.status, 500);
    assert.equal(dbError.body.error, 'Unable to load users. Please try again.');
    assert.equal(dbError.body.error.includes('database unavailable'), false);

    const annaLogin = await invoke(login, {
      body: { email: anna.email, password: 'secret123' },
      headers: {},
      ip: '127.0.0.1',
    });
    assert.equal(annaLogin.statusCode, 200);
    const annaToken = annaLogin.body.token;

    const suspended = await requestJson(server, '/api/v1/admin/users/student-anna/status', {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'suspended' },
    });
    assert.equal(suspended.status, 200);
    assert.equal(suspended.body.success, true);
    assert.equal(anna.status, 'suspended');
    assert.equal(suspended.body.revocation.required, true);
    const suspensionAudit = audits.filter((entry) => entry.action === 'ACCOUNT_STATUS_CHANGE').at(-1);
    assert.ok(suspensionAudit);
    assert.equal(suspensionAudit.actor, 'Audit Admin');
    assert.match(suspensionAudit.details, /anna@example.test/);
    assert.match(suspensionAudit.details, /student-anna/);
    assert.match(suspensionAudit.details, /suspended/);
    assert.equal(suspensionAudit.severity, 'Warning');
    assert.ok(suspensionAudit.ipAddress);
    const suspendedList = await requestJson(server, '/api/v1/admin/users?search=anna', { token: adminToken });
    assert.equal(suspendedList.body.data[0].status, 'suspended');
    assertPreserved();

    const suspendedLogin = await withExpectedConsoleErrors(
      () => invoke(login, {
        body: { email: anna.email, password: 'secret123' },
        headers: {},
        ip: '127.0.0.1',
      }),
      isValidationLog
    );
    assert.equal(suspendedLogin.statusCode, 403);
    assert.equal(suspendedLogin.body.code, 'ACCOUNT_SUSPENDED');
    const suspendedAccess = await run(protect, {
      method: 'GET',
      originalUrl: '/api/v1/students/profile',
      url: '/api/v1/students/profile',
      headers: { authorization: `Bearer ${annaToken}` },
      cookies: {},
    });
    assert.equal(suspendedAccess.nextCalled, false);
    assert.equal(await isTokenBlacklisted(annaToken), true);

    const providerSuspended = await requestJson(server, '/api/v1/admin/users/provider-north/status', {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'suspended' },
    });
    assert.equal(providerSuspended.status, 200);
    assert.equal(provider.status, 'suspended');
    assert.equal(providerProfile.verificationStatus, 'Pending Review');
    assertPreserved();

    const restored = await requestJson(server, '/api/v1/admin/users/student-anna/status', {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'active' },
    });
    assert.equal(restored.status, 200);
    assert.equal(restored.body.revocation.required, false);
    assert.equal(anna.status, 'active');
    const restoreAudit = audits.filter((entry) => entry.action === 'ACCOUNT_STATUS_CHANGE').at(-1);
    assert.equal(restoreAudit.severity, 'Info');
    assert.match(restoreAudit.details, /active/);
    assert.match(restoreAudit.details, /anna@example.test/);
    const oldSession = await run(protect, {
      method: 'GET',
      originalUrl: '/api/v1/students/profile',
      url: '/api/v1/students/profile',
      headers: { authorization: `Bearer ${annaToken}` },
      cookies: {},
    });
    assert.equal(oldSession.nextCalled, false);
    const replacement = await invoke(login, {
      body: { email: anna.email, password: 'secret123' },
      headers: {},
      ip: '127.0.0.1',
    });
    assert.equal(replacement.statusCode, 200);
    const replacementAccess = await run(protect, {
      method: 'GET',
      originalUrl: '/api/v1/students/profile',
      url: '/api/v1/students/profile',
      headers: { authorization: `Bearer ${replacement.body.token}` },
      cookies: {},
    });
    assert.equal(replacementAccess.nextCalled, true);
    const studentGate = await run(authorize('student'), replacementAccess.req);
    assert.equal(studentGate.nextCalled, true);

    await requestJson(server, '/api/v1/admin/users/provider-north/status', {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'active' },
    });
    assert.equal(provider.status, 'active');
    assertPreserved();

    const saveCountBeforeSelf = admin.saveCount;
    const selfChange = await withExpectedConsoleErrors(
      () => requestJson(server, '/api/v1/admin/users/admin-1/status', {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'suspended' },
      }),
      isValidationLog
    );
    assert.equal(selfChange.status, 403);
    assert.equal(admin.status, 'active');
    assert.equal(admin.saveCount, saveCountBeforeSelf);

    const saveCountBeforePeer = peerAdmin.saveCount;
    const peerChange = await withExpectedConsoleErrors(
      () => requestJson(server, '/api/v1/admin/users/admin-2/status', {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'suspended' },
      }),
      isValidationLog
    );
    assert.equal(peerChange.status, 403);
    assert.equal(peerAdmin.status, 'active');
    assert.equal(peerAdmin.saveCount, saveCountBeforePeer);

    const superChange = await requestJson(server, '/api/v1/admin/users/admin-2/status', {
      method: 'PATCH',
      token: superadminToken,
      body: { status: 'suspended' },
    });
    assert.equal(superChange.status, 200);
    assert.equal(peerAdmin.status, 'suspended');
    await requestJson(server, '/api/v1/admin/users/admin-2/status', {
      method: 'PATCH',
      token: superadminToken,
      body: { status: 'active' },
    });
    assert.equal(peerAdmin.status, 'active');

    const saveCountBeforeConsent = anna.saveCount;
    const consentChange = await withExpectedConsoleErrors(
      () => requestJson(server, '/api/v1/admin/users/student-anna/status', {
        method: 'PATCH',
        token: superadminToken,
        body: { status: 'pending_consent' },
      }),
      isValidationLog
    );
    assert.equal(consentChange.status, 400);
    assert.match(consentChange.body.error, /pending consent/i);
    assert.equal(anna.status, 'active');
    assert.equal(anna.saveCount, saveCountBeforeConsent);
    assertPreserved();

    console.log('admin user management tests passed');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
