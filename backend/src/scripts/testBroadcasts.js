/**
 * Announcement dispatch, audience filtering, schedule, and expiration.
 * Uses an in-memory Broadcast stand-in. Does not connect to MongoDB.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const mongoose = require('mongoose');

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

const store = new Map();
let failCreate = false;
let failFind = false;
let failSave = false;

const matches = (doc, query) => {
  if (!query) return true;
  return Object.entries(query).every(([key, expected]) => {
    const value = doc[key];
    if (
      expected
      && typeof expected === 'object'
      && !(expected instanceof Date)
      && !Array.isArray(expected)
    ) {
      if (Object.prototype.hasOwnProperty.call(expected, '$ne') && value === expected.$ne) return false;
      if (expected.$in && !expected.$in.includes(value)) return false;
      if (Object.prototype.hasOwnProperty.call(expected, '$lt')) {
        return new Date(value).getTime() < new Date(expected.$lt).getTime();
      }
      if (Object.prototype.hasOwnProperty.call(expected, '$lte')) {
        return new Date(value).getTime() <= new Date(expected.$lte).getTime();
      }
      if (Object.prototype.hasOwnProperty.call(expected, '$gte')) {
        return new Date(value).getTime() >= new Date(expected.$gte).getTime();
      }
      return true;
    }
    return value === expected;
  });
};

const clone = (doc) => ({
  _id: doc._id,
  title: doc.title,
  message: doc.message,
  target: doc.target,
  priority: doc.priority,
  startDate: doc.startDate,
  expiresAt: doc.expiresAt,
  status: doc.status,
  createdBy: doc.createdBy,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const Broadcast = {
  find(query) {
    if (failFind) return Promise.reject(new Error('database unavailable'));
    const rows = [...store.values()].filter((doc) => matches(doc, query)).map(clone);
    const chain = {
      sort() { return chain; },
      populate() { return Promise.resolve(rows); },
      then(resolve, reject) { return Promise.resolve(rows).then(resolve, reject); },
    };
    return chain;
  },
  async create(data) {
    if (failCreate) {
      const error = new Error('database unavailable');
      error.name = 'MongoServerError';
      throw error;
    }
    const now = new Date();
    const doc = {
      _id: new mongoose.Types.ObjectId().toString(),
      status: 'Active',
      createdAt: now,
      updatedAt: now,
      ...data,
    };
    store.set(doc._id, doc);
    return clone(doc);
  },
  async updateMany(filter, update) {
    let modifiedCount = 0;
    for (const doc of store.values()) {
      if (!matches(doc, filter)) continue;
      Object.assign(doc, update.$set || {});
      modifiedCount += 1;
    }
    return { modifiedCount };
  },
  async findById(id) {
    const doc = store.get(String(id));
    if (!doc) return null;
    return {
      ...clone(doc),
      async save() {
        if (failSave) throw new Error('database unavailable');
        const current = store.get(String(this._id));
        if (!current) throw new Error('missing broadcast');
        current.status = this.status;
        current.title = this.title;
        current.updatedAt = new Date();
        return this;
      },
    };
  },
};

install('../models/Broadcast', Broadcast);

const { authorize } = require('../middleware/auth');
const {
  getBroadcasts,
  getActiveUserBroadcasts,
  createBroadcast,
  revokeBroadcast,
} = require('../controllers/broadcastController');
const broadcastRouter = require('../routes/broadcastRoutes');

const invoke = (handler, req) => new Promise((resolve, reject) => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
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
    resolve({ statusCode: 500, body: { message: error.message }, nextCalled: false });
  })).catch(reject);
});

const admin = {
  _id: new mongoose.Types.ObjectId().toString(),
  role: 'admin',
  name: 'Ada Admin',
  email: 'ada@example.com',
};
const superadmin = {
  _id: new mongoose.Types.ObjectId().toString(),
  role: 'super_admin',
  name: 'Sam Super',
  email: 'sam@example.com',
};
const student = {
  _id: new mongoose.Types.ObjectId().toString(),
  role: 'student',
  name: 'Stu Dent',
};
const provider = {
  _id: new mongoose.Types.ObjectId().toString(),
  role: 'provider',
  name: 'Grant Org',
};

const hoursFromNow = (amount) => new Date(Date.now() + amount * 60 * 60 * 1000).toISOString();

const futureBody = (overrides = {}) => ({
  title: 'Portal maintenance',
  message: 'The portal will be unavailable tonight.',
  target: 'All Users',
  priority: 'Info',
  expiresAt: hoursFromNow(24),
  ...overrides,
});

const titles = (result) => result.body.broadcasts.map((item) => item.title);

const insert = (fields) => {
  const doc = {
    _id: new mongoose.Types.ObjectId().toString(),
    title: 'Inserted',
    message: 'Inserted message',
    target: 'All Users',
    priority: 'Info',
    status: 'Active',
    startDate: new Date(Date.now() - 60 * 60 * 1000),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    createdBy: admin._id,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...fields,
  };
  store.set(doc._id, doc);
  return doc;
};

const run = async () => {
  const serverSource = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  assert.match(
    serverSource,
    /app\.get\('\/api\/v1\/broadcasts\/active',\s*protect,\s*getActiveUserBroadcasts\)/
  );

  const layerNames = broadcastRouter.stack.map((layer) => layer.handle?.name || layer.name);
  assert.ok(layerNames.includes('protect'), layerNames.join(','));
  assert.ok(layerNames.includes('authorizeRequest'), layerNames.join(','));

  const protectLayer = broadcastRouter.stack.find((layer) => layer.handle?.name === 'protect');
  const authorizeLayer = broadcastRouter.stack.find((layer) => layer.handle?.name === 'authorizeRequest');
  assert.equal(authorize('admin', 'super_admin').name, 'authorizeRequest');

  const anonymous = await invoke(protectLayer.handle, { headers: {}, method: 'POST', originalUrl: '/api/v1/admin/broadcast' });
  assert.equal(anonymous.statusCode, 401);

  const studentDenied = await invoke(authorizeLayer.handle, { user: student, headers: {} });
  assert.equal(studentDenied.statusCode, 403);
  assert.notEqual(studentDenied.nextCalled, true);

  const providerDenied = await invoke(authorizeLayer.handle, { user: provider, headers: {} });
  assert.equal(providerDenied.statusCode, 403);

  const adminAllowed = await invoke(authorizeLayer.handle, { user: admin, headers: {} });
  assert.equal(adminAllowed.nextCalled, true);

  const superAllowed = await invoke(authorizeLayer.handle, { user: superadmin, headers: {} });
  assert.equal(superAllowed.nextCalled, true);

  const studentCreate = await invoke(createBroadcast, {
    user: student,
    body: futureBody({ title: 'Student should not send this' }),
    headers: {},
  });
  assert.equal(studentCreate.statusCode, 403);
  assert.equal(studentCreate.body.success, false);
  assert.equal(store.size, 0);

  const providerCreate = await invoke(createBroadcast, {
    user: provider,
    body: futureBody({ title: 'Provider should not send this' }),
    headers: {},
  });
  assert.equal(providerCreate.statusCode, 403);
  assert.equal(store.size, 0);

  const missing = await invoke(createBroadcast, {
    user: admin,
    body: { target: 'All Users', priority: 'Info' },
    headers: {},
  });
  assert.equal(missing.statusCode, 400);
  assert.match(missing.body.message, /required/i);
  assert.equal(store.size, 0);

  const blankTitle = await invoke(createBroadcast, {
    user: admin,
    body: futureBody({ title: '   ' }),
    headers: {},
  });
  assert.equal(blankTitle.statusCode, 400);
  assert.equal(store.size, 0);

  const badAudience = await invoke(createBroadcast, {
    user: admin,
    body: futureBody({ target: 'Everyone' }),
    headers: {},
  });
  assert.equal(badAudience.statusCode, 400);
  assert.match(badAudience.body.message, /audience/i);

  const badPriority = await invoke(createBroadcast, {
    user: admin,
    body: futureBody({ priority: 'Critical' }),
    headers: {},
  });
  assert.equal(badPriority.statusCode, 400);
  assert.match(badPriority.body.message, /priority/i);

  const badDate = await invoke(createBroadcast, {
    user: admin,
    body: futureBody({ expiresAt: 'not-a-date' }),
    headers: {},
  });
  assert.equal(badDate.statusCode, 400);
  assert.match(badDate.body.message, /expiration/i);

  const invertedRange = await invoke(createBroadcast, {
    user: admin,
    body: futureBody({
      startDate: hoursFromNow(48),
      expiresAt: hoursFromNow(24),
    }),
    headers: {},
  });
  assert.equal(invertedRange.statusCode, 400);
  assert.match(invertedRange.body.message, /after the start date/i);
  assert.equal(store.size, 0);

  const alreadyExpired = await invoke(createBroadcast, {
    user: admin,
    body: futureBody({
      startDate: hoursFromNow(-48),
      expiresAt: hoursFromNow(-1),
    }),
    headers: {},
  });
  assert.equal(alreadyExpired.statusCode, 400);
  assert.match(alreadyExpired.body.message, /in the future/i);
  assert.equal(store.size, 0);

  const created = await invoke(createBroadcast, {
    user: admin,
    body: futureBody({
      title: '  Live info  ',
      message: '  Visible now  ',
      priority: 'Info',
      target: 'All Users',
    }),
    headers: {},
  });
  assert.equal(created.statusCode, 201, JSON.stringify(created.body));
  assert.equal(created.body.success, true);
  assert.equal(created.body.broadcast.priority, 'Info');
  assert.equal(created.body.broadcast.target, 'All Users');
  assert.equal(created.body.broadcast.title, 'Live info');
  assert.equal(created.body.broadcast.message, 'Visible now');
  assert.equal(created.body.broadcast.phase, 'live');
  assert.doesNotMatch(created.body.message, /email|push|every user/i);
  assert.equal(store.has(created.body.broadcast._id), true);

  const reloaded = await invoke(getBroadcasts, { user: admin, headers: {} });
  assert.equal(reloaded.statusCode, 200);
  assert.equal(reloaded.body.broadcasts.length, 1);
  assert.equal(reloaded.body.broadcasts[0]._id, created.body.broadcast._id);
  assert.equal(reloaded.body.broadcasts[0].title, 'Live info');
  assert.equal(reloaded.body.broadcasts[0].priority, 'Info');
  assert.equal(reloaded.body.activeCount, 1);
  assert.equal(reloaded.body.count, reloaded.body.broadcasts.filter((item) => item.isCurrentlyActive).length);

  await invoke(createBroadcast, {
    user: admin,
    body: futureBody({ title: 'Student warning', target: 'Students Only', priority: 'Warning' }),
    headers: {},
  });
  await invoke(createBroadcast, {
    user: admin,
    body: futureBody({ title: 'Provider urgent', target: 'Grant Providers Only', priority: 'Urgent' }),
    headers: {},
  });
  const scheduled = await invoke(createBroadcast, {
    user: superadmin,
    body: futureBody({
      title: 'Scheduled later',
      target: 'All Users',
      priority: 'Info',
      startDate: hoursFromNow(48),
      expiresAt: hoursFromNow(72),
    }),
    headers: {},
  });
  assert.equal(scheduled.statusCode, 201, JSON.stringify(scheduled.body));
  assert.equal(scheduled.body.broadcast.phase, 'scheduled');
  assert.equal(scheduled.body.broadcast.isCurrentlyActive, false);

  const expired = insert({
    title: 'Already over',
    startDate: new Date(Date.now() - 48 * 60 * 60 * 1000),
    expiresAt: new Date(Date.now() - 60 * 60 * 1000),
    priority: 'Warning',
    status: 'Active',
  });

  const adminList = await invoke(getBroadcasts, { user: admin, headers: {} });
  assert.equal(adminList.statusCode, 200);
  assert.ok(titles(adminList).includes('Live info'));
  assert.ok(titles(adminList).includes('Scheduled later'));
  assert.ok(titles(adminList).includes('Already over'));
  assert.equal(store.get(expired._id).status, 'Expired');
  assert.equal(
    adminList.body.activeCount,
    adminList.body.broadcasts.filter((item) => item.phase === 'live').length
  );
  assert.equal(adminList.body.activeCount, 3);
  assert.notEqual(adminList.body.activeCount, adminList.body.total);

  const studentFeed = await invoke(getActiveUserBroadcasts, { user: student, headers: {} });
  assert.equal(studentFeed.statusCode, 200);
  assert.deepEqual(titles(studentFeed).sort(), ['Live info', 'Student warning']);
  assert.equal(studentFeed.body.count, studentFeed.body.broadcasts.length);
  assert.ok(studentFeed.body.broadcasts.every((item) => item.phase === 'live'));
  assert.equal(studentFeed.body.broadcasts[0].title, 'Student warning');
  assert.equal(studentFeed.body.broadcasts[0].priority, 'Warning');

  const providerFeed = await invoke(getActiveUserBroadcasts, { user: provider, headers: {} });
  assert.deepEqual(titles(providerFeed).sort(), ['Live info', 'Provider urgent']);
  assert.equal(providerFeed.body.broadcasts[0].title, 'Provider urgent');
  assert.equal(providerFeed.body.broadcasts[0].priority, 'Urgent');

  const adminFeed = await invoke(getActiveUserBroadcasts, { user: admin, headers: {} });
  assert.deepEqual(titles(adminFeed), ['Live info']);

  const anonymousFeed = await invoke(getActiveUserBroadcasts, { headers: {} });
  assert.equal(anonymousFeed.statusCode, 401);

  const studentList = await invoke(getBroadcasts, { user: student, headers: {} });
  assert.equal(studentList.statusCode, 403);

  const revokedId = created.body.broadcast._id;
  const revoked = await invoke(revokeBroadcast, {
    user: admin,
    params: { id: revokedId },
    headers: {},
  });
  assert.equal(revoked.statusCode, 200);
  assert.equal(revoked.body.success, true);
  assert.equal(store.get(revokedId).status, 'Revoked');

  const afterRevoke = await invoke(getActiveUserBroadcasts, { user: student, headers: {} });
  assert.deepEqual(titles(afterRevoke), ['Student warning']);

  const badId = await invoke(revokeBroadcast, {
    user: admin,
    params: { id: 'not-valid' },
    headers: {},
  });
  assert.equal(badId.statusCode, 400);
  assert.equal(badId.body.success, false);

  const beforeFailure = store.size;
  failCreate = true;
  const createFailed = await invoke(createBroadcast, {
    user: admin,
    body: futureBody({ title: 'Should not persist' }),
    headers: {},
  });
  failCreate = false;
  assert.equal(createFailed.statusCode, 500);
  assert.equal(createFailed.body.success, false);
  assert.match(createFailed.body.message, /could not be saved/i);
  assert.doesNotMatch(createFailed.body.message, /will show it/i);
  assert.equal(store.size, beforeFailure);
  assert.equal([...store.values()].some((item) => item.title === 'Should not persist'), false);

  failFind = true;
  const loadFailed = await invoke(getBroadcasts, { user: admin, headers: {} });
  failFind = false;
  assert.equal(loadFailed.statusCode, 500);
  assert.equal(loadFailed.body.success, false);
  assert.match(loadFailed.body.message, /could not be loaded/i);

  const liveProvider = [...store.values()].find((item) => item.title === 'Provider urgent');
  failSave = true;
  const revokeFailed = await invoke(revokeBroadcast, {
    user: admin,
    params: { id: liveProvider._id },
    headers: {},
  });
  failSave = false;
  assert.equal(revokeFailed.statusCode, 500);
  assert.equal(revokeFailed.body.success, false);
  assert.equal(store.get(liveProvider._id).status, 'Active');

  console.log('broadcast announcement checks passed');
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
