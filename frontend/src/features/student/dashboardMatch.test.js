import assert from 'node:assert/strict';
import {
  EMPTY_MATCH_TITLE,
  INCOMPLETE_PROFILE_MESSAGE,
  INCOMPLETE_PROFILE_TITLE,
  interpretDashboardMatches,
  mapDashboardMatch
} from './dashboardMatch.js';

const match = (name, score, tagsScore) => ({
  totalScore: score,
  gpaScore: 80,
  incomeScore: 60,
  tagsScore,
  classification: 'Recommended',
  scholarship: {
    _id: name,
    name,
    scholarshipType: 'Merit',
    grantValue: '15000',
    deadline: '2026-12-31',
    description: `${name} description`,
    applicationURL: 'https://example.edu/apply'
  }
});

const incomplete = interpretDashboardMatches({
  success: true,
  count: 0,
  matches: [],
  profileComplete: false
});

assert.equal(incomplete.profileIncomplete, true);
assert.deepEqual(incomplete.matches, []);
assert.equal(incomplete.count, 0);
assert.equal(INCOMPLETE_PROFILE_TITLE, 'Complete your student profile');
assert.match(INCOMPLETE_PROFILE_MESSAGE, /Finish your profile/);
assert.equal(EMPTY_MATCH_TITLE, 'No eligible scholarship match right now');

const empty = interpretDashboardMatches({
  success: true,
  count: 0,
  matches: []
});

assert.equal(empty.profileIncomplete, false);
assert.deepEqual(empty.matches, []);
assert.equal(empty.count, 0);

const ranked = interpretDashboardMatches({
  success: true,
  count: 2,
  matches: [match('City IT Grant', 86.67, 100), match('Need-Based Regional', 53.33, 0)]
});

assert.equal(ranked.profileIncomplete, false);
assert.equal(ranked.count, 2);
assert.equal(ranked.matches.length, 1);
assert.equal(ranked.matches[0].title, 'City IT Grant');
assert.equal(ranked.matches[0].matchBreakdown.gwa.score, 80);
assert.equal(ranked.matches[0].matchBreakdown.financial.score, 60);
assert.equal(ranked.matches[0].matchBreakdown.specialEligibility.score, 100);
assert.equal(Object.hasOwn(ranked.matches[0].matchBreakdown, 'location'), false);

const mapped = mapDashboardMatch(match('Working Student Grant', 70, 40));
assert.equal(mapped.matchBreakdown.specialEligibility.score, 40);
assert.equal(mapped.matchBreakdown.specialEligibility.detail, 'Special eligibility alignment');
assert.equal(Object.hasOwn(mapped.matchBreakdown, 'location'), false);

console.log('dashboard match display tests passed');
