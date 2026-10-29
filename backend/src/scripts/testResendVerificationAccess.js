const assert = require('assert');
const jwt = require('jsonwebtoken');
const { installMemoryRevocationStore } = require('./revocationStoreStub');

installMemoryRevocationStore();

const User = require('../models/User');
const Provider = require('../models/Provider');
const emailService = require('../utils/emailService');
const { protect } = require('../middleware/auth');
const authRoutes = require('../routes/authRoutes');
const { resendVerification, updateUnverifiedEmail } = require('../controllers/authController');

const secret = process.env.JWT_SECRET || 'fallback_secret';
const users = new Map();
const lookups = [];
const sent = [];

const queryResult = (value) => {
  const promise = Promise.resolve(value);
  promise.select = () => Promise.resolve(value);
  return promise;
};

const makeUser = (id, email, extra = {}) => {
  const user = {
    _id: id,
    id,
    role: 'student',
    status: 'active',
    name: 'Test User',
    email,
    isVerified: false,
    emailVerificationToken: `token-${id}`,
    emailVerificationExpire: new Date(Date.now() - 1000),
    ...extra,
    async matchPassword(password) {
      return password === 'correct-password';
    },
    async save() {
      return this;
    },
  };
  users.set(id, user);
  return user;
};

User.findById = (id) => queryResult(users.get(String(id)) || null);
User.findOne = (query) => {
  lookups.push(query);
  if (query && query.email) {
    const match = [...users.values()].find((user) => user.email === query.email) || null;
    return queryResult(match);
  }
  return queryResult(null);
};
User.findOneAndUpdate = async (filter, update) => {
  const user = users.get(String(filter._id));
  if (!user) return null;
  if (filter.isVerified && filter.isVerified.$ne === true && user.isVerified) return null;
  if (update && update.$set) Object.assign(user, update.$set);
  return user;
};
Provider.findOne = () => queryResult(null);
emailService.sendVerificationEmail = async (email, name, verifyUrl) => {
  sent.push({ email, name, verifyUrl });
};

const userA = makeUser('user-a', 'a@example.com');
const userB = makeUser('user-b', 'b@example.com', { isVerified: true, emailVerificationToken: 'b-token' });

const sign = (id, extra = {}) => jwt.sign({ id, ...extra }, secret);

const invoke = async (handlers, req) => {
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
  const pending = [];
  let index = 0;
  const next = (err) => {
    if (err) {
      res.statusCode = err.statusCode || 500;
      res.body = { success: false, message: err.message, code: err.code };
      return;
    }
    const handler = handlers[index];
    index += 1;
    if (!handler) return;
    pending.push(Promise.resolve(handler(req, res, next)));
  };
  next();
  while (pending.length) {
    const batch = pending.splice(0, pending.length);
    await Promise.all(batch);
  }
  return res;
};

const routeHandlers = (method, routePath) => {
  const layer = authRoutes.stack.find(
    (entry) => entry.route && entry.route.path === routePath && entry.route.methods[method]
  );
  assert.ok(layer, `${method.toUpperCase()} ${routePath} route is missing`);
  return layer.route.stack.map((entry) => entry.handle);
};

const snapshot = (user) => ({
  email: user.email,
  isVerified: user.isVerified,
  emailVerificationToken: user.emailVerificationToken,
});

const main = async () => {
  const resendHandlers = routeHandlers('post', '/resend-verification');
  const updateHandlers = routeHandlers('put', '/update-unverified-email');
  assert.ok(!resendHandlers.some((handler) => handler.name === 'protect'));
  assert.ok(updateHandlers.some((handler) => handler.name === 'protect'));
  assert.equal(resendHandlers.at(-1), resendVerification);
  assert.equal(updateHandlers.at(-1), updateUnverifiedEmail);

  const beforeA = snapshot(userA);
  const beforeB = snapshot(userB);
  const anonymous = await invoke([protect, updateUnverifiedEmail], {
    headers: {},
    body: { oldEmail: userB.email, newEmail: 'taken-over@example.com', password: 'correct-password' },
    ip: '127.0.0.1',
  });
  assert.equal(anonymous.statusCode, 401);
  assert.deepEqual(snapshot(userA), beforeA);
  assert.deepEqual(snapshot(userB), beforeB);

  const invalid = await invoke([protect, updateUnverifiedEmail], {
    headers: { authorization: 'Bearer not-a-token' },
    body: { oldEmail: userA.email, newEmail: 'taken-over@example.com', password: 'correct-password' },
    ip: '127.0.0.1',
  });
  assert.equal(invalid.statusCode, 401);
  assert.equal(invalid.body.code, 'SESSION_REVOKED');
  assert.deepEqual(snapshot(userA), beforeA);

  const expired = await invoke([protect, updateUnverifiedEmail], {
    headers: {
      authorization: `Bearer ${jwt.sign({ id: 'user-a', exp: Math.floor(Date.now() / 1000) - 60 }, secret)}`,
    },
    body: { oldEmail: userB.email, newEmail: 'taken-over@example.com', password: 'correct-password' },
    ip: '127.0.0.1',
  });
  assert.equal(expired.statusCode, 401);
  assert.equal(expired.body.code, 'SESSION_REVOKED');
  assert.deepEqual(snapshot(userA), beforeA);
  assert.deepEqual(snapshot(userB), beforeB);

  lookups.length = 0;
  const noSession = await invoke([updateUnverifiedEmail], {
    body: { oldEmail: userB.email, newEmail: 'replacement@example.com', password: 'correct-password' },
    headers: {},
    ip: '127.0.0.1',
  });
  assert.equal(noSession.statusCode, 401);
  assert.equal(lookups.length, 0);
  assert.deepEqual(snapshot(userB), beforeB);

  const ownUpdate = await invoke([protect, updateUnverifiedEmail], {
    headers: { authorization: `Bearer ${sign('user-a')}` },
    body: {
      oldEmail: userB.email,
      newEmail: 'Replacement@Example.com',
      password: 'correct-password',
      userId: 'user-b',
    },
    ip: '127.0.0.1',
  });
  assert.equal(ownUpdate.statusCode, 200);
  assert.equal(ownUpdate.body.email, 'replacement@example.com');
  assert.equal(userA.email, 'replacement@example.com');
  assert.equal(userA.isVerified, false);
  assert.equal(userB.email, 'b@example.com');
  assert.equal(userB.isVerified, true);
  assert.equal(userB.emailVerificationToken, 'b-token');
  assert.equal(sent.at(-1).email, 'replacement@example.com');

  const conflict = await invoke([protect, updateUnverifiedEmail], {
    headers: { authorization: `Bearer ${sign('user-a')}` },
    body: { oldEmail: userA.email, newEmail: 'B@Example.com', password: 'correct-password' },
    ip: '127.0.0.1',
  });
  assert.equal(conflict.statusCode, 400);
  assert.equal(userA.email, 'replacement@example.com');
  assert.equal(userB.email, 'b@example.com');
  assert.equal(userB.isVerified, true);

  const wrongPassword = await invoke([protect, updateUnverifiedEmail], {
    headers: { authorization: `Bearer ${sign('user-a')}` },
    body: { newEmail: 'another@example.com', password: 'wrong-password' },
    ip: '127.0.0.1',
  });
  assert.equal(wrongPassword.statusCode, 401);
  assert.equal(userA.email, 'replacement@example.com');

  const verifiedUpdate = await invoke([protect, updateUnverifiedEmail], {
    headers: { authorization: `Bearer ${sign('user-b')}` },
    body: { oldEmail: userA.email, newEmail: 'changed-b@example.com', password: 'correct-password' },
    ip: '127.0.0.1',
  });
  assert.equal(verifiedUpdate.statusCode, 400);
  assert.equal(userB.email, 'b@example.com');
  assert.equal(userB.isVerified, true);

  const sentBefore = sent.length;
  const unknown = await invoke([resendVerification], {
    body: { email: 'nobody@example.com' },
    ip: '127.0.0.1',
  });
  const verifiedResend = await invoke([resendVerification], {
    body: { email: 'b@example.com' },
    ip: '127.0.0.1',
  });
  assert.equal(unknown.statusCode, 200);
  assert.equal(verifiedResend.statusCode, 200);
  assert.equal(unknown.body.message, verifiedResend.body.message);
  assert.match(unknown.body.message, /unverified account exists/i);
  assert.equal(sent.length, sentBefore);
  assert.equal(userB.isVerified, true);
  assert.equal(userB.emailVerificationToken, 'b-token');
  assert.equal(userA.email, 'replacement@example.com');

  const unverified = makeUser('user-c', 'c@example.com');
  const resent = await invoke([resendVerification], {
    body: { email: 'C@Example.com' },
    ip: '127.0.0.1',
  });
  assert.equal(resent.statusCode, 200);
  assert.equal(resent.body.message, unknown.body.message);
  assert.notEqual(unverified.emailVerificationToken, 'token-user-c');
  assert.equal(unverified.isVerified, false);
  assert.equal(sent.at(-1).email, 'c@example.com');
  assert.equal(userA.email, 'replacement@example.com');
  assert.equal(userB.email, 'b@example.com');
  assert.equal(userB.isVerified, true);

  console.log('resend verification access tests passed');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
