import assert from 'node:assert/strict';
import { buildFilterDemandPayload } from './filterDemand.js';

assert.equal(buildFilterDemandPayload({
  selectedRegion: 'All',
  selectedDegree: 'All',
  selectedFlags: [],
  searchQuery: 'Juan Dela Cruz',
}), null);

const payload = buildFilterDemandPayload({
  selectedRegion: 'Ilocos Region',
  selectedDegree: 'Undergraduate',
  selectedFlags: ['isPWD', 'isPWD'],
  searchQuery: 'private email and scholarship name',
});

assert.deepEqual(payload, {
  academicLevel: 'College',
  region: 'Ilocos Region',
  eligibilityTags: ['Person with Disability (PWD)'],
});
assert.equal(Object.hasOwn(payload, 'searchQuery'), false);
assert.equal(Object.hasOwn(payload, 'query'), false);
assert.equal(JSON.stringify(payload).includes('Juan'), false);
assert.equal(JSON.stringify(payload).includes('@'), false);

console.log('Filter demand payload tests passed');
