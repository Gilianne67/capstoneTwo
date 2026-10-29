const assert = require('assert');

const StudentProfile = require('../models/StudentProfile');
const matchingController = require('../controllers/matchingController');
const matchingService = require('../services/matchingService');
const { CATALOG_INDEX } = require('../utils/courseCanonical');
const { rankScholarships } = require('../services/matchingEngine');
const { closeMatchingPool } = require('../services/matchingWorkerRunner');

const FIXED_NOW = new Date('2026-09-26T04:00:00.000Z');
const BELOW_10K = 'Below ₱10,000 / month';

const student = {
  academicLevel: 'College',
  course: 'BSIT',
  gwa: 1.5,
  gwaScale: '1.00-5.00',
  incomeBracket: BELOW_10K,
  region: 'Bicol Region',
  province: 'Camarines Sur',
  municipalityCity: 'Naga City',
  citizenship: 'Filipino',
  dateOfBirth: '2004-01-01',
  yearLevel: '2nd Year',
  specialEligibilityFlags: {}
};

const scholarship = (id, overrides = {}) => ({
  _id: id,
  name: overrides.name || id,
  scholarshipType: 'Merit',
  description: overrides.description || '',
  status: overrides.status || 'Open',
  isArchived: overrides.isArchived === true,
  adminRemovedAt: overrides.adminRemovedAt || null,
  deadline: '2026-12-31',
  academicRequirements: [
    { gradingScale: '1.00-5.00', minimumGPA: 2.5 }
  ],
  hardFilters: {
    academicLevel: 'College',
    courseProgram: overrides.courseProgram || ['BS Information Technology'],
    geographicLocation: {
      scope: 'Nationwide',
      regions: [],
      provinces: [],
      municipalities: []
    },
    citizenshipStatus: 'Filipino'
  },
  incomeRequirement: { maxMonthlyIncome: null },
  specialTags: [],
  criteriaWeights: {
    gwaWeight: 0.4,
    incomeWeight: 0.4,
    tagsWeight: 0.2
  }
});

const records = [
  scholarship('eligible-it', {
    name: 'Information Technology Grant',
    description: 'Support for information technology students.'
  }),
  scholarship('ineligible-nursing', {
    name: 'Nursing Award',
    courseProgram: ['BS Nursing']
  }),
  scholarship('closed-it', {
    name: 'Closed Information Technology Grant',
    status: 'Closed'
  }),
  scholarship('archived-it', {
    name: 'Archived Information Technology Grant',
    isArchived: true
  }),
  scholarship('admin-removed-it', {
    name: 'Removed Information Technology Grant',
    isArchived: false,
    adminRemovedAt: new Date('2026-10-01T00:00:00.000Z')
  })
];

const matchesFilter = (doc, filter) => {
  if (filter.status && doc.status !== filter.status) {
    return false;
  }

  if (filter.isArchived === false && doc.isArchived === true) {
    return false;
  }

  if (filter.adminRemovedAt === null && doc.adminRemovedAt) {
    return false;
  }

  if (filter._id && Array.isArray(filter._id.$in)) {
    const ids = filter._id.$in.map(String);
    if (!ids.includes(String(doc._id))) {
      return false;
    }
  }

  return true;
};

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

const rankWith = async ({ query = '', search } = {}) => {
  const filters = [];
  const searches = [];

  const matches = await matchingService.getRankedScholarships(student, {
    query,
    now: FIXED_NOW,
    loadAliasIndex: async () => CATALOG_INDEX,
    searchScholarships: async (request) => {
      searches.push(request);
      if (search) {
        return search(request);
      }
      throw new Error('search should not be called');
    },
    findScholarships: async (filter) => {
      filters.push(filter);
      return records.filter((doc) => matchesFilter(doc, filter));
    }
  });

  return { matches, filters, searches };
};

const runServiceTests = async () => {
  const empty = await rankWith();
  assert.deepStrictEqual(empty.searches, []);
  assert.strictEqual(empty.filters.length, 1);
  assert.strictEqual(empty.filters[0].status, 'Open');
  assert.strictEqual(empty.filters[0].isArchived, false);
  assert.strictEqual(empty.filters[0].adminRemovedAt, null);
  assert.strictEqual(empty.filters[0]._id, undefined);
  assert.deepStrictEqual(
    empty.matches.map((match) => String(match.scholarship._id)),
    ['eligible-it']
  );

  const direct = rankScholarships(
    student,
    [records[0]],
    CATALOG_INDEX,
    FIXED_NOW
  );
  assert.strictEqual(empty.matches[0].totalScore, direct[0].totalScore);
  assert.deepStrictEqual(empty.matches[0].weights, {
    gwaWeight: 0.4,
    incomeWeight: 0.4,
    tagsWeight: 0.2
  });

  const keyword = await rankWith({
    query: ' Information Technology ',
    search: async () => ({
      total: records.length,
      hits: records.map((doc) => ({ id: doc._id }))
    })
  });
  assert.strictEqual(keyword.searches.length, 1);
  assert.strictEqual(keyword.searches[0].query, 'Information Technology');
  assert.strictEqual(keyword.searches[0].size, 1000);
  assert.deepStrictEqual(
    keyword.filters[0]._id.$in.map(String),
    ['eligible-it', 'ineligible-nursing', 'closed-it', 'archived-it', 'admin-removed-it']
  );
  assert.strictEqual(keyword.filters[0].status, 'Open');
  assert.strictEqual(keyword.filters[0].isArchived, false);
  assert.strictEqual(keyword.filters[0].adminRemovedAt, null);
  assert.deepStrictEqual(
    keyword.matches.map((match) => String(match.scholarship._id)),
    ['eligible-it']
  );

  const none = await rankWith({
    query: 'marine biology',
    search: async () => ({ total: 0, hits: [] })
  });
  assert.deepStrictEqual(none.matches, []);
  assert.deepStrictEqual(none.filters, []);

  await assert.rejects(
    () => rankWith({
      query: 'IT',
      search: async () => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:9200');
      }
    }),
    (error) => {
      assert.strictEqual(error.code, 'SEARCH_UNAVAILABLE');
      assert.match(error.message, /Scholarship search is unavailable/);
      assert.ok(!/ECONNREFUSED|9200/.test(error.message));
      return true;
    }
  );

  await assert.rejects(
    () => rankWith({
      query: 'IT',
      search: async () => ({
        total: 5,
        hits: [{ id: 'eligible-it' }]
      })
    }),
    (error) => error.code === 'SEARCH_UNAVAILABLE'
  );
};

const runControllerTests = async () => {
  const originalFindOne = StudentProfile.findOne;
  const originalRank = matchingService.getRankedScholarships;
  const calls = [];

  matchingService.getRankedScholarships = async (profile, options) => {
    calls.push(options);
    if (options.query === 'IT') {
      const error = new Error(
        'Scholarship search is unavailable. Keyword results cannot be shown until search is restored.'
      );
      error.code = 'SEARCH_UNAVAILABLE';
      throw error;
    }
    return [{ scholarship: { _id: 'eligible-it' }, totalScore: 80 }];
  };

  try {
    StudentProfile.findOne = async () => student;

    const emptyResponse = mockResponse();
    await matchingController.getMatches(
      { user: { id: 'student-1' }, query: {} },
      emptyResponse
    );
    assert.strictEqual(emptyResponse.statusCode, 200);
    assert.strictEqual(emptyResponse.body.success, true);
    assert.strictEqual(emptyResponse.body.count, 1);
    assert.strictEqual(calls[0].query, '');
    assert.ok(!Object.prototype.hasOwnProperty.call(emptyResponse.body, 'code'));

    const keywordResponse = mockResponse();
    await matchingController.getMatches(
      { user: { id: 'student-1' }, query: { q: ' IT ' } },
      keywordResponse
    );
    assert.strictEqual(keywordResponse.statusCode, 503);
    assert.strictEqual(keywordResponse.body.success, false);
    assert.strictEqual(keywordResponse.body.code, 'SEARCH_UNAVAILABLE');
    assert.strictEqual(keywordResponse.body.matches, undefined);
    assert.strictEqual(calls[1].query, 'IT');

    matchingService.getRankedScholarships = async () => {
      throw new Error('secret database detail');
    };
    const failureResponse = mockResponse();
    await matchingController.getMatches(
      { user: { id: 'student-1' }, query: {} },
      failureResponse
    );
    assert.strictEqual(failureResponse.statusCode, 500);
    assert.strictEqual(failureResponse.body.success, false);
    assert.strictEqual(
      failureResponse.body.message,
      'Failed to generate scholarship matches'
    );
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(failureResponse.body, 'error'),
      false
    );
    assert.strictEqual(
      JSON.stringify(failureResponse.body).includes('secret database detail'),
      false
    );

    matchingService.getRankedScholarships = async (profile, options) => {
      calls.push(options);
      if (options.query === 'IT') {
        const error = new Error(
          'Scholarship search is unavailable. Keyword results cannot be shown until search is restored.'
        );
        error.code = 'SEARCH_UNAVAILABLE';
        throw error;
      }
      return [{ scholarship: { _id: 'eligible-it' }, totalScore: 80 }];
    };

    StudentProfile.findOne = async () => ({ academicLevel: 'College' });
    const incompleteCalls = calls.length;
    const incompleteResponse = mockResponse();
    await matchingController.getMatches(
      { user: { id: 'student-1' }, query: { q: 'IT' } },
      incompleteResponse
    );
    assert.strictEqual(incompleteResponse.statusCode, 200);
    assert.strictEqual(incompleteResponse.body.profileComplete, false);
    assert.deepStrictEqual(incompleteResponse.body.matches, []);
    assert.strictEqual(calls.length, incompleteCalls);
  } finally {
    StudentProfile.findOne = originalFindOne;
    matchingService.getRankedScholarships = originalRank;
  }
};

const main = async () => {
  try {
    await runServiceTests();
    await runControllerTests();
    console.log('matching search tests passed');
  } catch (error) {
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
  } finally {
    closeMatchingPool();
  }
};

main();
