const assert = require('assert');
const os = require('os');
const { threadId } = require('worker_threads');
const { performance } = require('perf_hooks');
const { CATALOG_INDEX } = require('../utils/courseCanonical');
const { INCOME_BRACKETS, rankScholarships } = require('../services/matchingService');
const {
  runMatchingWorker,
  closeMatchingPool,
  MATCHING_POOL_SIZE
} = require('../services/matchingWorkerRunner');

/**
 * Compares in-process rankScholarships with runMatchingWorker.
 * Database time is not included. Both sides receive the same plain data.
 *
 * Representative size is a capstone demo assumption: this repo does not
 * ship a production scholarship catalog. The stress size is larger than
 * that assumption and is reported separately.
 */
const REPRESENTATIVE_SCHOLARSHIPS = 100;
const REPRESENTATIVE_CONCURRENCY = 10;
const STRESS_SCHOLARSHIPS = 2000;
const STRESS_CONCURRENCY = 10;
const MEASURED_RUNS = 5;
const STRESS_RUNS = 3;
const FIXED_NOW = new Date('2026-09-26T04:00:00.000Z');

const PROGRAMS = [
  ['BSIT', 'BS Information Technology'],
  ['BSCS', 'BS Computer Science'],
  ['BSIS', 'BS Information Systems'],
  ['BSCpE', 'BS Computer Engineering'],
  ['BSCE', 'BS Civil Engineering'],
  ['BSEE', 'BS Electrical Engineering'],
  ['BSME', 'BS Mechanical Engineering'],
  ['BSN', 'BS Nursing'],
  ['BSBA', 'BS Business Administration'],
  ['BSED', 'Bachelor of Secondary Education']
];

const LOCATIONS = [
  {
    scope: 'Nationwide',
    regions: [],
    provinces: [],
    municipalities: []
  },
  {
    scope: 'Region',
    regions: ['Bicol Region'],
    provinces: [],
    municipalities: []
  },
  {
    scope: 'Province',
    regions: [],
    provinces: ['Camarines Sur'],
    municipalities: []
  },
  {
    scope: 'Municipality',
    regions: [],
    provinces: [],
    municipalities: ['Naga City']
  },
  {
    scope: 'Region',
    regions: ['National Capital Region'],
    provinces: [],
    municipalities: []
  }
];

const INCOME_CAPS = [null, 10000, 21190, 43828, 76669];

const baseStudent = (overrides = {}) => {
  const student = {
    academicLevel: 'College',
    course: 'BSIT',
    gwa: 1.5,
    gwaScale: '1.00-5.00',
    incomeBracket: INCOME_BRACKETS[0].label,
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
    },
    ...overrides
  };

  student.specialEligibilityFlags = {
    isIndigenous: false,
    isPWD: false,
    isSoloParentChild: false,
    isOrphan: false,
    isFarmerFisherfolkChild: false,
    isDisasterAffected: false,
    isWorkingStudent: false,
    is4PsBeneficiary: false,
    ...(overrides.specialEligibilityFlags || {})
  };

  return student;
};

const buildScholarships = (count) => {
  const scholarships = [];

  for (let index = 0; index < count; index += 1) {
    const program = PROGRAMS[index % PROGRAMS.length];
    const tags = [];

    if (index % 4 === 0) {
      tags.push({ tagName: 'Working Student', mode: 'Preferred' });
    } else if (index % 4 === 1) {
      tags.push({ tagName: '4Ps Beneficiary', mode: 'Exclusive' });
    }

    scholarships.push({
      _id: `scholarship-${index}`,
      name: `Scholarship ${index}`,
      scholarshipType: index % 2 === 0 ? 'Merit' : 'Need-based',
      grantValue: 'Tuition',
      applicationURL: `https://example.test/apply/${index}`,
      description: 'Representative benchmark scholarship',
      status: 'Open',
      isArchived: false,
      deadline: '2026-12-31',
      academicRequirements: [
        {
          gradingScale: '1.00-5.00',
          minimumGPA: index % 5 === 0 ? 1.75 : 2.5
        },
        { gradingScale: '60-100', minimumGPA: 85 }
      ],
      hardFilters: {
        academicLevel: 'College',
        courseProgram: index % 7 === 0 ? [] : [program[1]],
        geographicLocation: LOCATIONS[index % LOCATIONS.length],
        citizenshipStatus: index % 11 === 0 ? 'Any' : 'Filipino'
      },
      incomeRequirement: {
        maxMonthlyIncome: INCOME_CAPS[index % INCOME_CAPS.length]
      },
      specialTags: tags,
      criteriaWeights: {
        gwaWeight: 0.4,
        incomeWeight: 0.4,
        tagsWeight: 0.2
      }
    });
  }

  return scholarships;
};

const buildStudents = (count) =>
  Array.from({ length: count }, (_, index) => baseStudent({
    gwa: 1 + (index % 5) * 0.25,
    course: PROGRAMS[index % PROGRAMS.length][0],
    incomeBracket: INCOME_BRACKETS[index % INCOME_BRACKETS.length].label,
    specialEligibilityFlags: {
      isWorkingStudent: index % 2 === 0,
      is4PsBeneficiary: index % 3 === 0
    }
  }));

const signatureOf = (matches) =>
  matches.map((match) => ({
    id: match.scholarship._id,
    name: match.scholarship.name,
    totalScore: match.totalScore,
    gpaScore: match.gpaScore,
    incomeScore: match.incomeScore,
    tagsScore: match.tagsScore,
    weights: match.weights,
    classification: match.classification
  }));

const assertEquivalent = (students, scholarships, workerResults) => {
  students.forEach((student, index) => {
    const local = rankScholarships(
      student,
      scholarships,
      CATALOG_INDEX,
      FIXED_NOW
    );
    assert.deepStrictEqual(signatureOf(workerResults[index]), signatureOf(local));
  });
};

const summarize = (values) => {
  const sorted = [...values].filter(Number.isFinite).sort((left, right) => left - right);

  if (sorted.length === 0) {
    return { min: 0, median: 0, max: 0, mean: 0 };
  }

  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
  const p95Index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(0.95 * sorted.length) - 1)
  );

  return {
    count: sorted.length,
    min: sorted[0],
    median,
    p95: sorted[p95Index],
    max: sorted[sorted.length - 1],
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length
  };
};

const fmt = (value) => Number.isFinite(value) ? value.toFixed(2) : 'n/a';

const measure = async (work) => {
  const start = performance.now();
  let timerWaitMs = null;
  const timer = new Promise((resolve) => {
    setTimeout(() => {
      timerWaitMs = performance.now() - start;
      resolve();
    }, 0);
  });
  const rssBefore = process.memoryUsage().rss;
  let peakRss = rssBefore;
  const rssProbe = setInterval(() => {
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
  }, 10);

  try {
    const result = await work();

    if (timerWaitMs === null) {
      await timer;
    }

    return {
      ...result,
      timerWaitMs,
      rssDeltaMb: (peakRss - rssBefore) / (1024 * 1024)
    };
  } finally {
    clearInterval(rssProbe);
  }
};

const runMainOnce = (student, scholarships) => {
  const matches = rankScholarships(
    student,
    scholarships,
    CATALOG_INDEX,
    FIXED_NOW
  );
  return { matches: [matches], latencies: [] };
};

const runWorkerOnce = async (student, scholarships) => {
  const requestStart = performance.now();
  const pending = runMatchingWorker({
    studentProfile: student,
    scholarships,
    aliasIndex: CATALOG_INDEX,
    now: FIXED_NOW
  });
  const setupMs = performance.now() - requestStart;
  const matches = await pending;

  return {
    matches: [matches],
    latencies: [performance.now() - requestStart],
    setupMs
  };
};

const runMainConcurrent = (students, scholarships) => {
  const matches = new Array(students.length);
  const latencies = new Array(students.length);
  const start = performance.now();

  students.forEach((student, index) => {
    const requestStart = performance.now();
    matches[index] = rankScholarships(
      student,
      scholarships,
      CATALOG_INDEX,
      FIXED_NOW
    );
    latencies[index] = performance.now() - requestStart;
  });

  return {
    matches,
    latencies,
    wallMs: performance.now() - start,
    setupMs: 0
  };
};

const runWorkerConcurrent = async (students, scholarships) => {
  const start = performance.now();
  const pending = students.map((student) => {
    const requestStart = performance.now();
    return runMatchingWorker({
      studentProfile: student,
      scholarships,
      aliasIndex: CATALOG_INDEX,
      now: FIXED_NOW
    }).then((matches) => ({
      matches,
      latencyMs: performance.now() - requestStart
    }));
  });
  const setupMs = performance.now() - start;
  const results = await Promise.all(pending);

  return {
    matches: results.map((result) => result.matches),
    latencies: results.map((result) => result.latencyMs),
    wallMs: performance.now() - start,
    setupMs
  };
};

const repeat = async (runs, students, scholarships, createWork) => {
  const samples = [];

  for (let index = 0; index < runs; index += 1) {
    const sample = await measure(createWork());
    assertEquivalent(students, scholarships, sample.matches);
    samples.push(sample);
  }

  return samples;
};

const printSamples = (title, samples) => {
  const wall = summarize(samples.map((sample) => sample.wallMs));
  const setup = summarize(samples.map((sample) => sample.setupMs || 0));
  const timerWait = summarize(samples.map((sample) => sample.timerWaitMs));
  const requests = summarize(samples.flatMap((sample) => sample.latencies));
  const requestMedian = summarize(samples.map((sample) => summarize(sample.latencies).median));
  const requestMax = summarize(samples.map((sample) => summarize(sample.latencies).max));
  const overlap = summarize(samples.map((sample) => {
    const busy = sample.latencies.reduce((sum, value) => sum + value, 0);
    return sample.wallMs > 0 ? busy / sample.wallMs : 0;
  }));
  const rss = summarize(samples.map((sample) => sample.rssDeltaMb));

  console.log(`\n${title}`);
  console.log(`  wall ms (n=${wall.count}): min ${fmt(wall.min)}, median ${fmt(wall.median)}, p95 ${fmt(wall.p95)}, max ${fmt(wall.max)}`);
  console.log(`  request latency ms (n=${requests.count}): median ${fmt(requests.median)}, p95 ${fmt(requests.p95)}, max ${fmt(requests.max)}`);
  console.log(`  request latency ms by run: median-of-medians ${fmt(requestMedian.median)}, median-of-max ${fmt(requestMax.median)}`);
  console.log(`  sync setup ms before await: median ${fmt(setup.median)}, max ${fmt(setup.max)}`);
  console.log(`  setTimeout(0) wait ms: min ${fmt(timerWait.min)}, median ${fmt(timerWait.median)}, max ${fmt(timerWait.max)}`);
  console.log(`  sum(request latency) / wall: median ${fmt(overlap.median)}`);
  console.log(`  process RSS increase MB: median ${fmt(rss.median)}, max ${fmt(rss.max)}`);
};

const environment = () => {
  const cpu = os.cpus()[0] || {};
  return {
    node: process.version,
    platform: `${os.platform()} ${os.release()}`,
    arch: os.arch(),
    cpuModel: cpu.model || 'unknown',
    cpuCount: os.cpus().length,
    totalMemoryMb: Math.round(os.totalmem() / (1024 * 1024))
  };
};

const main = async () => {
  const representativeScholarships = buildScholarships(REPRESENTATIVE_SCHOLARSHIPS);
  const representativeStudents = buildStudents(REPRESENTATIVE_CONCURRENCY);
  const stressScholarships = buildScholarships(STRESS_SCHOLARSHIPS);
  const stressStudents = buildStudents(STRESS_CONCURRENCY);
  const info = environment();

  console.log('Matching worker benchmark');
  console.log(JSON.stringify(info, null, 2));
  console.log(JSON.stringify({
    representativeScholarships: representativeScholarships.length,
    representativeConcurrentRequests: representativeStudents.length,
    stressScholarships: stressScholarships.length,
    stressConcurrentRequests: stressStudents.length,
    measuredRuns: MEASURED_RUNS,
    stressRuns: STRESS_RUNS,
    courseAliasEntries: CATALOG_INDEX.size,
    workerPoolSize: MATCHING_POOL_SIZE,
    representativePayloadBytes: Buffer.byteLength(JSON.stringify({
      studentProfile: representativeStudents[0],
      scholarships: representativeScholarships,
      aliasEntries: Array.from(CATALOG_INDEX.entries())
    })),
    stressPayloadBytes: Buffer.byteLength(JSON.stringify({
      studentProfile: stressStudents[0],
      scholarships: stressScholarships,
      aliasEntries: Array.from(CATALOG_INDEX.entries())
    })),
    databaseQueriesIncluded: false
  }, null, 2));

  const idle = await measure(() => new Promise((resolve) => {
    const start = performance.now();
    setTimeout(() => {
      resolve({
        wallMs: performance.now() - start,
        latencies: [],
        matches: []
      });
    }, 200);
  }));
  console.log('\nIdle 200ms baseline');
  console.log(`  wall ms: ${fmt(idle.wallMs)}`);
  console.log(`  setTimeout(0) wait ms: ${fmt(idle.timerWaitMs)}`);
  console.log('  setTimeout(0) is scheduled before the timed work.');
  console.log('  A wait close to the wall time means the main thread did not yield during that work.');

  const diagnosticStudents = representativeStudents;
  const diagnosticStart = performance.now();
  const diagnostics = await Promise.all(diagnosticStudents.map((student) =>
    runMatchingWorker({
      studentProfile: student,
      scholarships: representativeScholarships,
      aliasIndex: CATALOG_INDEX,
      now: FIXED_NOW
    }, { diagnostics: true })
  ));
  const diagnosticWallMs = performance.now() - diagnosticStart;
  const workerThreadIds = diagnostics.map((result) => result.threadId);

  const uniqueThreadIds = new Set(workerThreadIds);
  assert.ok(workerThreadIds.every((id) => Number.isInteger(id) && id !== threadId));
  assert.ok(uniqueThreadIds.size >= 1);
  assert.ok(uniqueThreadIds.size <= MATCHING_POOL_SIZE);
  assert.ok(uniqueThreadIds.size < diagnosticStudents.length);
  assertEquivalent(
    diagnosticStudents,
    representativeScholarships,
    diagnostics.map((result) => result.matches)
  );

  await assert.rejects(
    () => runMatchingWorker({
      studentProfile: representativeStudents[0],
      scholarships: representativeScholarships,
      aliasIndex: CATALOG_INDEX,
      now: FIXED_NOW,
      forceError: 'benchmark forced worker failure'
    }),
    /benchmark forced worker failure/
  );

  console.log('\nThread check');
  console.log(`  main threadId: ${threadId}`);
  console.log(`  concurrent worker threadIds: ${workerThreadIds.join(', ')}`);
  console.log(`  unique worker threads: ${new Set(workerThreadIds).size} of ${diagnosticStudents.length}`);
  console.log(`  diagnostic concurrent wall ms: ${fmt(diagnosticWallMs)}`);
  console.log('  ranking signatures matched the main-thread algorithm');
  console.log('  forced worker error rejected the request');

  const singleStudent = representativeStudents[0];

  await runMainOnce(singleStudent, representativeScholarships);
  await runWorkerOnce(singleStudent, representativeScholarships);
  await runMainConcurrent(representativeStudents, representativeScholarships);
  await runWorkerConcurrent(representativeStudents, representativeScholarships);
  await runMainConcurrent(stressStudents, stressScholarships);
  await runWorkerConcurrent(stressStudents, stressScholarships);

  const singleMain = await repeat(
    MEASURED_RUNS,
    [singleStudent],
    representativeScholarships,
    () => async () => {
      const start = performance.now();
      const result = runMainOnce(singleStudent, representativeScholarships);
      result.wallMs = performance.now() - start;
      result.latencies = [result.wallMs];
      return result;
    }
  );

  const singleWorker = await repeat(
    MEASURED_RUNS,
    [singleStudent],
    representativeScholarships,
    () => async () => {
      const start = performance.now();
      const result = await runWorkerOnce(singleStudent, representativeScholarships);
      result.wallMs = performance.now() - start;
      return result;
    }
  );

  const concurrentMain = await repeat(
    MEASURED_RUNS,
    representativeStudents,
    representativeScholarships,
    () => () => runMainConcurrent(
      representativeStudents,
      representativeScholarships
    )
  );

  const concurrentWorker = await repeat(
    MEASURED_RUNS,
    representativeStudents,
    representativeScholarships,
    () => () => runWorkerConcurrent(
      representativeStudents,
      representativeScholarships
    )
  );

  const stressMain = await repeat(
    STRESS_RUNS,
    stressStudents,
    stressScholarships,
    () => () => runMainConcurrent(stressStudents, stressScholarships)
  );

  const stressWorker = await repeat(
    STRESS_RUNS,
    stressStudents,
    stressScholarships,
    () => () => runWorkerConcurrent(stressStudents, stressScholarships)
  );

  const representativeMatches = rankScholarships(
    singleStudent,
    representativeScholarships,
    CATALOG_INDEX,
    FIXED_NOW
  );

  console.log('\nDataset notes');
  console.log(`  representative matches for student 0: ${representativeMatches.length} of ${representativeScholarships.length}`);
  console.log('  one warmup run of each scenario was discarded');
  console.log('  warm worker figures use the existing pool and include JSON serialization plus queued execution');
  console.log('  the thread check above includes cold worker startup');

  printSamples(
    `Single request, ${REPRESENTATIVE_SCHOLARSHIPS} scholarships, main thread (${MEASURED_RUNS} runs)`,
    singleMain
  );
  printSamples(
    `Single request, ${REPRESENTATIVE_SCHOLARSHIPS} scholarships, worker (${MEASURED_RUNS} runs)`,
    singleWorker
  );
  printSamples(
    `${REPRESENTATIVE_CONCURRENCY} concurrent requests, ${REPRESENTATIVE_SCHOLARSHIPS} scholarships, main thread (${MEASURED_RUNS} runs)`,
    concurrentMain
  );
  printSamples(
    `${REPRESENTATIVE_CONCURRENCY} concurrent requests, ${REPRESENTATIVE_SCHOLARSHIPS} scholarships, worker (${MEASURED_RUNS} runs)`,
    concurrentWorker
  );
  printSamples(
    `${STRESS_CONCURRENCY} concurrent requests, ${STRESS_SCHOLARSHIPS} scholarships, main thread (${STRESS_RUNS} runs)`,
    stressMain
  );
  printSamples(
    `${STRESS_CONCURRENCY} concurrent requests, ${STRESS_SCHOLARSHIPS} scholarships, worker (${STRESS_RUNS} runs)`,
    stressWorker
  );

  console.log('\nBenchmark finished. Equivalence checks passed for every measured run.');
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    closeMatchingPool();
  });
