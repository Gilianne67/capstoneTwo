const assert = require('assert');
const {
  COURSE_CATALOG,
  normalizeCourseText,
  resolveCanonical,
  toMatchIds,
  collectAliasClaims,
  buildAliasIndex,
  mergeAliasIndex,
  expandCourseAliases,
  CATALOG_INDEX
} = require('../utils/courseCanonical');
const { matchesCourse } = require('../services/matchingService');
const { buildSynonymLines } = require('../services/scholarshipSearchService');

const idsOf = (value, level) =>
  Array.from(toMatchIds(value, level, CATALOG_INDEX));

assert.strictEqual(
  normalizeCourseText('B.S.I.T.'),
  'bsit'
);
assert.strictEqual(
  normalizeCourseText('Bachelor of Science in Information Technology'),
  'bs information technology'
);
assert.strictEqual(
  normalizeCourseText('Science, Technology, Engineering and Mathematics'),
  'science technology engineering mathematics'
);

assert.strictEqual(
  resolveCanonical('STEM', 'Senior High School'),
  'shs-stem'
);
assert.strictEqual(
  resolveCanonical(
    'Science, Technology, Engineering and Mathematics',
    'Senior High School'
  ),
  'shs-stem'
);
assert.strictEqual(
  resolveCanonical('STEM', 'College'),
  null
);
assert.strictEqual(
  resolveCanonical('BSIT', 'College'),
  'college-bsit'
);
assert.strictEqual(
  resolveCanonical('BS Information Technology', 'College'),
  'college-bsit'
);
assert.strictEqual(resolveCanonical('IT', 'College'), 'college-bsit');
assert.strictEqual(
  resolveCanonical('Information Technology', 'College'),
  'college-bsit'
);
assert.strictEqual(resolveCanonical('IT', 'Senior High School'), null);
assert.strictEqual(
  resolveCanonical('Information Technology', 'Graduate Studies'),
  null
);
assert.strictEqual(
  resolveCanonical('BSCS', 'College'),
  'college-bscs'
);
assert.strictEqual(
  resolveCanonical('BSIT', 'Senior High School'),
  null
);

assert.deepStrictEqual(idsOf('BSIT', 'College'), ['college-bsit']);
assert.deepStrictEqual(
  idsOf('Custom Basket Weaving', 'College'),
  ['raw:custom basket weaving']
);

assert.strictEqual(
  matchesCourse('BSIT', ['BS Information Technology'], 'College'),
  true
);
assert.strictEqual(
  matchesCourse('IT', ['Information Technology'], 'College'),
  true
);
assert.strictEqual(
  matchesCourse('Information Technology', ['BS Information Technology'], 'College'),
  true
);
assert.strictEqual(
  matchesCourse('BSCS', ['BSIT'], 'College'),
  false
);
assert.strictEqual(
  matchesCourse('STEM', ['STEM Strand'], 'Senior High School'),
  true
);
assert.strictEqual(
  matchesCourse('STEM', ['BSIT'], 'College'),
  false
);
assert.strictEqual(
  matchesCourse('ABM', [], 'Senior High School'),
  true
);
assert.strictEqual(
  matchesCourse('', ['BSIT'], 'College'),
  false
);
assert.strictEqual(
  matchesCourse(
    'Custom Basket Weaving',
    ['custom basket weaving'],
    'College'
  ),
  true
);
assert.strictEqual(
  matchesCourse(
    'Custom Basket Weaving',
    ['BSIT'],
    'College'
  ),
  false
);

const assertBothSides = (left, right, level = 'College') => {
  assert.strictEqual(
    matchesCourse(left, [right], level),
    true,
    `${left} should match provider course ${right}`
  );
  assert.strictEqual(
    matchesCourse(right, [left], level),
    true,
    `${right} should match provider course ${left}`
  );
  assert.strictEqual(resolveCanonical(left, level), resolveCanonical(right, level));
  assert.ok(resolveCanonical(left, level));
};

assertBothSides('Civil Engineering', 'BS in Civil Engineering');
assertBothSides('Civil Engineering', 'BS Civil Engineering');
assertBothSides('BSCE', 'Civil Engineering');
assertBothSides('B.S.C.E.', 'Bachelor of Science in Civil Engineering');
assertBothSides('BSIT', 'Information Technology');
assertBothSides('BSCS', 'Computer Science');
assertBothSides('BS Computer Science', 'BS in Computer Science');
assertBothSides('BSIS', 'Information Systems');
assertBothSides('BSCpE', 'Computer Engineering');
assertBothSides('BSEE', 'Electrical Engineering');
assertBothSides('BSME', 'Mechanical Engineering');
assertBothSides('BSN', 'Nursing');
assertBothSides('BSBA', 'Business Administration');
assertBothSides('BSED', 'Secondary Education');
assertBothSides('AB Psychology', 'Psychology');
assertBothSides('BA in Psychology', 'Bachelor of Arts in Psychology');

assertBothSides(
  '  b.s.   in   civil-engineering ',
  'CIVIL ENGINEERING'
);
assertBothSides(
  'BS-in-Civil-Engineering',
  'civil engineering'
);

assert.strictEqual(
  matchesCourse('Civil Engineering', ['Mechanical Engineering'], 'College'),
  false
);
assert.strictEqual(
  matchesCourse('Civil Engineering', ['Computer Engineering'], 'College'),
  false
);
assert.strictEqual(
  matchesCourse('BSCE', ['BSEE'], 'College'),
  false
);
assert.strictEqual(
  matchesCourse('BSCS', ['BSCpE'], 'College'),
  false
);
assert.strictEqual(
  matchesCourse('Information Technology', ['Information Systems'], 'College'),
  false
);
assert.strictEqual(
  matchesCourse('Civil Engineering', ['BS Civil Engineering'], 'Senior High School'),
  false
);
assert.strictEqual(
  matchesCourse('Computer Science', ['MS Computer Science'], 'Graduate Studies'),
  false
);

assert.strictEqual(resolveCanonical('CE', 'College'), null);
assert.strictEqual(resolveCanonical('EE', 'College'), null);
assert.strictEqual(resolveCanonical('ME', 'College'), null);
assert.strictEqual(resolveCanonical('CS', 'College'), null);
assert.strictEqual(resolveCanonical('IS', 'College'), null);
assert.strictEqual(resolveCanonical('CpE', 'College'), null);
assert.strictEqual(resolveCanonical('Psych', 'College'), null);
assert.strictEqual(
  matchesCourse('CE', ['Civil Engineering'], 'College'),
  false
);
assert.strictEqual(
  matchesCourse('EE', ['Electrical Engineering'], 'College'),
  false
);
assert.strictEqual(
  matchesCourse('CS', ['Computer Science'], 'College'),
  false
);
assert.strictEqual(
  matchesCourse('BS Psychology', ['AB Psychology'], 'College'),
  false
);
assert.strictEqual(
  matchesCourse('BS Secondary Education', ['Secondary Education'], 'College'),
  false
);
assert.strictEqual(
  matchesCourse('Education', ['Secondary Education'], 'College'),
  false
);

assert.strictEqual(
  matchesCourse(
    'Civil Engineering Technology',
    ['Civil Engineering'],
    'College'
  ),
  false
);
assert.strictEqual(
  matchesCourse('Civil Eng', ['Civil Engineering'], 'College'),
  false
);
assert.strictEqual(
  matchesCourse('BS Basket Weaving', ['Basket Weaving'], 'College'),
  false
);
assert.strictEqual(
  matchesCourse('Basket Weaving', ['basket weaving'], 'College'),
  true
);
assert.strictEqual(
  matchesCourse('Civil Engineering', [], 'College'),
  true
);

assert.strictEqual(
  resolveCanonical('Information Technology', 'Graduate Studies'),
  null
);
assert.strictEqual(
  resolveCanonical('Computer Science', 'Graduate Studies'),
  null
);
assert.strictEqual(
  resolveCanonical('Business Administration', 'Graduate Studies'),
  null
);
assert.strictEqual(resolveCanonical('MSIT', 'Graduate Studies'), 'grad-msit');
assert.strictEqual(
  resolveCanonical('MS Computer Science', 'Graduate Studies'),
  'grad-mscs'
);
assert.strictEqual(resolveCanonical('MBA', 'Graduate Studies'), 'grad-mba');

COURSE_CATALOG
  .filter(
    (entry) =>
      entry.academicLevel === 'College' && /^BS\s+/i.test(entry.canonicalName)
  )
  .forEach((entry) => {
    const title = entry.canonicalName.replace(/^BS\s+/i, '').trim();
    assert.strictEqual(
      resolveCanonical(title, 'College'),
      entry.canonicalId,
      title
    );
    assert.strictEqual(
      resolveCanonical(`BS in ${title}`, 'College'),
      entry.canonicalId,
      `BS in ${title}`
    );
  });

collectAliasClaims(COURSE_CATALOG).forEach((ids, key) => {
  assert.strictEqual(
    ids.size,
    1,
    `ambiguous catalog alias ${key}: ${Array.from(ids).join(', ')}`
  );
});

const synonymLines = buildSynonymLines(
  COURSE_CATALOG.map((entry) => [
    entry.canonicalName,
    ...(entry.aliases || [])
  ])
);
assert.strictEqual(synonymLines.length, COURSE_CATALOG.length);

const staleCivil = buildAliasIndex([
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
  }
]);
assert.strictEqual(
  resolveCanonical('Civil Engineering', 'College', staleCivil),
  'college-bsce'
);
assert.strictEqual(
  resolveCanonical('BS in Civil Engineering', 'College', staleCivil),
  'college-bsce'
);

const expandedOnce = expandCourseAliases({
  canonicalId: 'college-bsce',
  canonicalName: 'BS Civil Engineering',
  academicLevel: 'College',
  aliases: ['BSCE']
});
const expandedTwice = expandCourseAliases(expandedOnce);
assert.deepStrictEqual(expandedTwice.aliases, expandedOnce.aliases);
assert.ok(expandedOnce.aliases.includes('Civil Engineering'));
assert.ok(expandedOnce.aliases.includes('BS in Civil Engineering'));

const ambiguous = buildAliasIndex([
  {
    canonicalId: 'college-bsce',
    canonicalName: 'BS Civil Engineering',
    academicLevel: 'College',
    aliases: ['CE', 'Civil Engineering']
  },
  {
    canonicalId: 'college-bscpe',
    canonicalName: 'BS Computer Engineering',
    academicLevel: 'College',
    aliases: ['CE', 'Computer Engineering']
  }
]);
assert.strictEqual(resolveCanonical('CE', 'College', ambiguous), null);
assert.strictEqual(
  resolveCanonical('Civil Engineering', 'College', ambiguous),
  'college-bsce'
);
assert.strictEqual(
  resolveCanonical('Computer Engineering', 'College', ambiguous),
  'college-bscpe'
);
assert.strictEqual(
  matchesCourse('CE', ['Civil Engineering'], 'College', ambiguous),
  false
);
assert.strictEqual(
  matchesCourse('CE', ['CE'], 'College', ambiguous),
  true
);

const conflicting = buildAliasIndex([
  {
    canonicalId: 'college-other',
    canonicalName: 'Other Civil Program',
    academicLevel: 'College',
    aliases: ['Civil Engineering']
  }
]);
const merged = mergeAliasIndex(CATALOG_INDEX, conflicting);
assert.strictEqual(resolveCanonical('Civil Engineering', 'College', merged), null);
assert.strictEqual(resolveCanonical('BSCE', 'College', merged), 'college-bsce');
assert.strictEqual(resolveCanonical('BSIT', 'College', merged), 'college-bsit');

console.log('course canonicalization tests passed');
