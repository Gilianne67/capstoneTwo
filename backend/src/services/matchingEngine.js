const {
  CATALOG_INDEX,
  toMatchIds,
  setsIntersect
} = require('../utils/courseCanonicalCore');

/**
 * Student income brackets, in ascending order.
 * Comparison ceilings are the amounts written in each label.
 * The open-ended top bracket has no finite ceiling.
 */
const INCOME_BRACKETS = [
  { label: 'Below ₱10,000 / month', ceiling: 10000 },
  { label: '₱10,001 – ₱21,190 / month', ceiling: 21190 },
  { label: '₱21,191 – ₱43,828 / month', ceiling: 43828 },
  { label: '₱43,829 – ₱76,669 / month', ceiling: 76669 },
  { label: '₱76,670 – ₱131,484 / month', ceiling: 131484 },
  { label: 'Above ₱131,484 / month', ceiling: Infinity }
];

const DEFAULT_WEIGHTS = {
  gwaWeight: 0.4,
  incomeWeight: 0.4,
  tagsWeight: 0.2
};

const WEIGHT_LIMITS = {
  gwaWeight: { min: 0.2, max: 0.7 },
  incomeWeight: { min: 0.2, max: 0.7 },
  tagsWeight: { min: 0, max: 0.3 }
};

/**
 * Same absolute tolerance as Scholarship pre('validate').
 * Exact equality would reject 0.7 + 0.2 + 0.1, which is
 * 0.9999999999999999 in IEEE-754. That triple is what the provider
 * form stores for 70% / 20% / 10%, and the model already accepts it.
 */
const WEIGHT_TOTAL_TOLERANCE = 0.0001;

const CLASSIFICATION_THRESHOLDS = {
  highlyRecommended: 90,
  recommended: 70,
  potentialMatch: 50
};

const FLAG_TAGS = [
  {
    flag: 'isIndigenous',
    names: ['Indigenous Peoples (IP)', 'IP']
  },
  {
    flag: 'isPWD',
    names: ['Person with Disability (PWD)', 'PWD', 'PWD Status']
  },
  {
    flag: 'isSoloParentChild',
    names: ['Solo Parent Dependent', 'Solo Parent Child']
  },
  {
    flag: 'isOrphan',
    names: ['Orphan Status', 'Orphan']
  },
  {
    flag: 'isFarmerFisherfolkChild',
    names: ['Child of Farmer / Fisherfolk', 'Farmer/Fisherfolk Child']
  },
  {
    flag: 'isDisasterAffected',
    names: ['Disaster-Affected Family', 'Disaster Affected']
  },
  {
    flag: 'isWorkingStudent',
    names: ['Working Student']
  },
  {
    flag: 'is4PsBeneficiary',
    names: ['4Ps Beneficiary', '4Ps']
  }
];

const roundScore = (value) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const normalizeText = (value) =>
  String(value || '').trim().toLowerCase();

const normalizeIncomeLabel = (value) =>
  String(value || '')
    .replace(/[–—-]/g, '-')
    .replace(/₱/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const normalizeScale = (scale) => {
  const value = String(scale || '').trim();

  if (value === '1-5' || value === '1.00-5.00') {
    return '1.00-5.00';
  }

  if (value === '60-100') {
    return '60-100';
  }

  return null;
};

const findIncomeBracketIndex = (incomeBracket) => {
  const normalized = normalizeIncomeLabel(incomeBracket);

  return INCOME_BRACKETS.findIndex(
    (bracket) => normalizeIncomeLabel(bracket.label) === normalized
  );
};

const canonicalTagKey = (tagName) => {
  const normalized = normalizeText(tagName);
  const match = FLAG_TAGS.find((entry) =>
    entry.names.some((name) => normalizeText(name) === normalized)
  );

  return match ? match.flag : `raw:${normalized}`;
};

const isExclusiveMode = (mode) => {
  const normalized = normalizeText(mode);
  return normalized === 'exclusive' || normalized === 'only';
};

const isPreferredMode = (mode) => normalizeText(mode) === 'preferred';

/**
 * Checks whether a student's course matches
 * one of the scholarship's eligible courses.
 *
 * Empty provider list = no course restriction.
 * Match on exact canonical ID, otherwise raw normalized text.
 */
const matchesCourse = (
  studentCourse,
  scholarshipCourses,
  academicLevel,
  aliasIndex = CATALOG_INDEX
) => {
  if (!scholarshipCourses || scholarshipCourses.length === 0) {
    return true;
  }

  if (!studentCourse) {
    return false;
  }

  const studentIds = toMatchIds(
    studentCourse,
    academicLevel,
    aliasIndex
  );

  if (studentIds.size === 0) {
    return false;
  }

  return scholarshipCourses.some((course) => {
    if (!course) {
      return false;
    }

    const providerIds = toMatchIds(
      course,
      academicLevel,
      aliasIndex
    );

    return setsIntersect(studentIds, providerIds);
  });
};

const listIncludes = (list, value) =>
  (list || []).some(
    (item) => normalizeText(item) === normalizeText(value)
  );

/**
 * Nationwide is unrestricted.
 * Region, Province, and Municipality each check only that scope's field.
 * Records with no scope keep the previous "every listed level must match" rule.
 */
const matchesLocation = (studentProfile, geographicLocation) => {
  if (!geographicLocation) {
    return true;
  }

  const scope = normalizeText(geographicLocation.scope);
  const regions = geographicLocation.regions || [];
  const provinces = geographicLocation.provinces || [];
  const municipalities = geographicLocation.municipalities || [];

  if (scope === 'nationwide') {
    return true;
  }

  if (scope === 'region') {
    return listIncludes(regions, studentProfile.region);
  }

  if (scope === 'province') {
    return listIncludes(provinces, studentProfile.province);
  }

  if (scope === 'municipality') {
    return listIncludes(
      municipalities,
      studentProfile.municipalityCity
    );
  }

  if (
    regions.length === 0 &&
    provinces.length === 0 &&
    municipalities.length === 0
  ) {
    return true;
  }

  if (
    regions.length > 0 &&
    !listIncludes(regions, studentProfile.region)
  ) {
    return false;
  }

  if (
    provinces.length > 0 &&
    !listIncludes(provinces, studentProfile.province)
  ) {
    return false;
  }

  if (
    municipalities.length > 0 &&
    !listIncludes(municipalities, studentProfile.municipalityCity)
  ) {
    return false;
  }

  return true;
};

const getStudentTagKeys = (studentProfile) => {
  const flags = studentProfile.specialEligibilityFlags || {};

  return FLAG_TAGS
    .filter((entry) => flags[entry.flag])
    .map((entry) => entry.flag);
};

/**
 * Provider-facing tag labels for the student's special eligibility flags.
 */
const getStudentTags = (studentProfile) => {
  const keys = new Set(getStudentTagKeys(studentProfile));

  return FLAG_TAGS
    .filter((entry) => keys.has(entry.flag))
    .map((entry) => entry.names[0]);
};

const studentHasTag = (studentProfile, tagName) => {
  if (!tagName || !String(tagName).trim()) {
    return false;
  }

  const keys = new Set(getStudentTagKeys(studentProfile));
  return keys.has(canonicalTagKey(tagName));
};

const matchesExclusiveTags = (studentProfile, specialTags) => {
  if (!specialTags || specialTags.length === 0) {
    return true;
  }

  const exclusiveTags = specialTags.filter((tag) =>
    isExclusiveMode(tag.mode)
  );

  return exclusiveTags.every((requiredTag) =>
    studentHasTag(studentProfile, requiredTag.tagName)
  );
};

const matchesAcademicLevel = (studentProfile, scholarship) => {
  const required = scholarship.hardFilters?.academicLevel;

  if (!required || !String(required).trim()) {
    return false;
  }

  return (
    normalizeText(required) ===
    normalizeText(studentProfile.academicLevel)
  );
};

const matchesCitizenship = (studentProfile, scholarship) => {
  const required = normalizeText(
    scholarship.hardFilters?.citizenshipStatus
  );
  const student = normalizeText(studentProfile.citizenship);

  if (!required) {
    return true;
  }

  if (required === 'any') {
    return student === 'filipino' || student === 'non-filipino';
  }

  if (required === 'filipino') {
    return student === 'filipino';
  }

  return student === required;
};

const getAcademicRequirements = (scholarship) => {
  const current = Array.isArray(scholarship.academicRequirements)
    ? scholarship.academicRequirements
    : [];

  const normalizedCurrent = current
    .map((requirement) => ({
      gradingScale: normalizeScale(requirement?.gradingScale),
      minimumGPA: Number(requirement?.minimumGPA)
    }))
    .filter(
      (requirement) =>
        requirement.gradingScale &&
        Number.isFinite(requirement.minimumGPA)
    );

  if (normalizedCurrent.length > 0) {
    return normalizedCurrent;
  }

  const legacy = scholarship.academicRequirement;

  if (
    legacy &&
    legacy.minimumGPA != null &&
    legacy.gradingScale
  ) {
    const gradingScale = normalizeScale(legacy.gradingScale);
    const minimumGPA = Number(legacy.minimumGPA);

    if (gradingScale && Number.isFinite(minimumGPA)) {
      return [{ gradingScale, minimumGPA }];
    }
  }

  return [];
};

const requirementForScale = (scholarship, gwaScale) => {
  const scale = normalizeScale(gwaScale);

  if (!scale) {
    return null;
  }

  return (
    getAcademicRequirements(scholarship).find(
      (requirement) => requirement.gradingScale === scale
    ) || null
  );
};

/**
 * 1.00-5.00 passes when the student GWA is less than or equal to
 * the provider maximum allowable GWA.
 * 60-100 passes when the student GWA is greater than or equal to
 * the provider minimum.
 * Only the requirement for the student's gwaScale is used.
 */
const matchesAcademicRequirement = (studentProfile, scholarship) => {
  const requirement = requirementForScale(
    scholarship,
    studentProfile.gwaScale
  );

  if (!requirement) {
    return false;
  }

  const gwa = Number(studentProfile.gwa);

  if (!Number.isFinite(gwa)) {
    return false;
  }

  if (requirement.gradingScale === '1.00-5.00') {
    return gwa >= 1 && gwa <= 5 && gwa <= requirement.minimumGPA;
  }

  return gwa >= 60 && gwa <= 100 && gwa >= requirement.minimumGPA;
};

/**
 * maxMonthlyIncome is a monthly peso ceiling.
 * Legacy maximumIncome was stored as an annual amount, so it is not
 * applied as a monthly ceiling.
 *
 * null, undefined, and '' mean no cap.
 * A finite cap of 0 or more, including 0, is a real ceiling.
 * Negative, non-finite, and non-numeric values are invalid. They must
 * not be treated as an unlimited allowance.
 */
const resolveMonthlyIncomeCap = (scholarship) => {
  const income = scholarship.incomeRequirement || {};
  const monthly = income.maxMonthlyIncome;

  if (monthly === null || monthly === undefined || monthly === '') {
    return { kind: 'unset' };
  }

  const cap = typeof monthly === 'number' ? monthly : Number(monthly);

  if (!Number.isFinite(cap) || cap < 0) {
    return { kind: 'invalid' };
  }

  return { kind: 'cap', cap };
};

/**
 * A bracket is eligible only when its entire ceiling is at or below
 * the provider maximum. The open-ended top bracket never is.
 */
const eligibleIncomeIndexes = (cap) =>
  INCOME_BRACKETS
    .map((bracket, index) => ({ bracket, index }))
    .filter(
      ({ bracket }) =>
        Number.isFinite(bracket.ceiling) && bracket.ceiling <= cap
    )
    .map(({ index }) => index);

const matchesIncome = (studentProfile, scholarship) => {
  const resolved = resolveMonthlyIncomeCap(scholarship);

  if (resolved.kind === 'unset') {
    return true;
  }

  if (resolved.kind === 'invalid') {
    return false;
  }

  const index = findIncomeBracketIndex(studentProfile.incomeBracket);

  if (index < 0) {
    return false;
  }

  return eligibleIncomeIndexes(resolved.cap).includes(index);
};

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * End of the deadline's calendar day in Asia/Manila, as a UTC timestamp.
 * A date-only deadline remains open through 23:59:59.999 that day.
 */
const manilaDeadlineEnd = (deadline) => {
  if (!deadline) {
    return null;
  }

  const parsed = new Date(deadline);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const manila = new Date(parsed.getTime() + MANILA_OFFSET_MS);

  return Date.UTC(
    manila.getUTCFullYear(),
    manila.getUTCMonth(),
    manila.getUTCDate(),
    15,
    59,
    59,
    999
  );
};

/**
 * A date-only deadline remains open through the end of that
 * calendar day in Asia/Manila.
 */
const isDeadlineOpen = (deadline, now = new Date()) => {
  const endOfDeadlineDay = manilaDeadlineEnd(deadline);

  if (endOfDeadlineDay === null) {
    return false;
  }

  return now.getTime() <= endOfDeadlineDay;
};

const passesHardFilters = (
  studentProfile,
  scholarship,
  aliasIndex = CATALOG_INDEX,
  now = new Date()
) => {
  if (normalizeText(scholarship.status) !== 'open') {
    return false;
  }

  if (scholarship.isArchived === true) {
    return false;
  }

  if (!isDeadlineOpen(scholarship.deadline, now)) {
    return false;
  }

  if (!matchesAcademicLevel(studentProfile, scholarship)) {
    return false;
  }

  if (
    !matchesCourse(
      studentProfile.course,
      scholarship.hardFilters?.courseProgram,
      studentProfile.academicLevel,
      aliasIndex
    )
  ) {
    return false;
  }

  if (
    !matchesLocation(
      studentProfile,
      scholarship.hardFilters?.geographicLocation
    )
  ) {
    return false;
  }

  if (!matchesCitizenship(studentProfile, scholarship)) {
    return false;
  }

  if (!matchesExclusiveTags(studentProfile, scholarship.specialTags)) {
    return false;
  }

  if (!matchesAcademicRequirement(studentProfile, scholarship)) {
    return false;
  }

  if (!matchesIncome(studentProfile, scholarship)) {
    return false;
  }

  return true;
};

/**
 * GWA score after the hard filter has passed.
 *
 * Table 3.3 names three passing tiers: meeting the cutoff (75),
 * exceeding it modestly (85), and exceeding it by a large margin (100).
 * The approved methodology does not define the numeric width of those
 * tiers. The boundaries below are a proposed implementation rule, not
 * a cutoff quoted from the methodology.
 *
 * improvementRatio is the fraction of the span from the cutoff to the
 * best grade on the student's scale.
 *
 *   ratio === 0       => 75
 *   0 < ratio < 0.50  => 85
 *   ratio >= 0.50     => 100
 *
 * 1.00-5.00, lower is better, best grade is 1.00:
 *   improvementRatio = (requiredGwa - studentGwa) / (requiredGwa - 1.00)
 *
 * 60-100, higher is better, best grade is 100:
 *   improvementRatio = (studentGwa - requiredGwa) / (100 - requiredGwa)
 *
 * When the cutoff is already the best grade, the span length is 0.
 * The only passing grade is that best grade, so the score is 100 and
 * the formula does not divide. A failing GWA is excluded by
 * matchesAcademicRequirement and does not receive a component score.
 */
const scoreFromImprovementRatio = (ratio) => {
  if (!Number.isFinite(ratio) || ratio < 0) {
    return null;
  }

  if (ratio === 0) {
    return 75;
  }

  if (ratio < 0.5) {
    return 85;
  }

  return 100;
};

const scoreGpa = (studentProfile, scholarship) => {
  const requirement = requirementForScale(
    scholarship,
    studentProfile.gwaScale
  );

  if (!requirement) {
    return null;
  }

  const studentGwa = Number(studentProfile.gwa);
  const threshold = Number(requirement.minimumGPA);

  if (!Number.isFinite(studentGwa) || !Number.isFinite(threshold)) {
    return null;
  }

  if (requirement.gradingScale === '1.00-5.00') {
    const passes =
      studentGwa >= 1 &&
      studentGwa <= 5 &&
      studentGwa <= threshold;

    if (!passes) {
      return null;
    }

    if (threshold <= 1) {
      return 100;
    }

    return scoreFromImprovementRatio(
      (threshold - studentGwa) / (threshold - 1)
    );
  }

  const passes =
    studentGwa >= 60 &&
    studentGwa <= 100 &&
    studentGwa >= threshold;

  if (!passes) {
    return null;
  }

  if (threshold >= 100) {
    return 100;
  }

  return scoreFromImprovementRatio(
    (studentGwa - threshold) / (100 - threshold)
  );
};

/**
 * Income score after the hard filter has passed.
 *
 * Table 3.4 names 100, 85, 70, and 50 for eligible students. The
 * approved methodology does not define which bracket distance maps to
 * each tier, and the scholarship stores only a maximum monthly income.
 * The distances below are a proposed implementation rule, not a cutoff
 * quoted from the methodology. Distance is measured from the highest
 * bracket whose ceiling is still at or below that cap:
 *
 *   3 or more brackets below => 100
 *   exactly 2 below          => 85
 *   exactly 1 below          => 70
 *   the highest eligible     => 50
 *
 * No monthly cap scores 100 for every bracket, including the
 * open-ended top bracket. An invalid cap scores nothing. A student
 * above the cap is excluded by matchesIncome and is not scored.
 */
const scoreIncome = (studentProfile, scholarship) => {
  const resolved = resolveMonthlyIncomeCap(scholarship);

  if (resolved.kind === 'unset') {
    return 100;
  }

  if (resolved.kind === 'invalid') {
    return null;
  }

  const studentIndex = findIncomeBracketIndex(studentProfile.incomeBracket);

  if (studentIndex < 0) {
    return null;
  }

  const eligibleIndexes = eligibleIncomeIndexes(resolved.cap);

  if (!eligibleIndexes.includes(studentIndex)) {
    return null;
  }

  const tightest = Math.max(...eligibleIndexes);
  const distance = tightest - studentIndex;

  if (distance >= 3) {
    return 100;
  }

  if (distance === 2) {
    return 85;
  }

  if (distance === 1) {
    return 70;
  }

  return 50;
};

/**
 * Preferred-tag score, 0–100.
 * No preferred tags scores 100.
 * Exclusive tags are a hard filter and do not add points.
 * score = 100 * matchedPreferred / preferredCount
 */
const scoreTags = (studentProfile, scholarship) => {
  const preferred = (scholarship.specialTags || []).filter((tag) =>
    isPreferredMode(tag.mode)
  );

  if (preferred.length === 0) {
    return 100;
  }

  const matched = preferred.filter((tag) =>
    studentHasTag(studentProfile, tag.tagName)
  ).length;

  return roundScore((100 * matched) / preferred.length);
};

const finiteWeight = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const withinLimit = (value, limit) =>
  value >= limit.min && value <= limit.max;

/**
 * Missing criteriaWeights uses the full default vector.
 * A present configuration is used only when every component is finite,
 * inside its approved limit, and the three weights total 1 within
 * WEIGHT_TOTAL_TOLERANCE. Partial or malformed objects return null
 * instead of mixing in defaults.
 */
const approvedWeights = (criteriaWeights) => {
  if (
    !criteriaWeights ||
    typeof criteriaWeights !== 'object' ||
    Array.isArray(criteriaWeights)
  ) {
    return null;
  }

  const gwaWeight = finiteWeight(criteriaWeights.gwaWeight);
  const incomeWeight = finiteWeight(criteriaWeights.incomeWeight);
  const tagsWeight = finiteWeight(criteriaWeights.tagsWeight);

  if (
    gwaWeight === null ||
    incomeWeight === null ||
    tagsWeight === null
  ) {
    return null;
  }

  if (
    !withinLimit(gwaWeight, WEIGHT_LIMITS.gwaWeight) ||
    !withinLimit(incomeWeight, WEIGHT_LIMITS.incomeWeight) ||
    !withinLimit(tagsWeight, WEIGHT_LIMITS.tagsWeight)
  ) {
    return null;
  }

  const total = gwaWeight + incomeWeight + tagsWeight;

  if (Math.abs(total - 1) > WEIGHT_TOTAL_TOLERANCE) {
    return null;
  }

  return { gwaWeight, incomeWeight, tagsWeight };
};

const getWeights = (scholarship) => {
  const criteriaWeights = scholarship && scholarship.criteriaWeights;

  if (criteriaWeights == null) {
    return {
      gwaWeight: DEFAULT_WEIGHTS.gwaWeight,
      incomeWeight: DEFAULT_WEIGHTS.incomeWeight,
      tagsWeight: DEFAULT_WEIGHTS.tagsWeight
    };
  }

  return approvedWeights(criteriaWeights);
};

const classifyScore = (totalScore) => {
  if (totalScore >= CLASSIFICATION_THRESHOLDS.highlyRecommended) {
    return 'Highly Recommended';
  }

  if (totalScore >= CLASSIFICATION_THRESHOLDS.recommended) {
    return 'Recommended';
  }

  if (totalScore >= CLASSIFICATION_THRESHOLDS.potentialMatch) {
    return 'Potential Match';
  }

  return 'Low Compatibility';
};

/**
 * Engine-wide scoring rules. Provider weights stay on each scholarship
 * and are not part of this object.
 */
const scoringConfiguration = () => ({
  defaultWeights: {
    gwaWeight: DEFAULT_WEIGHTS.gwaWeight,
    incomeWeight: DEFAULT_WEIGHTS.incomeWeight,
    tagsWeight: DEFAULT_WEIGHTS.tagsWeight
  },
  classification: [
    {
      minimumScore: CLASSIFICATION_THRESHOLDS.highlyRecommended,
      label: 'Highly Recommended'
    },
    {
      minimumScore: CLASSIFICATION_THRESHOLDS.recommended,
      label: 'Recommended'
    },
    {
      minimumScore: CLASSIFICATION_THRESHOLDS.potentialMatch,
      label: 'Potential Match'
    },
    {
      minimumScore: null,
      label: 'Low Compatibility'
    }
  ]
});

/**
 * Returns null when any hard filter fails, a component score is
 * unavailable, or criteriaWeights is present but not an approved
 * total of 1. Invalid weights are left out of the ranking. They are
 * not replaced component-by-component and not clamped into a score.
 * A missing criteriaWeights value uses 0.4 / 0.4 / 0.2.
 *
 * S_total = (gpaScore * gwaWeight) + (incomeScore * incomeWeight) + (tagsScore * tagsWeight)
 * Component scores are 0–100 and approved weights sum to 1, so S_total is 0–100.
 */
const evaluateScholarship = (
  studentProfile,
  scholarship,
  aliasIndex = CATALOG_INDEX,
  now = new Date()
) => {
  if (!passesHardFilters(studentProfile, scholarship, aliasIndex, now)) {
    return null;
  }

  const gpaScore = scoreGpa(studentProfile, scholarship);
  const incomeScore = scoreIncome(studentProfile, scholarship);
  const tagsScore = scoreTags(studentProfile, scholarship);

  if (
    gpaScore === null ||
    incomeScore === null ||
    tagsScore === null
  ) {
    return null;
  }

  const weights = getWeights(scholarship);

  if (!weights) {
    return null;
  }

  const totalScore = roundScore(
    Math.min(
      100,
      Math.max(
        0,
        gpaScore * weights.gwaWeight +
          incomeScore * weights.incomeWeight +
          tagsScore * weights.tagsWeight
      )
    )
  );

  return {
    scholarship,
    totalScore,
    gpaScore,
    incomeScore,
    tagsScore,
    weights,
    classification: classifyScore(totalScore)
  };
};

const rankScholarships = (
  studentProfile,
  scholarships,
  aliasIndex = CATALOG_INDEX,
  now = new Date()
) =>
  (scholarships || [])
    .map((scholarship) =>
      evaluateScholarship(studentProfile, scholarship, aliasIndex, now)
    )
    .filter(Boolean)
    .sort((left, right) => right.totalScore - left.totalScore);

module.exports = {
  INCOME_BRACKETS,
  DEFAULT_WEIGHTS,
  FLAG_TAGS,
  CLASSIFICATION_THRESHOLDS,
  scoringConfiguration,
  passesHardFilters,
  matchesCourse,
  matchesLocation,
  matchesExclusiveTags,
  matchesAcademicRequirement,
  matchesIncome,
  getStudentTags,
  evaluateScholarship,
  rankScholarships,
  scoreGpa,
  scoreIncome,
  scoreTags,
  classifyScore,
  isDeadlineOpen,
  manilaDeadlineEnd
};
