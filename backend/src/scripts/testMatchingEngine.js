const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
const { CATALOG_INDEX } = require('../utils/courseCanonical');
const {
  passesHardFilters,
  evaluateScholarship,
  rankScholarships,
  classifyScore
} = require('../services/matchingService');
const {
  isProfileComplete,
  rankIfProfileComplete
} = require('../utils/studentProfileCompletion');

const FIXED_NOW = new Date('2026-09-26T04:00:00.000Z');

const BELOW_10K = 'Below ₱10,000 / month';
const FROM_10K = '₱10,001 – ₱21,190 / month';
const FROM_21K = '₱21,191 – ₱43,828 / month';
const FROM_43K = '₱43,829 – ₱76,669 / month';
const FROM_76K = '₱76,670 – ₱131,484 / month';
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
    name: 'Test Scholarship',
    scholarshipType: 'STEM',
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

const eligible = (student, scholarship) =>
  passesHardFilters(student, scholarship, CATALOG_INDEX, FIXED_NOW);

const ranked = (student, scholarship) =>
  evaluateScholarship(student, scholarship, CATALOG_INDEX, FIXED_NOW);

let passed = 0;

const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`ok ${passed}. ${name}`);
};

test('academic level match', () => {
  assert.strictEqual(
    eligible(baseStudent(), baseScholarship()),
    true
  );
});

test('academic level mismatch', () => {
  assert.strictEqual(
    eligible(
      baseStudent({ academicLevel: 'Senior High School', course: 'STEM' }),
      baseScholarship()
    ),
    false
  );
});

test('course canonical match (BSIT vs BS Information Technology)', () => {
  assert.strictEqual(
    eligible(
      baseStudent({ course: 'BSIT' }),
      baseScholarship({
        hardFilters: {
          courseProgram: ['BS Information Technology']
        }
      })
    ),
    true
  );
});

test('course mismatch (BSIT vs BSCS)', () => {
  assert.strictEqual(
    eligible(
      baseStudent({ course: 'BSIT' }),
      baseScholarship({
        hardFilters: {
          courseProgram: ['BSCS']
        }
      })
    ),
    false
  );
});

test('civil engineering aliases match on both sides without changing other hard filters', () => {
  const civilScholarship = baseScholarship({
    hardFilters: {
      courseProgram: ['BS in Civil Engineering']
    }
  });
  const civilStudent = baseStudent({ course: 'Civil Engineering' });
  const civilRanked = ranked(civilStudent, civilScholarship);
  const itRanked = ranked(baseStudent({ course: 'BSIT' }), baseScholarship());

  assert.strictEqual(eligible(civilStudent, civilScholarship), true);
  assert.strictEqual(
    eligible(
      baseStudent({ course: 'BSCE' }),
      baseScholarship({
        hardFilters: { courseProgram: ['Civil Engineering'] }
      })
    ),
    true
  );
  assert.strictEqual(
    eligible(
      baseStudent({ course: 'Civil Engineering' }),
      baseScholarship({
        hardFilters: { courseProgram: ['Mechanical Engineering'] }
      })
    ),
    false
  );
  assert.strictEqual(
    eligible(
      baseStudent({
        academicLevel: 'Senior High School',
        course: 'Civil Engineering',
        yearLevel: 'Grade 12'
      }),
      civilScholarship
    ),
    false
  );
  assert.strictEqual(
    eligible(
      baseStudent({ course: 'Civil Engineering', gwa: 3 }),
      civilScholarship
    ),
    false
  );
  assert.strictEqual(
    eligible(
      baseStudent({ course: 'Civil Engineering' }),
      baseScholarship({
        hardFilters: { courseProgram: [] }
      })
    ),
    true
  );
  assert.ok(civilRanked);
  assert.strictEqual(civilRanked.totalScore, itRanked.totalScore);
  assert.strictEqual(civilRanked.classification, itRanked.classification);
  assert.strictEqual(civilRanked.gpaScore, itRanked.gpaScore);
  assert.strictEqual(civilRanked.incomeScore, itRanked.incomeScore);
  assert.strictEqual(civilRanked.tagsScore, itRanked.tagsScore);
});

test('empty provider course list is unrestricted', () => {
  const scholarship = baseScholarship({
    scholarshipType: 'STEM',
    hardFilters: {
      courseProgram: []
    }
  });

  assert.strictEqual(
    eligible(baseStudent({ course: 'BSIT' }), scholarship),
    true
  );
  assert.strictEqual(
    eligible(baseStudent({ course: 'BSCS' }), scholarship),
    true
  );
});

test('nationwide location is unrestricted', () => {
  assert.strictEqual(
    eligible(
      baseStudent({ region: 'National Capital Region' }),
      baseScholarship({
        hardFilters: {
          geographicLocation: {
            scope: 'Nationwide',
            regions: ['Bicol Region'],
            provinces: ['Camarines Sur'],
            municipalities: ['Naga City']
          }
        }
      })
    ),
    true
  );
});

test('region match', () => {
  assert.strictEqual(
    eligible(
      baseStudent({ region: 'Bicol Region' }),
      baseScholarship({
        hardFilters: {
          geographicLocation: {
            scope: 'Region',
            regions: ['Bicol Region']
          }
        }
      })
    ),
    true
  );
});

test('region mismatch', () => {
  assert.strictEqual(
    eligible(
      baseStudent({ region: 'National Capital Region' }),
      baseScholarship({
        hardFilters: {
          geographicLocation: {
            scope: 'Region',
            regions: ['Bicol Region']
          }
        }
      })
    ),
    false
  );
});

test('province match', () => {
  assert.strictEqual(
    eligible(
      baseStudent({ province: 'Camarines Sur' }),
      baseScholarship({
        hardFilters: {
          geographicLocation: {
            scope: 'Province',
            regions: ['Bicol Region'],
            provinces: ['Camarines Sur']
          }
        }
      })
    ),
    true
  );
});

test('municipality match', () => {
  assert.strictEqual(
    eligible(
      baseStudent({ municipalityCity: 'Naga City' }),
      baseScholarship({
        hardFilters: {
          geographicLocation: {
            scope: 'Municipality',
            regions: ['Bicol Region'],
            provinces: ['Camarines Sur'],
            municipalities: ['Naga City']
          }
        }
      })
    ),
    true
  );
});

test('Filipino citizenship', () => {
  assert.strictEqual(
    eligible(
      baseStudent({ citizenship: 'Filipino' }),
      baseScholarship({
        hardFilters: { citizenshipStatus: 'Filipino' }
      })
    ),
    true
  );
});

test('citizenship Any accepts Filipino and Non-Filipino', () => {
  const scholarship = baseScholarship({
    hardFilters: { citizenshipStatus: 'Any' }
  });

  assert.strictEqual(
    eligible(baseStudent({ citizenship: 'Filipino' }), scholarship),
    true
  );
  assert.strictEqual(
    eligible(baseStudent({ citizenship: 'Non-Filipino' }), scholarship),
    true
  );
});

test('citizenship mismatch', () => {
  assert.strictEqual(
    eligible(
      baseStudent({ citizenship: 'Non-Filipino' }),
      baseScholarship({
        hardFilters: { citizenshipStatus: 'Filipino' }
      })
    ),
    false
  );
});

test('exclusive tag satisfied', () => {
  assert.strictEqual(
    eligible(
      baseStudent({
        specialEligibilityFlags: { isPWD: true }
      }),
      baseScholarship({
        specialTags: [
          { tagName: 'Person with Disability (PWD)', mode: 'Exclusive' }
        ]
      })
    ),
    true
  );

  assert.strictEqual(
    eligible(
      baseStudent({
        specialEligibilityFlags: { is4PsBeneficiary: true }
      }),
      baseScholarship({
        specialTags: [
          { tagName: '4Ps Beneficiary', mode: 'Only' }
        ]
      })
    ),
    true
  );
});

test('exclusive tag not satisfied', () => {
  assert.strictEqual(
    eligible(
      baseStudent(),
      baseScholarship({
        specialTags: [
          { tagName: 'Person with Disability (PWD)', mode: 'Exclusive' }
        ]
      })
    ),
    false
  );
});

test('preferred tag does not exclude student', () => {
  assert.strictEqual(
    eligible(
      baseStudent(),
      baseScholarship({
        specialTags: [
          { tagName: 'Working Student', mode: 'Preferred' }
        ]
      })
    ),
    true
  );
});

test('open scholarship', () => {
  assert.strictEqual(
    eligible(
      baseStudent(),
      baseScholarship({ status: 'Open', isArchived: false })
    ),
    true
  );
});

test('closed scholarship excluded', () => {
  assert.strictEqual(
    eligible(baseStudent(), baseScholarship({ status: 'Closed' })),
    false
  );
});

test('archived scholarship excluded', () => {
  assert.strictEqual(
    eligible(baseStudent(), baseScholarship({ isArchived: true })),
    false
  );
});

test('expired scholarship excluded', () => {
  assert.strictEqual(
    eligible(
      baseStudent(),
      baseScholarship({ deadline: '2026-09-25' })
    ),
    false
  );
});

test('GWA 1.00-5.00 meets requirement', () => {
  assert.strictEqual(
    eligible(
      baseStudent({ gwa: 2, gwaScale: '1.00-5.00' }),
      baseScholarship({
        academicRequirements: [
          { gradingScale: '1.00-5.00', minimumGPA: 2 }
        ]
      })
    ),
    true
  );
});

test('GWA 1.00-5.00 fails requirement', () => {
  assert.strictEqual(
    eligible(
      baseStudent({ gwa: 2.01, gwaScale: '1.00-5.00' }),
      baseScholarship({
        academicRequirements: [
          { gradingScale: '1.00-5.00', minimumGPA: 2 }
        ]
      })
    ),
    false
  );
});

test('GWA 60-100 meets requirement', () => {
  assert.strictEqual(
    eligible(
      baseStudent({ gwa: 85, gwaScale: '60-100' }),
      baseScholarship({
        academicRequirements: [
          { gradingScale: '60-100', minimumGPA: 85 }
        ]
      })
    ),
    true
  );
});

test('GWA 60-100 fails requirement', () => {
  assert.strictEqual(
    eligible(
      baseStudent({ gwa: 84.99, gwaScale: '60-100' }),
      baseScholarship({
        academicRequirements: [
          { gradingScale: '60-100', minimumGPA: 85 }
        ]
      })
    ),
    false
  );
});

test('provider supports both scales and student uses 1.00-5.00', () => {
  const scholarship = baseScholarship({
    academicRequirements: [
      { gradingScale: '1.00-5.00', minimumGPA: 2 },
      { gradingScale: '60-100', minimumGPA: 99 }
    ]
  });

  assert.strictEqual(
    eligible(
      baseStudent({ gwa: 1.75, gwaScale: '1.00-5.00' }),
      scholarship
    ),
    true
  );
  assert.strictEqual(
    eligible(
      baseStudent({ gwa: 2.25, gwaScale: '1.00-5.00' }),
      scholarship
    ),
    false
  );
});

test('provider supports both scales and student uses 60-100', () => {
  const scholarship = baseScholarship({
    academicRequirements: [
      { gradingScale: '1.00-5.00', minimumGPA: 1.25 },
      { gradingScale: '60-100', minimumGPA: 85 }
    ]
  });

  assert.strictEqual(
    eligible(
      baseStudent({ gwa: 90, gwaScale: '60-100' }),
      scholarship
    ),
    true
  );
  assert.strictEqual(
    eligible(
      baseStudent({ gwa: 80, gwaScale: '60-100' }),
      scholarship
    ),
    false
  );
});

test('GWA score uses the proposed improvement-ratio tiers', () => {
  const gwaScore = (gwa, scale, minimumGPA) => ranked(
    baseStudent({ gwa, gwaScale: scale }),
    baseScholarship({
      academicRequirements: [
        { gradingScale: scale, minimumGPA }
      ]
    })
  );

  assert.strictEqual(gwaScore(2, '1.00-5.00', 2).gpaScore, 75);
  assert.strictEqual(gwaScore(1.75, '1.00-5.00', 2).gpaScore, 85);
  assert.strictEqual(gwaScore(1.51, '1.00-5.00', 2).gpaScore, 85);
  assert.strictEqual(gwaScore(1.5, '1.00-5.00', 2).gpaScore, 100);
  assert.strictEqual(gwaScore(1, '1.00-5.00', 2).gpaScore, 100);

  assert.strictEqual(gwaScore(85, '60-100', 85).gpaScore, 75);
  assert.strictEqual(gwaScore(90, '60-100', 85).gpaScore, 85);
  assert.strictEqual(gwaScore(89, '60-100', 80).gpaScore, 85);
  assert.strictEqual(gwaScore(90, '60-100', 80).gpaScore, 100);
  assert.strictEqual(gwaScore(100, '60-100', 80).gpaScore, 100);
});

test('GWA at the best grade does not divide by zero', () => {
  const perfectFive = ranked(
    baseStudent({ gwa: 1, gwaScale: '1.00-5.00' }),
    baseScholarship({
      academicRequirements: [
        { gradingScale: '1.00-5.00', minimumGPA: 1 }
      ]
    })
  );
  const perfectPercent = ranked(
    baseStudent({ gwa: 100, gwaScale: '60-100' }),
    baseScholarship({
      academicRequirements: [
        { gradingScale: '60-100', minimumGPA: 100 }
      ]
    })
  );

  assert.ok(perfectFive);
  assert.strictEqual(perfectFive.gpaScore, 100);
  assert.ok(perfectPercent);
  assert.strictEqual(perfectPercent.gpaScore, 100);
  assert.strictEqual(
    eligible(
      baseStudent({ gwa: 1.01, gwaScale: '1.00-5.00' }),
      baseScholarship({
        academicRequirements: [
          { gradingScale: '1.00-5.00', minimumGPA: 1 }
        ]
      })
    ),
    false
  );
  assert.strictEqual(
    ranked(
      baseStudent({ gwa: 1.01, gwaScale: '1.00-5.00' }),
      baseScholarship({
        academicRequirements: [
          { gradingScale: '1.00-5.00', minimumGPA: 1 }
        ]
      })
    ),
    null
  );
  assert.strictEqual(
    ranked(
      baseStudent({ gwa: 99, gwaScale: '60-100' }),
      baseScholarship({
        academicRequirements: [
          { gradingScale: '60-100', minimumGPA: 100 }
        ]
      })
    ),
    null
  );
});

test('income score uses the proposed bracket-distance tiers', () => {
  const incomeScore = (incomeBracket, maxMonthlyIncome) => ranked(
    baseStudent({ incomeBracket }),
    baseScholarship({
      incomeRequirement: { maxMonthlyIncome }
    })
  );

  assert.strictEqual(incomeScore(BELOW_10K, 76669).incomeScore, 100);
  assert.strictEqual(incomeScore(BELOW_10K, 131484).incomeScore, 100);
  assert.strictEqual(incomeScore(FROM_10K, 76669).incomeScore, 85);
  assert.strictEqual(incomeScore(FROM_21K, 76669).incomeScore, 70);
  assert.strictEqual(incomeScore(FROM_43K, 76669).incomeScore, 50);
  assert.strictEqual(incomeScore(BELOW_10K, 10000).incomeScore, 50);
  assert.strictEqual(incomeScore(BELOW_10K, 21190).incomeScore, 70);
  assert.strictEqual(incomeScore(FROM_10K, 21190).incomeScore, 50);
  assert.strictEqual(incomeScore(BELOW_10K, 43828).incomeScore, 85);

  assert.strictEqual(
    ranked(
      baseStudent({ incomeBracket: FROM_76K }),
      baseScholarship({
        incomeRequirement: { maxMonthlyIncome: 76669 }
      })
    ),
    null
  );
  assert.strictEqual(
    ranked(
      baseStudent({ incomeBracket: FROM_21K }),
      baseScholarship({
        incomeRequirement: { maxMonthlyIncome: 21190 }
      })
    ),
    null
  );
  assert.strictEqual(
    ranked(
      baseStudent({ incomeBracket: ABOVE_131K }),
      baseScholarship({
        incomeRequirement: { maxMonthlyIncome: 999999 }
      })
    ),
    null
  );
});

test('no income cap scores every bracket at 100, including the open-ended bracket', () => {
  [BELOW_10K, FROM_10K, FROM_21K, FROM_43K, FROM_76K, ABOVE_131K].forEach((incomeBracket) => {
    const result = ranked(
      baseStudent({ incomeBracket }),
      baseScholarship({
        incomeRequirement: { maxMonthlyIncome: null, maximumIncome: 240000 }
      })
    );

    assert.ok(result, incomeBracket);
    assert.strictEqual(result.incomeScore, 100, incomeBracket);
  });
});

test('a zero cap is a real cap and invalid caps are not unlimited', () => {
  const excluded = (maxMonthlyIncome) => ranked(
    baseStudent({ incomeBracket: BELOW_10K }),
    baseScholarship({
      incomeRequirement: { maxMonthlyIncome, maximumIncome: 240000 }
    })
  );

  assert.strictEqual(excluded(0), null);
  assert.strictEqual(excluded(-1), null);
  assert.strictEqual(excluded(Number.NaN), null);
  assert.strictEqual(excluded(Number.POSITIVE_INFINITY), null);
  assert.strictEqual(excluded('not-a-number'), null);

  const blank = ranked(
    baseStudent({ incomeBracket: ABOVE_131K }),
    baseScholarship({
      incomeRequirement: { maxMonthlyIncome: '', maximumIncome: 240000 }
    })
  );
  assert.strictEqual(blank.incomeScore, 100);
});

test('preferred tag score is calculated', () => {
  const result = ranked(
    baseStudent({
      specialEligibilityFlags: { is4PsBeneficiary: true }
    }),
    baseScholarship({
      specialTags: [
        { tagName: '4Ps Beneficiary', mode: 'Preferred' },
        { tagName: 'Working Student', mode: 'Preferred' },
        { tagName: 'Indigenous Peoples (IP)', mode: 'Exclusive' }
      ]
    })
  );

  assert.strictEqual(result, null);

  const scored = ranked(
    baseStudent({
      specialEligibilityFlags: { is4PsBeneficiary: true }
    }),
    baseScholarship({
      specialTags: [
        { tagName: '4Ps Beneficiary', mode: 'Preferred' },
        { tagName: 'Working Student', mode: 'Preferred' }
      ]
    })
  );

  assert.strictEqual(scored.tagsScore, 50);
});

test('provider weights are applied', () => {
  const student = baseStudent({
    gwa: 1.5,
    gwaScale: '1.00-5.00',
    incomeBracket: FROM_10K,
    specialEligibilityFlags: { is4PsBeneficiary: true }
  });
  const scholarship = baseScholarship({
    academicRequirements: [
      { gradingScale: '1.00-5.00', minimumGPA: 2 }
    ],
    incomeRequirement: { maxMonthlyIncome: 21190 },
    specialTags: [
      { tagName: '4Ps Beneficiary', mode: 'Preferred' },
      { tagName: 'Working Student', mode: 'Preferred' }
    ],
    criteriaWeights: {
      gwaWeight: 0.7,
      incomeWeight: 0.2,
      tagsWeight: 0.1
    }
  });

  const result = ranked(student, scholarship);

  assert.strictEqual(result.gpaScore, 100);
  assert.strictEqual(result.incomeScore, 50);
  assert.strictEqual(result.tagsScore, 50);
  assert.deepStrictEqual(result.weights, {
    gwaWeight: 0.7,
    incomeWeight: 0.2,
    tagsWeight: 0.1
  });
  assert.strictEqual(result.totalScore, 85);
  assert.strictEqual(result.classification, 'Recommended');
  assert.notStrictEqual(result.totalScore, 70);
});

test('final score is normalized 0-100', () => {
  const perfect = ranked(
    baseStudent({ gwa: 1, gwaScale: '1.00-5.00' }),
    baseScholarship({
      academicRequirements: [
        { gradingScale: '1.00-5.00', minimumGPA: 2.5 }
      ]
    })
  );
  const weighted = ranked(
    baseStudent({
      gwa: 1.5,
      incomeBracket: FROM_10K,
      specialEligibilityFlags: { is4PsBeneficiary: true }
    }),
    baseScholarship({
      academicRequirements: [
        { gradingScale: '1.00-5.00', minimumGPA: 2 }
      ],
      incomeRequirement: { maxMonthlyIncome: 21190 },
      specialTags: [
        { tagName: '4Ps Beneficiary', mode: 'Preferred' },
        { tagName: 'Working Student', mode: 'Preferred' }
      ],
      criteriaWeights: {
        gwaWeight: 0.7,
        incomeWeight: 0.2,
        tagsWeight: 0.1
      }
    })
  );

  assert.strictEqual(perfect.totalScore, 100);
  assert.ok(weighted.totalScore >= 0 && weighted.totalScore <= 100);
  assert.ok(perfect.gpaScore >= 0 && perfect.gpaScore <= 100);
  assert.ok(perfect.incomeScore >= 0 && perfect.incomeScore <= 100);
  assert.ok(perfect.tagsScore >= 0 && perfect.tagsScore <= 100);
});

test('results are sorted descending', () => {
  const student = baseStudent({ gwa: 1.5, gwaScale: '1.00-5.00' });
  const low = baseScholarship({
    name: 'Low',
    academicRequirements: [
      { gradingScale: '1.00-5.00', minimumGPA: 1.5 }
    ]
  });
  const high = baseScholarship({
    name: 'High',
    academicRequirements: [
      { gradingScale: '1.00-5.00', minimumGPA: 2.5 }
    ]
  });
  const middle = baseScholarship({
    name: 'Middle',
    academicRequirements: [
      { gradingScale: '1.00-5.00', minimumGPA: 1.8 }
    ]
  });

  const results = rankScholarships(
    student,
    [low, high, middle],
    CATALOG_INDEX,
    FIXED_NOW
  );

  assert.deepStrictEqual(
    results.map((result) => [result.scholarship.name, result.totalScore]),
    [
      ['High', 100],
      ['Middle', 94],
      ['Low', 90]
    ]
  );
});

test('recommendation classification is correct', () => {
  assert.strictEqual(classifyScore(100), 'Highly Recommended');
  assert.strictEqual(classifyScore(90), 'Highly Recommended');
  assert.strictEqual(classifyScore(89.99), 'Recommended');
  assert.strictEqual(classifyScore(70), 'Recommended');
  assert.strictEqual(classifyScore(69.99), 'Potential Match');
  assert.strictEqual(classifyScore(50), 'Potential Match');
  assert.strictEqual(classifyScore(49.99), 'Low Compatibility');

  const highly = ranked(
    baseStudent({ gwa: 1 }),
    baseScholarship()
  );
  const recommended = ranked(
    baseStudent({ gwa: 1.5, incomeBracket: BELOW_10K }),
    baseScholarship({
      academicRequirements: [
        { gradingScale: '1.00-5.00', minimumGPA: 2 }
      ],
      incomeRequirement: { maxMonthlyIncome: 21190 }
    })
  );
  const exactOpenIncome = ranked(
    baseStudent({ gwa: 2.5 }),
    baseScholarship({
      academicRequirements: [
        { gradingScale: '1.00-5.00', minimumGPA: 2.5 }
      ]
    })
  );
  const lowCompatibility = ranked(
    baseStudent({
      gwa: 2,
      incomeBracket: FROM_43K,
      specialEligibilityFlags: {}
    }),
    baseScholarship({
      academicRequirements: [
        { gradingScale: '1.00-5.00', minimumGPA: 2 }
      ],
      incomeRequirement: { maxMonthlyIncome: 76669 },
      specialTags: [
        { tagName: 'Working Student', mode: 'Preferred' }
      ],
      criteriaWeights: {
        gwaWeight: 0.2,
        incomeWeight: 0.5,
        tagsWeight: 0.3
      }
    })
  );

  assert.strictEqual(highly.totalScore, 100);
  assert.strictEqual(highly.classification, 'Highly Recommended');
  assert.strictEqual(recommended.gpaScore, 100);
  assert.strictEqual(recommended.incomeScore, 70);
  assert.strictEqual(recommended.tagsScore, 100);
  assert.strictEqual(recommended.totalScore, 88);
  assert.strictEqual(recommended.classification, 'Recommended');
  assert.strictEqual(exactOpenIncome.gpaScore, 75);
  assert.strictEqual(exactOpenIncome.incomeScore, 100);
  assert.strictEqual(exactOpenIncome.totalScore, 90);
  assert.strictEqual(exactOpenIncome.classification, 'Highly Recommended');
  assert.strictEqual(lowCompatibility.gpaScore, 75);
  assert.strictEqual(lowCompatibility.incomeScore, 50);
  assert.strictEqual(lowCompatibility.tagsScore, 0);
  assert.strictEqual(lowCompatibility.totalScore, 40);
  assert.strictEqual(lowCompatibility.classification, 'Low Compatibility');
});

test('a scholarship that fails a hard filter never receives a ranking score', () => {
  const student = baseStudent();
  const openScholarship = baseScholarship({ name: 'Open' });
  const closedScholarship = baseScholarship({
    name: 'Closed',
    status: 'Closed'
  });
  const mismatchedCourse = baseScholarship({
    name: 'Wrong course',
    hardFilters: { courseProgram: ['BSCS'] }
  });

  assert.strictEqual(ranked(student, closedScholarship), null);
  assert.strictEqual(ranked(student, mismatchedCourse), null);

  const results = rankScholarships(
    student,
    [closedScholarship, mismatchedCourse, openScholarship],
    CATALOG_INDEX,
    FIXED_NOW
  );

  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].scholarship.name, 'Open');
  assert.ok(Number.isFinite(results[0].totalScore));
});

test('legacy 1-5 academic requirement maps to 1.00-5.00', () => {
  const scholarship = baseScholarship({
    academicRequirements: [],
    academicRequirement: {
      minimumGPA: 2.5,
      gradingScale: '1-5'
    }
  });

  assert.strictEqual(
    eligible(baseStudent({ gwa: 2, gwaScale: '1.00-5.00' }), scholarship),
    true
  );
  assert.strictEqual(
    eligible(baseStudent({ gwa: 3, gwaScale: '1.00-5.00' }), scholarship),
    false
  );
});

test('legacy annual maximumIncome is not treated as monthly', () => {
  const scholarship = baseScholarship({
    incomeRequirement: {
      maxMonthlyIncome: null,
      maximumIncome: 240000
    }
  });

  assert.strictEqual(
    eligible(baseStudent({ incomeBracket: ABOVE_131K }), scholarship),
    true
  );
  assert.strictEqual(
    ranked(baseStudent({ incomeBracket: ABOVE_131K }), scholarship).incomeScore,
    100
  );
});

const REQUIRED_TAG_CASES = [
  ['4Ps Beneficiary', 'is4PsBeneficiary'],
  ['Indigenous Peoples (IP)', 'isIndigenous'],
  ['Person with Disability (PWD)', 'isPWD'],
  ['Solo Parent Dependent', 'isSoloParentChild'],
  ['Orphan Status', 'isOrphan'],
  ['Child of Farmer / Fisherfolk', 'isFarmerFisherfolkChild'],
  ['Disaster-Affected Family', 'isDisasterAffected'],
  ['Working Student', 'isWorkingStudent']
];

REQUIRED_TAG_CASES.forEach(([tagName, flag]) => {
  test(`required tag satisfied: ${tagName}`, () => {
    assert.strictEqual(
      eligible(
        baseStudent({
          specialEligibilityFlags: { [flag]: true }
        }),
        baseScholarship({
          specialTags: [{ tagName, mode: 'Exclusive' }]
        })
      ),
      true
    );
  });

  test(`required tag failed: ${tagName}`, () => {
    assert.strictEqual(
      eligible(
        baseStudent(),
        baseScholarship({
          specialTags: [{ tagName, mode: 'Exclusive' }]
        })
      ),
      false
    );
  });
});

test('preferred tag ranks a match and still accepts a student without it', () => {
  const scholarship = baseScholarship({
    specialTags: [
      { tagName: 'Working Student', mode: 'Preferred' }
    ],
    criteriaWeights: {
      gwaWeight: 0.4,
      incomeWeight: 0.4,
      tagsWeight: 0.2
    }
  });

  const matched = ranked(
    baseStudent({
      specialEligibilityFlags: { isWorkingStudent: true }
    }),
    scholarship
  );
  const unmatched = ranked(baseStudent(), scholarship);

  assert.ok(matched);
  assert.ok(unmatched);
  assert.strictEqual(matched.tagsScore, 100);
  assert.strictEqual(unmatched.tagsScore, 0);
  assert.strictEqual(scholarship.criteriaWeights.gwaWeight, 0.4);
  assert.strictEqual(scholarship.criteriaWeights.incomeWeight, 0.4);
  assert.strictEqual(scholarship.criteriaWeights.tagsWeight, 0.2);
});

const rankList = (student, scholarships) =>
  rankScholarships(student, scholarships, CATALOG_INDEX, FIXED_NOW);

test('incomplete profile returns no matches', () => {
  const student = baseStudent({
    dateOfBirth: '2008-06-01',
    yearLevel: '1st Year',
    province: '',
    municipalityCity: ''
  });
  const scholarships = [baseScholarship()];

  assert.strictEqual(isProfileComplete(student), false);
  assert.ok(rankList(student, scholarships).length > 0);
  assert.deepStrictEqual(
    rankIfProfileComplete(student, scholarships, rankList),
    []
  );
});

test('complete profile matching still works', () => {
  const student = baseStudent({
    dateOfBirth: '2004-01-15',
    yearLevel: '2nd Year'
  });
  const scholarships = [baseScholarship({ name: 'Open Match' })];
  const direct = rankList(student, scholarships);
  const gated = rankIfProfileComplete(student, scholarships, rankList);

  assert.strictEqual(isProfileComplete(student), true);
  assert.strictEqual(gated.length, 1);
  assert.strictEqual(direct.length, 1);
  assert.strictEqual(gated[0].totalScore, direct[0].totalScore);
  assert.strictEqual(gated[0].gpaScore, direct[0].gpaScore);
  assert.strictEqual(gated[0].incomeScore, direct[0].incomeScore);
  assert.strictEqual(gated[0].tagsScore, direct[0].tagsScore);
  assert.deepStrictEqual(gated[0].weights, direct[0].weights);
  assert.strictEqual(gated[0].classification, direct[0].classification);
  assert.strictEqual(gated[0].scholarship.name, 'Open Match');
});

const assertFrontendRulesMatch = async () => {
  const frontendPath = path.resolve(
    __dirname,
    '../../../frontend/src/features/student/profileCompletion.js'
  );
  const { isProfileComplete: frontendIsProfileComplete } = await import(
    pathToFileURL(frontendPath).href
  );
  const samples = [
    baseStudent({
      dateOfBirth: '2008-06-01',
      yearLevel: '1st Year',
      province: '',
      municipalityCity: ''
    }),
    baseStudent({
      dateOfBirth: '2004-01-15',
      yearLevel: '2nd Year'
    })
  ];

  samples.forEach((sample) => {
    assert.strictEqual(
      frontendIsProfileComplete(sample),
      isProfileComplete(sample)
    );
  });
};

const assertSimulatorMatchesEngine = async () => {
  const simulatorPath = path.resolve(
    __dirname,
    '../../../frontend/src/features/public-landing/components/matchingSimulator.js'
  );
  const { evaluateSampleMatch } = await import(
    pathToFileURL(simulatorPath).href
  );
  const sampleScholarship = baseScholarship({
    academicRequirements: [
      { gradingScale: '1.00-5.00', minimumGPA: 2 },
      { gradingScale: '60-100', minimumGPA: 85 }
    ],
    incomeRequirement: { maxMonthlyIncome: 43828 },
    specialTags: [
      { tagName: '4Ps Beneficiary', mode: 'Preferred' }
    ]
  });
  const cases = [
    { scale: '1.00-5.00', gwa: '1.50', incomeBracket: BELOW_10K, hasPreferredTag: 'yes' },
    { scale: '1.00-5.00', gwa: '1.75', incomeBracket: BELOW_10K, hasPreferredTag: 'yes' },
    { scale: '1.00-5.00', gwa: '2.00', incomeBracket: FROM_21K, hasPreferredTag: 'no' },
    { scale: '1.00-5.00', gwa: '1.00', incomeBracket: FROM_10K, hasPreferredTag: 'yes' },
    { scale: '60-100', gwa: '92.5', incomeBracket: FROM_21K, hasPreferredTag: 'yes' },
    { scale: '60-100', gwa: '85', incomeBracket: BELOW_10K, hasPreferredTag: 'no' },
    { scale: '1.00-5.00', gwa: '2.25', incomeBracket: ABOVE_131K, hasPreferredTag: 'yes' },
    { scale: '60-100', gwa: '84', incomeBracket: BELOW_10K, hasPreferredTag: 'no' }
  ];

  cases.forEach((input) => {
    const sample = evaluateSampleMatch(input);
    const engineResult = ranked(
      baseStudent({
        gwa: Number(input.gwa),
        gwaScale: input.scale,
        incomeBracket: input.incomeBracket,
        specialEligibilityFlags: {
          is4PsBeneficiary: input.hasPreferredTag === 'yes'
        }
      }),
      sampleScholarship
    );

    if (!sample.eligible) {
      assert.strictEqual(engineResult, null, JSON.stringify(input));
      return;
    }

    assert.ok(engineResult, JSON.stringify(input));
    assert.strictEqual(engineResult.gpaScore, sample.gpaScore, JSON.stringify(input));
    assert.strictEqual(engineResult.incomeScore, sample.incomeScore, JSON.stringify(input));
    assert.strictEqual(engineResult.tagsScore, sample.tagsScore, JSON.stringify(input));
    assert.strictEqual(engineResult.totalScore, sample.totalScore, JSON.stringify(input));
    assert.strictEqual(
      engineResult.classification,
      sample.classification,
      JSON.stringify(input)
    );
  });
};

Promise.all([assertFrontendRulesMatch(), assertSimulatorMatchesEngine()])
  .then(() => {
    console.log(`matching engine tests passed (${passed})`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
