const assert = require('assert');

const StudentProfile = require('../models/StudentProfile');
const Notification = require('../models/Notification');
const { createProfile, getProfile, updateProfile } = require('../controllers/studentProfileController');

const OWNER_ID = 'student-1';
const OTHER_USER_ID = 'student-2';

const mockResponse = () => {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };

  return response;
};

const ownedProfile = () => ({
  _id: 'profile-1',
  userId: OWNER_ID,
  course: 'BSIT',
  gwa: 1.5,
  gwaScale: '1.00-5.00',
  academicLevel: 'College',
  yearLevel: '2nd Year',
  incomeBracket: 'Below ₱10,000 / month',
  region: 'National Capital Region',
  province: 'Metro Manila',
  municipalityCity: 'Quezon City',
  citizenship: 'Filipino',
  dateOfBirth: '2004-01-15',
  schoolName: 'Sample University',
  schoolType: 'Public'
});

const run = async () => {
  const originalFindOne = StudentProfile.findOne;
  const originalUpdate = StudentProfile.findOneAndUpdate;
  const originalCreate = StudentProfile.create;
  const originalNotificationFind = Notification.findOne;
  const originalNotificationCreate = Notification.create;
  const stored = ownedProfile();
  const updates = [];
  const lookups = [];

  StudentProfile.findOne = async (query) => {
    lookups.push(query);
    return String(query.userId) === String(stored.userId) ? { ...stored } : null;
  };

  StudentProfile.findOneAndUpdate = async (filter, update) => {
    updates.push({ filter, update });

    if (String(filter.userId) !== OWNER_ID) {
      return null;
    }

    Object.assign(stored, update, {
      _id: 'profile-1',
      userId: OWNER_ID
    });

    return { ...stored };
  };

  Notification.findOne = () => ({
    select: async () => null
  });
  Notification.create = async () => ({ _id: 'note-1' });

  try {
    const hijack = mockResponse();
    await updateProfile({
      user: { id: OWNER_ID, email: 'owner@example.com', name: 'Owner Student' },
      body: {
        userId: OTHER_USER_ID,
        _id: 'profile-other',
        gwa: 1.25,
        course: 'BS Computer Science'
      },
      ip: '127.0.0.1',
      headers: {}
    }, hijack);

    assert.strictEqual(hijack.statusCode, 200);
    assert.strictEqual(hijack.body.success, true);
    assert.strictEqual(hijack.body.profile.userId, OWNER_ID);
    assert.strictEqual(hijack.body.profile._id, 'profile-1');
    assert.strictEqual(hijack.body.profile.gwa, 1.25);
    assert.strictEqual(hijack.body.profile.course, 'BS Computer Science');
    assert.strictEqual(stored.userId, OWNER_ID);
    assert.strictEqual(updates.length, 1);
    assert.deepStrictEqual(updates[0].filter, { userId: OWNER_ID });
    assert.strictEqual(Object.prototype.hasOwnProperty.call(updates[0].update, 'userId'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(updates[0].update, '_id'), false);
    assert.strictEqual(updates[0].update.gwa, 1.25);
    assert.strictEqual(updates[0].update.course, 'BS Computer Science');

    const ordinary = mockResponse();
    await updateProfile({
      user: { id: OWNER_ID, email: 'owner@example.com', name: 'Owner Student' },
      body: {
        schoolName: 'Updated University',
        schoolType: 'Private'
      },
      ip: '127.0.0.1',
      headers: {}
    }, ordinary);

    assert.strictEqual(ordinary.statusCode, 200);
    assert.strictEqual(ordinary.body.success, true);
    assert.strictEqual(ordinary.body.profile.userId, OWNER_ID);
    assert.strictEqual(ordinary.body.profile.schoolName, 'Updated University');
    assert.strictEqual(ordinary.body.profile.schoolType, 'Private');
    assert.strictEqual(ordinary.body.profile.gwa, 1.25);
    assert.strictEqual(stored.userId, OWNER_ID);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(updates[1].update, 'userId'), false);
    assert.strictEqual(updates[1].update.schoolName, 'Updated University');
    assert.strictEqual(updates[1].update.schoolType, 'Private');
    assert.ok(lookups.every((query) => String(query.userId) === OWNER_ID));

    const foreignRead = mockResponse();
    await getProfile({
      user: { id: OWNER_ID, email: 'owner@example.com', name: 'Owner Student' },
      query: { userId: OTHER_USER_ID },
      body: { userId: OTHER_USER_ID },
      params: { id: OTHER_USER_ID },
      ip: '127.0.0.1',
      headers: {}
    }, foreignRead);

    assert.strictEqual(foreignRead.statusCode, 200);
    assert.strictEqual(foreignRead.body.success, true);
    assert.strictEqual(foreignRead.body.profile.userId, OWNER_ID);
    assert.strictEqual(foreignRead.body.profile._id, 'profile-1');
    assert.strictEqual(String(lookups.at(-1).userId), OWNER_ID);

    const created = [];
    StudentProfile.findOne = async () => null;
    StudentProfile.create = async (doc) => {
      created.push({ ...doc });
      return { _id: 'profile-new', ...doc };
    };

    const hijackCreate = mockResponse();
    await createProfile({
      user: { id: OWNER_ID, email: 'owner@example.com', name: 'Owner Student' },
      body: {
        userId: OTHER_USER_ID,
        _id: 'profile-other',
        course: 'BS Information Technology',
        gwa: 1.75,
        gwaScale: '1.00-5.00',
        academicLevel: 'College',
        yearLevel: '1st Year',
        incomeBracket: 'Below ₱10,000 / month',
        region: 'National Capital Region',
        dateOfBirth: '2005-02-02'
      },
      ip: '127.0.0.1',
      headers: {}
    }, hijackCreate);

    assert.strictEqual(hijackCreate.statusCode, 201);
    assert.strictEqual(hijackCreate.body.success, true);
    assert.strictEqual(hijackCreate.body.profile.userId, OWNER_ID);
    assert.notStrictEqual(hijackCreate.body.profile.userId, OTHER_USER_ID);
    assert.notStrictEqual(hijackCreate.body.profile._id, 'profile-other');
    assert.strictEqual(created.length, 1);
    assert.strictEqual(created[0].userId, OWNER_ID);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(created[0], '_id'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(created[0], 'userId'), true);
    assert.strictEqual(created[0].course, 'BS Information Technology');
    assert.strictEqual(created[0].gwa, 1.75);

    console.log('student profile ownership tests passed');
  } finally {
    StudentProfile.findOne = originalFindOne;
    StudentProfile.findOneAndUpdate = originalUpdate;
    StudentProfile.create = originalCreate;
    Notification.findOne = originalNotificationFind;
    Notification.create = originalNotificationCreate;
  }
};

run().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exitCode = 1;
});
