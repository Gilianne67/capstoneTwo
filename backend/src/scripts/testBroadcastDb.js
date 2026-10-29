/**
 * Live announcement persistence against the configured MongoDB.
 * Skips when MONGO_URI is missing or the database cannot be reached.
 * Removes only the rows this script creates.
 */
const dns = require('dns');
const assert = require('assert');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const Broadcast = require('../models/Broadcast');
const AuditLog = require('../models/AuditLog');
const { broadcastPhase } = require('../utils/broadcastRules');
const {
  createBroadcast,
  getActiveUserBroadcasts,
} = require('../controllers/broadcastController');

const MARKER = `QA-BROADCAST-${Date.now()}`;

const safeMessage = (error) => String(error?.message || error || 'MongoDB connection failed')
  .replace(/mongodb(\+srv)?:\/\/\S+/gi, '[database]');

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
    if (error) {
      reject(error);
      return;
    }
    resolve({ statusCode: res.statusCode, body: res.body, nextCalled: true });
  })).catch(reject);
});

const hoursFromNow = (amount) => new Date(Date.now() + amount * 60 * 60 * 1000).toISOString();

const admin = {
  _id: new mongoose.Types.ObjectId(),
  role: 'admin',
  name: 'Broadcast QA',
  email: 'broadcast-qa@example.com',
};
const student = { _id: new mongoose.Types.ObjectId(), role: 'student', name: 'Student QA' };
const provider = { _id: new mongoose.Types.ObjectId(), role: 'provider', name: 'Provider QA' };

const titled = (label) => `${MARKER} ${label}`;

const cleanup = async () => {
  await Broadcast.deleteMany({ title: { $regex: `^${MARKER}` } });
  await AuditLog.deleteMany({ details: { $regex: MARKER } });
};

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.log('broadcast database check skipped: MONGO_URI is not set');
    return;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  } catch (error) {
    console.log(`broadcast database check skipped: ${safeMessage(error)}`);
    return;
  }

  try {
    await cleanup();

    const denied = await invoke(createBroadcast, {
      user: student,
      headers: {},
      body: {
        title: titled('denied'),
        message: 'Students cannot dispatch this.',
        target: 'All Users',
        priority: 'Info',
        expiresAt: hoursFromNow(24),
      },
    });
    assert.equal(denied.statusCode, 403);
    assert.equal(await Broadcast.countDocuments({ title: titled('denied') }), 0);

    const invalid = await invoke(createBroadcast, {
      user: admin,
      headers: {},
      body: {
        title: titled('invalid range'),
        message: 'This range is backwards.',
        target: 'All Users',
        priority: 'Info',
        startDate: hoursFromNow(48),
        expiresAt: hoursFromNow(24),
      },
    });
    assert.equal(invalid.statusCode, 400);
    assert.equal(await Broadcast.countDocuments({ title: titled('invalid range') }), 0);

    const created = await invoke(createBroadcast, {
      user: admin,
      headers: {},
      body: {
        title: titled('all users'),
        message: 'Visible to students and providers.',
        target: 'All Users',
        priority: 'Urgent',
        expiresAt: hoursFromNow(24),
      },
    });
    assert.equal(created.statusCode, 201, JSON.stringify(created.body));
    assert.equal(created.body.broadcast.priority, 'Urgent');

    const stored = await Broadcast.findById(created.body.broadcast._id);
    assert.ok(stored);
    assert.equal(stored.title, titled('all users'));
    assert.equal(stored.priority, 'Urgent');
    assert.equal(stored.target, 'All Users');
    assert.equal(broadcastPhase(stored), 'live');

    const studentOnly = await invoke(createBroadcast, {
      user: admin,
      headers: {},
      body: {
        title: titled('students'),
        message: 'Students only.',
        target: 'Students Only',
        priority: 'Warning',
        expiresAt: hoursFromNow(24),
      },
    });
    assert.equal(studentOnly.statusCode, 201, JSON.stringify(studentOnly.body));

    const providerOnly = await invoke(createBroadcast, {
      user: admin,
      headers: {},
      body: {
        title: titled('providers'),
        message: 'Providers only.',
        target: 'Grant Providers Only',
        priority: 'Info',
        expiresAt: hoursFromNow(24),
      },
    });
    assert.equal(providerOnly.statusCode, 201, JSON.stringify(providerOnly.body));

    const scheduled = await invoke(createBroadcast, {
      user: admin,
      headers: {},
      body: {
        title: titled('scheduled'),
        message: 'Not live yet.',
        target: 'All Users',
        priority: 'Urgent',
        startDate: hoursFromNow(48),
        expiresAt: hoursFromNow(72),
      },
    });
    assert.equal(scheduled.statusCode, 201, JSON.stringify(scheduled.body));

    await Broadcast.create({
      title: titled('expired'),
      message: 'Already over.',
      target: 'All Users',
      priority: 'Warning',
      status: 'Active',
      startDate: new Date(Date.now() - 48 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() - 60 * 60 * 1000),
      createdBy: admin._id,
    });

    const persisted = await Broadcast.find({ title: { $regex: `^${MARKER}` } });
    assert.equal(persisted.length, 5);
    const liveStored = persisted.filter((doc) => broadcastPhase(doc) === 'live');
    assert.equal(liveStored.length, 3);

    const studentFeed = await invoke(getActiveUserBroadcasts, { user: student, headers: {} });
    const providerFeed = await invoke(getActiveUserBroadcasts, { user: provider, headers: {} });
    const studentTitles = studentFeed.body.broadcasts
      .filter((item) => String(item.title).startsWith(MARKER))
      .map((item) => item.title)
      .sort();
    const providerTitles = providerFeed.body.broadcasts
      .filter((item) => String(item.title).startsWith(MARKER))
      .map((item) => item.title)
      .sort();

    assert.deepEqual(studentTitles, [titled('all users'), titled('students')].sort());
    assert.deepEqual(providerTitles, [titled('all users'), titled('providers')].sort());
    assert.equal(
      studentFeed.body.broadcasts.filter((item) => String(item.title).startsWith(MARKER) && item.priority === 'Urgent').length,
      1
    );
    assert.equal(
      studentFeed.body.broadcasts.filter((item) => item.title === titled('all users'))[0].priority,
      'Urgent'
    );

    console.log('broadcast database checks passed');
  } finally {
    try {
      await cleanup();
      const leftover = await Broadcast.countDocuments({ title: { $regex: `^${MARKER}` } });
      assert.equal(leftover, 0);
    } catch (error) {
      console.error(`broadcast database cleanup failed for ${MARKER}: ${safeMessage(error)}`);
      throw error;
    }
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error(safeMessage(error));
  process.exit(1);
});
