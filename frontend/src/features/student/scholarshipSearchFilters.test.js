import assert from 'node:assert/strict';
import { REGIONS } from '../../data/locationData.js';
import { applyScholarshipSearch, SCHOLARSHIP_SEARCH_REGIONS } from './scholarshipSearchFilters.js';

const listing = (id, overrides = {}) => ({
  _id: id,
  title: overrides.title || id,
  degreeLevel: overrides.degreeLevel || 'College',
  geographicLocation: overrides.geographicLocation || {
    scope: 'Region',
    regions: ['Bicol Region'],
    provinces: ['Albay'],
    municipalities: []
  },
  specialTags: overrides.specialTags || [],
  totalScore: overrides.totalScore ?? 80,
  amount: overrides.amount ?? '15000',
  deadline: overrides.deadline || '2026-12-31'
});

const sample = [
  listing('bicol-college', {
    degreeLevel: 'College',
    totalScore: 70,
    amount: '10000',
    deadline: '2026-12-20',
    specialTags: [{ tagName: 'Person with Disability (PWD)', mode: 'Preferred' }]
  }),
  listing('ncr-graduate', {
    degreeLevel: 'Graduate Studies',
    geographicLocation: {
      scope: 'Region',
      regions: ['National Capital Region'],
      provinces: [],
      municipalities: []
    },
    totalScore: 90,
    amount: '₱40,000',
    deadline: '2026-11-01',
    specialTags: [{ tagName: '4Ps Beneficiary', mode: 'Exclusive' }]
  }),
  listing('nationwide-shs', {
    degreeLevel: 'Senior High School',
    geographicLocation: { scope: 'Nationwide', regions: [], provinces: [], municipalities: [] },
    totalScore: 60,
    amount: 'Full tuition',
    deadline: '2026-10-01'
  }),
  listing('calabarzon-college', {
    degreeLevel: 'College',
    geographicLocation: {
      scope: 'Province',
      regions: ['CALABARZON'],
      provinces: ['Laguna'],
      municipalities: []
    },
    totalScore: 85,
    amount: 25000,
    deadline: '2027-01-15',
    specialTags: [
      { tagName: 'Working Student', mode: 'Preferred' },
      { tagName: 'Indigenous Peoples (IP)', mode: 'Preferred' }
    ]
  })
];

const ids = (rows) => rows.map((row) => row._id);

const cleared = {
  selectedRegion: 'All',
  selectedDegree: 'All',
  selectedFlags: [],
  minMatchScore: 0,
  sortBy: 'match'
};

assert.deepEqual(
  ids(applyScholarshipSearch(sample, { ...cleared, selectedRegion: 'NCR' })),
  ['ncr-graduate', 'nationwide-shs']
);
assert.deepEqual(
  ids(applyScholarshipSearch(sample, { ...cleared, selectedRegion: 'Region V (Bicol Region)' })),
  ['bicol-college', 'nationwide-shs']
);
assert.deepEqual(
  ids(applyScholarshipSearch(sample, { ...cleared, selectedRegion: 'Region IV-A' })),
  ['calabarzon-college', 'nationwide-shs']
);
assert.deepEqual(
  ids(applyScholarshipSearch(sample, { ...cleared, selectedRegion: 'CALABARZON' })),
  ['calabarzon-college', 'nationwide-shs']
);
assert.deepEqual(
  ids(applyScholarshipSearch(sample, { ...cleared, selectedRegion: 'Bicol Region' })),
  ['bicol-college', 'nationwide-shs']
);
assert.deepEqual(
  ids(applyScholarshipSearch(sample, { ...cleared, selectedRegion: 'National Capital Region' })),
  ['ncr-graduate', 'nationwide-shs']
);

assert.equal(SCHOLARSHIP_SEARCH_REGIONS.length, 17);
assert.deepEqual(
  SCHOLARSHIP_SEARCH_REGIONS.map((region) => region.value).sort(),
  [...REGIONS].sort()
);

const nationwide = listing('nationwide', {
  geographicLocation: { scope: 'Nationwide', regions: [], provinces: [], municipalities: [] },
  totalScore: 10
});
const regionalListings = SCHOLARSHIP_SEARCH_REGIONS.map((region, index) => listing(region.value, {
  geographicLocation: {
    scope: 'Region',
    regions: [region.value],
    provinces: [],
    municipalities: []
  },
  totalScore: 40 + index
}));

for (const region of SCHOLARSHIP_SEARCH_REGIONS) {
  const rows = applyScholarshipSearch(
    [...regionalListings, nationwide],
    { ...cleared, selectedRegion: region.value }
  );
  assert.deepEqual(ids(rows), [region.value, 'nationwide']);
}

const numbered = [
  listing('region-v-text', {
    geographicLocation: 'Region V (Bicol Region)',
    totalScore: 70
  }),
  listing('region-vi-text', {
    geographicLocation: 'Region VI',
    totalScore: 65
  })
];
assert.deepEqual(
  ids(applyScholarshipSearch([...numbered, nationwide], { ...cleared, selectedRegion: 'Bicol Region' })),
  ['region-v-text', 'nationwide']
);
assert.deepEqual(
  ids(applyScholarshipSearch([...numbered, nationwide], { ...cleared, selectedRegion: 'Western Visayas' })),
  ['region-vi-text', 'nationwide']
);

const davao = listing('davao-college', {
  degreeLevel: 'College',
  geographicLocation: {
    scope: 'Region',
    regions: ['Davao Region'],
    provinces: [],
    municipalities: []
  },
  totalScore: 88,
  specialTags: [{ tagName: 'Working Student', mode: 'Preferred' }]
});
assert.deepEqual(
  ids(applyScholarshipSearch([davao, nationwide, ...sample], {
    selectedRegion: 'Davao Region',
    selectedDegree: 'Undergraduate',
    selectedFlags: ['isWorkingStudent'],
    minMatchScore: 80,
    sortBy: 'match'
  })),
  ['davao-college']
);

assert.deepEqual(
  ids(applyScholarshipSearch(sample, { ...cleared, selectedDegree: 'Undergraduate' })),
  ['calabarzon-college', 'bicol-college']
);
assert.deepEqual(
  ids(applyScholarshipSearch(sample, { ...cleared, selectedDegree: 'Senior High School' })),
  ['nationwide-shs']
);
assert.deepEqual(
  ids(applyScholarshipSearch(sample, { ...cleared, selectedDegree: 'Postgraduate' })),
  ['ncr-graduate']
);

assert.deepEqual(
  ids(applyScholarshipSearch(sample, { ...cleared, selectedFlags: ['isPWD'] })),
  ['bicol-college']
);
assert.deepEqual(
  ids(applyScholarshipSearch(sample, { ...cleared, selectedFlags: ['is4PsBeneficiary'] })),
  ['ncr-graduate']
);
assert.deepEqual(
  ids(applyScholarshipSearch(sample, { ...cleared, selectedFlags: ['isWorkingStudent', 'isPWD'] })).sort(),
  ['bicol-college', 'calabarzon-college']
);

assert.deepEqual(
  ids(applyScholarshipSearch(sample, { ...cleared, minMatchScore: 80 })),
  ['ncr-graduate', 'calabarzon-college']
);

const combined = applyScholarshipSearch(sample, {
  selectedRegion: 'Region IV-A',
  selectedDegree: 'Undergraduate',
  selectedFlags: ['isIP'],
  minMatchScore: 80,
  sortBy: 'amount'
});
assert.deepEqual(ids(combined), ['calabarzon-college']);

const withPwd = applyScholarshipSearch(sample, { ...cleared, selectedFlags: ['isPWD', 'isIP'] });
const pwdCleared = applyScholarshipSearch(sample, { ...cleared, selectedFlags: ['isIP'] });
assert.equal(withPwd.some((row) => row._id === 'bicol-college'), true);
assert.equal(pwdCleared.some((row) => row._id === 'bicol-college'), false);
assert.deepEqual(ids(applyScholarshipSearch(sample, cleared)), ['ncr-graduate', 'calabarzon-college', 'bicol-college', 'nationwide-shs']);

assert.deepEqual(
  ids(applyScholarshipSearch(sample, { ...cleared, selectedRegion: 'Not A Region' })),
  ['nationwide-shs']
);
assert.deepEqual(
  ids(applyScholarshipSearch(
    sample.filter((row) => row._id !== 'nationwide-shs'),
    { ...cleared, selectedRegion: 'Not A Region' }
  )),
  []
);
assert.deepEqual(ids(applyScholarshipSearch(sample, { ...cleared, selectedDegree: 'Elementary' })), []);
assert.deepEqual(ids(applyScholarshipSearch(sample, { ...cleared, selectedFlags: ['not-a-flag'] })), []);
assert.deepEqual(
  ids(applyScholarshipSearch(sample, { ...cleared, minMatchScore: Number.NaN })),
  ids(applyScholarshipSearch(sample, cleared))
);

const byDeadline = applyScholarshipSearch(sample, {
  ...cleared,
  selectedDegree: 'Undergraduate',
  sortBy: 'deadline'
});
assert.deepEqual(ids(byDeadline), ['bicol-college', 'calabarzon-college']);
const byAmount = applyScholarshipSearch(sample, {
  ...cleared,
  selectedDegree: 'Undergraduate',
  sortBy: 'amount'
});
assert.deepEqual(ids(byAmount), ['calabarzon-college', 'bicol-college']);
assert.equal(byDeadline.length, 2);

assert.deepEqual(applyScholarshipSearch([], cleared), []);
assert.deepEqual(applyScholarshipSearch(null, { ...cleared, sortBy: 'unknown' }), []);

console.log('scholarship search filter tests passed');
