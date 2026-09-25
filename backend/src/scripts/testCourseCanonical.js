const assert = require('assert');
const {
  normalizeCourseText,
  resolveCanonical,
  toMatchIds,
  CATALOG_INDEX
} = require('../utils/courseCanonical');
const { matchesCourse } = require('../services/matchingService');

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

console.log('course canonicalization tests passed');
