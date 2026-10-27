const assert = require('assert');
const mongoose = require('mongoose');
const Scholarship = require('../models/Scholarship');
const { CATALOG_INDEX } = require('../utils/courseCanonical');
const {
  DEFAULT_WEIGHTS,
  evaluateScholarship,
  rankScholarships,
  scoringConfiguration
} = require('../services/matchingEngine');
const {
  runMatchingWorker,
  closeMatchingPool
} = require('../services/matchingWorkerRunner');

const FIXED_NOW = new Date('2026-09-26T04:00:00.000Z');
const FROM_10K = '₱10,001 – ₱21,190 / month';
const WEIGHT_TOTAL_MESSAGE = /must total 100%/;
const WEIGHT_BOUND_MESSAGE = /minimum allowed value|maximum allowed value/;

const DEFAULT_CRITERIA_WEIGHTS = {
  gwaWeight: 0.4,
  incomeWeight: 0.4,
  tagsWeight: 0.2
};

const ACADEMIC_CRITERIA_WEIGHTS = {
  gwaWeight: 0.7,
  incomeWeight: 0.2,
  tagsWeight: 0.1
};

const baseStudent = () => ({
  academicLevel: 'College',
  course: 'BSIT',
  gwa: 1.5,
  gwaScale: '1.00-5.00',
  incomeBracket: FROM_10K,
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
    is4PsBeneficiary: true
  }
});

const matchScholarship = (overrides = {}) => {
  const scholarship = {
    name: 'Weighted Grant',
    status: 'Open',
    isArchived: false,
    deadline: '2026-12-31',
    academicRequirements: [
      { gradingScale: '1.00-5.00', minimumGPA: 2 }
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
    incomeRequirement: {
      maxMonthlyIncome: 21190
    },
    specialTags: [
      { tagName: '4Ps Beneficiary', mode: 'Preferred' },
      { tagName: 'Working Student', mode: 'Preferred' }
    ],
    criteriaWeights: { ...DEFAULT_CRITERIA_WEIGHTS },
    ...overrides
  };

  return scholarship;
};

const persistableScholarship = (criteriaWeights) => {
  const document = {
    providerId: new mongoose.Types.ObjectId(),
    name: 'Weight Total Grant',
    scholarshipType: 'Merit-Based',
    description: 'Checks that provider weights total 100 percent.',
    grantValue: '10000',
    deadline: new Date('2026-12-31T00:00:00.000Z'),
    applicationURL: 'https://provider.example/apply',
    academicRequirements: [
      { gradingScale: '1.00-5.00', minimumGPA: 2.5 }
    ],
    hardFilters: {
      academicLevel: 'College',
      citizenshipStatus: 'Filipino',
      geographicLocation: { scope: 'Nationwide' }
    }
  };

  if (criteriaWeights !== undefined) {
    document.criteriaWeights = criteriaWeights;
  }

  return document;
};

const weightTotal = (weights) =>
  weights.gwaWeight + weights.incomeWeight + weights.tagsWeight;

const validationText = (error) => {
  const nested = error && error.errors
    ? Object.values(error.errors).map((item) => item && item.message)
    : [];

  return [error && error.message, ...nested].filter(Boolean).join(' ');
};

const assertAccepted = async (criteriaWeights) => {
  const document = new Scholarship(persistableScholarship(criteriaWeights));
  await document.validate();
  assert.strictEqual(document.criteriaWeights.gwaWeight, criteriaWeights.gwaWeight);
  assert.strictEqual(document.criteriaWeights.incomeWeight, criteriaWeights.incomeWeight);
  assert.strictEqual(document.criteriaWeights.tagsWeight, criteriaWeights.tagsWeight);
};

const assertRejected = async (criteriaWeights, pattern = WEIGHT_TOTAL_MESSAGE) => {
  const document = new Scholarship(persistableScholarship(criteriaWeights));
  await assert.rejects(
    () => document.validate(),
    (error) => {
      assert.match(validationText(error), pattern);
      return true;
    }
  );
};

const assertUnscored = (scholarship) => {
  assert.strictEqual(scoreOf(scholarship), null);
  assert.deepStrictEqual(
    rankScholarships(
      baseStudent(),
      [scholarship],
      CATALOG_INDEX,
      FIXED_NOW
    ),
    []
  );
};

const roundedTotal = (gpaScore, incomeScore, tagsScore, weights) => {
  const raw =
    gpaScore * weights.gwaWeight +
    incomeScore * weights.incomeWeight +
    tagsScore * weights.tagsWeight;

  return Math.round((Math.min(100, Math.max(0, raw)) + Number.EPSILON) * 100) / 100;
};

const scoreOf = (scholarship) =>
  evaluateScholarship(baseStudent(), scholarship, CATALOG_INDEX, FIXED_NOW);

const assertSameRanking = async (scholarships) => {
  const student = baseStudent();
  const workerMatches = await runMatchingWorker({
    studentProfile: student,
    scholarships,
    aliasIndex: CATALOG_INDEX,
    now: FIXED_NOW
  });
  const localMatches = rankScholarships(
    JSON.parse(JSON.stringify(student)),
    JSON.parse(JSON.stringify(scholarships)),
    CATALOG_INDEX,
    new Date(FIXED_NOW.toISOString())
  );

  assert.deepStrictEqual(workerMatches, localMatches);
  return workerMatches;
};

let passed = 0;

const test = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`ok ${passed}. ${name}`);
};

const main = async () => {
  await test('stored weights that total 1.0 pass scholarship validation', async () => {
    assert.deepStrictEqual(DEFAULT_WEIGHTS, DEFAULT_CRITERIA_WEIGHTS);

    const omitted = new Scholarship(persistableScholarship());
    await omitted.validate();
    assert.strictEqual(omitted.criteriaWeights.gwaWeight, 0.4);
    assert.strictEqual(omitted.criteriaWeights.incomeWeight, 0.4);
    assert.strictEqual(omitted.criteriaWeights.tagsWeight, 0.2);
    assert.strictEqual(weightTotal(omitted.criteriaWeights), 1);

    await assertAccepted(DEFAULT_CRITERIA_WEIGHTS);
    await assertAccepted(ACADEMIC_CRITERIA_WEIGHTS);
    await assertAccepted({
      gwaWeight: 40 / 100,
      incomeWeight: 40 / 100,
      tagsWeight: 20 / 100
    });
    await assertAccepted({
      gwaWeight: 0.5,
      incomeWeight: 0.2,
      tagsWeight: 0.3
    });
    await assertAccepted({
      gwaWeight: 0.2,
      incomeWeight: 0.7,
      tagsWeight: 0.1
    });
  });

  await test('totals below and above 1.0 are rejected and are not scored', async () => {
    const samples = [
      { gwaWeight: 0.3, incomeWeight: 0.3, tagsWeight: 0.2 },
      { gwaWeight: 0.5, incomeWeight: 0.4, tagsWeight: 0.2 },
      { gwaWeight: 0.4, incomeWeight: 0.4, tagsWeight: 0.1 }
    ];

    for (const weights of samples) {
      assert.notStrictEqual(weightTotal(weights), 1);
      await assertRejected(weights);
      assertUnscored(matchScholarship({ criteriaWeights: weights }));
    }
  });

  await test('each approved weight boundary is stored and scored inside 0-100', async () => {
    const boundaries = [
      { gwaWeight: 0.2, incomeWeight: 0.5, tagsWeight: 0.3 },
      { gwaWeight: 0.7, incomeWeight: 0.3, tagsWeight: 0 },
      { gwaWeight: 0.5, incomeWeight: 0.2, tagsWeight: 0.3 },
      { gwaWeight: 0.2, incomeWeight: 0.7, tagsWeight: 0.1 },
      { gwaWeight: 0.4, incomeWeight: 0.3, tagsWeight: 0.3 }
    ];

    for (const weights of boundaries) {
      assert.ok(Math.abs(weightTotal(weights) - 1) <= 0.0001);
      await assertAccepted(weights);
      const result = scoreOf(matchScholarship({ criteriaWeights: weights }));
      assert.deepStrictEqual(result.weights, weights);
      assert.strictEqual(result.gpaScore, 80);
      assert.strictEqual(result.incomeScore, 60);
      assert.strictEqual(result.tagsScore, 50);
      assert.strictEqual(
        result.totalScore,
        roundedTotal(80, 60, 50, weights)
      );
      assert.ok(result.totalScore >= 0 && result.totalScore <= 100);
    }
  });

  await test('weights just outside an approved limit are rejected and are not scored', async () => {
    const outsideLimits = [
      { gwaWeight: 0.19, incomeWeight: 0.51, tagsWeight: 0.3 },
      { gwaWeight: 0.71, incomeWeight: 0.2, tagsWeight: 0.09 },
      { gwaWeight: 0.51, incomeWeight: 0.19, tagsWeight: 0.3 },
      { gwaWeight: 0.2, incomeWeight: 0.71, tagsWeight: 0.09 },
      { gwaWeight: 0.5, incomeWeight: 0.51, tagsWeight: -0.01 },
      { gwaWeight: 0.4, incomeWeight: 0.29, tagsWeight: 0.31 }
    ];

    for (const weights of outsideLimits) {
      assert.ok(Math.abs(weightTotal(weights) - 1) <= 0.0001);
      await assertRejected(weights, WEIGHT_BOUND_MESSAGE);
      assertUnscored(matchScholarship({ criteriaWeights: weights }));
    }
  });

  await test('the 0.0001 total tolerance is unchanged and those weights are scored', async () => {
    const inside = {
      gwaWeight: 0.4,
      incomeWeight: 0.4,
      tagsWeight: 0.2 + 0.00005
    };
    const outside = {
      gwaWeight: 0.4,
      incomeWeight: 0.4,
      tagsWeight: 0.2 + 0.0002
    };

    assert.ok(Math.abs(weightTotal(inside) - 1) <= 0.0001);
    assert.ok(Math.abs(weightTotal(inside) - 1) > 0);
    assert.ok(Math.abs(weightTotal(outside) - 1) > 0.0001);

    await assertAccepted(inside);
    const scored = scoreOf(matchScholarship({ criteriaWeights: inside }));
    assert.deepStrictEqual(scored.weights, inside);
    assert.strictEqual(scored.totalScore, roundedTotal(80, 60, 50, inside));
    assert.ok(scored.totalScore >= 0 && scored.totalScore <= 100);

    await assertRejected(outside);
    assertUnscored(matchScholarship({ criteriaWeights: outside }));
  });

  await test('each scholarship keeps its own weights and a later change is rescored', async () => {
    const incomeLeaning = matchScholarship({
      name: 'Income leaning',
      criteriaWeights: {
        gwaWeight: 0.2,
        incomeWeight: 0.7,
        tagsWeight: 0.1
      }
    });
    const academicLeaning = matchScholarship({
      name: 'Academic leaning',
      criteriaWeights: { ...DEFAULT_CRITERIA_WEIGHTS }
    });
    const before = scoreOf(academicLeaning);
    const rankedBefore = rankScholarships(
      baseStudent(),
      [incomeLeaning, academicLeaning],
      CATALOG_INDEX,
      FIXED_NOW
    );

    assert.strictEqual(before.gpaScore, 80);
    assert.strictEqual(before.incomeScore, 60);
    assert.strictEqual(before.tagsScore, 50);
    assert.deepStrictEqual(before.weights, DEFAULT_CRITERIA_WEIGHTS);
    assert.strictEqual(before.totalScore, 66);
    assert.deepStrictEqual(
      rankedBefore.map((match) => [match.scholarship.name, match.totalScore, match.weights]),
      [
        ['Academic leaning', 66, DEFAULT_CRITERIA_WEIGHTS],
        [
          'Income leaning',
          63,
          { gwaWeight: 0.2, incomeWeight: 0.7, tagsWeight: 0.1 }
        ]
      ]
    );
    assert.deepStrictEqual(scoringConfiguration().defaultWeights, DEFAULT_WEIGHTS);

    academicLeaning.criteriaWeights = { ...ACADEMIC_CRITERIA_WEIGHTS };
    const after = scoreOf(academicLeaning);
    const rankedAfter = rankScholarships(
      baseStudent(),
      [incomeLeaning, academicLeaning],
      CATALOG_INDEX,
      FIXED_NOW
    );

    assert.strictEqual(after.gpaScore, before.gpaScore);
    assert.strictEqual(after.incomeScore, before.incomeScore);
    assert.strictEqual(after.tagsScore, before.tagsScore);
    assert.deepStrictEqual(after.weights, ACADEMIC_CRITERIA_WEIGHTS);
    assert.notDeepStrictEqual(after.weights, DEFAULT_WEIGHTS);
    assert.strictEqual(after.totalScore, 73);
    assert.notStrictEqual(after.totalScore, before.totalScore);
    assert.deepStrictEqual(
      rankedAfter.map((match) => match.scholarship.name),
      ['Academic leaning', 'Income leaning']
    );
    assert.strictEqual(rankedAfter[0].totalScore, 73);
    assert.strictEqual(rankedAfter[1].totalScore, 63);
    assert.deepStrictEqual(scoringConfiguration().defaultWeights, DEFAULT_WEIGHTS);
  });

  await test('invalid weights are left unscored instead of clamped to 0 or 100', async () => {
    assertUnscored(matchScholarship({
      criteriaWeights: { gwaWeight: 1, incomeWeight: 1, tagsWeight: 1 }
    }));
    assertUnscored(matchScholarship({
      criteriaWeights: { gwaWeight: -1, incomeWeight: -1, tagsWeight: -1 }
    }));

    const valid = scoreOf(matchScholarship());
    assert.strictEqual(valid.totalScore, 66);
    assert.ok(valid.totalScore >= 0 && valid.totalScore <= 100);
    assert.ok(valid.gpaScore >= 0 && valid.gpaScore <= 100);
    assert.ok(valid.incomeScore >= 0 && valid.incomeScore <= 100);
    assert.ok(valid.tagsScore >= 0 && valid.tagsScore <= 100);
  });

  await test('missing, null, non-numeric, and non-finite weights are not scored', async () => {
    const malformed = [
      { gwaWeight: 0.7 },
      { gwaWeight: 0.7, incomeWeight: 0.3, tagsWeight: null },
      { gwaWeight: 0.4, incomeWeight: null, tagsWeight: 0.2 },
      { gwaWeight: 'abc', incomeWeight: 0.4, tagsWeight: 0.2 },
      { gwaWeight: '', incomeWeight: 0.4, tagsWeight: 0.6 },
      { gwaWeight: 0.7, incomeWeight: 0.3, tagsWeight: '' },
      { gwaWeight: 0.7, incomeWeight: 0.3, tagsWeight: false },
      { gwaWeight: 0.4, incomeWeight: 0.4, tagsWeight: Number.NaN },
      { gwaWeight: Number.POSITIVE_INFINITY, incomeWeight: 0.4, tagsWeight: 0.2 },
      {}
    ];

    for (const weights of malformed) {
      assertUnscored(matchScholarship({ criteriaWeights: weights }));
    }

    await assertRejected({ gwaWeight: 0.7 });
    await assertRejected({
      gwaWeight: 0.7,
      incomeWeight: 0.3,
      tagsWeight: null
    });
    await assertRejected(
      { gwaWeight: 'abc', incomeWeight: 0.4, tagsWeight: 0.2 },
      /must total 100%|Cast to Number/
    );

    const numericStrings = scoreOf(matchScholarship({
      criteriaWeights: {
        gwaWeight: '0.7',
        incomeWeight: '0.2',
        tagsWeight: '0.1'
      }
    }));
    assert.deepStrictEqual(numericStrings.weights, ACADEMIC_CRITERIA_WEIGHTS);
    assert.strictEqual(numericStrings.totalScore, 73);
    assert.ok(numericStrings.totalScore >= 0 && numericStrings.totalScore <= 100);
  });

  await test('defaults are used only when the whole weight configuration is absent', async () => {
    const missing = matchScholarship();
    delete missing.criteriaWeights;
    const explicitNull = matchScholarship({ criteriaWeights: null });
    const empty = matchScholarship({ criteriaWeights: {} });

    for (const scholarship of [missing, explicitNull]) {
      const result = scoreOf(scholarship);
      assert.deepStrictEqual(result.weights, DEFAULT_CRITERIA_WEIGHTS);
      assert.strictEqual(result.totalScore, 66);
      assert.ok(result.totalScore >= 0 && result.totalScore <= 100);
    }

    assertUnscored(empty);
  });

  await test('the worker reproduces engine scores before and after a weight change', async () => {
    const open = matchScholarship({ name: 'Weighted Grant' });
    const closed = matchScholarship({
      name: 'Closed Grant',
      status: 'Closed'
    });

    const before = await assertSameRanking([closed, open]);
    assert.strictEqual(before.length, 1);
    assert.strictEqual(before[0].scholarship.name, 'Weighted Grant');
    assert.deepStrictEqual(before[0].weights, DEFAULT_CRITERIA_WEIGHTS);
    assert.strictEqual(before[0].totalScore, 66);
    assert.ok(before[0].totalScore >= 0 && before[0].totalScore <= 100);

    open.criteriaWeights = { ...ACADEMIC_CRITERIA_WEIGHTS };
    closed.criteriaWeights = { ...ACADEMIC_CRITERIA_WEIGHTS };

    const absent = matchScholarship({
      name: 'Absent weights',
      criteriaWeights: null
    });
    const partial = matchScholarship({
      name: 'Partial weights',
      criteriaWeights: { gwaWeight: 0.7 }
    });
    const nulled = matchScholarship({
      name: 'Null weight',
      criteriaWeights: {
        gwaWeight: 0.7,
        incomeWeight: 0.3,
        tagsWeight: null
      }
    });
    const nonNumeric = matchScholarship({
      name: 'Non numeric weight',
      criteriaWeights: {
        gwaWeight: 'abc',
        incomeWeight: 0.4,
        tagsWeight: 0.2
      }
    });
    const nonFinite = matchScholarship({
      name: 'Non finite weight',
      criteriaWeights: {
        gwaWeight: Number.POSITIVE_INFINITY,
        incomeWeight: 0.4,
        tagsWeight: 0.2
      }
    });

    const after = await assertSameRanking([
      closed,
      open,
      absent,
      partial,
      nulled,
      nonNumeric,
      nonFinite
    ]);
    assert.deepStrictEqual(
      after.map((match) => [match.scholarship.name, match.totalScore, match.weights]),
      [
        ['Weighted Grant', 73, ACADEMIC_CRITERIA_WEIGHTS],
        ['Absent weights', 66, DEFAULT_CRITERIA_WEIGHTS]
      ]
    );
    assert.strictEqual(after[0].gpaScore, before[0].gpaScore);
    assert.strictEqual(after[0].incomeScore, before[0].incomeScore);
    assert.strictEqual(after[0].tagsScore, before[0].tagsScore);
    assert.notStrictEqual(after[0].totalScore, before[0].totalScore);
    assert.ok(after[0].totalScore >= 0 && after[0].totalScore <= 100);
    assert.ok(after[1].totalScore >= 0 && after[1].totalScore <= 100);
  });

  console.log(`provider criteria weight tests passed (${passed})`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    closeMatchingPool();
  });
