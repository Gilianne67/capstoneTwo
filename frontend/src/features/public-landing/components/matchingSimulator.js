/**
 * Homepage demonstration of the published matching rules.
 * Numbers follow backend/src/services/matchingEngine.js for one fictional
 * scholarship. This does not search listings or read a student profile.
 *
 * Default weights when a scholarship has no custom criteriaWeights:
 * academic 0.40, income 0.40, preferred tags 0.20.
 * Classification: 90 or higher Highly Recommended, 70 or higher Recommended,
 * 50 or higher Potential Match, otherwise Low Compatibility.
 */

export const CLASSIFICATION_BANDS = [
  { minimumScore: 90, label: 'Highly Recommended', summary: '90 or higher' },
  { minimumScore: 70, label: 'Recommended', summary: '70 or higher' },
  { minimumScore: 50, label: 'Potential Match', summary: '50 or higher' },
  { minimumScore: null, label: 'Low Compatibility', summary: 'Below 50' },
];

export const INCOME_BRACKETS = [
  { label: 'Below ₱10,000 / month', ceiling: 10000 },
  { label: '₱10,001 – ₱21,190 / month', ceiling: 21190 },
  { label: '₱21,191 – ₱43,828 / month', ceiling: 43828 },
  { label: '₱43,829 – ₱76,669 / month', ceiling: 76669 },
  { label: '₱76,670 – ₱131,484 / month', ceiling: 131484 },
  { label: 'Above ₱131,484 / month', ceiling: Infinity },
];

export const SAMPLE_SCHOLARSHIP = {
  name: 'Sample Academic Grant',
  gwaCeiling: 2,
  percentageFloor: 85,
  monthlyIncomeCap: 43828,
  incomeCapLabel: '₱43,828 / month',
  preferredTag: '4Ps Beneficiary',
  weights: {
    gwaWeight: 0.4,
    incomeWeight: 0.4,
    tagsWeight: 0.2,
  },
};

const roundScore = (value) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const formatScore = (value) => {
  const rounded = roundScore(value);
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
};

const classifyScore = (totalScore) => {
  const band = CLASSIFICATION_BANDS.find(
    (entry) => entry.minimumScore !== null && totalScore >= entry.minimumScore
  );

  return band ? band.label : 'Low Compatibility';
};

export const formatWeight = (weight) => `${Math.round(Number(weight) * 100)}%`;

const parseGwa = (value) => {
  const parsed = Number.parseFloat(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

export function validateSampleInputs({ scale, gwa, incomeBracket, hasPreferredTag }) {
  const errors = {};

  if (scale !== '1.00-5.00' && scale !== '60-100') {
    errors.scale = 'Choose the grading scale your school uses.';
  }

  const parsedGwa = parseGwa(gwa);
  if (String(gwa ?? '').trim() === '') {
    errors.gwa = 'Enter your GWA or grade to continue.';
  } else if (parsedGwa === null) {
    errors.gwa = 'Enter a number, such as 1.75 or 92.';
  } else if (scale === '1.00-5.00' && (parsedGwa < 1 || parsedGwa > 5)) {
    errors.gwa = 'On the 1.00–5.00 scale, enter a GWA from 1.00 to 5.00. A lower number is a better grade.';
  } else if (scale === '60-100' && (parsedGwa < 60 || parsedGwa > 100)) {
    errors.gwa = 'On the 60–100 scale, enter a grade from 60 to 100. A higher number is a better grade.';
  }

  if (!INCOME_BRACKETS.some((bracket) => bracket.label === incomeBracket)) {
    errors.incomeBracket = 'Choose the monthly income range closest to your household.';
  }

  if (hasPreferredTag !== 'yes' && hasPreferredTag !== 'no') {
    errors.hasPreferredTag = 'Choose Yes or No for this sample qualification.';
  }

  return errors;
}

const scoreGpa = (scale, gwa) => {
  const threshold = scale === '1.00-5.00'
    ? SAMPLE_SCHOLARSHIP.gwaCeiling
    : SAMPLE_SCHOLARSHIP.percentageFloor;

  const ratio = scale === '1.00-5.00'
    ? (threshold - gwa) / (threshold - 1)
    : (gwa - threshold) / (100 - threshold);

  const clamped = Math.min(1, Math.max(0, ratio));
  return roundScore(60 + 40 * clamped);
};

const passesGwa = (scale, gwa) => {
  if (scale === '1.00-5.00') {
    return gwa >= 1 && gwa <= 5 && gwa <= SAMPLE_SCHOLARSHIP.gwaCeiling;
  }

  return gwa >= 60 && gwa <= 100 && gwa >= SAMPLE_SCHOLARSHIP.percentageFloor;
};

const scoreIncome = (incomeBracket) => {
  const index = INCOME_BRACKETS.findIndex((bracket) => bracket.label === incomeBracket);
  const ceiling = INCOME_BRACKETS[index]?.ceiling;

  if (!Number.isFinite(ceiling) || ceiling > SAMPLE_SCHOLARSHIP.monthlyIncomeCap) {
    return { passes: false, score: null };
  }

  const eligibleIndexes = INCOME_BRACKETS
    .map((bracket, bracketIndex) => ({ bracket, bracketIndex }))
    .filter(({ bracket }) => (
      Number.isFinite(bracket.ceiling) &&
      bracket.ceiling <= SAMPLE_SCHOLARSHIP.monthlyIncomeCap
    ))
    .map(({ bracketIndex }) => bracketIndex);

  const distance = Math.max(...eligibleIndexes) - index;

  if (distance <= 0) return { passes: true, score: 60 };
  if (distance === 1) return { passes: true, score: 80 };
  return { passes: true, score: 100 };
};

/**
 * Returns an illustrative comparison against SAMPLE_SCHOLARSHIP.
 * Call only after validateSampleInputs returns no errors.
 */
export function evaluateSampleMatch({ scale, gwa, incomeBracket, hasPreferredTag }) {
  const parsedGwa = parseGwa(gwa);
  const gwaPasses = passesGwa(scale, parsedGwa);
  const income = scoreIncome(incomeBracket);
  const reasons = [];

  if (!gwaPasses) {
    reasons.push(
      scale === '1.00-5.00'
        ? `The sample requires a GWA of ${formatScore(SAMPLE_SCHOLARSHIP.gwaCeiling)} or better on the 1.00–5.00 scale, where lower is better. ${formatScore(parsedGwa)} does not pass.`
        : `The sample requires a grade of ${SAMPLE_SCHOLARSHIP.percentageFloor} or higher on the 60–100 scale. ${formatScore(parsedGwa)} does not pass.`
    );
  }

  if (!income.passes) {
    reasons.push(
      `The sample only includes household income brackets at or below ${SAMPLE_SCHOLARSHIP.incomeCapLabel}. The selected bracket does not pass.`
    );
  }

  if (reasons.length > 0) {
    return {
      illustrative: true,
      eligible: false,
      reasons,
      gpaScore: null,
      incomeScore: null,
      tagsScore: null,
      totalScore: null,
      classification: null,
      weights: SAMPLE_SCHOLARSHIP.weights,
    };
  }

  const gpaScore = scoreGpa(scale, parsedGwa);
  const incomeScore = income.score;
  const tagsScore = hasPreferredTag === 'yes' ? 100 : 0;
  const { gwaWeight, incomeWeight, tagsWeight } = SAMPLE_SCHOLARSHIP.weights;
  const totalScore = roundScore(
    Math.min(
      100,
      Math.max(
        0,
        gpaScore * gwaWeight + incomeScore * incomeWeight + tagsScore * tagsWeight
      )
    )
  );

  return {
    illustrative: true,
    eligible: true,
    reasons: [],
    gpaScore,
    incomeScore,
    tagsScore,
    totalScore,
    classification: classifyScore(totalScore),
    weights: SAMPLE_SCHOLARSHIP.weights,
  };
}

const COMPLETE_PROBE = {
  scale: '1.00-5.00',
  gwa: '1.50',
  incomeBracket: INCOME_BRACKETS[0].label,
  hasPreferredTag: 'yes',
};

export const SIGNUP_PATH = '/auth?mode=signup';

export const EMPTY_PREVIEW_FORM = {
  scale: '',
  gwa: '',
  incomeBracket: '',
  hasPreferredTag: '',
};

/** Drop a grade that cannot exist on the newly selected scale. */
export function gradeAfterScaleChange(nextScale, gwa) {
  if (String(gwa ?? '').trim() === '') return '';
  const errors = validateSampleInputs({
    ...COMPLETE_PROBE,
    scale: nextScale,
    gwa,
  });
  return errors.gwa ? '' : String(gwa).trim();
}

export function createPreviewState() {
  return {
    form: { ...EMPTY_PREVIEW_FORM },
    errors: {},
    result: null,
  };
}

export function reducePreview(state, action) {
  if (action.type === 'edit') {
    const form = { ...state.form, [action.field]: action.value };
    if (action.field === 'scale' && action.value !== state.form.scale) {
      form.gwa = gradeAfterScaleChange(action.value, state.form.gwa);
    }

    const errors = { ...state.errors };
    delete errors[action.field];
    if (action.field === 'scale') delete errors.gwa;

    return { ...state, form, errors, result: null };
  }

  if (action.type === 'submit') {
    const errors = validateSampleInputs(state.form);
    if (Object.keys(errors).length > 0) {
      return { ...state, errors, result: null };
    }

    return {
      ...state,
      errors: {},
      result: evaluateSampleMatch(state.form),
    };
  }

  if (action.type === 'reset') {
    return createPreviewState();
  }

  return state;
}

export function describePracticeResult(result) {
  if (!result || result.illustrative !== true) return null;

  if (!result.eligible) {
    return {
      heading: 'This sample would not be ranked',
      score: null,
      classification: null,
      summary: `No practice score is calculated until every requirement of the fictional ${SAMPLE_SCHOLARSHIP.name} is met. This is not a scholarship offer.`,
      reasons: result.reasons,
    };
  }

  return {
    heading: result.classification,
    score: result.totalScore,
    classification: result.classification,
    summary: `This practice score is ${formatScore(result.totalScore)} out of 100, labeled ${result.classification}. It compares these answers with the fictional ${SAMPLE_SCHOLARSHIP.name}. It is not a scholarship offer or a guarantee of eligibility.`,
    reasons: [],
  };
}
