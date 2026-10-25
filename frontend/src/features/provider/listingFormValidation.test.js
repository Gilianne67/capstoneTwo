import assert from 'node:assert/strict';
import {
  PAST_DEADLINE_MESSAGE,
  applicationUrlError,
  deadlineError,
  localDateInputValue,
  manilaDateInputValue,
  validateListingForm
} from './listingFormValidation.js';

const TODAY = '2026-10-25';

const validListing = (overrides = {}) => ({
  title: 'DOST Merit Scholarship',
  grantValue: '₱40,000 / semester',
  category: 'Merit-Based',
  deadline: TODAY,
  portalUrl: 'https://provider.gov.ph/apply',
  description: 'Covers tuition for eligible college students.',
  benefits: ['Full tuition coverage'],
  academicLevel: 'College',
  citizenship: 'Filipino',
  enableScale105: true,
  maxGwa105: '2.50',
  enableScale60100: false,
  minGpa60100: '',
  maxIncome: '30000',
  allowedCourses: ['BS Civil Engineering'],
  geographicScope: 'Municipality',
  selectedRegion: 'National Capital Region',
  selectedProvince: 'Metro Manila',
  selectedMunicipality: 'Manila',
  requiredTags: ['4Ps Beneficiary'],
  preferredTags: ['Working Student'],
  weights: { gpaWeight: 40, incomeWeight: 40, tagsWeight: 20 },
  ...overrides
});

const shiftLocalDate = (isoDate, days) => {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return localDateInputValue(date);
};

const errorsFor = (overrides) => validateListingForm(validListing(overrides), TODAY);

let passed = 0;

const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

check('local calendar date is not taken from UTC', () => {
  const earlyMorning = new Date(2026, 9, 26, 0, 30, 0);
  assert.equal(localDateInputValue(earlyMorning), '2026-10-26');

  const utcDay = earlyMorning.toISOString().slice(0, 10);
  if (earlyMorning.getTimezoneOffset() < 0) {
    assert.equal(utcDay, '2026-10-25');
    assert.notEqual(localDateInputValue(earlyMorning), utcDay);
  }
});

check('Manila calendar day is used when a timestamp is loaded for edit', () => {
  assert.equal(manilaDateInputValue('2026-10-25'), '2026-10-25');
  assert.equal(manilaDateInputValue('2026-10-24T16:00:00.000Z'), '2026-10-25');
});

check('yesterday is rejected and today and future dates are accepted', () => {
  const yesterday = shiftLocalDate(TODAY, -1);
  const tomorrow = shiftLocalDate(TODAY, 1);

  assert.equal(deadlineError(yesterday, TODAY), PAST_DEADLINE_MESSAGE);
  assert.equal(deadlineError(TODAY, TODAY), '');
  assert.equal(deadlineError(tomorrow, TODAY), '');
  assert.equal(errorsFor({ deadline: yesterday }).deadline, PAST_DEADLINE_MESSAGE);
  assert.equal(errorsFor({ deadline: TODAY }).deadline, undefined);
  assert.equal(errorsFor({ deadline: tomorrow }).deadline, undefined);
});

check('a past deadline blocks submission', () => {
  const errors = errorsFor({ deadline: shiftLocalDate(TODAY, -1) });
  assert.ok(errors.deadline);
  assert.equal(Object.keys(errors).length > 0, true);
});

check('required fields reject empty and whitespace-only values', () => {
  const errors = errorsFor({
    title: '   ',
    grantValue: ' ',
    description: '\n\t',
    portalUrl: '   ',
    academicLevel: '',
    citizenship: ' ',
    deadline: ''
  });

  assert.equal(errors.title, 'Scholarship name is required.');
  assert.equal(errors.grantValue, 'Grant value is required.');
  assert.equal(errors.description, 'Program description is required.');
  assert.equal(errors.portalUrl, 'Application URL is required.');
  assert.equal(errors.academicLevel, 'Academic level is required.');
  assert.equal(errors.citizenship, 'Citizenship requirement is required.');
  assert.equal(errors.deadline, 'Application deadline is required.');
});

check('optional benefits and income can be left blank', () => {
  const errors = errorsFor({ benefits: [], maxIncome: '   ', allowedCourses: [] });
  assert.equal(errors.benefits, undefined);
  assert.equal(errors.maxIncome, undefined);
  assert.equal(errors.allowedCourses, undefined);
});

check('invalid application URLs are rejected and http(s) URLs are accepted', () => {
  assert.match(applicationUrlError('javascript:alert(1)'), /HTTP or HTTPS/);
  assert.match(applicationUrlError('ftp://provider.gov.ph/apply'), /HTTP or HTTPS/);
  assert.match(applicationUrlError('not a url'), /HTTP or HTTPS/);
  assert.equal(applicationUrlError('https://provider.gov.ph/apply'), '');
  assert.equal(applicationUrlError(' http://provider.gov.ph/apply '), '');
  assert.equal(errorsFor({ portalUrl: 'javascript:alert(1)' }).portalUrl !== undefined, true);
});

check('numeric fields reject malformed, negative, and out-of-range values', () => {
  assert.ok(errorsFor({ maxGwa105: 'abc' }).maxGwa105);
  assert.ok(errorsFor({ maxGwa105: '0.5' }).maxGwa105);
  assert.ok(errorsFor({ maxGwa105: '6' }).maxGwa105);
  assert.ok(errorsFor({ enableScale105: false, enableScale60100: true, minGpa60100: 'NaN' }).minGpa60100);
  assert.ok(errorsFor({ enableScale105: false, enableScale60100: true, minGpa60100: '59' }).minGpa60100);
  assert.ok(errorsFor({ maxIncome: '-1' }).maxIncome);
  assert.ok(errorsFor({ maxIncome: '12abc' }).maxIncome);
  assert.equal(errorsFor({ maxGwa105: '1.75', maxIncome: '0' }).maxGwa105, undefined);
});

check('selections must belong to the supported options', () => {
  assert.ok(errorsFor({ category: 'Unknown' }).category);
  assert.ok(errorsFor({ academicLevel: 'Elementary' }).academicLevel);
  assert.ok(errorsFor({ citizenship: 'Permanent Resident' }).citizenship);
  assert.ok(errorsFor({ geographicScope: 'Barangay' }).geographicScope);
  assert.ok(errorsFor({ selectedRegion: 'Atlantis' }).selectedRegion);
  assert.ok(errorsFor({ selectedProvince: 'Atlantis' }).selectedProvince);
  assert.ok(errorsFor({ selectedMunicipality: 'Atlantis' }).selectedMunicipality);
  assert.equal(errorsFor({ geographicScope: 'Nationwide', selectedRegion: '', selectedProvince: '', selectedMunicipality: '' }).selectedRegion, undefined);
});

check('empty benefit and course entries and unknown tags are rejected', () => {
  assert.ok(errorsFor({ benefits: ['Tuition', '   '] }).benefits);
  assert.ok(errorsFor({ allowedCourses: [''] }).allowedCourses);
  assert.ok(errorsFor({ requiredTags: ['Not A Real Tag'], preferredTags: [] }).tags);
  assert.ok(errorsFor({
    requiredTags: ['Working Student'],
    preferredTags: ['Working Student']
  }).tags);
  assert.equal(errorsFor({ requiredTags: [], preferredTags: [] }).tags, undefined);
});

check('ranking weights must be numeric, inside range, and total 100', () => {
  assert.match(errorsFor({ weights: { gpaWeight: 'abc', incomeWeight: 40, tagsWeight: 20 } }).weights, /valid numbers/);
  assert.match(errorsFor({ weights: { gpaWeight: -1, incomeWeight: 81, tagsWeight: 20 } }).weights, /negative|between/);
  assert.match(errorsFor({ weights: { gpaWeight: 80, incomeWeight: 20, tagsWeight: 0 } }).weights, /20% and 70%/);
  assert.match(errorsFor({ weights: { gpaWeight: 50, incomeWeight: 40, tagsWeight: 20 } }).weights, /100%/);
  assert.equal(errorsFor().weights, undefined);
});

check('a complete listing has no validation errors', () => {
  assert.deepEqual(errorsFor(), {});
});

check('edit mode uses the same deadline rule', () => {
  const savedDeadline = manilaDateInputValue('2026-10-20T16:00:00.000Z');
  const errors = errorsFor({ deadline: savedDeadline });
  assert.equal(savedDeadline, '2026-10-21');
  assert.equal(errors.deadline, PAST_DEADLINE_MESSAGE);
});

console.log(`\n${passed} validation checks passed`);
