const assert = require('assert');
const fs = require('fs');
const path = require('path');

const Provider = require('../models/Provider');
const Scholarship = require('../models/Scholarship');
const scholarshipController = require('../controllers/scholarshipController');
require('../services/matchCache').invalidateMatchCache = async () => ({
  ok: false,
  reason: 'test_isolated'
});
const searchSync = require('../services/scholarshipSearchSync');
const {
  PAST_DEADLINE_MESSAGE,
  INVALID_DEADLINE_MESSAGE,
  REQUIRED_DEADLINE_MESSAGE,
  REQUIRED_URL_MESSAGE,
  INVALID_URL_MESSAGE,
  manilaCalendarDate,
  validateScholarshipInput
} = require('../utils/scholarshipInputValidation');

const originals = {
  providerFindOne: Provider.findOne,
  scholarshipCreate: Scholarship.create,
  scholarshipFindOne: Scholarship.findOne,
  sync: searchSync.syncScholarshipSearch
};

const restore = () => {
  Provider.findOne = originals.providerFindOne;
  Scholarship.create = originals.scholarshipCreate;
  Scholarship.findOne = originals.scholarshipFindOne;
  searchSync.syncScholarshipSearch = originals.sync;
};

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

const verifiedProvider = {
  _id: 'provider-1',
  verificationStatus: 'Verified'
};

const savedScholarship = (overrides = {}) => ({
  _id: 'sch-1',
  providerId: verifiedProvider._id,
  name: 'Cebu IT Excellence Grant',
  scholarshipType: 'Merit-Based',
  description: 'Support for information technology students in Cebu.',
  grantValue: '10000',
  deadline: '2026-12-31',
  applicationURL: 'https://provider.gov.ph/apply',
  hardFilters: {
    academicLevel: 'College',
    geographicLocation: {
      scope: 'Nationwide',
      regions: [],
      provinces: [],
      municipalities: []
    },
    citizenshipStatus: 'Filipino'
  },
  ...overrides,
  async save() {
    return this;
  }
});

const validBody = (overrides = {}) => ({
  name: 'Cebu IT Excellence Grant',
  scholarshipType: 'Merit-Based',
  description: 'Support for information technology students in Cebu.',
  grantValue: '10000',
  deadline: '2026-12-31',
  applicationURL: 'https://provider.gov.ph/apply',
  hardFilters: {
    academicLevel: 'College',
    geographicLocation: {
      scope: 'Nationwide',
      regions: [],
      provinces: [],
      municipalities: []
    },
    citizenshipStatus: 'Filipino'
  },
  ...overrides
});

const runValidationUnitTests = () => {
  const now = new Date('2026-10-25T16:30:00.000Z');
  const today = manilaCalendarDate(now);
  const yesterday = shiftCalendarDate(today, -1);
  const tomorrow = shiftCalendarDate(today, 1);

  assert.equal(today, '2026-10-26');
  assert.equal(
    validateScholarshipInput(validBody({ deadline: yesterday }), { now }).errors.deadline,
    PAST_DEADLINE_MESSAGE
  );
  assert.equal(
    validateScholarshipInput(validBody({ deadline: today }), { now }).valid,
    true
  );
  assert.equal(
    validateScholarshipInput(validBody({ deadline: tomorrow }), { now }).valid,
    true
  );
  assert.equal(
    validateScholarshipInput(validBody({ deadline: 'not-a-date' }), { now }).errors.deadline,
    INVALID_DEADLINE_MESSAGE
  );
  assert.equal(
    validateScholarshipInput(validBody({ deadline: '2026-02-31' }), { now }).errors.deadline,
    INVALID_DEADLINE_MESSAGE
  );
  assert.equal(
    validateScholarshipInput(validBody({ deadline: '' }), { now }).errors.deadline,
    REQUIRED_DEADLINE_MESSAGE
  );

  assert.equal(
    validateScholarshipInput(validBody({ applicationURL: 'javascript:alert(1)' })).errors.applicationURL,
    INVALID_URL_MESSAGE
  );
  assert.equal(
    validateScholarshipInput(validBody({ applicationURL: 'ftp://provider.gov.ph/apply' })).errors.applicationURL,
    INVALID_URL_MESSAGE
  );
  assert.equal(
    validateScholarshipInput(validBody({ applicationURL: 'not a url' })).errors.applicationURL,
    INVALID_URL_MESSAGE
  );
  assert.equal(
    validateScholarshipInput(validBody({ applicationURL: '' })).errors.applicationURL,
    REQUIRED_URL_MESSAGE
  );
  assert.equal(
    validateScholarshipInput(validBody({ applicationURL: 'https://provider.gov.ph/apply' })).valid,
    true
  );

  assert.equal(
    validateScholarshipInput(validBody({
      hardFilters: {
        academicLevel: 'College',
        citizenshipStatus: 'Filipino',
        geographicLocation: { scope: 'Region', regions: [] }
      }
    })).errors.geographicLocation,
    'Region is required for this geographic scope.'
  );
  assert.equal(
    validateScholarshipInput(validBody({
      hardFilters: {
        academicLevel: 'College',
        citizenshipStatus: 'Filipino',
        geographicLocation: {
          scope: 'Province',
          regions: ['Central Visayas'],
          provinces: []
        }
      }
    })).errors.geographicLocation,
    'Province is required for this geographic scope.'
  );
  assert.equal(
    validateScholarshipInput(validBody({
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
    })).errors.geographicLocation,
    'Municipality or city is required for this geographic scope.'
  );
  assert.equal(
    validateScholarshipInput(validBody({
      hardFilters: {
        academicLevel: 'College',
        citizenshipStatus: 'Filipino',
        geographicLocation: { scope: 'Region', regions: ['Atlantis'] }
      }
    })).errors.geographicLocation,
    'Select a region from the list.'
  );
  assert.equal(
    validateScholarshipInput(validBody()).valid,
    true
  );
  assert.equal(
    validateScholarshipInput(validBody({
      hardFilters: {
        academicLevel: 'College',
        citizenshipStatus: 'Filipino',
        geographicLocation: {
          scope: 'Municipality',
          regions: ['Central Visayas'],
          provinces: ['Cebu'],
          municipalities: ['Cebu City']
        }
      }
    })).valid,
    true
  );
};

const createWith = async (body, provider = verifiedProvider) => {
  const created = [];
  Provider.findOne = async () => provider;
  Scholarship.create = async (data) => {
    created.push(data);
    return savedScholarship(data);
  };
  searchSync.syncScholarshipSearch = async () => ({ synchronized: true });
  const res = mockRes();
  await scholarshipController.createScholarship(
    { user: { id: 'user-1' }, body },
    res
  );
  res.created = created;
  return res;
};

const updateWith = async (body, existing = savedScholarship()) => {
  Provider.findOne = async () => verifiedProvider;
  Scholarship.findOne = async () => existing;
  searchSync.syncScholarshipSearch = async () => ({ synchronized: true });
  const res = mockRes();
  await scholarshipController.updateScholarship(
    { user: { id: 'user-1' }, params: { id: 'sch-1' }, body },
    res
  );
  return res;
};

const runControllerTests = async () => {
  const today = manilaCalendarDate(new Date());
  const yesterday = shiftCalendarDate(today, -1);
  const tomorrow = shiftCalendarDate(today, 1);

  const pastCreate = await createWith(validBody({ deadline: yesterday }));
  assert.equal(pastCreate.statusCode, 400);
  assert.equal(pastCreate.body.message, PAST_DEADLINE_MESSAGE);
  assert.equal(pastCreate.created.length, 0);

  const todayCreate = await createWith(validBody({ deadline: today }));
  assert.equal(todayCreate.statusCode, 201);
  assert.equal(todayCreate.body.success, true);
  assert.equal(todayCreate.created.length, 1);

  const futureCreate = await createWith(validBody({ deadline: tomorrow }));
  assert.equal(futureCreate.statusCode, 201);

  const invalidDateCreate = await createWith(validBody({ deadline: '2026-13-40' }));
  assert.equal(invalidDateCreate.statusCode, 400);
  assert.equal(invalidDateCreate.body.message, INVALID_DEADLINE_MESSAGE);

  const javascriptCreate = await createWith(validBody({
    applicationURL: 'javascript:alert(1)'
  }));
  assert.equal(javascriptCreate.statusCode, 400);
  assert.equal(javascriptCreate.body.message, INVALID_URL_MESSAGE);
  assert.equal(javascriptCreate.created.length, 0);

  const missingUrl = validBody();
  delete missingUrl.applicationURL;
  const missingUrlCreate = await createWith(missingUrl);
  assert.equal(missingUrlCreate.statusCode, 400);
  assert.equal(missingUrlCreate.body.message, REQUIRED_URL_MESSAGE);

  const missingRegion = await createWith(validBody({
    hardFilters: {
      academicLevel: 'College',
      citizenshipStatus: 'Filipino',
      geographicLocation: { scope: 'Region', regions: [] }
    }
  }));
  assert.equal(missingRegion.statusCode, 400);
  assert.match(missingRegion.body.message, /Region is required/);

  const nationwide = await createWith(validBody());
  assert.equal(nationwide.statusCode, 201);

  let saveCalled = false;
  const existing = savedScholarship();
  existing.save = async function save() {
    saveCalled = true;
    return this;
  };

  const pastUpdate = await updateWith({ deadline: yesterday }, existing);
  assert.equal(pastUpdate.statusCode, 400);
  assert.equal(pastUpdate.body.message, PAST_DEADLINE_MESSAGE);
  assert.equal(saveCalled, false);

  saveCalled = false;
  const urlUpdate = await updateWith(
    { applicationURL: 'javascript:void(0)' },
    existing
  );
  assert.equal(urlUpdate.statusCode, 400);
  assert.equal(saveCalled, false);

  const validUpdate = await updateWith(
    { description: 'Updated description for an existing listing.' },
    existing
  );
  assert.equal(validUpdate.statusCode, 200);
  assert.equal(validUpdate.body.success, true);
  assert.equal(existing.description, 'Updated description for an existing listing.');

  const unverified = await createWith(validBody(), {
    _id: 'provider-2',
    verificationStatus: 'Pending'
  });
  assert.equal(unverified.statusCode, 403);
  assert.match(unverified.body.message, /Only verified providers/);

  const missingProvider = mockRes();
  Provider.findOne = async () => null;
  await scholarshipController.createScholarship(
    { user: { id: 'user-1' }, body: validBody() },
    missingProvider
  );
  assert.equal(missingProvider.statusCode, 404);

  const routeSource = fs.readFileSync(
    path.join(__dirname, '../routes/scholarshipRoutes.js'),
    'utf8'
  );
  assert.match(routeSource, /protect/);
  assert.match(routeSource, /authorize\('provider'\)/);
};

const main = async () => {
  try {
    runValidationUnitTests();
    await runControllerTests();
    console.log('scholarship input validation tests passed');
  } finally {
    restore();
  }
};

main().catch((error) => {
  restore();
  console.error(error);
  process.exit(1);
});
