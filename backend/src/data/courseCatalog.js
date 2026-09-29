/**
 * Canonical SHS strands and college/graduate programs.
 * Matching uses exact canonical IDs only — no family matching.
 */
const COURSE_CATALOG = [
  {
    canonicalId: 'shs-stem',
    canonicalName: 'STEM',
    academicLevel: 'Senior High School',
    kind: 'strand',
    aliases: [
      'STEM',
      'Science, Technology, Engineering and Mathematics',
      'Science Technology Engineering and Mathematics',
      'Science, Technology, Engineering, and Mathematics Strand',
      'STEM Strand'
    ]
  },
  {
    canonicalId: 'shs-abm',
    canonicalName: 'ABM',
    academicLevel: 'Senior High School',
    kind: 'strand',
    aliases: [
      'ABM',
      'Accountancy, Business and Management',
      'Accountancy Business and Management',
      'Accountancy, Business, and Management Strand',
      'ABM Strand'
    ]
  },
  {
    canonicalId: 'shs-humss',
    canonicalName: 'HUMSS',
    academicLevel: 'Senior High School',
    kind: 'strand',
    aliases: [
      'HUMSS',
      'Humanities and Social Sciences',
      'Humanities Social Sciences',
      'HUMSS Strand'
    ]
  },
  {
    canonicalId: 'shs-gas',
    canonicalName: 'GAS',
    academicLevel: 'Senior High School',
    kind: 'strand',
    aliases: [
      'GAS',
      'General Academic Strand',
      'General Academic'
    ]
  },
  {
    canonicalId: 'shs-tvl',
    canonicalName: 'TVL',
    academicLevel: 'Senior High School',
    kind: 'strand',
    aliases: [
      'TVL',
      'Technical-Vocational-Livelihood',
      'Technical Vocational Livelihood',
      'TVL Strand'
    ]
  },
  {
    canonicalId: 'shs-arts-design',
    canonicalName: 'Arts and Design',
    academicLevel: 'Senior High School',
    kind: 'strand',
    aliases: [
      'Arts and Design',
      'Arts & Design',
      'Arts and Design Strand'
    ]
  },
  {
    canonicalId: 'shs-sports',
    canonicalName: 'Sports',
    academicLevel: 'Senior High School',
    kind: 'strand',
    aliases: [
      'Sports',
      'Sports Track',
      'Sports Strand'
    ]
  },
  {
    canonicalId: 'college-bsit',
    canonicalName: 'BS Information Technology',
    academicLevel: 'College',
    kind: 'program',
    aliases: [
      'BSIT',
      'B.S.I.T.',
      'BS IT',
      'BS Information Technology',
      'Bachelor of Science in Information Technology'
    ]
  },
  {
    canonicalId: 'college-bscs',
    canonicalName: 'BS Computer Science',
    academicLevel: 'College',
    kind: 'program',
    aliases: [
      'BSCS',
      'B.S.C.S.',
      'BS CS',
      'BS Computer Science',
      'Bachelor of Science in Computer Science'
    ]
  },
  {
    canonicalId: 'college-bsis',
    canonicalName: 'BS Information Systems',
    academicLevel: 'College',
    kind: 'program',
    aliases: [
      'BSIS',
      'B.S.I.S.',
      'BS IS',
      'BS Information Systems',
      'Bachelor of Science in Information Systems'
    ]
  },
  {
    canonicalId: 'college-bscpe',
    canonicalName: 'BS Computer Engineering',
    academicLevel: 'College',
    kind: 'program',
    aliases: [
      'BSCpE',
      'BSCPE',
      'BS Computer Engineering',
      'Bachelor of Science in Computer Engineering'
    ]
  },
  {
    canonicalId: 'college-bsce',
    canonicalName: 'BS Civil Engineering',
    academicLevel: 'College',
    kind: 'program',
    aliases: [
      'BSCE',
      'BS Civil Engineering',
      'Bachelor of Science in Civil Engineering'
    ]
  },
  {
    canonicalId: 'college-bsee',
    canonicalName: 'BS Electrical Engineering',
    academicLevel: 'College',
    kind: 'program',
    aliases: [
      'BSEE',
      'BS Electrical Engineering',
      'Bachelor of Science in Electrical Engineering'
    ]
  },
  {
    canonicalId: 'college-bsme',
    canonicalName: 'BS Mechanical Engineering',
    academicLevel: 'College',
    kind: 'program',
    aliases: [
      'BSME',
      'BS Mechanical Engineering',
      'Bachelor of Science in Mechanical Engineering'
    ]
  },
  {
    canonicalId: 'college-bsn',
    canonicalName: 'BS Nursing',
    academicLevel: 'College',
    kind: 'program',
    aliases: [
      'BSN',
      'BS Nursing',
      'Bachelor of Science in Nursing'
    ]
  },
  {
    canonicalId: 'college-bsba',
    canonicalName: 'BS Business Administration',
    academicLevel: 'College',
    kind: 'program',
    aliases: [
      'BSBA',
      'BS Business Administration',
      'Bachelor of Science in Business Administration'
    ]
  },
  {
    canonicalId: 'college-bsed',
    canonicalName: 'Bachelor of Secondary Education',
    academicLevel: 'College',
    kind: 'program',
    aliases: [
      'BSED',
      'BSEd',
      'Bachelor of Secondary Education'
    ]
  },
  {
    canonicalId: 'college-ab-psych',
    canonicalName: 'AB Psychology',
    academicLevel: 'College',
    kind: 'program',
    aliases: [
      'AB Psych',
      'AB Psychology',
      'BA Psychology',
      'Bachelor of Arts in Psychology'
    ]
  },
  {
    canonicalId: 'grad-msit',
    canonicalName: 'MS Information Technology',
    academicLevel: 'Graduate Studies',
    kind: 'program',
    aliases: [
      'MSIT',
      'MS IT',
      'MS Information Technology',
      'Master of Science in Information Technology'
    ]
  },
  {
    canonicalId: 'grad-mscs',
    canonicalName: 'MS Computer Science',
    academicLevel: 'Graduate Studies',
    kind: 'program',
    aliases: [
      'MSCS',
      'MS CS',
      'MS Computer Science',
      'Master of Science in Computer Science'
    ]
  },
  {
    canonicalId: 'grad-mba',
    canonicalName: 'Master of Business Administration',
    academicLevel: 'Graduate Studies',
    kind: 'program',
    aliases: [
      'MBA',
      'Master of Business Administration'
    ]
  }
];

module.exports = { COURSE_CATALOG };
