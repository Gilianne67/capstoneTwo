process.env.MATCHING_WORKER_POOL_SIZE = '2';
process.env.MATCHING_WORKER_MAX_QUEUE = '2';

const assert = require('assert');
const { CATALOG_INDEX } = require('../utils/courseCanonicalCore');
const { rankScholarships } = require('../services/matchingEngine');
const {
  MATCHING_POOL_SIZE,
  MATCHING_MAX_QUEUE,
  runMatchingWorker,
  getMatchingPoolStats,
  closeMatchingPool
} = require('../services/matchingWorkerRunner');

const FIXED_NOW = new Date('2026-09-26T04:00:00.000Z');

const student = {
  academicLevel: 'College',
  course: 'BSIT',
  gwa: 1.5,
  gwaScale: '1.00-5.00',
  incomeBracket: 'Below ₱10,000 / month',
  region: 'Bicol Region',
  province: 'Camarines Sur',
  municipalityCity: 'Naga City',
  citizenship: 'Filipino',
  specialEligibilityFlags: {
    isIndigenous: false,
    isPWD: false,
    isSoloParentChild: false,
    isOrphan: false,
    isFarmerFisherfolkChild: false,
    isDisasterAffected: false,
    isWorkingStudent: false,
    is4PsBeneficiary: false
  }
};

const scholarship = {
  _id: 'scholarship-1',
  name: 'Pool Scholarship',
  scholarshipType: 'Merit',
  status: 'Open',
  isArchived: false,
  deadline: '2026-12-31',
  academicRequirements: [
    { gradingScale: '1.00-5.00', minimumGPA: 2.5 }
  ],
  hardFilters: {
    academicLevel: 'College',
    courseProgram: ['BS Information Technology'],
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
};

const input = (extra = {}) => ({
  studentProfile: student,
  scholarships: [scholarship],
  aliasIndex: CATALOG_INDEX,
  now: FIXED_NOW,
  ...extra
});

const signature = (matches) => matches.map((match) => ({
  name: match.scholarship.name,
  totalScore: match.totalScore,
  gpaScore: match.gpaScore,
  incomeScore: match.incomeScore,
  tagsScore: match.tagsScore,
  weights: match.weights,
  classification: match.classification
}));

const expected = signature(rankScholarships(
  student,
  [scholarship],
  CATALOG_INDEX,
  FIXED_NOW
));

let passed = 0;

const test = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`ok ${passed}. ${name}`);
};

const wait = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const main = async () => {
  assert.strictEqual(MATCHING_POOL_SIZE, 2);
  assert.strictEqual(MATCHING_MAX_QUEUE, 2);

  await test('simultaneous jobs share the pool and match main-thread ranking', async () => {
    const results = await Promise.all(
      Array.from({ length: MATCHING_POOL_SIZE + MATCHING_MAX_QUEUE }, () =>
        runMatchingWorker(input(), { diagnostics: true })
      )
    );
    const threadIds = new Set(results.map((result) => result.threadId));

    results.forEach((result) => {
      assert.deepStrictEqual(signature(result.matches), expected);
      assert.notStrictEqual(result.threadId, 0);
    });
    assert.ok(threadIds.size >= 1);
    assert.ok(threadIds.size <= MATCHING_POOL_SIZE);
    assert.ok(getMatchingPoolStats().workers <= MATCHING_POOL_SIZE);
  });

  await test('jobs wait when every worker is busy', async () => {
    const jobs = Array.from({ length: 4 }, () => runMatchingWorker(input({ delayMs: 250 })));
    await wait(40);
    const stats = getMatchingPoolStats();

    assert.strictEqual(stats.busy, MATCHING_POOL_SIZE);
    assert.strictEqual(stats.queued, MATCHING_MAX_QUEUE);
    assert.strictEqual(stats.workers, MATCHING_POOL_SIZE);

    const results = await Promise.all(jobs);
    results.forEach((matches) => {
      assert.deepStrictEqual(signature(matches), expected);
    });
    assert.strictEqual(getMatchingPoolStats().queued, 0);
    assert.strictEqual(getMatchingPoolStats().busy, 0);
  });

  await test('the queue rejects work beyond its bound', async () => {
    const accepted = Array.from({ length: MATCHING_POOL_SIZE + MATCHING_MAX_QUEUE }, () =>
      runMatchingWorker(input({ hang: true }), { timeoutMs: 5000 })
    );

    await assert.rejects(
      () => runMatchingWorker(input({ hang: true }), { timeoutMs: 5000 }),
      /queue is full/
    );
    assert.strictEqual(getMatchingPoolStats().queued, MATCHING_MAX_QUEUE);

    closeMatchingPool();
    const settled = await Promise.allSettled(accepted);
    assert.ok(settled.every((result) => result.status === 'rejected'));
    assert.strictEqual(getMatchingPoolStats().workers, 0);
    assert.strictEqual(getMatchingPoolStats().queued, 0);
  });

  await test('a crashed worker rejects that job and a later job recovers', async () => {
    await assert.rejects(
      () => runMatchingWorker(input({ crash: true })),
      /exited with code 1/
    );

    const matches = await runMatchingWorker(input());
    assert.deepStrictEqual(signature(matches), expected);
    assert.ok(getMatchingPoolStats().workers <= MATCHING_POOL_SIZE);
  });

  await test('a timed-out worker is replaced and later jobs complete', async () => {
    await assert.rejects(
      () => runMatchingWorker(input({ hang: true }), { timeoutMs: 200 }),
      /timed out/
    );

    const matches = await runMatchingWorker(input());
    assert.deepStrictEqual(signature(matches), expected);
  });

  await test('a failed ranking does not retire the worker or change results', async () => {
    const before = getMatchingPoolStats().workers;

    await assert.rejects(
      () => runMatchingWorker(input({ forceError: 'pool forced failure' })),
      /pool forced failure/
    );

    const matches = await runMatchingWorker(input());
    assert.deepStrictEqual(signature(matches), expected);
    assert.strictEqual(getMatchingPoolStats().workers, before);
  });

  await test('shutdown rejects queued work and the pool can be used again', async () => {
    const pending = runMatchingWorker(input({ delayMs: 500 }));
    await wait(20);
    closeMatchingPool();

    await assert.rejects(pending, /shut down/);
    assert.strictEqual(getMatchingPoolStats().workers, 0);

    const matches = await runMatchingWorker(input());
    assert.deepStrictEqual(signature(matches), expected);
  });

  console.log(`matching worker pool tests passed (${passed})`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    closeMatchingPool();
  });
