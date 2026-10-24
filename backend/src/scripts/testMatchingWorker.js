const assert = require('assert');
const { CATALOG_INDEX } = require('../utils/courseCanonical');
const { rankScholarships } = require('../services/matchingService');
const { runMatchingWorker } = require('../services/matchingWorkerRunner');

const FIXED_NOW = new Date('2026-09-26T04:00:00.000Z');

const BELOW_10K = 'Below ₱10,000 / month';
const FROM_21K = '₱21,191 – ₱43,828 / month';
const ABOVE_131K = 'Above ₱131,484 / month';

const baseStudent = (overrides = {}) => {
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

const baseScholarship = (overrides = {}) => {
  const scholarship = {
    _id: 'scholarship-id',
    name: 'Test Scholarship',
    scholarshipType: 'STEM',
    grantValue: 'Tuition',
    applicationURL: 'https://example.test/apply',
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
    incomeRequirement: {
      maxMonthlyIncome: null
    },
    specialTags: [],
    criteriaWeights: {
      gwaWeight: 0.4,
      incomeWeight: 0.4,
      tagsWeight: 0.2
    },
    ...overrides
  };

  scholarship.hardFilters = {
    academicLevel: 'College',
    courseProgram: ['BS Information Technology'],
    citizenshipStatus: 'Filipino',
    ...(overrides.hardFilters || {})
  };

  scholarship.hardFilters.geographicLocation = {
    scope: 'Nationwide',
    regions: [],
    provinces: [],
    municipalities: [],
    ...(overrides.hardFilters?.geographicLocation || {})
  };

  scholarship.incomeRequirement = {
    maxMonthlyIncome: null,
    ...(overrides.incomeRequirement || {})
  };

  scholarship.criteriaWeights = {
    gwaWeight: 0.4,
    incomeWeight: 0.4,
    tagsWeight: 0.2,
    ...(overrides.criteriaWeights || {})
  };

  return scholarship;
};

const scoreSnapshot = (matches) =>
  (matches || []).map((match) => ({
    name: match.scholarship.name,
    _id: match.scholarship._id,
    scholarshipType: match.scholarship.scholarshipType,
    grantValue: match.scholarship.grantValue,
    applicationURL: match.scholarship.applicationURL,
    totalScore: match.totalScore,
    gpaScore: match.gpaScore,
    incomeScore: match.incomeScore,
    tagsScore: match.tagsScore,
    weights: match.weights,
    classification: match.classification
  }));

const assertSameRanking = async (student, scholarships, now = FIXED_NOW) => {
  const workerMatches = await runMatchingWorker({
    studentProfile: student,
    scholarships,
    aliasIndex: CATALOG_INDEX,
    now
  });
  const serializedNow = new Date(now.toISOString());
  const localOnSerializedInput = rankScholarships(
    JSON.parse(JSON.stringify(student)),
    JSON.parse(JSON.stringify(scholarships)),
    CATALOG_INDEX,
    serializedNow
  );
  const localOnOriginalInput = rankScholarships(
    student,
    scholarships,
    CATALOG_INDEX,
    now
  );

  assert.deepStrictEqual(workerMatches, localOnSerializedInput);
  assert.deepStrictEqual(
    scoreSnapshot(workerMatches),
    scoreSnapshot(localOnOriginalInput)
  );

  return workerMatches;
};

let passed = 0;

const test = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`ok ${passed}. ${name}`);
};

const main = async () => {
  await test('worker ranking matches the existing algorithm', async () => {
    const matches = await assertSameRanking(
      baseStudent(),
      [baseScholarship({ name: 'Open Match' })]
    );

    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].scholarship.name, 'Open Match');
    assert.strictEqual(matches[0].scholarship.applicationURL, 'https://example.test/apply');
    assert.ok(matches[0].totalScore >= 0 && matches[0].totalScore <= 100);
  });

  await test('worker preserves score ordering', async () => {
    const matches = await assertSameRanking(baseStudent(), [
      baseScholarship({
        name: 'Low',
        academicRequirements: [
          { gradingScale: '1.00-5.00', minimumGPA: 1.5 }
        ]
      }),
      baseScholarship({
        name: 'High',
        academicRequirements: [
          { gradingScale: '1.00-5.00', minimumGPA: 2.5 }
        ]
      }),
      baseScholarship({
        name: 'Middle',
        academicRequirements: [
          { gradingScale: '1.00-5.00', minimumGPA: 2 }
        ]
      })
    ]);

    assert.deepStrictEqual(
      matches.map((match) => match.scholarship.name),
      ['High', 'Middle', 'Low']
    );
  });

  await test('worker drops scholarships that fail hard filters', async () => {
    const matches = await assertSameRanking(baseStudent(), [
      baseScholarship({ name: 'Closed', status: 'Closed' }),
      baseScholarship({ name: 'Archived', isArchived: true }),
      baseScholarship({
        name: 'Wrong course',
        hardFilters: { courseProgram: ['BSCS'] }
      }),
      baseScholarship({ name: 'Past deadline', deadline: '2026-09-25' }),
      baseScholarship({
        name: 'Wrong municipality',
        hardFilters: {
          geographicLocation: {
            scope: 'Municipality',
            municipalities: ['Legazpi City']
          }
        }
      }),
      baseScholarship({ name: 'Open' })
    ]);

    assert.deepStrictEqual(
      matches.map((match) => match.scholarship.name),
      ['Open']
    );
  });

  await test('worker keeps the same course, location, tag, income, and scale results', async () => {
    await assertSameRanking(
      baseStudent({ course: 'BSIT' }),
      [baseScholarship({
        name: 'Canonical course',
        hardFilters: { courseProgram: ['BS Information Technology'] }
      })]
    );

    await assertSameRanking(
      baseStudent({ course: 'BSIT' }),
      [baseScholarship({
        name: 'Course mismatch',
        hardFilters: { courseProgram: ['BSCS'] }
      })]
    );

    await assertSameRanking(
      baseStudent(),
      [baseScholarship({
        name: 'Region match',
        hardFilters: {
          geographicLocation: {
            scope: 'Region',
            regions: ['Bicol Region']
          }
        }
      })]
    );

    await assertSameRanking(
      baseStudent({
        specialEligibilityFlags: { isWorkingStudent: true }
      }),
      [baseScholarship({
        name: 'Exclusive tag',
        specialTags: [{ tagName: 'Working Student', mode: 'Exclusive' }]
      })]
    );

    await assertSameRanking(baseStudent(), [
      baseScholarship({
        name: 'Missing exclusive tag',
        specialTags: [{ tagName: 'Working Student', mode: 'Exclusive' }]
      })
    ]);

    const preferred = await assertSameRanking(
      baseStudent({
        specialEligibilityFlags: { is4PsBeneficiary: true }
      }),
      [baseScholarship({
        name: 'Preferred tag',
        specialTags: [
          { tagName: '4Ps Beneficiary', mode: 'Preferred' },
          { tagName: 'Working Student', mode: 'Preferred' }
        ]
      })]
    );
    const withoutPreferred = await assertSameRanking(
      baseStudent(),
      [baseScholarship({
        name: 'Preferred tag',
        specialTags: [
          { tagName: '4Ps Beneficiary', mode: 'Preferred' },
          { tagName: 'Working Student', mode: 'Preferred' }
        ]
      })]
    );

    assert.ok(preferred[0].totalScore > withoutPreferred[0].totalScore);

    await assertSameRanking(
      baseStudent({ incomeBracket: FROM_21K }),
      [baseScholarship({
        name: 'Income cap',
        incomeRequirement: { maxMonthlyIncome: 10000 }
      })]
    );

    await assertSameRanking(
      baseStudent({ incomeBracket: ABOVE_131K }),
      [baseScholarship({
        name: 'No monthly cap',
        incomeRequirement: { maxMonthlyIncome: null, maximumIncome: 240000 }
      })]
    );

    await assertSameRanking(
      baseStudent({ gwa: 95, gwaScale: '60-100' }),
      [baseScholarship({
        name: 'Percentage scale',
        academicRequirements: [
          { gradingScale: '60-100', minimumGPA: 85 }
        ]
      })]
    );

    await assertSameRanking(
      baseStudent({ gwa: 2, gwaScale: '1.00-5.00' }),
      [baseScholarship({
        name: 'Legacy scale',
        academicRequirements: [],
        academicRequirement: {
          minimumGPA: 2.5,
          gradingScale: '1-5'
        }
      })]
    );
  });

  await test('worker applies the same deadline day and custom weights', async () => {
    const deadline = new Date('2026-09-26T00:00:00.000Z');
    const matches = await assertSameRanking(
      baseStudent({
        gwa: 1.25,
        specialEligibilityFlags: { isPWD: true }
      }),
      [baseScholarship({
        name: 'Deadline day',
        deadline,
        specialTags: [{ tagName: 'Person with Disability (PWD)', mode: 'Preferred' }],
        criteriaWeights: {
          gwaWeight: 0.5,
          incomeWeight: 0.2,
          tagsWeight: 0.3
        }
      })]
    );

    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].weights.gwaWeight, 0.5);
    assert.strictEqual(matches[0].weights.tagsWeight, 0.3);
    assert.strictEqual(
      matches[0].scholarship.deadline,
      deadline.toISOString()
    );
  });

  await test('empty and null scholarship lists stay empty', async () => {
    assert.deepStrictEqual(await assertSameRanking(baseStudent(), []), []);
    assert.deepStrictEqual(await assertSameRanking(baseStudent(), null), []);
  });

  await test('worker computation errors reject instead of using another ranking', async () => {
    const student = baseStudent();
    const scholarships = [baseScholarship({ name: 'Should not be returned' })];
    const expected = rankScholarships(
      student,
      scholarships,
      CATALOG_INDEX,
      FIXED_NOW
    );

    await assert.rejects(
      () => runMatchingWorker({
        studentProfile: student,
        scholarships,
        aliasIndex: CATALOG_INDEX,
        now: FIXED_NOW,
        forceError: 'matching worker forced failure'
      }),
      (error) => {
        assert.strictEqual(error.message, 'matching worker forced failure');
        assert.match(error.stack, /matchingWorker\.js/);
        return true;
      }
    );

    await assert.rejects(
      () => runMatchingWorker({
        studentProfile: null,
        scholarships,
        aliasIndex: CATALOG_INDEX,
        now: FIXED_NOW
      }),
      (error) => {
        assert.match(error.stack, /matchingWorker\.js/);
        assert.notStrictEqual(error.message, expected[0].scholarship.name);
        return true;
      }
    );

    assert.strictEqual(expected.length, 1);
  });

  await test('invalid worker messages, crashes, exits, and timeouts reject', async () => {
    const input = {
      studentProfile: baseStudent(),
      scholarships: [baseScholarship()],
      aliasIndex: CATALOG_INDEX,
      now: FIXED_NOW
    };

    await assert.rejects(
      () => runMatchingWorker(input, {
        workerCode: `
          const { parentPort } = require('worker_threads');
          parentPort.on('message', () => {
            parentPort.postMessage({
              ok: false,
              error: { message: 'ranking failed', stack: 'ranking failed' }
            });
          });
        `
      }),
      (error) => {
        assert.strictEqual(error.message, 'ranking failed');
        return true;
      }
    );

    await assert.rejects(
      () => runMatchingWorker(input, {
        workerCode: `
          const { parentPort } = require('worker_threads');
          parentPort.on('message', () => {
            parentPort.postMessage({ ok: true, matches: null });
          });
        `
      }),
      /Matching worker failed/
    );

    await assert.rejects(
      () => runMatchingWorker(input, {
        workerCode: `
          const { parentPort } = require('worker_threads');
          parentPort.on('message', () => {
            throw new Error('worker crashed');
          });
        `
      }),
      /worker crashed/
    );

    await assert.rejects(
      () => runMatchingWorker(input, {
        workerCode: `
          const { parentPort } = require('worker_threads');
          parentPort.on('message', () => {
            process.exit(1);
          });
        `
      }),
      /Matching worker exited with code 1/
    );

    await assert.rejects(
      () => runMatchingWorker(input, {
        timeoutMs: 200,
        workerCode: `
          const { parentPort } = require('worker_threads');
          parentPort.on('message', () => {});
        `
      }),
      /Matching worker timed out/
    );
  });

  await test('missing alias data is rejected before ranking', async () => {
    await assert.rejects(
      () => runMatchingWorker({
        studentProfile: baseStudent(),
        scholarships: [baseScholarship()],
        aliasIndex: null,
        now: FIXED_NOW
      }),
      /course alias index/
    );

    await assert.rejects(
      () => runMatchingWorker({
        studentProfile: baseStudent(),
        scholarships: [baseScholarship()],
        aliasIndex: CATALOG_INDEX,
        now: 'not-a-date'
      }),
      /valid timestamp/
    );
  });

  console.log(`matching worker tests passed (${passed})`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
