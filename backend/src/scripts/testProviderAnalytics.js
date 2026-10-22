const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Provider = require('../models/Provider');
const Scholarship = require('../models/Scholarship');
const SavedMatch = require('../models/SavedMatch');
const { protect, authorize } = require('../middleware/auth');
const { getAnalytics } = require('../controllers/providerController');
const {
  TOP_SCHOLARSHIP_LIMIT,
  resolveAnalyticsPeriod,
  buildProviderAnalytics,
} = require('../services/providerAnalyticsService');

const NOW = new Date('2026-10-12T04:00:00.000Z');

const runMiddleware = (middleware, req) =>
  new Promise((resolve) => {
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        resolve({
          nextCalled: false,
          statusCode: this.statusCode,
          body: payload,
        });
      },
    };

    Promise.resolve(
      middleware(req, res, () => {
        resolve({
          nextCalled: true,
          statusCode: res.statusCode,
          body: res.body,
        });
      })
    ).catch((error) => {
      resolve({
        nextCalled: false,
        statusCode: res.statusCode,
        error,
      });
    });
  });

const invoke = (handler, req) =>
  new Promise((resolve) => {
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        resolve({
          statusCode: this.statusCode,
          body: payload,
        });
      },
    };

    Promise.resolve(handler(req, res)).catch((error) => {
      resolve({ statusCode: 500, error });
    });
  });

const monthCount = (analytics, label) => {
  const month = analytics.creationTrend.find((entry) => entry.label === label);
  assert.ok(month, `Missing month ${label}`);
  return month.count;
};

const sixMonthPeriod = () => {
  const result = resolveAnalyticsPeriod({}, NOW);
  assert.strictEqual(result.ok, true);
  return result.period;
};

const main = async () => {
  const period = sixMonthPeriod();
  assert.strictEqual(period.range, '6m');
  assert.strictEqual(period.from, '2026-05');
  assert.strictEqual(period.to, '2026-10');
  assert.strictEqual(period.timeZone, 'Asia/Manila');
  assert.strictEqual(period.start.toISOString(), '2026-04-30T16:00:00.000Z');
  assert.strictEqual(period.end.toISOString(), '2026-10-31T16:00:00.000Z');
  assert.deepStrictEqual(
    period.months.map((month) => month.key),
    ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']
  );

  const septemberNow = new Date('2026-09-30T15:59:59.999Z');
  const septemberPeriod = resolveAnalyticsPeriod({ range: '6m' }, septemberNow);
  assert.strictEqual(septemberPeriod.ok, true);
  assert.strictEqual(septemberPeriod.period.from, '2026-04');
  assert.strictEqual(septemberPeriod.period.to, '2026-09');

  const octoberStart = new Date('2026-09-30T16:00:00.000Z');
  const octoberPeriod = resolveAnalyticsPeriod({ range: '6m' }, octoberStart);
  assert.strictEqual(octoberPeriod.period.from, '2026-05');
  assert.strictEqual(octoberPeriod.period.to, '2026-10');

  const threeMonths = resolveAnalyticsPeriod({ range: '3m' }, NOW);
  assert.strictEqual(threeMonths.period.from, '2026-08');
  assert.strictEqual(threeMonths.period.to, '2026-10');
  assert.strictEqual(threeMonths.period.months.length, 3);

  const custom = resolveAnalyticsPeriod({ from: '2026-05', to: '2026-10' }, NOW);
  assert.strictEqual(custom.ok, true);
  assert.strictEqual(custom.period.range, null);
  assert.strictEqual(custom.period.start.toISOString(), period.start.toISOString());
  assert.strictEqual(custom.period.end.toISOString(), period.end.toISOString());

  const invalidCases = [
    [{ range: '7d' }, 'range must be one of 3m, 6m, or 12m.'],
    [{ range: '6M' }, 'range must be one of 3m, 6m, or 12m.'],
    [{ range: '' }, 'range must be one of 3m, 6m, or 12m.'],
    [{ range: '6m', from: '2026-01', to: '2026-06' }, 'Use either range or from and to, not both.'],
    [{ from: '2026-05' }, 'Both from and to are required.'],
    [{ to: '2026-10' }, 'Both from and to are required.'],
    [{ from: '2026-13', to: '2026-10' }, 'from and to must use YYYY-MM.'],
    [{ from: '2026-5', to: '2026-10' }, 'from and to must use YYYY-MM.'],
    [{ from: '2026-10', to: '2026-05' }, 'from must be the same month as to, or earlier.'],
    [{ from: '2024-10', to: '2026-10' }, 'Date range cannot exceed 24 months.'],
    [{ from: '2026-11', to: '2026-12' }, 'Date range cannot extend beyond the current month.'],
    [{ range: ['6m', '12m'] }, 'Invalid date range.'],
  ];

  invalidCases.forEach(([query, message]) => {
    const result = resolveAnalyticsPeriod(query, NOW);
    assert.strictEqual(result.ok, false, `Expected invalid range for ${JSON.stringify(query)}`);
    assert.strictEqual(result.message, message);
    assert.strictEqual(result.period, undefined);
  });

  const allowedSpan = resolveAnalyticsPeriod({ from: '2024-11', to: '2026-10' }, NOW);
  assert.strictEqual(allowedSpan.ok, true);
  assert.strictEqual(allowedSpan.period.months.length, 24);

  const ignoredProviderQuery = resolveAnalyticsPeriod(
    { range: '6m', providerId: 'provider-b' },
    NOW
  );
  assert.strictEqual(ignoredProviderQuery.ok, true);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(ignoredProviderQuery.period, 'providerId'), false);

  const mixedScholarships = [
    {
      _id: 'a1',
      providerId: 'provider-a',
      name: 'B Grant',
      status: 'Open',
      isArchived: false,
      createdAt: '2026-04-30T16:00:00.000Z',
    },
    {
      _id: 'a2',
      providerId: 'provider-a',
      name: 'A Grant',
      status: 'Closed',
      isArchived: false,
      createdAt: '2026-05-15T04:00:00.000Z',
    },
    {
      _id: 'a3',
      providerId: 'provider-a',
      name: 'Archived Grant',
      status: 'Open',
      isArchived: true,
      createdAt: '2026-08-01T00:00:00.000Z',
    },
    {
      _id: 'a4',
      providerId: 'provider-a',
      name: 'April Grant',
      status: 'Open',
      isArchived: false,
      createdAt: '2026-04-30T15:59:59.999Z',
    },
    {
      _id: 'a5',
      providerId: 'provider-a',
      name: 'Next Month Boundary',
      status: 'Open',
      isArchived: false,
      createdAt: '2026-10-31T16:00:00.000Z',
    },
    {
      _id: 'a6',
      providerId: 'provider-a',
      name: 'October End',
      status: 'Open',
      isArchived: false,
      createdAt: '2026-10-31T15:59:59.999Z',
    },
    {
      _id: 'b1',
      providerId: 'provider-b',
      name: 'Other Provider Grant',
      status: 'Open',
      isArchived: false,
      createdAt: '2026-05-02T00:00:00.000Z',
    },
  ];

  const mixedSaves = [
    { scholarshipId: 'a1', saveCount: 4 },
    { scholarshipId: 'a2', saveCount: 4 },
    { scholarshipId: 'a3', saveCount: 1 },
    { scholarshipId: 'b1', saveCount: 10 },
    { scholarshipId: 'not-owned', saveCount: 99 },
  ];

  const providerA = buildProviderAnalytics({
    providerId: 'provider-a',
    scholarships: mixedScholarships,
    saveCounts: mixedSaves,
    period,
  });

  assert.strictEqual(providerA.overview.totalCreated, 6);
  assert.strictEqual(providerA.overview.openScholarships, 4);
  assert.strictEqual(providerA.overview.totalSaves, 9);
  assert.strictEqual(providerA.overview.createdInPeriod, 4);
  assert.strictEqual(monthCount(providerA, 'May 2026'), 2);
  assert.strictEqual(monthCount(providerA, 'June 2026'), 0);
  assert.strictEqual(monthCount(providerA, 'July 2026'), 0);
  assert.strictEqual(monthCount(providerA, 'August 2026'), 1);
  assert.strictEqual(monthCount(providerA, 'September 2026'), 0);
  assert.strictEqual(monthCount(providerA, 'October 2026'), 1);
  assert.strictEqual(providerA.creationTrend.length, 6);
  assert.deepStrictEqual(
    providerA.mostSaved.scholarships.map((scholarship) => scholarship.id),
    ['a2', 'a1']
  );
  assert.strictEqual(providerA.mostSaved.saveCount, 4);
  assert.ok(providerA.scholarships.some((scholarship) => scholarship.id === 'a4' && scholarship.saveCount === 0));
  assert.ok(providerA.scholarships.some((scholarship) => scholarship.id === 'a3' && scholarship.isArchived === true));
  assert.ok(!providerA.scholarships.some((scholarship) => scholarship.id === 'b1'));

  const providerB = buildProviderAnalytics({
    providerId: 'provider-b',
    scholarships: mixedScholarships,
    saveCounts: mixedSaves,
    period,
  });
  assert.strictEqual(providerB.overview.totalCreated, 1);
  assert.strictEqual(providerB.overview.totalSaves, 10);
  assert.strictEqual(providerB.overview.openScholarships, 1);
  assert.deepStrictEqual(providerB.scholarships.map((scholarship) => scholarship.id), ['b1']);
  assert.strictEqual(providerB.mostSaved.scholarships[0].name, 'Other Provider Grant');

  const unsaved = buildProviderAnalytics({
    providerId: 'provider-c',
    scholarships: [
      {
        _id: 'c1',
        providerId: 'provider-c',
        name: 'Quiet Grant',
        status: 'Open',
        isArchived: false,
        createdAt: '2026-07-10T02:00:00.000Z',
      },
      {
        _id: 'c2',
        providerId: 'provider-c',
        name: 'Second Quiet Grant',
        status: 'Closed',
        isArchived: false,
        createdAt: '2026-09-01T02:00:00.000Z',
      },
    ],
    saveCounts: [],
    period,
  });
  assert.strictEqual(unsaved.overview.totalCreated, 2);
  assert.strictEqual(unsaved.overview.openScholarships, 1);
  assert.strictEqual(unsaved.overview.totalSaves, 0);
  assert.strictEqual(unsaved.mostSaved.saveCount, 0);
  assert.strictEqual(unsaved.mostSaved.scholarships.length, 2);
  assert.ok(unsaved.scholarships.every((scholarship) => scholarship.saveCount === 0));
  assert.strictEqual(monthCount(unsaved, 'June 2026'), 0);
  assert.strictEqual(monthCount(unsaved, 'July 2026'), 1);
  assert.strictEqual(monthCount(unsaved, 'September 2026'), 1);

  const empty = buildProviderAnalytics({
    providerId: 'provider-empty',
    scholarships: [],
    saveCounts: [{ scholarshipId: 'b1', saveCount: 10 }],
    period,
  });
  assert.deepStrictEqual(empty.overview, {
    totalCreated: 0,
    openScholarships: 0,
    totalSaves: 0,
    createdInPeriod: 0,
  });
  assert.strictEqual(empty.mostSaved, null);
  assert.deepStrictEqual(empty.scholarships, []);
  assert.deepStrictEqual(empty.topScholarships, []);
  assert.ok(empty.creationTrend.every((month) => month.count === 0));
  assert.strictEqual(empty.creationTrend.length, 6);

  const tieNames = ['Fifth', 'Fourth', 'Third B', 'Third A', 'Second', 'First', 'Sixth'];
  const tieCounts = [3, 4, 3, 3, 5, 5, 1];
  const tieScholarships = tieNames.map((name, index) => ({
    _id: `t${index}`,
    providerId: 'provider-ties',
    name,
    status: 'Open',
    isArchived: false,
    createdAt: '2026-06-15T04:00:00.000Z',
  }));
  const ties = buildProviderAnalytics({
    providerId: 'provider-ties',
    scholarships: tieScholarships,
    saveCounts: tieScholarships.map((scholarship, index) => ({
      scholarshipId: scholarship._id,
      saveCount: tieCounts[index],
    })),
    period,
  });
  assert.strictEqual(TOP_SCHOLARSHIP_LIMIT, 5);
  assert.deepStrictEqual(
    ties.topScholarships.map((scholarship) => `${scholarship.name}:${scholarship.saveCount}`),
    ['First:5', 'Second:5', 'Fourth:4', 'Fifth:3', 'Third A:3', 'Third B:3']
  );
  assert.ok(!ties.topScholarships.some((scholarship) => scholarship.name === 'Sixth'));
  assert.strictEqual(ties.scholarships.length, 7);
  assert.ok(ties.scholarships.some((scholarship) => scholarship.name === 'Sixth' && scholarship.saveCount === 1));
  assert.deepStrictEqual(
    ties.mostSaved.scholarships.map((scholarship) => scholarship.name),
    ['First', 'Second']
  );

  assert.doesNotMatch(getAnalytics.toString(), /closeExpiredScholarships/);
  assert.doesNotMatch(getAnalytics.toString(), /Application/);
  assert.doesNotMatch(getAnalytics.toString(), /req\.query\.providerId/);
  assert.doesNotMatch(getAnalytics.toString(), /req\.body/);
  assert.match(getAnalytics.toString(), /providerId:\s*provider\._id/);

  const originalFindOne = Provider.findOne;
  const originalFind = Scholarship.find;
  const originalAggregate = SavedMatch.aggregate;

  try {
    let providerLookups = 0;
    Provider.findOne = async () => {
      providerLookups += 1;
      return null;
    };

    const invalidRequest = await invoke(getAnalytics, {
      query: { range: '7d', providerId: 'provider-b' },
      user: { id: 'user-a' },
    });
    assert.strictEqual(invalidRequest.statusCode, 400);
    assert.strictEqual(invalidRequest.body.success, false);
    assert.strictEqual(providerLookups, 0);

    const missingProvider = await invoke(getAnalytics, {
      query: { range: '6m' },
      user: { id: 'missing-user' },
    });
    assert.strictEqual(missingProvider.statusCode, 404);
    assert.strictEqual(missingProvider.body.message, 'Provider profile not found');

    const store = mixedScholarships.map((scholarship) => ({ ...scholarship }));
    let aggregateIds = null;
    Provider.findOne = async () => ({ _id: 'provider-a' });
    Scholarship.find = (query) => {
      assert.deepStrictEqual(query, { providerId: 'provider-a' });
      return {
        select() {
          return this;
        },
        async lean() {
          return store.filter((scholarship) => scholarship.providerId === query.providerId);
        },
      };
    };
    SavedMatch.aggregate = async (pipeline) => {
      aggregateIds = pipeline[0].$match.scholarshipId.$in.map(String);
      return mixedSaves
        .filter((entry) => aggregateIds.includes(String(entry.scholarshipId)))
        .map((entry) => ({ _id: entry.scholarshipId, saveCount: entry.saveCount }));
    };

    const httpProviderA = await invoke(getAnalytics, {
      query: { range: '6m', providerId: 'provider-b' },
      user: { id: 'user-a', _id: 'user-a' },
    });
    assert.strictEqual(httpProviderA.statusCode, 200);
    assert.strictEqual(httpProviderA.body.success, true);
    assert.strictEqual(httpProviderA.body.analytics.overview.totalCreated, 6);
    assert.strictEqual(httpProviderA.body.analytics.overview.totalSaves, 9);
    assert.ok(!aggregateIds.includes('b1'));
    assert.ok(!httpProviderA.body.analytics.scholarships.some((scholarship) => scholarship.id === 'b1'));

    Provider.findOne = async () => ({ _id: 'provider-b' });
    Scholarship.find = (query) => ({
      select() {
        return this;
      },
      async lean() {
        return store.filter((scholarship) => scholarship.providerId === query.providerId);
      },
    });
    const httpProviderB = await invoke(getAnalytics, {
      query: {},
      user: { id: 'user-b' },
    });
    assert.strictEqual(httpProviderB.body.analytics.overview.totalCreated, 1);
    assert.strictEqual(httpProviderB.body.analytics.overview.totalSaves, 10);
    assert.deepStrictEqual(
      httpProviderB.body.analytics.scholarships.map((scholarship) => scholarship.id),
      ['b1']
    );

    let aggregateCalled = false;
    Provider.findOne = async () => ({ _id: 'provider-empty' });
    Scholarship.find = () => ({
      select() {
        return this;
      },
      async lean() {
        return [];
      },
    });
    SavedMatch.aggregate = async () => {
      aggregateCalled = true;
      return [];
    };
    const httpEmpty = await invoke(getAnalytics, {
      query: { range: '12m' },
      user: { id: 'user-empty' },
    });
    assert.strictEqual(httpEmpty.statusCode, 200);
    assert.strictEqual(httpEmpty.body.analytics.overview.totalCreated, 0);
    assert.strictEqual(httpEmpty.body.analytics.mostSaved, null);
    assert.strictEqual(httpEmpty.body.analytics.creationTrend.length, 12);
    assert.ok(httpEmpty.body.analytics.creationTrend.every((month) => month.count === 0));
    assert.strictEqual(aggregateCalled, false);

    Provider.findOne = async () => ({ _id: 'provider-c' });
    Scholarship.find = () => ({
      select() {
        return this;
      },
      async lean() {
        return [
          {
            _id: 'c1',
            providerId: 'provider-c',
            name: 'Quiet Grant',
            status: 'Open',
            isArchived: false,
            createdAt: new Date('2026-07-10T02:00:00.000Z'),
          },
        ];
      },
    });
    SavedMatch.aggregate = async () => [];
    const httpUnsaved = await invoke(getAnalytics, {
      query: { from: '2026-05', to: '2026-10' },
      user: { id: 'user-c' },
    });
    assert.strictEqual(httpUnsaved.body.analytics.overview.totalSaves, 0);
    assert.strictEqual(httpUnsaved.body.analytics.scholarships[0].saveCount, 0);
    assert.strictEqual(httpUnsaved.body.analytics.mostSaved.saveCount, 0);
  } finally {
    Provider.findOne = originalFindOne;
    Scholarship.find = originalFind;
    SavedMatch.aggregate = originalAggregate;
  }

  const unauthenticated = await runMiddleware(protect, { headers: {}, cookies: {} });
  assert.strictEqual(unauthenticated.nextCalled, false);
  assert.strictEqual(unauthenticated.statusCode, 401);
  assert.strictEqual(unauthenticated.body.success, false);

  const studentBlocked = await runMiddleware(authorize('provider'), {
    user: { role: 'student', status: 'active' },
  });
  assert.strictEqual(studentBlocked.nextCalled, false);
  assert.strictEqual(studentBlocked.statusCode, 403);

  const providerAllowed = await runMiddleware(authorize('provider'), {
    user: { role: 'provider', status: 'active' },
  });
  assert.strictEqual(providerAllowed.nextCalled, true);

  const routeSource = fs.readFileSync(
    path.resolve(__dirname, '../routes/providerRoutes.js'),
    'utf8'
  );
  const protectAt = routeSource.indexOf('router.use(protect)');
  const authorizeAt = routeSource.indexOf("router.use(authorize('provider'))");
  const analyticsAt = routeSource.indexOf("router.get('/analytics', getAnalytics)");
  assert.ok(protectAt >= 0 && authorizeAt > protectAt);
  assert.ok(analyticsAt > authorizeAt);
  assert.match(routeSource, /getAnalytics/);

  const page = fs.readFileSync(
    path.resolve(__dirname, '../../../frontend/src/features/provider/pages/PerformanceAnalytics.jsx'),
    'utf8'
  );
  assert.match(page, /\$\{API_BASE_URL\}\/provider\/analytics\?range=/);
  assert.doesNotMatch(page, /getMockAnalyticsForCriteria/);
  assert.doesNotMatch(page, /totalImpressions/);
  assert.doesNotMatch(page, /conversionRate/);
  assert.doesNotMatch(page, /Outbound Referral/);

  console.log('Provider analytics tests passed');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
