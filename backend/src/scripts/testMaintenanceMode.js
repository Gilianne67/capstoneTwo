/**
 * Maintenance mode blocks student and provider API access.
 * Model methods are stand-ins. This does not open a database connection.
 */
const assert = require('assert');
const express = require('express');
const jwt = require('jsonwebtoken');
const Module = require('module');
const cookieParser = require('cookie-parser');

process.env.JWT_SECRET = 'maintenance-mode-test-secret';

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
  on() {},
});

const audits = [];
install('../controllers/auditController', {
  async recordAuditLog(entry) {
    audits.push(entry);
    return { ok: true };
  },
  withAuditWarning(body) {
    return body;
  },
});

const User = require('../models/User');
const Provider = require('../models/Provider');
const SystemConfig = require('../models/SystemConfig');
const tokenService = require('../services/tokenService');
const { protect, authorize } = require('../middleware/auth');
const {
  MAINTENANCE_CODE,
  MAINTENANCE_MESSAGE,
  isMaintenanceExempt,
  enforceMaintenanceMode,
} = require('../middleware/maintenanceMode');
const adminRoutes = require('../routes/adminRoutes');
const errorHandler = require('../middleware/error');

const changedAt = new Date('2026-06-01T00:00:00.000Z');
const users = new Map([
  ['student-1', { _id: 'student-1', role: 'student', status: 'active', email: 'student@example.test', name: 'Ana' }],
  ['provider-1', { _id: 'provider-1', role: 'provider', status: 'active', email: 'provider@example.test', name: 'North' }],
  ['admin-1', {
    _id: 'admin-1',
    role: 'admin',
    status: 'active',
    email: 'admin@example.test',
    name: 'Ada',
    passwordChangedAt: changedAt,
  }],
  ['super-1', { _id: 'super-1', role: 'superadmin', status: 'active', email: 'super@example.test', name: 'Root' }],
  ['legacy-super', { _id: 'legacy-super', role: 'super_admin', status: 'active', email: 'legacy@example.test', name: 'Legacy' }],
  ['hyphen-super', { _id: 'hyphen-super', role: 'super-admin', status: 'active', email: 'hyphen@example.test', name: 'Hyphen' }],
  ['suspended-admin', { _id: 'suspended-admin', role: 'admin', status: 'suspended', email: 'suspended@example.test', name: 'Paused' }],
  ['imposter', { _id: 'imposter', role: 'student', status: 'active', email: 'imposter@example.test', name: 'Imposter' }],
  ['stale-admin', {
    _id: 'stale-admin',
    role: 'admin',
    status: 'active',
    email: 'stale@example.test',
    name: 'Stale',
    passwordChangedAt: changedAt,
  }],
]);

const config = {
  maintenanceMode: false,
  retainedSetting: 'keep-me',
  saved: false,
  async save() {
    this.saved = true;
    return this;
  },
};

let failConfig = false;
const configQuery = () => ({
  select() { return this; },
  lean() { return Promise.resolve({ maintenanceMode: config.maintenanceMode }); },
  then(resolve, reject) {
    return Promise.resolve(config).then(resolve, reject);
  },
});

SystemConfig.findOne = () => {
  if (failConfig) throw new Error('config unavailable');
  return configQuery();
};

User.findById = (id) => ({
  select() {
    return Promise.resolve(users.get(String(id)) || null);
  },
});

Provider.findOne = () => ({
  select() {
    return Promise.resolve(null);
  },
});

const revoked = new Set();
tokenService.isTokenBlacklisted = async (token) => revoked.has(token);

const sign = (id, extra = {}) => jwt.sign(
  { id, ...extra },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

const adminToken = sign('admin-1', { role: 'student', passwordChangedAt: changedAt.getTime() });
const superToken = sign('super-1', { role: 'superadmin' });
const legacyToken = sign('legacy-super', { role: 'super_admin' });
const hyphenToken = sign('hyphen-super', { role: 'super-admin' });
const studentToken = sign('student-1', { role: 'admin' });
const providerToken = sign('provider-1', { role: 'provider' });
const suspendedToken = sign('suspended-admin', { role: 'admin' });
const imposterToken = sign('imposter', { role: 'admin' });
const staleToken = sign('stale-admin', { role: 'admin' });
const revokedToken = sign('admin-1', { role: 'admin', passwordChangedAt: changedAt.getTime() });
revoked.add(revokedToken);

const hits = {
  student: 0,
  provider: 0,
  register: 0,
  login: 0,
  logout: 0,
  forgot: 0,
  reset: 0,
  me: 0,
};

const startServer = () => new Promise((resolve) => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(enforceMaintenanceMode);
  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  });
  app.get('/', (req, res) => {
    res.status(200).json({ status: 'success', message: 'IskolarMatch API Online' });
  });
  app.get('/api/v1/health', (req, res) => {
    res.status(200).json({ status: 'success', message: 'IskolarMatch API Online' });
  });
  app.post('/api/v1/auth/login', (req, res) => {
    hits.login += 1;
    res.status(200).json({ success: true, message: 'Login successful' });
  });
  app.get('/api/v1/auth/login', (req, res) => {
    hits.login += 1;
    res.status(200).json({ success: true, data: { gpa: 'private-gpa' } });
  });
  app.post('/api/v1/auth/register', (req, res) => {
    hits.register += 1;
    res.status(201).json({ success: true, data: { email: 'new@student.test' } });
  });
  app.get('/api/v1/auth/logout', protect, (req, res) => {
    hits.logout += 1;
    res.status(200).json({ success: true, message: 'User logged out successfully' });
  });
  app.post('/api/v1/auth/forgotpassword', (req, res) => {
    hits.forgot += 1;
    res.status(200).json({
      success: true,
      message: 'If an account exists with that email, password reset instructions have been dispatched.',
    });
  });
  app.put('/api/v1/auth/resetpassword/:resettoken', (req, res) => {
    hits.reset += 1;
    res.status(200).json({ success: true, message: 'Password reset successful and account unlocked.' });
  });
  app.get('/api/v1/auth/me', protect, (req, res) => {
    hits.me += 1;
    res.status(200).json({ success: true, data: { id: req.user._id, role: req.user.role, email: req.user.email } });
  });
  app.get('/api/v1/students/profile', protect, authorize('student'), (req, res) => {
    hits.student += 1;
    res.status(200).json({ success: true, data: { gpa: 'private-gpa' } });
  });
  app.get('/api/v1/provider/profile', protect, authorize('provider'), (req, res) => {
    hits.provider += 1;
    res.status(200).json({ success: true, data: { bankAccount: 'provider-secret' } });
  });
  app.use('/api/v1/admin', adminRoutes);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
});

const requestJson = async (server, path, { method = 'GET', token, cookie, body } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let parsed = {};
  if (text) parsed = JSON.parse(text);
  return { status: response.status, body: parsed };
};

const assertNoProtectedData = (result) => {
  const text = JSON.stringify(result.body);
  assert.equal(text.includes('private-gpa'), false);
  assert.equal(text.includes('provider-secret'), false);
  assert.equal(text.includes('retainedSetting'), false);
  assert.equal(text.includes('keep-me'), false);
  assert.equal(text.includes('student@example.test'), false);
  assert.equal(result.body.data, undefined);
};

const assertMaintenance = (result) => {
  assert.equal(result.status, 503);
  assert.equal(result.body.success, false);
  assert.equal(result.body.code, MAINTENANCE_CODE);
  assert.equal(result.body.message, MAINTENANCE_MESSAGE);
  assert.equal(result.body.error, MAINTENANCE_MESSAGE);
  assertNoProtectedData(result);
};

const run = async () => {
  assert.equal(isMaintenanceExempt('GET', '/'), true);
  assert.equal(isMaintenanceExempt('GET', '/api/v1/health'), true);
  assert.equal(isMaintenanceExempt('GET', '/api/v1/health/'), true);
  assert.equal(isMaintenanceExempt('POST', '/api/v1/auth/login'), true);
  assert.equal(isMaintenanceExempt('POST', '/api/v1/auth/login?next=/dashboard'), true);
  assert.equal(isMaintenanceExempt('GET', '/api/v1/auth/login'), false);
  assert.equal(isMaintenanceExempt('GET', '/api/v1/auth/logout'), true);
  assert.equal(isMaintenanceExempt('POST', '/api/v1/auth/logout'), false);
  assert.equal(isMaintenanceExempt('POST', '/api/v1/auth/forgotpassword'), true);
  assert.equal(isMaintenanceExempt('PUT', '/api/v1/auth/resetpassword/abc'), true);
  assert.equal(isMaintenanceExempt('GET', '/api/v1/auth/resetpassword/abc'), false);
  assert.equal(isMaintenanceExempt('POST', '/api/v1/auth/register'), false);
  assert.equal(isMaintenanceExempt('GET', '/api/v1/auth/me'), false);
  assert.equal(isMaintenanceExempt('GET', '/api/v1/admin/config'), false);
  assert.equal(isMaintenanceExempt('PUT', '/api/v1/admin/config'), false);
  assert.equal(isMaintenanceExempt('GET', '/api/v1/students/profile'), false);
  assert.equal(isMaintenanceExempt('OPTIONS', '/api/v1/students/profile'), true);

  const server = await startServer();
  try {
    const studentOpen = await requestJson(server, '/api/v1/students/profile', { token: studentToken });
    assert.equal(studentOpen.status, 200);
    assert.equal(studentOpen.body.data.gpa, 'private-gpa');

    const providerOpen = await requestJson(server, '/api/v1/provider/profile', { token: providerToken });
    assert.equal(providerOpen.status, 200);
    assert.equal(providerOpen.body.data.bankAccount, 'provider-secret');

    const adminOpen = await requestJson(server, '/api/v1/admin/config', { token: adminToken });
    assert.equal(adminOpen.status, 200);
    assert.equal(adminOpen.body.data.maintenanceMode, false);
    assert.equal(adminOpen.body.data.retainedSetting, 'keep-me');

    const anonymousOpen = await requestJson(server, '/api/v1/students/profile');
    assert.equal(anonymousOpen.status, 401);
    assertNoProtectedData(anonymousOpen);

    const studentAdminOpen = await requestJson(server, '/api/v1/admin/config', { token: studentToken });
    assert.equal(studentAdminOpen.status, 403);
    assertNoProtectedData(studentAdminOpen);

    config.maintenanceMode = 'true';
    const stringFlag = await requestJson(server, '/api/v1/students/profile', { token: studentToken });
    assert.equal(stringFlag.status, 200);
    assert.equal(stringFlag.body.data.gpa, 'private-gpa');

    config.maintenanceMode = true;
    const studentHits = hits.student;
    const providerHits = hits.provider;
    const registerHits = hits.register;
    const meHits = hits.me;

    assertMaintenance(await requestJson(server, '/api/v1/students/profile', { token: studentToken }));
    assertMaintenance(await requestJson(server, '/api/v1/provider/profile', { token: providerToken }));
    assertMaintenance(await requestJson(server, '/api/v1/students/profile'));
    assertMaintenance(await requestJson(server, '/api/v1/admin/config'));
    assertMaintenance(await requestJson(server, '/api/v1/admin/config', { token: studentToken }));
    assertMaintenance(await requestJson(server, '/api/v1/admin/config', { token: providerToken }));
    assertMaintenance(await requestJson(server, '/api/v1/auth/me', { token: studentToken }));
    assertMaintenance(await requestJson(server, '/api/v1/auth/register', { method: 'POST', body: { email: 'new@student.test' } }));
    assertMaintenance(await requestJson(server, '/api/v1/auth/login'));
    assertMaintenance(await requestJson(server, '/api/v1/admin/config', { token: imposterToken }));
    assertMaintenance(await requestJson(server, '/api/v1/admin/config', { token: suspendedToken }));
    assertMaintenance(await requestJson(server, '/api/v1/admin/config', { token: staleToken }));
    assertMaintenance(await requestJson(server, '/api/v1/admin/config', { token: revokedToken }));
    assert.equal(hits.student, studentHits);
    assert.equal(hits.provider, providerHits);
    assert.equal(hits.register, registerHits);
    assert.equal(hits.me, meHits);

    const adminRead = await requestJson(server, '/api/v1/admin/config', { token: adminToken });
    assert.equal(adminRead.status, 200);
    assert.equal(adminRead.body.data.maintenanceMode, true);
    assert.equal(adminRead.body.data.retainedSetting, 'keep-me');

    const cookieRead = await requestJson(server, '/api/v1/admin/config', { cookie: `token=${adminToken}` });
    assert.equal(cookieRead.status, 200);
    assert.equal(cookieRead.body.data.maintenanceMode, true);

    const superRead = await requestJson(server, '/api/v1/admin/config', { token: superToken });
    assert.equal(superRead.status, 200);
    const legacyRead = await requestJson(server, '/api/v1/admin/config', { token: legacyToken });
    assert.equal(legacyRead.status, 200);
    const hyphenRead = await requestJson(server, '/api/v1/admin/config', { token: hyphenToken });
    assert.equal(hyphenRead.status, 200);
    assert.equal(hyphenRead.body.data.maintenanceMode, true);

    const adminMe = await requestJson(server, '/api/v1/auth/me', { token: adminToken });
    assert.equal(adminMe.status, 200);
    assert.equal(adminMe.body.data.role, 'admin');
    assert.equal(adminMe.body.data.email, 'admin@example.test');

    const health = await requestJson(server, '/api/v1/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.message, 'IskolarMatch API Online');
    const root = await requestJson(server, '/');
    assert.equal(root.status, 200);
    assert.equal(root.body.message, 'IskolarMatch API Online');

    const login = await requestJson(server, '/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'student@example.test', password: 'not-used' },
    });
    assert.equal(login.status, 200);
    assert.equal(login.body.message, 'Login successful');
    assert.equal(hits.login, 1);

    const logout = await requestJson(server, '/api/v1/auth/logout', { token: studentToken });
    assert.equal(logout.status, 200);
    assert.equal(logout.body.message, 'User logged out successfully');
    assert.equal(hits.logout, 1);
    const anonymousLogout = await requestJson(server, '/api/v1/auth/logout');
    assert.equal(anonymousLogout.status, 401);
    assert.equal(hits.logout, 1);

    const forgot = await requestJson(server, '/api/v1/auth/forgotpassword', {
      method: 'POST',
      body: { email: 'student@example.test' },
    });
    assert.equal(forgot.status, 200);
    assert.equal(hits.forgot, 1);
    const reset = await requestJson(server, '/api/v1/auth/resetpassword/one-time-token', {
      method: 'PUT',
      body: { password: 'a-new-password-value' },
    });
    assert.equal(reset.status, 200);
    assert.equal(hits.reset, 1);
    assert.equal(JSON.stringify(reset.body).includes('a-new-password-value'), false);

    const preflight = await requestJson(server, '/api/v1/students/profile', { method: 'OPTIONS' });
    assert.equal(preflight.status, 204);

    const turnedOff = await requestJson(server, '/api/v1/admin/config', {
      method: 'PUT',
      token: adminToken,
      body: { maintenanceMode: false, unrelated: 'do-not-store' },
    });
    assert.equal(turnedOff.status, 200);
    assert.equal(turnedOff.body.success, true);
    assert.equal(turnedOff.body.data.maintenanceMode, false);
    assert.equal(turnedOff.body.data.retainedSetting, 'keep-me');
    assert.equal(config.saved, true);
    assert.equal(config.retainedSetting, 'keep-me');
    assert.equal(config.unrelated, undefined);
    assert.equal(audits.at(-1).action, 'SYSTEM_CONFIG_UPDATED');
    assert.equal(audits.at(-1).details, 'Updated settings: maintenanceMode=false');

    const restored = await requestJson(server, '/api/v1/students/profile', { token: studentToken });
    assert.equal(restored.status, 200);
    assert.equal(restored.body.data.gpa, 'private-gpa');
    const providerRestored = await requestJson(server, '/api/v1/provider/profile', { token: providerToken });
    assert.equal(providerRestored.status, 200);
    assert.equal(providerRestored.body.data.bankAccount, 'provider-secret');

    config.maintenanceMode = true;
    assertMaintenance(await requestJson(server, '/api/v1/provider/profile', { token: providerToken }));
    const superOff = await requestJson(server, '/api/v1/admin/config', {
      method: 'PUT',
      token: superToken,
      body: { maintenanceMode: false },
    });
    assert.equal(superOff.status, 200);
    assert.equal(superOff.body.data.maintenanceMode, false);
    assert.equal(superOff.body.data.retainedSetting, 'keep-me');
    assert.equal(config.retainedSetting, 'keep-me');
    const restoredAgain = await requestJson(server, '/api/v1/students/profile', { token: studentToken });
    assert.equal(restoredAgain.status, 200);
    assert.equal(restoredAgain.body.data.gpa, 'private-gpa');

    config.maintenanceMode = true;
    failConfig = true;
    const healthWhileConfigDown = await requestJson(server, '/api/v1/health');
    assert.equal(healthWhileConfigDown.status, 200);
    const failedRead = await requestJson(server, '/api/v1/students/profile', { token: studentToken });
    assert.equal(failedRead.status, 503);
    assert.equal(failedRead.body.code, undefined);
    assert.equal(failedRead.body.message, 'System configuration could not be read. Please try again shortly.');
    assert.equal(JSON.stringify(failedRead.body).includes('private-gpa'), false);
    assert.equal(JSON.stringify(failedRead.body).includes('config unavailable'), false);
    failConfig = false;
    config.maintenanceMode = false;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log('maintenance mode tests passed');
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
