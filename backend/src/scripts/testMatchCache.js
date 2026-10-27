/**
 * Match-result cache tests against an isolated Redis database 14.
 * Does not flush Redis. Deletes only match:v1 keys this file creates,
 * then restores match:gen and match:trust to the values they had before the test.
 */
const assert = require('assert');
const { execFile } = require('child_process');
const { createClient } = require('redis');

const Provider = require('../models/Provider');
const Scholarship = require('../models/Scholarship');
const Report = require('../models/Report');
const AuditLog = require('../models/AuditLog');
const scholarshipController = require('../controllers/scholarshipController');
const { updateScholarshipStatus: adminUpdateScholarshipStatus } = require('../controllers/adminController');
const { updateModerationReport } = require('../controllers/moderationController');
const searchSync = require('../services/scholarshipSearchSync');
const matchCache = require('../services/matchCache');
const { getRankedScholarships } = require('../services/matchingService');
const { closeExpiredScholarships } = require('../services/scholarshipExpirationService');
const { closeMatchingPool } = require('../services/matchingWorkerRunner');
const { buildAliasIndex, CATALOG_INDEX } = require('../utils/courseCanonical');
const {
  FLAG_TAGS,
  rankScholarships,
  scoringConfiguration
} = require('../services/matchingEngine');

const {
  buildMatchCacheKey,
  invalidateMatchCache,
  profileMatchFields,
  MATCH_CACHE_TTL_SECONDS,
  MATCH_CACHE_KEY_PREFIX,
  MATCH_CACHE_GENERATION_KEY,
  MATCH_CACHE_TRUST_KEY
} = matchCache;

const FIXED_NOW = new Date('2026-10-27T02:00:00.000Z');
const AFTER_DEADLINE = new Date('2026-10-27T16:00:00.000Z');
const BELOW_10K = 'Below ₱10,000 / month';
const createdKeys = new Set();
const observed = [];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const exec = (command, args) =>
  new Promise((resolve, reject) => {
    execFile(command, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });

const baseStudent = (userId, overrides = {}) => ({
  userId,
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
  schoolName: 'Naga College',
  schoolType: 'Public',
  isMinor: false,
  specialEligibilityFlags: {},
  ...overrides
});

const scholarship = (id, overrides = {}) => {
  const record = {
    _id: id,
    providerId: 'provider-1',
    name: overrides.name || id,
    scholarshipType: 'Merit',
    description: overrides.description || '',
    status: overrides.status || 'Open',
    isArchived: overrides.isArchived === true,
    deadline: overrides.deadline || new Date('2026-12-31T00:00:00.000Z'),
    academicRequirements: overrides.academicRequirements || [
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
    specialTags: overrides.specialTags || [],
    criteriaWeights: overrides.criteriaWeights || {
      gwaWeight: 0.4,
      incomeWeight: 0.4,
      tagsWeight: 0.2
    },
    rankingMode: 'Weighted',
    applicationURL: 'https://provider.example.edu/apply'
  };

  return record;
};

const attachSave = (record) => {
  record.save = async function save() {
    return this;
  };
  return record;
};

const withoutFunctions = (doc) => {
  const copy = { ...doc };
  Object.keys(copy).forEach((key) => {
    if (typeof copy[key] === 'function') {
      delete copy[key];
    }
  });
  return copy;
};

const matchesFilter = (doc, filter) => {
  if (filter.status && doc.status !== filter.status) {
    return false;
  }

  if (filter.isArchived === false && doc.isArchived === true) {
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

const idsOf = (matches) => matches.map((match) => String(match.scholarship._id));

const normalized = (value) => JSON.parse(JSON.stringify(value));

const keyFor = (profile, extras = {}) => buildMatchCacheKey({
  generation: extras.generation || '0',
  studentProfile: profile,
  query: extras.query || '',
  now: extras.now || FIXED_NOW,
  explicitNow: extras.explicitNow !== false,
  scoring: extras.scoring
});

const runKeyTests = () => {
  const student = baseStudent('student-a');
  const baseline = keyFor(student);

  assert.ok(baseline);
  assert.ok(baseline.startsWith(`${MATCH_CACHE_KEY_PREFIX}0:`));
  assert.strictEqual(profileMatchFields(student).schoolName, undefined);
  assert.strictEqual(profileMatchFields(student).yearLevel, undefined);
  assert.strictEqual(
    buildMatchCacheKey({
      generation: '0',
      studentProfile: { course: 'BSIT' },
      query: '',
      now: FIXED_NOW,
      explicitNow: true
    }),
    null
  );

  const relevant = {
    academicLevel: 'Senior High School',
    course: 'BS Nursing',
    gwa: 1.25,
    gwaScale: '60-100',
    incomeBracket: 'Above ₱131,484 / month',
    region: 'Davao Region',
    province: 'Cebu',
    municipalityCity: 'Cebu City',
    citizenship: 'Non-Filipino'
  };

  Object.entries(relevant).forEach(([field, value]) => {
    assert.notStrictEqual(
      baseline,
      keyFor(baseStudent('student-a', { [field]: value })),
      field
    );
  });

  FLAG_TAGS.forEach((entry) => {
    assert.notStrictEqual(
      baseline,
      keyFor(baseStudent('student-a', {
        specialEligibilityFlags: { [entry.flag]: true }
      })),
      entry.flag
    );
  });

  assert.strictEqual(
    baseline,
    keyFor(baseStudent('student-a', { specialEligibilityFlags: {
      isIndigenous: false,
      isPWD: false,
      isSoloParentChild: false,
      isOrphan: false,
      isFarmerFisherfolkChild: false,
      isDisasterAffected: false,
      isWorkingStudent: false,
      is4PsBeneficiary: false
    } }))
  );
  assert.notStrictEqual(baseline, keyFor(baseStudent('student-b')));

  ['schoolName', 'yearLevel', 'dateOfBirth', 'schoolType', 'isMinor'].forEach((field) => {
    const value = field === 'isMinor' ? true : `changed-${field}`;
    assert.strictEqual(
      baseline,
      keyFor(baseStudent('student-a', { [field]: value })),
      field
    );
  });

  assert.strictEqual(keyFor(student, { query: ' IT ' }), keyFor(student, { query: 'IT' }));
  assert.notStrictEqual(keyFor(student, { query: 'IT' }), keyFor(student, { query: 'it' }));
  assert.notStrictEqual(keyFor(student, { query: 'IT' }), keyFor(student, { query: 'nursing' }));
  assert.notStrictEqual(
    keyFor(student, { generation: '1' }),
    keyFor(student, { generation: '2' })
  );
  assert.notStrictEqual(
    keyFor(student, { now: FIXED_NOW }),
    keyFor(student, { now: AFTER_DEADLINE })
  );

  const changedWeights = scoringConfiguration();
  changedWeights.defaultWeights = {
    ...changedWeights.defaultWeights,
    gwaWeight: 0.5,
    incomeWeight: 0.3
  };
  assert.notStrictEqual(baseline, keyFor(student, { scoring: changedWeights }));

  const changedBand = scoringConfiguration();
  changedBand.classification = changedBand.classification.map((band) => ({ ...band }));
  changedBand.classification[0] = {
    ...changedBand.classification[0],
    minimumScore: 91
  };
  assert.notStrictEqual(baseline, keyFor(student, { scoring: changedBand }));
  assert.strictEqual(MATCH_CACHE_TTL_SECONDS, 60);
};

const openClient = async (url) => {
  const client = createClient({
    url,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 1000,
      reconnectStrategy: () => false
    }
  });
  client.on('error', () => {});
  await client.connect();

  const info = String(await client.sendCommand(['CLIENT', 'INFO']));
  if (!info.includes('db=14')) {
    await client.quit();
    throw new Error(`Refusing to write: ${url} is not database 14`);
  }

  return client;
};

const connectRedis = async () => {
  try {
    const client = await openClient('redis://127.0.0.1:6379/14');
    return {
      client,
      endpoint: '127.0.0.1:6379 database 14',
      containerName: null
    };
  } catch (existingError) {
    const containerName = `iskolarmatch-match-cache-${process.pid}`;

    try {
      await exec('docker', [
        'run',
        '-d',
        '--name',
        containerName,
        '-p',
        '127.0.0.1:6400:6379',
        'redis:7-alpine'
      ]);
    } catch (dockerError) {
      const reason = existingError && existingError.message
        ? existingError.message
        : 'connection failed';
      throw new Error(
        `No isolated Redis available. Localhost:6379 database 14 failed (${reason}). Docker start failed (${dockerError.message}).`
      );
    }

    let lastError = null;

    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const client = await openClient('redis://127.0.0.1:6400/14');
        return {
          client,
          endpoint: '127.0.0.1:6400 database 14 (temporary Docker Redis)',
          containerName
        };
      } catch (error) {
        lastError = error;
        await delay(250);
      }
    }

    try {
      await exec('docker', ['rm', '-f', containerName]);
    } catch (cleanupError) {
      lastError = cleanupError;
    }

    throw new Error(
      `Temporary Redis did not accept database 14. ${lastError && lastError.message}`
    );
  }
};

const remember = (event) => {
  observed.push(event);
  if (event && typeof event.key === 'string' && event.key.startsWith(MATCH_CACHE_KEY_PREFIX)) {
    createdKeys.add(event.key);
  }
};

const aliasIndexWith = (alias) => {
  const index = new Map(CATALOG_INDEX);
  buildAliasIndex([{
    canonicalId: 'college-bsit',
    canonicalName: 'BS Information Technology',
    academicLevel: 'College',
    kind: 'program',
    aliases: [alias]
  }]).forEach((canonicalId, key) => {
    index.set(key, canonicalId);
  });
  return index;
};

const rank = async (redis, profile, {
  records,
  query = '',
  search,
  beforeFind,
  aliasIndex = CATALOG_INDEX
} = {}) => {
  const events = [];
  const calls = { find: 0, search: 0, alias: 0 };
  const matches = await getRankedScholarships(profile, {
    query,
    now: FIXED_NOW,
    matchCacheClient: redis,
    onMatchCache: (event) => {
      events.push(event);
      remember(event);
    },
    loadAliasIndex: async () => {
      calls.alias += 1;
      return aliasIndex;
    },
    searchScholarships: async (request) => {
      calls.search += 1;
      if (search) {
        return search(request);
      }
      throw new Error('search should not be called');
    },
    findScholarships: async (filter) => {
      calls.find += 1;
      if (beforeFind) {
        await beforeFind();
      }
      return records
        .filter((doc) => matchesFilter(doc, filter))
        .map(withoutFunctions);
    }
  });

  return { matches, events, calls };
};

const runBehaviorTests = async (redis) => {
  const student = baseStudent('student-a');
  const records = [
    scholarship('eligible-it', {
      name: 'Information Technology Grant',
      description: 'Support for information technology students.'
    }),
    scholarship('eligible-nursing', {
      name: 'Nursing Award',
      courseProgram: ['BS Nursing']
    })
  ];
  const direct = rankScholarships(student, [records[0]], CATALOG_INDEX, FIXED_NOW);

  const first = await rank(redis, student, { records });
  assert.strictEqual(first.events[0].event, 'miss');
  assert.strictEqual(first.events.some((event) => event.event === 'store'), true);
  assert.strictEqual(first.calls.find, 1);
  assert.strictEqual(first.calls.alias, 1);
  assert.deepStrictEqual(idsOf(first.matches), ['eligible-it']);
  assert.deepStrictEqual(normalized(first.matches), normalized(direct));
  assert.ok(first.events[0].key.startsWith(MATCH_CACHE_KEY_PREFIX));
  assert.ok(!first.events[0].key.startsWith('bl_'));
  assert.ok(!first.events[0].key.includes('auth:sessions:'));

  const ttl = await redis.ttl(first.events[0].key);
  assert.ok(ttl <= MATCH_CACHE_TTL_SECONDS && ttl >= 55, `ttl ${ttl}`);
  observed.ttl = ttl;

  const repeated = await rank(redis, student, { records });
  assert.strictEqual(repeated.events[0].event, 'hit');
  assert.strictEqual(repeated.calls.find, 0);
  assert.strictEqual(repeated.calls.alias, 0);
  assert.strictEqual(repeated.calls.search, 0);
  assert.deepStrictEqual(repeated.matches, first.matches);

  const trimmed = await rank(redis, student, {
    records,
    query: ' IT ',
    search: async () => ({
      total: 1,
      hits: [{ id: 'eligible-it' }]
    })
  });
  assert.strictEqual(trimmed.events[0].event, 'miss');
  assert.strictEqual(trimmed.calls.search, 1);
  const trimmedAgain = await rank(redis, student, {
    records,
    query: 'IT',
    search: async () => ({
      total: 1,
      hits: [{ id: 'eligible-it' }]
    })
  });
  assert.strictEqual(trimmedAgain.events[0].event, 'hit');
  assert.strictEqual(trimmedAgain.calls.search, 0);
  assert.deepStrictEqual(trimmedAgain.matches, trimmed.matches);

  const otherCase = await rank(redis, student, {
    records,
    query: 'it',
    search: async () => ({
      total: 1,
      hits: [{ id: 'eligible-it' }]
    })
  });
  assert.strictEqual(otherCase.events[0].event, 'miss');
  assert.strictEqual(otherCase.calls.search, 1);
  assert.notStrictEqual(otherCase.events[0].key, trimmed.events[0].key);

  const otherStudent = await rank(redis, baseStudent('student-b'), { records });
  assert.strictEqual(otherStudent.events[0].event, 'miss');
  assert.strictEqual(otherStudent.calls.find, 1);
  assert.notStrictEqual(otherStudent.events[0].key, first.events[0].key);
  assert.deepStrictEqual(idsOf(otherStudent.matches), ['eligible-it']);

  const schoolOnly = await rank(redis, baseStudent('student-a', {
    schoolName: 'Another School'
  }), { records });
  assert.strictEqual(schoolOnly.events[0].event, 'hit');
  assert.strictEqual(schoolOnly.calls.find, 0);
  assert.deepStrictEqual(schoolOnly.matches, first.matches);

  const moved = await rank(redis, baseStudent('student-a', {
    province: 'Cebu'
  }), { records });
  assert.strictEqual(moved.events[0].event, 'miss');
  assert.strictEqual(moved.calls.find, 1);

  const rescored = await rank(redis, baseStudent('student-a', { gwa: 1 }), { records });
  assert.strictEqual(rescored.events[0].event, 'miss');
  assert.notStrictEqual(rescored.matches[0].totalScore, first.matches[0].totalScore);
  assert.deepStrictEqual(
    normalized(rescored.matches),
    normalized(rankScholarships(
      baseStudent('student-a', { gwa: 1 }),
      [records[0]],
      CATALOG_INDEX,
      FIXED_NOW
    ))
  );

  const named = [scholarship('named-grant', { name: 'Original Grant' })];
  const namedStudent = baseStudent('student-named');
  const originalName = await rank(redis, namedStudent, { records: named });
  assert.strictEqual(originalName.matches[0].scholarship.name, 'Original Grant');
  named[0].name = 'Renamed Grant';
  const staleName = await rank(redis, namedStudent, { records: named });
  assert.strictEqual(staleName.events[0].event, 'hit');
  assert.strictEqual(staleName.matches[0].scholarship.name, 'Original Grant');
  const invalidated = await invalidateMatchCache(redis);
  assert.strictEqual(invalidated.ok, true);
  const renamed = await rank(redis, namedStudent, { records: named });
  assert.strictEqual(renamed.events[0].event, 'miss');
  assert.strictEqual(renamed.matches[0].scholarship.name, 'Renamed Grant');
  assert.notStrictEqual(renamed.events[0].key, originalName.events[0].key);

  const weighted = [scholarship('weighted-grant')];
  const weightedStudent = baseStudent('student-weighted');
  const oldWeights = await rank(redis, weightedStudent, { records: weighted });
  weighted[0].criteriaWeights = {
    gwaWeight: 0.7,
    incomeWeight: 0.2,
    tagsWeight: 0.1
  };
  const beforeWeightInvalidation = await rank(redis, weightedStudent, { records: weighted });
  assert.strictEqual(beforeWeightInvalidation.events[0].event, 'hit');
  assert.strictEqual(
    beforeWeightInvalidation.matches[0].totalScore,
    oldWeights.matches[0].totalScore
  );
  await invalidateMatchCache(redis);
  const newWeights = await rank(redis, weightedStudent, { records: weighted });
  assert.strictEqual(newWeights.events[0].event, 'miss');
  assert.notStrictEqual(newWeights.matches[0].totalScore, oldWeights.matches[0].totalScore);
  assert.deepStrictEqual(newWeights.matches[0].weights, {
    gwaWeight: 0.7,
    incomeWeight: 0.2,
    tagsWeight: 0.1
  });
  assert.deepStrictEqual(
    normalized(newWeights.matches),
    normalized(rankScholarships(weightedStudent, weighted, CATALOG_INDEX, FIXED_NOW))
  );

  const expiringKeyOwner = baseStudent('student-ttl');
  const expiringRecords = [scholarship('ttl-grant', { name: 'TTL Original' })];
  const cachedTtl = await rank(redis, expiringKeyOwner, { records: expiringRecords });
  const ttlKey = cachedTtl.events[0].key;
  createdKeys.add(ttlKey);
  expiringRecords[0].name = 'TTL Recomputed';
  const stillCached = await rank(redis, expiringKeyOwner, { records: expiringRecords });
  assert.strictEqual(stillCached.events[0].event, 'hit');
  assert.strictEqual(stillCached.matches[0].scholarship.name, 'TTL Original');
  await redis.expire(ttlKey, 1);
  await delay(2500);
  const recomputed = await rank(redis, expiringKeyOwner, { records: expiringRecords });
  assert.strictEqual(recomputed.events[0].event, 'miss');
  assert.strictEqual(recomputed.calls.find, 1);
  assert.strictEqual(recomputed.matches[0].scholarship.name, 'TTL Recomputed');

  const emptyStudent = baseStudent('student-empty');
  const emptyFirst = await rank(redis, emptyStudent, {
    records,
    query: 'marine biology',
    search: async () => ({ total: 0, hits: [] })
  });
  assert.deepStrictEqual(emptyFirst.matches, []);
  assert.strictEqual(emptyFirst.events[0].event, 'miss');
  const emptySecond = await rank(redis, emptyStudent, {
    records,
    query: 'marine biology',
    search: async () => {
      throw new Error('empty result should have been cached');
    }
  });
  assert.strictEqual(emptySecond.events[0].event, 'hit');
  assert.deepStrictEqual(emptySecond.matches, []);
  assert.strictEqual(emptySecond.calls.search, 0);

  const failingStudent = baseStudent('student-search-failure');
  let searchFails = true;
  await assert.rejects(
    () => rank(redis, failingStudent, {
      records,
      query: 'broken-index',
      search: async () => {
        if (searchFails) {
          throw new Error('connect ECONNREFUSED 127.0.0.1:9200');
        }
        return { total: 1, hits: [{ id: 'eligible-it' }] };
      }
    }),
    (error) => error.code === 'SEARCH_UNAVAILABLE'
  );
  const failedEvent = observed.filter((event) => event.key && event.event === 'miss').at(-1);
  assert.ok(failedEvent);
  assert.strictEqual(await redis.get(failedEvent.key), null);
  searchFails = false;
  const recovered = await rank(redis, failingStudent, {
    records,
    query: 'broken-index',
    search: async () => ({ total: 1, hits: [{ id: 'eligible-it' }] })
  });
  assert.strictEqual(recovered.events[0].event, 'miss');
  assert.deepStrictEqual(idsOf(recovered.matches), ['eligible-it']);

  const generation = (await redis.get(MATCH_CACHE_GENERATION_KEY)) || '0';
  const poisonProfile = baseStudent('student-poison');
  const poisonKey = buildMatchCacheKey({
    generation,
    studentProfile: poisonProfile,
    query: '',
    now: FIXED_NOW,
    explicitNow: true
  });
  createdKeys.add(poisonKey);
  await redis.set(poisonKey, JSON.stringify({
    v: 1,
    studentId: 'someone-else',
    query: '',
    timeKey: 'instant:2026-10-27T02:00:00.000Z',
    matches: [{ scholarship: { _id: 'wrong' }, totalScore: 1 }]
  }), { EX: 60 });
  const poisoned = await rank(redis, poisonProfile, { records });
  assert.strictEqual(poisoned.events[0].event, 'miss');
  assert.deepStrictEqual(idsOf(poisoned.matches), ['eligible-it']);
  assert.ok(!idsOf(poisoned.matches).includes('wrong'));

  const corruptProfile = baseStudent('student-corrupt');
  const corruptKey = buildMatchCacheKey({
    generation: (await redis.get(MATCH_CACHE_GENERATION_KEY)) || '0',
    studentProfile: corruptProfile,
    query: '',
    now: FIXED_NOW,
    explicitNow: true
  });
  createdKeys.add(corruptKey);
  await redis.set(corruptKey, 'not-json', { EX: 60 });
  const corrupted = await rank(redis, corruptProfile, { records });
  assert.strictEqual(corrupted.events[0].event, 'miss');
  assert.deepStrictEqual(idsOf(corrupted.matches), ['eligible-it']);

  const anonymous = { ...student };
  delete anonymous.userId;
  const anonymousFirst = await rank(redis, anonymous, { records });
  const anonymousSecond = await rank(redis, anonymous, { records });
  assert.strictEqual(anonymousFirst.events[0].event, 'bypass');
  assert.strictEqual(anonymousFirst.events[0].reason, 'missing_student_id');
  assert.strictEqual(anonymousSecond.calls.find, 1);
  assert.deepStrictEqual(anonymousSecond.matches, anonymousFirst.matches);

  const failingRedis = {
    isOpen: true,
    isReady: true,
    async get() {
      throw new Error('redis read failed');
    },
    async set() {
      throw new Error('redis write failed');
    },
    async incr() {
      throw new Error('redis incr failed');
    }
  };
  const liveRecords = [scholarship('live-grant')];
  const liveStudent = baseStudent('student-live');
  const liveOptions = {
    records: liveRecords,
    search: async () => {
      throw new Error('search should not be called');
    }
  };
  const liveFirst = await rank(failingRedis, liveStudent, liveOptions);
  const liveSecond = await rank(failingRedis, liveStudent, liveOptions);
  assert.strictEqual(liveFirst.events[0].event, 'bypass');
  assert.strictEqual(liveFirst.events[0].reason, 'invalidation_untrusted');
  assert.strictEqual(liveSecond.calls.find, 1);
  assert.deepStrictEqual(liveFirst.matches, liveSecond.matches);
  assert.deepStrictEqual(
    normalized(liveFirst.matches),
    normalized(rankScholarships(liveStudent, liveRecords, CATALOG_INDEX, FIXED_NOW))
  );
  const entryReadFailure = {
    isOpen: true,
    isReady: true,
    async get(key) {
      if (key === MATCH_CACHE_TRUST_KEY) {
        return '1';
      }

      if (key === MATCH_CACHE_GENERATION_KEY) {
        return '0';
      }

      throw new Error('redis read failed');
    },
    async set() {
      throw new Error('redis write failed');
    }
  };
  const entryStudent = baseStudent('student-entry-read-failure');
  const entryFirst = await rank(entryReadFailure, entryStudent, liveOptions);
  assert.strictEqual(entryFirst.events[0].reason, 'redis_read_failed');
  assert.deepStrictEqual(
    normalized(entryFirst.matches),
    normalized(rankScholarships(entryStudent, liveRecords, CATALOG_INDEX, FIXED_NOW))
  );
  const writeFailure = {
    isOpen: true,
    isReady: true,
    async get() {
      return null;
    },
    async set() {
      throw new Error('redis write failed');
    },
    async incr() {
      return 1;
    }
  };
  const writeStudent = baseStudent('student-write-failure');
  const writeFirst = await rank(writeFailure, writeStudent, { records: liveRecords });
  const writeSecond = await rank(writeFailure, writeStudent, { records: liveRecords });
  assert.strictEqual(writeFirst.events.some((event) => event.reason === 'redis_write_failed'), true);
  assert.strictEqual(writeSecond.events[0].event, 'miss');
  assert.strictEqual(writeSecond.calls.find, 1);
  assert.deepStrictEqual(writeFirst.matches, writeSecond.matches);

  let entered = 0;
  let releaseOverlap;
  const overlap = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('concurrent ranking did not overlap'));
    }, 20000);
    releaseOverlap = () => {
      clearTimeout(timer);
      resolve();
    };
  });
  const beforeFind = async () => {
    entered += 1;
    if (entered === 2) {
      releaseOverlap();
    }
    await overlap;
  };
  const shared = [
    scholarship('eligible-it'),
    scholarship('eligible-nursing', {
      name: 'Nursing Award',
      courseProgram: ['BS Nursing']
    })
  ];
  const [itResult, nursingResult] = await Promise.all([
    rank(redis, baseStudent('student-it'), { records: shared, beforeFind }),
    rank(redis, baseStudent('student-nursing', { course: 'BS Nursing' }), {
      records: shared,
      beforeFind
    })
  ]);
  assert.strictEqual(entered, 2);
  assert.deepStrictEqual(idsOf(itResult.matches), ['eligible-it']);
  assert.deepStrictEqual(idsOf(nursingResult.matches), ['eligible-nursing']);
  assert.notStrictEqual(itResult.events[0].key, nursingResult.events[0].key);
  const itAgain = await rank(redis, baseStudent('student-it'), { records: shared });
  const nursingAgain = await rank(redis, baseStudent('student-nursing', {
    course: 'BS Nursing'
  }), { records: shared });
  assert.strictEqual(itAgain.events[0].event, 'hit');
  assert.strictEqual(nursingAgain.events[0].event, 'hit');
  assert.deepStrictEqual(itAgain.matches, itResult.matches);
  assert.deepStrictEqual(nursingAgain.matches, nursingResult.matches);

  const raced = [scholarship('raced-grant', { name: 'Before Change' })];
  const racedStudent = baseStudent('student-raced');
  const racedFirst = await rank(redis, racedStudent, {
    records: raced,
    beforeFind: async () => {
      await invalidateMatchCache(redis);
      raced[0].name = 'During Change';
    }
  });
  assert.strictEqual(racedFirst.matches[0].scholarship.name, 'During Change');
  assert.strictEqual(
    racedFirst.events.some((event) => event.reason === 'generation_changed'),
    true
  );
  const racedSecond = await rank(redis, racedStudent, { records: raced });
  assert.strictEqual(racedSecond.events[0].event, 'miss');
  assert.strictEqual(racedSecond.calls.find, 1);
  assert.strictEqual(racedSecond.matches[0].scholarship.name, 'During Change');
};

const runCorrectnessTests = async (redis) => {
  const CourseAlias = require('../models/CourseAlias');
  const aliasHooks = CourseAlias.schema.s.hooks;
  [
    'save',
    'insertMany',
    'updateOne',
    'updateMany',
    'findOneAndUpdate',
    'replaceOne',
    'deleteOne',
    'deleteMany',
    'findOneAndDelete'
  ].forEach((hook) => {
    const posts = aliasHooks._posts.get(hook) || [];
    assert.ok(posts.length > 0, `course alias ${hook} hook is registered`);
  });

  const aliasStudent = baseStudent('student-alias', { course: 'ZZTECH' });
  const aliasRecord = scholarship('alias-grant');
  const expandedAliasIndex = aliasIndexWith('ZZTECH');
  const withoutAlias = await rank(redis, aliasStudent, { records: [aliasRecord] });
  assert.strictEqual(withoutAlias.events[0].event, 'miss');
  assert.deepStrictEqual(idsOf(withoutAlias.matches), []);

  const staleAlias = await rank(redis, aliasStudent, {
    records: [aliasRecord],
    aliasIndex: expandedAliasIndex
  });
  assert.strictEqual(staleAlias.events[0].event, 'hit');
  assert.strictEqual(staleAlias.calls.find, 0);
  assert.deepStrictEqual(idsOf(staleAlias.matches), []);

  const generationBeforeAlias = await generationOf(redis);
  const originalInvalidate = matchCache.invalidateMatchCache;
  matchCache.invalidateMatchCache = async () => invalidateMatchCache(redis);
  try {
    await aliasHooks.execPost('save', null, [{}], {
      filter: (post) => post.fn && post.fn.name === 'invalidateAliasMatchCache'
    });
  } finally {
    matchCache.invalidateMatchCache = originalInvalidate;
  }
  assert.notStrictEqual(await generationOf(redis), generationBeforeAlias);

  const withAlias = await rank(redis, aliasStudent, {
    records: [aliasRecord],
    aliasIndex: expandedAliasIndex
  });
  assert.strictEqual(withAlias.events[0].event, 'miss');
  assert.strictEqual(withAlias.calls.alias, 1);
  assert.deepStrictEqual(idsOf(withAlias.matches), ['alias-grant']);

  const deadlineStudent = baseStudent('student-deadline');
  const deadlineRecord = scholarship('deadline-grant', {
    deadline: new Date('2026-12-31T00:00:00.000Z')
  });
  const cachedDeadline = await rank(redis, deadlineStudent, { records: [deadlineRecord] });
  assert.strictEqual(cachedDeadline.events[0].event, 'miss');
  assert.deepStrictEqual(idsOf(cachedDeadline.matches), ['deadline-grant']);
  const storedDeadline = JSON.parse(await redis.get(cachedDeadline.events[0].key));
  storedDeadline.matches[0].scholarship.deadline = '2020-01-01';
  await redis.set(
    cachedDeadline.events[0].key,
    JSON.stringify(storedDeadline),
    { EX: MATCH_CACHE_TTL_SECONDS }
  );
  const elapsedDeadline = await rank(redis, deadlineStudent, { records: [deadlineRecord] });
  assert.strictEqual(elapsedDeadline.events[0].event, 'miss');
  assert.strictEqual(elapsedDeadline.events[0].reason, 'deadline_elapsed');
  assert.strictEqual(elapsedDeadline.calls.find, 1);
  assert.deepStrictEqual(idsOf(elapsedDeadline.matches), ['deadline-grant']);
  assert.ok(
    String(elapsedDeadline.matches[0].scholarship.deadline).includes('2026')
  );
  const ttlAfterDeadlineCheck = await redis.ttl(elapsedDeadline.events.find((event) => event.event === 'store').key);
  assert.ok(ttlAfterDeadlineCheck <= MATCH_CACHE_TTL_SECONDS);
  assert.ok(ttlAfterDeadlineCheck >= 55);

  const trustStudent = baseStudent('student-trust');
  const trustRecord = scholarship('trust-grant', { name: 'Trust Original' });
  const trustRecords = [trustRecord];
  const trustCached = await rank(redis, trustStudent, { records: trustRecords });
  assert.strictEqual(trustCached.events[0].event, 'miss');
  trustRecord.name = 'Trust Live';
  const stillTrusted = await rank(redis, trustStudent, { records: trustRecords });
  assert.strictEqual(stillTrusted.events[0].event, 'hit');
  assert.strictEqual(stillTrusted.matches[0].scholarship.name, 'Trust Original');

  const failingRedis = {
    isOpen: true,
    isReady: true,
    incr: async () => {
      throw new Error('increment failed');
    },
    set: async () => {
      throw new Error('trust update failed');
    }
  };
  const failedInvalidation = await invalidateMatchCache(failingRedis);
  assert.strictEqual(failedInvalidation.ok, false);
  assert.strictEqual(failedInvalidation.reason, 'redis_write_failed');
  const afterFailedIncrement = await rank(redis, trustStudent, { records: trustRecords });
  assert.strictEqual(afterFailedIncrement.events[0].event, 'bypass');
  assert.strictEqual(afterFailedIncrement.events[0].reason, 'invalidation_untrusted');
  assert.strictEqual(afterFailedIncrement.calls.find, 1);
  assert.strictEqual(afterFailedIncrement.matches[0].scholarship.name, 'Trust Live');

  const restored = await invalidateMatchCache(redis);
  assert.strictEqual(restored.ok, true);
  assert.strictEqual(await redis.get(MATCH_CACHE_TRUST_KEY), '1');
  trustRecord.name = 'Trust Newer';
  const restoredCache = await rank(redis, trustStudent, { records: trustRecords });
  assert.strictEqual(restoredCache.events[0].event, 'miss');
  assert.strictEqual(restoredCache.matches[0].scholarship.name, 'Trust Newer');
  const restoredHit = await rank(redis, trustStudent, { records: trustRecords });
  assert.strictEqual(restoredHit.events[0].event, 'hit');
  assert.strictEqual(restoredHit.matches[0].scholarship.name, 'Trust Newer');

  await redis.set(MATCH_CACHE_TRUST_KEY, '0');
  trustRecord.name = 'Trust Unmarked';
  const unmarkedTrust = await rank(redis, trustStudent, { records: trustRecords });
  assert.strictEqual(unmarkedTrust.events[0].event, 'bypass');
  assert.strictEqual(unmarkedTrust.events[0].reason, 'invalidation_untrusted');
  assert.strictEqual(unmarkedTrust.calls.find, 1);
  assert.strictEqual(unmarkedTrust.matches[0].scholarship.name, 'Trust Unmarked');
  const trustedAgain = await invalidateMatchCache(redis);
  assert.strictEqual(trustedAgain.ok, true);
  assert.strictEqual(await redis.get(MATCH_CACHE_TRUST_KEY), '1');
};

const mockRes = () => ({
  statusCode: 200,
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

const validBody = (overrides = {}) => ({
  name: 'Created Grant',
  scholarshipType: 'Merit',
  description: 'Created during the cache test.',
  grantValue: '10000',
  deadline: '2027-12-31',
  applicationURL: 'https://provider.example.edu/apply',
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

const generationOf = async (redis) => {
  const value = await redis.get(MATCH_CACHE_GENERATION_KEY);
  return value === null ? '0' : String(value);
};

const runControllerTests = async (redis) => {
  const originals = {
    providerFindOne: Provider.findOne,
    scholarshipFindOne: Scholarship.findOne,
    scholarshipCreate: Scholarship.create,
    scholarshipFindByIdAndUpdate: Scholarship.findByIdAndUpdate,
    reportFindById: Report.findById,
    auditCreate: AuditLog.create,
    sync: searchSync.syncScholarshipSearch,
    invalidate: matchCache.invalidateMatchCache
  };

  matchCache.invalidateMatchCache = async () => invalidateMatchCache(redis);
  searchSync.syncScholarshipSearch = async () => ({ synchronized: true });
  AuditLog.create = async () => ({ _id: 'audit-test' });
  const provider = {
    _id: 'provider-1',
    verificationStatus: 'Verified'
  };
  Provider.findOne = async () => provider;

  try {
    const records = [attachSave(scholarship('controller-grant', { name: 'Controller Grant' }))];
    const student = baseStudent('student-controller');
    Scholarship.findOne = async (query) => records.find((record) => (
      String(record._id) === String(query._id) &&
      String(record.providerId) === String(query.providerId)
    )) || null;

    const cached = await rank(redis, student, { records });
    assert.deepStrictEqual(idsOf(cached.matches), ['controller-grant']);
    const beforeRejectedCreate = await generationOf(redis);
    provider.verificationStatus = 'Pending';
    const rejected = mockRes();
    await scholarshipController.createScholarship(
      { user: { id: 'user-1' }, body: validBody() },
      rejected
    );
    assert.strictEqual(rejected.statusCode, 403);
    assert.strictEqual(await generationOf(redis), beforeRejectedCreate);
    provider.verificationStatus = 'Verified';

    const beforeInvalid = await generationOf(redis);
    const invalid = mockRes();
    await scholarshipController.createScholarship(
      {
        user: { id: 'user-1' },
        body: validBody({ applicationURL: 'javascript:alert(1)' })
      },
      invalid
    );
    assert.strictEqual(invalid.statusCode, 400);
    assert.strictEqual(await generationOf(redis), beforeInvalid);

    Scholarship.create = async (data) => {
      const created = attachSave(scholarship('created-grant', {
        name: data.name,
        courseProgram: ['BS Information Technology']
      }));
      records.push(created);
      return created;
    };
    const createdResponse = mockRes();
    await scholarshipController.createScholarship(
      { user: { id: 'user-1', email: 'provider@example.com' }, body: validBody() },
      createdResponse
    );
    assert.strictEqual(createdResponse.statusCode, 201);
    const createdRank = await rank(redis, student, { records });
    assert.strictEqual(createdRank.events[0].event, 'miss');
    assert.deepStrictEqual(idsOf(createdRank.matches), ['controller-grant', 'created-grant']);

    const beforeWeights = createdRank.matches.find((match) => match.scholarship._id === 'controller-grant');
    const weightResponse = mockRes();
    await scholarshipController.updateScholarship(
      {
        user: { id: 'user-1' },
        params: { id: 'controller-grant' },
        body: {
          criteriaWeights: {
            gwaWeight: 0.7,
            incomeWeight: 0.2,
            tagsWeight: 0.1
          }
        }
      },
      weightResponse
    );
    assert.strictEqual(weightResponse.statusCode, 200);
    const weightedRank = await rank(redis, student, { records });
    assert.strictEqual(weightedRank.events[0].event, 'miss');
    const updated = weightedRank.matches.find((match) => match.scholarship._id === 'controller-grant');
    assert.notStrictEqual(updated.totalScore, beforeWeights.totalScore);
    assert.deepStrictEqual(updated.weights, {
      gwaWeight: 0.7,
      incomeWeight: 0.2,
      tagsWeight: 0.1
    });

    const statusResponse = mockRes();
    await scholarshipController.updateScholarshipStatus(
      {
        user: { id: 'user-1' },
        params: { id: 'created-grant' },
        body: { status: 'Closed' }
      },
      statusResponse
    );
    assert.strictEqual(statusResponse.statusCode, 200);
    const closedRank = await rank(redis, student, { records });
    assert.strictEqual(closedRank.events[0].event, 'miss');
    assert.ok(!idsOf(closedRank.matches).includes('created-grant'));

    const alreadyArchived = await generationOf(redis);
    records[0].isArchived = true;
    const archivedTwice = mockRes();
    await scholarshipController.archiveScholarship(
      { user: { id: 'user-1' }, params: { id: 'controller-grant' } },
      archivedTwice
    );
    assert.strictEqual(archivedTwice.statusCode, 400);
    assert.strictEqual(await generationOf(redis), alreadyArchived);
    records[0].isArchived = false;
    const archiveResponse = mockRes();
    await scholarshipController.archiveScholarship(
      { user: { id: 'user-1' }, params: { id: 'controller-grant' } },
      archiveResponse
    );
    assert.strictEqual(archiveResponse.statusCode, 200);
    const archivedRank = await rank(redis, student, { records });
    assert.strictEqual(archivedRank.events[0].event, 'miss');
    assert.deepStrictEqual(archivedRank.matches, []);

    const adminRecord = attachSave(scholarship('admin-grant'));
    const adminRecords = [adminRecord];
    const adminStudent = baseStudent('student-admin');
    const adminCached = await rank(redis, adminStudent, { records: adminRecords });
    assert.deepStrictEqual(idsOf(adminCached.matches), ['admin-grant']);
    const missingGeneration = await generationOf(redis);
    Scholarship.findByIdAndUpdate = async () => null;
    const missingRes = mockRes();
    let missingError = null;
    await adminUpdateScholarshipStatus(
      { params: { id: 'missing' }, body: { status: 'APPROVED' }, user: { email: 'admin@example.com' } },
      missingRes,
      (error) => {
        missingError = error;
      }
    );
    assert.ok(missingError);
    assert.strictEqual(await generationOf(redis), missingGeneration);

    Scholarship.findByIdAndUpdate = async (id, update) => {
      assert.strictEqual(String(id), 'admin-grant');
      adminRecord.status = update.status;
      return adminRecord;
    };
    const adminRes = mockRes();
    await adminUpdateScholarshipStatus(
      {
        params: { id: 'admin-grant' },
        body: { status: 'APPROVED' },
        user: { email: 'admin@example.com' }
      },
      adminRes,
      () => {}
    );
    assert.strictEqual(adminRes.statusCode, 200);
    const adminRank = await rank(redis, adminStudent, { records: adminRecords });
    assert.strictEqual(adminRank.events[0].event, 'miss');
    assert.deepStrictEqual(adminRank.matches, []);

    const moderated = attachSave(scholarship('moderated-grant'));
    const moderatedRecords = [moderated];
    const moderatedStudent = baseStudent('student-moderated');
    await rank(redis, moderatedStudent, { records: moderatedRecords });
    const report = {
      listingId: 'moderated-grant',
      async save() {
        return this;
      }
    };
    Report.findById = async () => report;
    const untouched = await generationOf(redis);
    const noteRes = mockRes();
    await updateModerationReport(
      {
        params: { id: 'report-1' },
        body: { action: 'NOTE', status: 'Resolved' },
        user: { _id: 'admin-1' }
      },
      noteRes
    );
    assert.strictEqual(noteRes.statusCode, 200);
    assert.strictEqual(await generationOf(redis), untouched);

    Scholarship.findByIdAndUpdate = async () => {
      moderated.status = 'Closed';
      moderated.isArchived = true;
      return moderated;
    };
    const removeRes = mockRes();
    await updateModerationReport(
      {
        params: { id: 'report-1' },
        body: { action: 'REMOVE_LISTING', status: 'Resolved' },
        user: { _id: 'admin-1' }
      },
      removeRes
    );
    assert.strictEqual(removeRes.statusCode, 200);
    const removedRank = await rank(redis, moderatedStudent, { records: moderatedRecords });
    assert.strictEqual(removedRank.events[0].event, 'miss');
    assert.deepStrictEqual(removedRank.matches, []);

    const expiring = attachSave(scholarship('expiring-grant', { deadline: '2026-10-27' }));
    const expiringRecords = [expiring];
    const expiringStudent = baseStudent('student-expiring');
    const openRank = await rank(redis, expiringStudent, { records: expiringRecords });
    assert.deepStrictEqual(idsOf(openRank.matches), ['expiring-grant']);
    const during = await closeExpiredScholarships(FIXED_NOW, {
      findCandidates: async () => [expiring],
      updateMany: async () => {
        throw new Error('updateMany should not run while the deadline day is open');
      },
      findPersisted: async () => [],
      syncScholarshipSearch: async () => ({ synchronized: true })
    });
    assert.strictEqual(during.closedCount, 0);
    const stillOpen = await rank(redis, expiringStudent, { records: expiringRecords });
    assert.strictEqual(stillOpen.events[0].event, 'hit');

    const closed = await closeExpiredScholarships(AFTER_DEADLINE, {
      findCandidates: async () => [expiring],
      updateMany: async () => {
        expiring.status = 'Closed';
        return { modifiedCount: 1 };
      },
      findPersisted: async () => [expiring],
      syncScholarshipSearch: async () => ({ synchronized: true })
    });
    assert.strictEqual(closed.closedCount, 1);
    const expiredRank = await rank(redis, expiringStudent, { records: expiringRecords });
    assert.strictEqual(expiredRank.events[0].event, 'miss');
    assert.deepStrictEqual(expiredRank.matches, []);
  } finally {
    Provider.findOne = originals.providerFindOne;
    Scholarship.findOne = originals.scholarshipFindOne;
    Scholarship.create = originals.scholarshipCreate;
    Scholarship.findByIdAndUpdate = originals.scholarshipFindByIdAndUpdate;
    Report.findById = originals.reportFindById;
    AuditLog.create = originals.auditCreate;
    searchSync.syncScholarshipSearch = originals.sync;
    matchCache.invalidateMatchCache = originals.invalidate;
  }
};

const countPattern = async (redis, pattern) => {
  const keys = await redis.sendCommand(['KEYS', pattern]);
  return Array.isArray(keys) ? keys.length : 0;
};

const cleanupRedis = async (redis, originalGeneration, originalTtl, originalTrust) => {
  for (const key of createdKeys) {
    if (typeof key === 'string' && key.startsWith(MATCH_CACHE_KEY_PREFIX)) {
      await redis.del(key);
    }
  }

  if (originalGeneration === null) {
    await redis.del(MATCH_CACHE_GENERATION_KEY);
  } else {
    await redis.set(MATCH_CACHE_GENERATION_KEY, originalGeneration);
    if (originalTtl > 0) {
      await redis.expire(MATCH_CACHE_GENERATION_KEY, originalTtl);
    }
  }

  if (originalTrust === null) {
    await redis.del(MATCH_CACHE_TRUST_KEY);
  } else {
    await redis.set(MATCH_CACHE_TRUST_KEY, originalTrust);
  }
};

const main = async () => {
  runKeyTests();
  const connection = await connectRedis();
  const redis = connection.client;
  const originalGeneration = await redis.get(MATCH_CACHE_GENERATION_KEY);
  const originalTtl = await redis.ttl(MATCH_CACHE_GENERATION_KEY);
  const originalTrust = await redis.get(MATCH_CACHE_TRUST_KEY);
  const blocklistBefore = await countPattern(redis, 'bl_*');
  const sessionsBefore = await countPattern(redis, 'auth:sessions:*');

  try {
    await runBehaviorTests(redis);
    await runCorrectnessTests(redis);
    await runControllerTests(redis);
    const counts = observed.reduce((summary, event) => {
      summary[event.event] = (summary[event.event] || 0) + 1;
      return summary;
    }, {});
    assert.ok(counts.miss > 0);
    assert.ok(counts.hit > 0);
    assert.ok(counts.store > 0);
    assert.strictEqual(await countPattern(redis, 'bl_*'), blocklistBefore);
    assert.strictEqual(await countPattern(redis, 'auth:sessions:*'), sessionsBefore);
    console.log('match cache tests passed');
    console.log(`redis: ${connection.endpoint}`);
    console.log(`events: ${JSON.stringify(counts)}`);
    console.log(`observed TTL seconds: ${observed.ttl}`);
    console.log(`match keys created by this test: ${createdKeys.size}`);
  } finally {
    try {
      await cleanupRedis(redis, originalGeneration, originalTtl, originalTrust);
    } catch (cleanupError) {
      console.error(`Match cache test cleanup failed. ${cleanupError.message}`);
      process.exitCode = 1;
    }

    try {
      await redis.quit();
    } catch (quitError) {
      console.error(`Match cache Redis client did not close. ${quitError.message}`);
    }

    if (connection.containerName) {
      try {
        await exec('docker', ['rm', '-f', connection.containerName]);
      } catch (dockerError) {
        console.error(`Temporary Redis container was not removed. ${dockerError.message}`);
      }
    }

    closeMatchingPool();
  }
};

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
}).finally(() => {
  process.exit(process.exitCode || 0);
});
