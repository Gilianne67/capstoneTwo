const dns = require('dns');
const os = require('os');
const path = require('path');
const { performance } = require('perf_hooks');
const { threadId } = require('worker_threads');

dns.setServers(['8.8.8.8', '8.8.4.4']);

const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../../.env'), quiet: true });

/**
 * Read-only performance measurement for scholarship search and student matching.
 *
 * It times the same service and HTTP route the student UI calls:
 *   GET /api/v1/matching
 *   GET /api/v1/matching?q=<keyword>
 *
 * Those routes load the saved profile, optionally query Elasticsearch,
 * load candidate scholarships from MongoDB, rank them on the matching
 * worker, and return the structured match list.
 *
 * The script does not insert, update, or delete application data.
 * Run from backend: npm run benchmark:matching-search
 */

const SEQUENTIAL_RUNS = 15;
const CONCURRENCY_LEVELS = [5, 10];
const CONCURRENT_ROUNDS = 3;
const TARGET_MS = 2000;
const SEARCH_SIZE = 1000;
const QUERY_CANDIDATES = [
  'information technology',
  'IT',
  'scholarship',
  'grant',
  'merit'
];
const NAMED_DATABASE = 'scholarship_matching_db';

const IN_MEMORY_PROFILE = {
  academicLevel: 'College',
  course: 'BSIT',
  gwa: 1.5,
  gwaScale: '1.00-5.00',
  incomeBracket: 'Below ₱10,000 / month',
  region: 'Bicol Region',
  province: 'Camarines Sur',
  municipalityCity: 'Naga City',
  citizenship: 'Filipino',
  dateOfBirth: '2004-01-01',
  yearLevel: '2nd Year',
  specialEligibilityFlags: {}
};

const safeMessage = (error) =>
  String((error && error.message) || error || 'Unknown error')
    .replace(/mongodb(?:\+srv)?:\/\/[^@\s]+@/gi, 'mongodb://[redacted]@')
    .replace(/\/\/([^/\s:@]*):([^/\s@]*)@/g, '//[redacted]@');

const fmt = (value) => (Number.isFinite(value) ? value.toFixed(2) : 'n/a');

const summarize = (values) => {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);

  if (sorted.length === 0) {
    return {
      count: 0,
      min: null,
      median: null,
      mean: null,
      p95: null,
      max: null
    };
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
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    p95: sorted[p95Index],
    max: sorted[sorted.length - 1]
  };
};

const assess = (stats) => {
  if (!stats || stats.attempted === 0) {
    return 'NOT RUN';
  }

  if (stats.failed > 0 || !Number.isFinite(stats.max)) {
    return 'FAIL';
  }

  return stats.max <= TARGET_MS ? 'PASS' : 'FAIL';
};

const countOpenScholarships = async (db) => {
  const listed = await db.listCollections({ name: 'scholarships' }).toArray();

  if (listed.length === 0) {
    return 0;
  }

  return db.collection('scholarships').countDocuments({
    status: 'Open',
    isArchived: false
  });
};

const chooseDatabase = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error('MONGO_URI is not set in backend/.env. The performance test needs the same database as the API.');
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  const primaryName = mongoose.connection.name;
  const primaryOpen = await countOpenScholarships(mongoose.connection.db);
  let namedOpen = null;

  if (primaryName !== NAMED_DATABASE) {
    const named = mongoose.connection.useDb(NAMED_DATABASE, { useCache: false });
    namedOpen = await countOpenScholarships(named.db);
  }

  let chosen = primaryName;
  let reason = 'This is the database selected by MONGO_URI, which is what server.js connects to.';

  if (primaryOpen === 0 && namedOpen > 0) {
    chosen = NAMED_DATABASE;
    reason = `The URI database "${primaryName}" has no open scholarships. The measurement uses "${NAMED_DATABASE}" because that database holds the open catalog. server.js does not set dbName, so confirm the running API is pointed at this database before citing the result as live API data.`;
  }

  const host = mongoose.connection.host;
  await mongoose.disconnect();

  return {
    host,
    primaryName,
    primaryOpen,
    namedOpen,
    chosen,
    reason
  };
};

const loadApplication = () => {
  const Scholarship = require('../models/Scholarship');
  const StudentProfile = require('../models/StudentProfile');
  const User = require('../models/User');
  const matchingService = require('../services/matchingService');
  const { searchScholarships } = require('../services/scholarshipSearchService');
  const { loadAliasIndex } = require('../utils/courseCanonical');
  const { isProfileComplete } = require('../utils/studentProfileCompletion');
  const { rankScholarships } = require('../services/matchingEngine');
  const {
    runMatchingWorker,
    getMatchingPoolStats,
    closeMatchingPool,
    MATCHING_POOL_SIZE
  } = require('../services/matchingWorkerRunner');
  const matchingRoutes = require('../routes/matchingRoutes');

  return {
    Scholarship,
    StudentProfile,
    User,
    matchingService,
    searchScholarships,
    loadAliasIndex,
    isProfileComplete,
    rankScholarships,
    runMatchingWorker,
    getMatchingPoolStats,
    closeMatchingPool,
    MATCHING_POOL_SIZE,
    matchingRoutes
  };
};

const selectSubject = async (app) => {
  const profiles = await app.StudentProfile.find({});
  const complete = profiles.filter((profile) => app.isProfileComplete(profile));
  let selected = null;

  for (const profile of complete) {
    const user = await app.User.findById(profile.userId);

    if (
      user &&
      user.role === 'student' &&
      user.status !== 'pending_consent' &&
      user.status !== 'suspended'
    ) {
      selected = { profile, user };
      break;
    }
  }

  return {
    profileCount: profiles.length,
    completeProfileCount: complete.length,
    httpReady: Boolean(selected),
    profile: selected ? selected.profile : IN_MEMORY_PROFILE,
    user: selected ? selected.user : null,
    profileSource: selected
      ? 'existing complete student profile'
      : 'in-memory profile, not written to the database'
  };
};

const assertStructuredMatches = (matches) => {
  if (!Array.isArray(matches)) {
    throw new Error('Matching did not return an array of structured results.');
  }

  matches.forEach((match) => {
    if (
      !match ||
      !match.scholarship ||
      !Number.isFinite(match.totalScore) ||
      typeof match.classification !== 'string'
    ) {
      throw new Error('A match was missing its scholarship, score, or classification.');
    }
  });

  return matches.length;
};

const timeCall = async (work) => {
  const start = performance.now();

  try {
    const value = await work();
    return {
      ok: true,
      ms: performance.now() - start,
      value
    };
  } catch (error) {
    return {
      ok: false,
      ms: performance.now() - start,
      error: safeMessage(error)
    };
  }
};

const runSequential = async (work, runs) => {
  await work();
  const samples = [];

  for (let index = 0; index < runs; index += 1) {
    samples.push(await timeCall(work));
  }

  return samples;
};

const runConcurrent = async (work, concurrency, rounds) => {
  await Promise.all(Array.from({ length: concurrency }, () => work()));
  const roundsOut = [];

  for (let index = 0; index < rounds; index += 1) {
    const wallStart = performance.now();
    const results = await Promise.all(
      Array.from({ length: concurrency }, () => timeCall(work))
    );
    roundsOut.push({
      wallMs: performance.now() - wallStart,
      results
    });
  }

  return roundsOut;
};

const statsFromSamples = (samples) => {
  const successful = samples.filter((sample) => sample.ok);
  const failed = samples.filter((sample) => !sample.ok);
  const timing = summarize(successful.map((sample) => sample.ms));

  return {
    attempted: samples.length,
    successful: successful.length,
    failed: failed.length,
    errors: [...new Set(failed.map((sample) => sample.error))].slice(0, 3),
    ...timing
  };
};

const statsFromRounds = (rounds) => {
  const samples = rounds.flatMap((round) => round.results);
  const stats = statsFromSamples(samples);
  const wall = summarize(rounds.map((round) => round.wallMs));
  const throughput = summarize(rounds.map((round) => {
    const successes = round.results.filter((sample) => sample.ok).length;
    return round.wallMs > 0 ? successes / (round.wallMs / 1000) : 0;
  }));

  return {
    ...stats,
    wall,
    throughput
  };
};

const printStats = (title, stats) => {
  console.log(`\n${title}`);
  console.log(`  attempted: ${stats.attempted}`);
  console.log(`  successful: ${stats.successful}`);
  console.log(`  failed: ${stats.failed}`);

  if (stats.errors && stats.errors.length > 0) {
    console.log(`  errors: ${stats.errors.join(' | ')}`);
  }

  console.log(
    `  response ms: min ${fmt(stats.min)}, median ${fmt(stats.median)}, average ${fmt(stats.mean)}, p95 ${fmt(stats.p95)}, max ${fmt(stats.max)}`
  );

  if (stats.throughput) {
    console.log(
      `  round wall ms: median ${fmt(stats.wall.median)}, max ${fmt(stats.wall.max)}`
    );
    console.log(
      `  throughput req/s: median ${fmt(stats.throughput.median)}, max ${fmt(stats.throughput.max)}`
    );
  }

  console.log(`  target <= ${TARGET_MS} ms on every successful response, with zero failures: ${assess(stats)}`);
};

const chooseQuery = async (searchScholarships) => {
  const attempts = [];

  for (const query of QUERY_CANDIDATES) {
    const sample = await timeCall(() => searchScholarships({
      query,
      size: SEARCH_SIZE
    }));

    if (!sample.ok) {
      return {
        available: false,
        error: sample.error,
        attempts
      };
    }

    const total = Number(sample.value && sample.value.total) || 0;
    const hits = Array.isArray(sample.value && sample.value.hits)
      ? sample.value.hits.length
      : 0;
    attempts.push({ query, total, hits, ms: sample.ms });

    if (hits > 0) {
      return {
        available: true,
        query,
        total,
        hits,
        attempts
      };
    }
  }

  return {
    available: true,
    query: QUERY_CANDIDATES[0],
    total: 0,
    hits: 0,
    attempts
  };
};

const measureBreakdown = async (app, profile, query) => {
  const started = performance.now();
  let searchMs = 0;
  let searchTotal = null;
  let candidateIds = null;

  if (query) {
    const searchStarted = performance.now();
    const result = await app.searchScholarships({
      query,
      size: SEARCH_SIZE
    });
    searchMs = performance.now() - searchStarted;
    searchTotal = Number(result && result.total) || 0;
    candidateIds = (result.hits || [])
      .map((hit) => hit && hit.id)
      .filter((id) => id !== undefined && id !== null && String(id).trim() !== '');
  }

  const filter = {
    status: 'Open',
    isArchived: false
  };

  if (candidateIds) {
    filter._id = { $in: candidateIds };
  }

  const loadStarted = performance.now();
  const [scholarships, aliasIndex] = await Promise.all([
    app.Scholarship.find(filter).lean(),
    app.loadAliasIndex()
  ]);
  const loadMs = performance.now() - loadStarted;
  const scoringStarted = performance.now();
  const inProcessMatches = app.rankScholarships(
    profile,
    scholarships,
    aliasIndex,
    new Date()
  );
  const inProcessMs = performance.now() - scoringStarted;
  const workerStarted = performance.now();
  const workerResult = await app.runMatchingWorker({
    studentProfile: profile,
    scholarships,
    aliasIndex,
    now: new Date()
  }, { diagnostics: true });
  const workerMs = performance.now() - workerStarted;

  return {
    totalMs: performance.now() - started,
    searchMs,
    loadMs,
    inProcessMs,
    workerMs,
    searchTotal,
    loadedScholarships: scholarships.length,
    matchCount: workerResult.matches.length,
    workerThreadId: workerResult.threadId,
    mainThreadId: threadId
  };
};

const startLocalApi = (matchingRoutes) => new Promise((resolve, reject) => {
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api/v1/matching', matchingRoutes);
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
  server.once('error', reject);
});

const requestMatches = async (baseUrl, token, query) => {
  const url = query
    ? `${baseUrl}/api/v1/matching?q=${encodeURIComponent(query)}`
    : `${baseUrl}/api/v1/matching`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = await response.json();

  if (!response.ok || !body || body.success !== true) {
    throw new Error(
      `HTTP ${response.status}: ${body && (body.message || body.error) || 'matching request failed'}`
    );
  }

  if (body.profileComplete === false) {
    throw new Error('HTTP matching returned before scoring because the profile is incomplete.');
  }

  const count = assertStructuredMatches(body.matches);
  return {
    count,
    bytes: Buffer.byteLength(JSON.stringify(body))
  };
};

const environment = () => {
  const cpu = os.cpus()[0] || {};
  return {
    node: process.version,
    platform: `${os.platform()} ${os.release()}`,
    cpuModel: cpu.model || 'unknown',
    cpuCount: os.cpus().length,
    totalMemoryMb: Math.round(os.totalmem() / (1024 * 1024))
  };
};

const main = async () => {
  const database = await chooseDatabase();
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: database.chosen,
    serverSelectionTimeoutMS: 8000
  });

  const app = loadApplication();
  const beforeScholarships = await app.Scholarship.countDocuments();
  const beforeProfiles = await app.StudentProfile.countDocuments();
  const openScholarships = await app.Scholarship.countDocuments({
    status: 'Open',
    isArchived: false
  });
  const subject = await selectSubject(app);
  const poolBefore = app.getMatchingPoolStats();
  const serviceSource = require('fs').readFileSync(
    path.join(__dirname, '../services/matchingService.js'),
    'utf8'
  );
  const controllerSource = require('fs').readFileSync(
    path.join(__dirname, '../controllers/matchingController.js'),
    'utf8'
  );
  const serviceUsesWorker = serviceSource.includes('return runMatchingWorker(');
  const controllerUsesService = controllerSource.includes(
    'matchingService.getRankedScholarships('
  );

  console.log('Matching and search performance');
  console.log(JSON.stringify({
    ...environment(),
    databaseHost: database.host,
    uriDatabase: database.primaryName,
    uriOpenScholarships: database.primaryOpen,
    namedDatabaseOpenScholarships: database.namedOpen,
    measuredDatabase: mongoose.connection.name,
    databaseChoice: database.reason,
    openScholarships,
    studentProfiles: subject.profileCount,
    completeStudentProfiles: subject.completeProfileCount,
    profileSource: subject.profileSource,
    httpAuthAvailable: subject.httpReady,
    elasticsearchEnabled: String(process.env.ELASTICSEARCH_ENABLED || ''),
    elasticsearchNode: String(process.env.ELASTICSEARCH_NODE || '').replace(
      /\/\/[^/@]+@/,
      '//'
    ),
    elasticsearchIndex: process.env.ELASTICSEARCH_INDEX || 'scholarships',
    searchCandidateLimit: SEARCH_SIZE,
    sequentialRuns: SEQUENTIAL_RUNS,
    concurrencyLevels: CONCURRENCY_LEVELS,
    concurrentRounds: CONCURRENT_ROUNDS,
    warmupExcluded: true,
    workerPoolSize: app.MATCHING_POOL_SIZE,
    workersBeforeTest: poolBefore.workers,
    serviceCallsWorker: serviceUsesWorker,
    controllerCallsService: controllerUsesService,
    writesPerformed: false,
    globalRateLimitApplied: false,
    targetMs: TARGET_MS
  }, null, 2));

  const queryChoice = await chooseQuery(app.searchScholarships);
  console.log('\nKeyword probe');
  console.log(JSON.stringify(queryChoice, null, 2));

  const scenarios = [];
  const record = (name, stats, extra = {}) => {
    scenarios.push({ name, assessment: assess(stats), ...stats, ...extra });
    printStats(name, stats);
  };

  const serviceNoQuery = async () => {
    const matches = await app.matchingService.getRankedScholarships(subject.profile);
    return { count: assertStructuredMatches(matches) };
  };

  record(
    `Sequential service matching, no keyword (${SEQUENTIAL_RUNS} measured runs)`,
    statsFromSamples(await runSequential(serviceNoQuery, SEQUENTIAL_RUNS))
  );

  const poolAfterService = app.getMatchingPoolStats();
  console.log('\nWorker pool after service matching');
  console.log(JSON.stringify(poolAfterService));

  const breakdowns = [];
  for (let index = 0; index < 5; index += 1) {
    breakdowns.push(await measureBreakdown(app, subject.profile, ''));
  }

  console.log('\nComponent breakdown, no keyword (5 runs, not a separate pass/fail sample)');
  console.log(`  Elasticsearch search ms: not called`);
  console.log(`  MongoDB plus course-alias load ms: ${fmt(summarize(breakdowns.map((item) => item.loadMs)).median)} median`);
  console.log(`  in-process rankScholarships ms: ${fmt(summarize(breakdowns.map((item) => item.inProcessMs)).median)} median`);
  console.log(`  runMatchingWorker ms: ${fmt(summarize(breakdowns.map((item) => item.workerMs)).median)} median`);
  console.log(`  breakdown total ms: ${fmt(summarize(breakdowns.map((item) => item.totalMs)).median)} median`);
  console.log(`  loaded scholarships: ${breakdowns[0].loadedScholarships}`);
  console.log(`  structured matches: ${breakdowns[0].matchCount}`);
  console.log(`  main threadId: ${breakdowns[0].mainThreadId}`);
  console.log(`  worker threadIds: ${breakdowns.map((item) => item.workerThreadId).join(', ')}`);

  if (queryChoice.available) {
    const searchOnly = async () => {
      const result = await app.searchScholarships({
        query: queryChoice.query,
        size: SEARCH_SIZE
      });

      if (!result || !Array.isArray(result.hits)) {
        throw new Error('Search did not return a hit list.');
      }

      return { count: result.hits.length, total: result.total };
    };

    record(
      `Sequential Elasticsearch search, query "${queryChoice.query}", size ${SEARCH_SIZE} (${SEQUENTIAL_RUNS} measured runs)`,
      statsFromSamples(await runSequential(searchOnly, SEQUENTIAL_RUNS))
    );

    const serviceQuery = async () => {
      const matches = await app.matchingService.getRankedScholarships(subject.profile, {
        query: queryChoice.query
      });
      return { count: assertStructuredMatches(matches) };
    };

    record(
      `Sequential service matching with keyword "${queryChoice.query}" (${SEQUENTIAL_RUNS} measured runs)`,
      statsFromSamples(await runSequential(serviceQuery, SEQUENTIAL_RUNS))
    );

    const keywordBreakdowns = [];
    for (let index = 0; index < 5; index += 1) {
      keywordBreakdowns.push(await measureBreakdown(
        app,
        subject.profile,
        queryChoice.query
      ));
    }

    console.log('\nComponent breakdown, keyword search plus matching (5 runs)');
    console.log(`  Elasticsearch search ms: ${fmt(summarize(keywordBreakdowns.map((item) => item.searchMs)).median)} median`);
    console.log(`  MongoDB plus course-alias load ms: ${fmt(summarize(keywordBreakdowns.map((item) => item.loadMs)).median)} median`);
    console.log(`  in-process rankScholarships ms: ${fmt(summarize(keywordBreakdowns.map((item) => item.inProcessMs)).median)} median`);
    console.log(`  runMatchingWorker ms: ${fmt(summarize(keywordBreakdowns.map((item) => item.workerMs)).median)} median`);
    console.log(`  search total hits reported: ${keywordBreakdowns[0].searchTotal}`);
    console.log(`  scholarships loaded after open/archive filter: ${keywordBreakdowns[0].loadedScholarships}`);
    console.log(`  structured matches: ${keywordBreakdowns[0].matchCount}`);
    console.log(`  worker threadIds: ${keywordBreakdowns.map((item) => item.workerThreadId).join(', ')}`);
  } else {
    console.log('\nKeyword matching was not measured.');
    console.log(`  ${queryChoice.error}`);
  }

  let server = null;
  let baseUrl = null;
  let token = null;

  if (subject.httpReady) {
    server = await startLocalApi(app.matchingRoutes);
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
    token = subject.user.getSignedJwtToken();

    const httpNoQuery = () => requestMatches(baseUrl, token, '');
    record(
      `Sequential HTTP GET /api/v1/matching (${SEQUENTIAL_RUNS} measured runs)`,
      statsFromSamples(await runSequential(httpNoQuery, SEQUENTIAL_RUNS))
    );

    if (queryChoice.available) {
      const httpQuery = () => requestMatches(baseUrl, token, queryChoice.query);
      record(
        `Sequential HTTP GET /api/v1/matching?q=${queryChoice.query} (${SEQUENTIAL_RUNS} measured runs)`,
        statsFromSamples(await runSequential(httpQuery, SEQUENTIAL_RUNS))
      );
    }
  } else {
    console.log('\nHTTP route was not measured because no active student account with a complete profile was available.');
  }

  const concurrentWork = [
    {
      name: 'service matching, no keyword',
      work: serviceNoQuery
    }
  ];

  if (queryChoice.available) {
    concurrentWork.push({
      name: `service matching, keyword "${queryChoice.query}"`,
      work: () => app.matchingService.getRankedScholarships(subject.profile, {
        query: queryChoice.query
      }).then((matches) => ({ count: assertStructuredMatches(matches) }))
    });
    concurrentWork.push({
      name: `Elasticsearch search, keyword "${queryChoice.query}"`,
      work: () => app.searchScholarships({
        query: queryChoice.query,
        size: SEARCH_SIZE
      }).then((result) => {
        if (!result || !Array.isArray(result.hits)) {
          throw new Error('Search did not return a hit list.');
        }
        return { count: result.hits.length };
      })
    });
  }

  if (baseUrl) {
    concurrentWork.push({
      name: 'HTTP GET /api/v1/matching',
      work: () => requestMatches(baseUrl, token, '')
    });

    if (queryChoice.available) {
      concurrentWork.push({
        name: `HTTP GET /api/v1/matching?q=${queryChoice.query}`,
        work: () => requestMatches(baseUrl, token, queryChoice.query)
      });
    }
  }

  for (const level of CONCURRENCY_LEVELS) {
    console.log(`\nConcurrent level ${level}`);

    for (const item of concurrentWork) {
      const rounds = await runConcurrent(item.work, level, CONCURRENT_ROUNDS);
      const stats = statsFromRounds(rounds);
      record(
        `${level} concurrent x ${CONCURRENT_ROUNDS} rounds: ${item.name}`,
        stats,
        { concurrency: level }
      );

      if (stats.failed > 0) {
        console.log('  Higher work at this level continues, but failures are included in the assessment.');
      }
    }
  }

  const afterScholarships = await app.Scholarship.countDocuments();
  const afterProfiles = await app.StudentProfile.countDocuments();

  if (beforeScholarships !== afterScholarships || beforeProfiles !== afterProfiles) {
    throw new Error('Document counts changed during a test that is required to be read-only.');
  }

  console.log('\nRead-only check');
  console.log(`  scholarships before/after: ${beforeScholarships}/${afterScholarships}`);
  console.log(`  student profiles before/after: ${beforeProfiles}/${afterProfiles}`);
  console.log(`  worker threads observed off main thread: ${breakdowns.every((item) => item.workerThreadId !== threadId)}`);
  console.log(`  service path calls runMatchingWorker: ${serviceUsesWorker}`);
  console.log(`  HTTP controller calls getRankedScholarships: ${controllerUsesService}`);
  console.log(`  workers after test: ${app.getMatchingPoolStats().workers}`);

  console.log('\nAssessment summary');
  scenarios.forEach((scenario) => {
    console.log(`  [${scenario.assessment}] ${scenario.name}`);
  });

  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  app.closeMatchingPool();
  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error(safeMessage(error));
  try {
    const { closeMatchingPool } = require('../services/matchingWorkerRunner');
    closeMatchingPool();
  } catch {
    // The pool may not have been loaded if startup failed.
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect().catch(() => {});
  }
  process.exitCode = 1;
});
