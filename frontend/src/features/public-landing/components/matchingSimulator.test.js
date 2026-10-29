import assert from 'node:assert/strict';
import {
  CLASSIFICATION_BANDS,
  INCOME_BRACKETS,
  SIGNUP_PATH,
  createPreviewState,
  describePracticeResult,
  evaluateSampleMatch,
  formatScore,
  formatWeight,
  gradeAfterScaleChange,
  reducePreview,
  validateSampleInputs,
} from './matchingSimulator.js';

const valid = {
  scale: '1.00-5.00',
  gwa: '1.50',
  incomeBracket: 'Below ₱10,000 / month',
  hasPreferredTag: 'yes',
};

assert.deepEqual(validateSampleInputs(valid), {});

assert.equal(validateSampleInputs({ ...valid, scale: '' }).scale !== undefined, true);
assert.equal(validateSampleInputs({ ...valid, gwa: '' }).gwa !== undefined, true);
assert.equal(validateSampleInputs({ ...valid, gwa: 'abc' }).gwa !== undefined, true);
assert.equal(validateSampleInputs({ ...valid, gwa: '0.5' }).gwa !== undefined, true);
assert.equal(validateSampleInputs({ ...valid, scale: '60-100', gwa: '1.50' }).gwa !== undefined, true);
assert.equal(validateSampleInputs({ ...valid, scale: '60-100', gwa: '101' }).gwa !== undefined, true);
assert.equal(validateSampleInputs({ ...valid, incomeBracket: '' }).incomeBracket !== undefined, true);
assert.equal(validateSampleInputs({ ...valid, hasPreferredTag: '' }).hasPreferredTag !== undefined, true);
assert.deepEqual(validateSampleInputs({ ...valid, gwa: ' 1.75 ' }), {});

const highly = evaluateSampleMatch(valid);
assert.equal(highly.eligible, true);
assert.equal(highly.illustrative, true);
assert.equal(highly.gpaScore, 100);
assert.equal(highly.incomeScore, 85);
assert.equal(highly.tagsScore, 100);
assert.equal(highly.totalScore, 94);
assert.equal(highly.classification, 'Highly Recommended');

const exact = evaluateSampleMatch({
  scale: '1.00-5.00',
  gwa: '2.00',
  incomeBracket: '₱21,191 – ₱43,828 / month',
  hasPreferredTag: 'no',
});
assert.equal(exact.gpaScore, 75);
assert.equal(exact.incomeScore, 50);
assert.equal(exact.tagsScore, 0);
assert.equal(exact.totalScore, 50);
assert.equal(exact.classification, 'Potential Match');

const best = evaluateSampleMatch({
  scale: '1.00-5.00',
  gwa: '1.00',
  incomeBracket: '₱10,001 – ₱21,190 / month',
  hasPreferredTag: 'yes',
});
assert.equal(best.gpaScore, 100);
assert.equal(best.incomeScore, 70);
assert.equal(best.tagsScore, 100);
assert.equal(best.totalScore, 88);
assert.equal(best.classification, 'Recommended');

const percentage = evaluateSampleMatch({
  scale: '60-100',
  gwa: '92.5',
  incomeBracket: '₱21,191 – ₱43,828 / month',
  hasPreferredTag: 'yes',
});
assert.equal(percentage.gpaScore, 100);
assert.equal(percentage.incomeScore, 50);
assert.equal(percentage.tagsScore, 100);
assert.equal(percentage.totalScore, 80);
assert.equal(percentage.classification, 'Recommended');

const blocked = evaluateSampleMatch({
  scale: '1.00-5.00',
  gwa: '2.25',
  incomeBracket: 'Above ₱131,484 / month',
  hasPreferredTag: 'yes',
});
assert.equal(blocked.eligible, false);
assert.equal(blocked.totalScore, null);
assert.equal(blocked.classification, null);
assert.equal(blocked.reasons.length, 2);

const gradeBlocked = evaluateSampleMatch({
  scale: '60-100',
  gwa: '84',
  incomeBracket: 'Below ₱10,000 / month',
  hasPreferredTag: 'no',
});
assert.equal(gradeBlocked.eligible, false);
assert.equal(gradeBlocked.reasons.length, 1);

const potential = evaluateSampleMatch({
  scale: '1.00-5.00',
  gwa: '1.00',
  incomeBracket: '₱21,191 – ₱43,828 / month',
  hasPreferredTag: 'no',
});
assert.equal(potential.eligible, true);
assert.equal(potential.gpaScore, 100);
assert.equal(potential.incomeScore, 50);
assert.equal(potential.totalScore, 60);
assert.equal(potential.classification, 'Potential Match');

assert.deepEqual(
  CLASSIFICATION_BANDS.map((band) => band.label),
  ['Highly Recommended', 'Recommended', 'Potential Match', 'Low Compatibility']
);
assert.equal(formatWeight(0.4), '40%');
assert.equal(formatWeight(0.2), '20%');
assert.equal(formatScore(80), '80');
assert.equal(formatScore(92.5), '92.5');

assert.equal(gradeAfterScaleChange('60-100', '1.50'), '');
assert.equal(gradeAfterScaleChange('1.00-5.00', '92'), '');
assert.equal(gradeAfterScaleChange('60-100', '92'), '92');
assert.equal(gradeAfterScaleChange('1.00-5.00', '1.75'), '1.75');
assert.equal(gradeAfterScaleChange('60-100', ''), '');

for (const bracket of INCOME_BRACKETS) {
  const sample = evaluateSampleMatch({
    scale: '1.00-5.00',
    gwa: '1.50',
    incomeBracket: bracket.label,
    hasPreferredTag: 'no',
  });
  const passes = Number.isFinite(bracket.ceiling) && bracket.ceiling <= 43828;
  assert.equal(sample.eligible, passes);
  assert.equal(sample.illustrative, true);
  if (passes) {
    const distance = 2 - INCOME_BRACKETS.indexOf(bracket);
    const expectedIncome = distance >= 3 ? 100 : distance === 2 ? 85 : distance === 1 ? 70 : 50;
    assert.equal(sample.tagsScore, 0);
    assert.equal(sample.gpaScore, 100);
    assert.equal(sample.incomeScore, expectedIncome);
  } else {
    assert.equal(sample.totalScore, null);
    assert.equal(sample.classification, null);
  }
}

assert.equal(evaluateSampleMatch({ ...valid, hasPreferredTag: 'no' }).tagsScore, 0);
assert.equal(evaluateSampleMatch(valid).tagsScore, 100);

let preview = createPreviewState();
preview = reducePreview(preview, { type: 'submit' });
assert.equal(preview.errors.scale !== undefined, true);
assert.equal(preview.errors.gwa !== undefined, true);
assert.equal(preview.errors.incomeBracket !== undefined, true);
assert.equal(preview.errors.hasPreferredTag !== undefined, true);
assert.equal(preview.result, null);

preview = reducePreview(preview, { type: 'edit', field: 'scale', value: '1.00-5.00' });
preview = reducePreview(preview, { type: 'edit', field: 'gwa', value: '1.50' });
preview = reducePreview(preview, { type: 'edit', field: 'scale', value: '60-100' });
assert.equal(preview.form.scale, '60-100');
assert.equal(preview.form.gwa, '');
preview = reducePreview(preview, { type: 'edit', field: 'gwa', value: '92.5' });
preview = reducePreview(preview, { type: 'edit', field: 'incomeBracket', value: '₱21,191 – ₱43,828 / month' });
preview = reducePreview(preview, { type: 'edit', field: 'hasPreferredTag', value: 'yes' });
preview = reducePreview(preview, { type: 'submit' });
assert.equal(preview.result.illustrative, true);
assert.equal(preview.result.eligible, true);
assert.equal(preview.result.totalScore, 80);
assert.equal(preview.result.classification, 'Recommended');
assert.equal(describePracticeResult(preview.result).heading, 'Recommended');
assert.equal(describePracticeResult(preview.result).score, 80);
assert.equal(preview.form.gwa, '92.5');
assert.equal(preview.form.incomeBracket, '₱21,191 – ₱43,828 / month');

const passing = reducePreview(
  {
    ...createPreviewState(),
    form: { ...valid },
  },
  { type: 'submit' }
);
assert.equal(passing.result.totalScore, 94);
assert.equal(passing.result.classification, 'Highly Recommended');
assert.equal(describePracticeResult(passing.result).score, 94);

const failing = reducePreview(
  {
    ...createPreviewState(),
    form: {
      scale: '1.00-5.00',
      gwa: '2.50',
      incomeBracket: 'Above ₱131,484 / month',
      hasPreferredTag: 'no',
    },
  },
  { type: 'submit' }
);
assert.equal(failing.result.eligible, false);
assert.equal(failing.result.totalScore, null);
assert.equal(failing.result.classification, null);
assert.equal(describePracticeResult(failing.result).score, null);
assert.equal(describePracticeResult(failing.result).reasons.length, 2);

const reset = reducePreview(passing, { type: 'reset' });
assert.equal(reset.form.gwa, '');
assert.equal(reset.form.scale, '');
assert.equal(reset.form.incomeBracket, '');
assert.equal(reset.form.hasPreferredTag, '');
assert.equal(reset.result, null);
assert.equal(SIGNUP_PATH, '/auth?mode=signup');

console.log('matchingSimulator.test.js passed');
