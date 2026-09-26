const assert = require('assert');
const { CATALOG_INDEX } = require('../utils/courseCanonical');
const {
  passesHardFilters,
  evaluateScholarship,
  rankScholarships,
  classifyScore
} = require('../services/matchingService');

const FIXED_NOW = new Date('2026-09-26T04:00:00.000Z');

const BELOW_10K = 'Below ₱10,000 / month';
const FROM_10K = '₱10,001 – ₱21,190 / month';
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

test('GPA score is calculated', () => {
  const midpoint = ranked(
    baseStudent({ gwa: 1.5, gwaScale: '1.00-5.00' }),
    baseScholarship({
      academicRequirements: [
        { gradingScale: '1.00-5.00', minimumGPA: 2 }
      ]
    })
  );
  const exact = ranked(
    baseStudent({ gwa: 2, gwaScale: '1.00-5.00' }),
    baseScholarship({
      academicRequirements: [
        { gradingScale: '1.00-5.00', minimumGPA: 2 }
      ]
    })
  );
  const best = ranked(
    baseStudent({ gwa: 1, gwaScale: '1.00-5.00' }),
    baseScholarship({
      academicRequirements: [
        { gradingScale: '1.00-5.00', minimumGPA: 2 }
      ]
    })
  );
  const percentage = ranked(
    baseStudent({ gwa: 90, gwaScale: '60-100' }),
    baseScholarship({
      academicRequirements: [
        { gradingScale: '60-100', minimumGPA: 80 }
      ]
    })
  );

  assert.strictEqual(midpoint.gpaScore, 80);
  assert.strictEqual(exact.gpaScore, 60);
  assert.strictEqual(best.gpaScore, 100);
  assert.strictEqual(percentage.gpaScore, 80);
});

test('income score is calculated', () => {
  const partial = ranked(
    baseStudent({ incomeBracket: BELOW_10K }),
    baseScholarship({
      incomeRequirement: { maxMonthlyIncome: 10000 }
    })
  );
  const close = ranked(
    baseStudent({ incomeBracket: BELOW_10K }),
    baseScholarship({
      incomeRequirement: { maxMonthlyIncome: 21190 }
    })
  );
  const full = ranked(
    baseStudent({ incomeBracket: BELOW_10K }),
    baseScholarship({
      incomeRequirement: { maxMonthlyIncome: 43828 }
    })
  );
  const unrestricted = ranked(
    baseStudent({ incomeBracket: ABOVE_131K }),
    baseScholarship({
      incomeRequirement: { maxMonthlyIncome: null }
    })
  );

  assert.strictEqual(partial.incomeScore, 60);
  assert.strictEqual(close.incomeScore, 80);
  assert.strictEqual(full.incomeScore, 100);
  assert.strictEqual(unrestricted.incomeScore, 100);
  assert.strictEqual(
    eligible(
      baseStudent({ incomeBracket: FROM_21K }),
      baseScholarship({
        incomeRequirement: { maxMonthlyIncome: 21190 }
      })
    ),
    false
  );
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

  assert.strictEqual(result.gpaScore, 80);
  assert.strictEqual(result.incomeScore, 60);
  assert.strictEqual(result.tagsScore, 50);
  assert.deepStrictEqual(result.weights, {
    gwaWeight: 0.7,
    incomeWeight: 0.2,
    tagsWeight: 0.1
  });
  assert.strictEqual(result.totalScore, 73);
  assert.notStrictEqual(result.totalScore, 66);
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
      { gradingScale: '1.00-5.00', minimumGPA: 2 }
    ]
  });

  const results = rankScholarships(
    student,
    [low, high, middle],
    CATALOG_INDEX,
    FIXED_NOW
  );

  assert.deepStrictEqual(
    results.map((result) => result.scholarship.name),
    ['High', 'Middle', 'Low']
  );
  assert.ok(results[0].totalScore > results[1].totalScore);
  assert.ok(results[1].totalScore > results[2].totalScore);
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
    baseStudent({ gwa: 2.5 }),
    baseScholarship({
      academicRequirements: [
        { gradingScale: '1.00-5.00', minimumGPA: 2.5 }
      ]
    })
  );

  assert.strictEqual(highly.totalScore, 100);
  assert.strictEqual(highly.classification, 'Highly Recommended');
  assert.strictEqual(recommended.totalScore, 84);
  assert.strictEqual(recommended.classification, 'Recommended');
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

console.log(`matching engine tests passed (${passed})`);
