const assert = require('assert');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/User');
const Provider = require('../models/Provider');
const Scholarship = require('../models/Scholarship');
const searchSync = require('../services/scholarshipSearchSync');
const scholarshipController = require('../controllers/scholarshipController');
require('../services/matchCache').invalidateMatchCache = async () => ({
  ok: false,
  reason: 'test_isolated'
});
const {
  PAST_DEADLINE_MESSAGE,
  INVALID_URL_MESSAGE,
  manilaCalendarDate
} = require('../utils/scholarshipInputValidation');

const MARKER = `__QA_VALIDATION__${Date.now()}`;

const mockRes = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

const shiftCalendarDate = (isoDate, days) => {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
};

const listingBody = (overrides = {}) => ({
  name: `${MARKER} Nationwide Grant`,
  scholarshipType: 'Merit-Based',
  description: 'Temporary QA listing for scholarship validation integration.',
  grantValue: '15000',
  deadline: '2026-12-31',
  applicationURL: 'https://qa.example.com/apply',
  academicRequirements: [
    {
      gradingScale: '1.00-5.00',
      minimumGPA: 2.5
    }
  ],
  hardFilters: {
    academicLevel: 'College',
    courseProgram: [],
    citizenshipStatus: 'Filipino',
    geographicLocation: {
      scope: 'Nationwide',
      regions: [],
      provinces: [],
      municipalities: []
    }
  },
  criteriaWeights: {
    gwaWeight: 0.4,
    incomeWeight: 0.4,
    tagsWeight: 0.2
  },
  rankingMode: 'Weighted',
  ...overrides
});

const connectIfAvailable = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    return { connected: false, reason: 'MONGO_URI is not set' };
  }

  try {
    await mongoose.connect(uri, {
      dbName: 'scholarship_matching_db',
      serverSelectionTimeoutMS: 4000
    });
    return { connected: true };
  } catch (error) {
    return {
      connected: false,
      reason: error.message || 'MongoDB connection failed'
    };
  }
};

const cleanup = async (ids) => {
  if (ids.scholarshipIds.length > 0) {
    await Scholarship.deleteMany({ _id: { $in: ids.scholarshipIds } });
  }

  await Scholarship.deleteMany({ name: new RegExp(`^${MARKER}`) });

  if (ids.providerIds.length > 0) {
    await Provider.deleteMany({ _id: { $in: ids.providerIds } });
  }

  if (ids.userIds.length > 0) {
    await User.deleteMany({ _id: { $in: ids.userIds } });
  }
};

const main = async () => {
  const connection = await connectIfAvailable();

  if (!connection.connected) {
    console.log(
      `scholarship database integration skipped: ${connection.reason}`
    );
    return;
  }

  const ids = {
    userIds: [],
    providerIds: [],
    scholarshipIds: []
  };

  searchSync.syncScholarshipSearch = async (scholarship) => ({
    synchronized: false,
    id: String(scholarship && (scholarship._id || scholarship.id) || 'unknown'),
    reason: 'integration-test'
  });

  try {
    const ownerUser = await User.create({
      name: `${MARKER} Owner`,
      email: `qa.validation.owner.${Date.now()}@example.com`,
      password: 'Secret1',
      role: 'provider',
      status: 'active',
      isOnboarded: true,
      isVerified: true
    });
    ids.userIds.push(ownerUser._id);

    const otherUser = await User.create({
      name: `${MARKER} Other`,
      email: `qa.validation.other.${Date.now()}@example.com`,
      password: 'Secret1',
      role: 'provider',
      status: 'active',
      isOnboarded: true,
      isVerified: true
    });
    ids.userIds.push(otherUser._id);

    const ownerProvider = await Provider.create({
      userId: ownerUser._id,
      institutionName: `${MARKER} Owner Foundation`,
      institutionType: 'Non-Profit / NGO',
      verificationStatus: 'Verified'
    });
    ids.providerIds.push(ownerProvider._id);

    const otherProvider = await Provider.create({
      userId: otherUser._id,
      institutionName: `${MARKER} Other Foundation`,
      institutionType: 'Non-Profit / NGO',
      verificationStatus: 'Verified'
    });
    ids.providerIds.push(otherProvider._id);

    const createRes = mockRes();
    await scholarshipController.createScholarship(
      {
        user: { id: ownerUser._id },
        body: listingBody()
      },
      createRes
    );
    assert.equal(createRes.statusCode, 201, createRes.body && createRes.body.message);
    assert.equal(createRes.body.success, true);
    const createdId = createRes.body.scholarship._id;
    ids.scholarshipIds.push(createdId);

    const persisted = await Scholarship.findById(createdId);
    assert.ok(persisted);
    assert.equal(persisted.name, `${MARKER} Nationwide Grant`);
    assert.equal(String(persisted.providerId), String(ownerProvider._id));
    assert.equal(persisted.applicationURL, 'https://qa.example.com/apply');
    assert.equal(manilaCalendarDate(persisted.deadline), '2026-12-31');

    const beforeInvalid = await Scholarship.countDocuments({
      name: new RegExp(`^${MARKER}`)
    });

    const today = manilaCalendarDate(new Date());
    const yesterday = shiftCalendarDate(today, -1);

    const pastRes = mockRes();
    await scholarshipController.createScholarship(
      {
        user: { id: ownerUser._id },
        body: listingBody({ deadline: yesterday })
      },
      pastRes
    );
    assert.equal(pastRes.statusCode, 400);
    assert.equal(pastRes.body.message, PAST_DEADLINE_MESSAGE);

    const urlRes = mockRes();
    await scholarshipController.createScholarship(
      {
        user: { id: ownerUser._id },
        body: listingBody({ applicationURL: 'javascript:alert(1)' })
      },
      urlRes
    );
    assert.equal(urlRes.statusCode, 400);
    assert.equal(urlRes.body.message, INVALID_URL_MESSAGE);

    const locationRes = mockRes();
    await scholarshipController.createScholarship(
      {
        user: { id: ownerUser._id },
        body: listingBody({
          hardFilters: {
            academicLevel: 'College',
            citizenshipStatus: 'Filipino',
            geographicLocation: {
              scope: 'Municipality',
              regions: ['Central Visayas'],
              provinces: ['Cebu'],
              municipalities: []
            }
          }
        })
      },
      locationRes
    );
    assert.equal(locationRes.statusCode, 400);
    assert.match(locationRes.body.message, /Municipality or city is required/);

    const afterInvalid = await Scholarship.countDocuments({
      name: new RegExp(`^${MARKER}`)
    });
    assert.equal(afterInvalid, beforeInvalid);

    const updateRes = mockRes();
    await scholarshipController.updateScholarship(
      {
        user: { id: ownerUser._id },
        params: { id: String(createdId) },
        body: {
          description: 'Updated QA listing description.',
          deadline: '2026-12-31'
        }
      },
      updateRes
    );
    assert.equal(updateRes.statusCode, 200, updateRes.body && updateRes.body.message);

    const updated = await Scholarship.findById(createdId);
    assert.equal(updated.description, 'Updated QA listing description.');
    assert.equal(manilaCalendarDate(updated.deadline), '2026-12-31');

    const hijackRes = mockRes();
    await scholarshipController.updateScholarship(
      {
        user: { id: otherUser._id },
        params: { id: String(createdId) },
        body: { description: 'Hijacked by another provider' }
      },
      hijackRes
    );
    assert.equal(hijackRes.statusCode, 404);

    const stillOwned = await Scholarship.findById(createdId);
    assert.equal(stillOwned.description, 'Updated QA listing description.');

    console.log('scholarship database integration tests passed');
  } finally {
    try {
      await cleanup(ids);
    } catch (cleanupError) {
      console.error('Failed to clean up QA scholarship records:', cleanupError);
    }

    await mongoose.disconnect();
  }
};

main()
  .then(() => {
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      console.error(disconnectError);
    }
    process.exit(1);
  });
