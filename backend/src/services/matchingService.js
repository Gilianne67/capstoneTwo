const Scholarship = require('../models/Scholarship');
const {
  loadAliasIndex,
  CATALOG_INDEX,
  toMatchIds,
  setsIntersect
} = require('../utils/courseCanonical');

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
 * A bracket is eligible only when its entire ceiling is at or below
 * the provider maximum. The open-ended top bracket never is.
 */
const resolveMonthlyIncomeCap = (scholarship) => {
  const income = scholarship.incomeRequirement || {};
  const monthly = income.maxMonthlyIncome;

  if (monthly !== null && monthly !== undefined && monthly !== '') {
    const cap = Number(monthly);

    if (Number.isFinite(cap) && cap >= 0) {
      return cap;
    }

    return null;
  }

  return null;
};

const matchesIncome = (studentProfile, scholarship) => {
  const cap = resolveMonthlyIncomeCap(scholarship);

  if (cap === null) {
    return true;
  }

  const index = findIncomeBracketIndex(studentProfile.incomeBracket);

  if (index < 0) {
    return false;
  }

  const ceiling = INCOME_BRACKETS[index].ceiling;

  return Number.isFinite(ceiling) && ceiling <= cap;
};

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * A date-only deadline remains open through the end of that
 * calendar day in Asia/Manila.
 */
const isDeadlineOpen = (deadline, now = new Date()) => {
  if (!deadline) {
    return false;
  }

  const parsed = new Date(deadline);

  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const manila = new Date(parsed.getTime() + MANILA_OFFSET_MS);
  const endOfDeadlineDay = Date.UTC(
    manila.getUTCFullYear(),
    manila.getUTCMonth(),
    manila.getUTCDate(),
    15,
    59,
    59,
    999
  );

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
 * GWA score, 0–100, only after the hard filter has passed.
 *
 * The paper names "meets", "exceeds modestly", and "exceeds by a
 * large margin" but does not define the cutoffs. This score is the
 * straight line between the provider threshold and the best grade
 * on the student's scale:
 *
 *   ratio 0    => meets the threshold exactly        => 60
 *   ratio 0.5  => midpoint, modest / large boundary  => 80
 *   ratio 1    => best grade on the scale            => 100
 *
 *   gpaScore = 60 + 40 * ratio
 *
 * 1.00-5.00, lower is better, best grade is 1.00:
 *   ratio = (threshold - studentGwa) / (threshold - 1.00)
 *
 * 60-100, higher is better, best grade is 100:
 *   ratio = (studentGwa - threshold) / (100 - threshold)
 *
 * ratio is clamped to 0–1. A threshold that is already the best
 * grade scores 100.
 */
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

  let ratio;

  if (requirement.gradingScale === '1.00-5.00') {
    ratio = threshold <= 1 ? 1 : (threshold - studentGwa) / (threshold - 1);
  } else {
    ratio = threshold >= 100 ? 1 : (studentGwa - threshold) / (100 - threshold);
  }

  const clamped = Math.min(1, Math.max(0, ratio));
  return roundScore(60 + 40 * clamped);
};

/**
 * Income score, 0–100, only after the hard filter has passed.
 *
 * The paper names "fully aligns", "closely aligns", and "partially
 * aligns" but does not define peso cutoffs. Student income is one of
 * six ordered brackets, so alignment is the number of brackets between
 * the student and the highest bracket that still fits under the
 * monthly ceiling:
 *
 *   0 brackets of room => partially aligns => 60
 *   1 bracket of room  => closely aligns   => 80
 *   2 or more          => fully aligns     => 100
 *
 * No monthly ceiling, including a legacy annual maximumIncome that is
 * intentionally ignored, scores 100.
 */
const scoreIncome = (studentProfile, scholarship) => {
  const cap = resolveMonthlyIncomeCap(scholarship);

  if (cap === null) {
    return 100;
  }

  const studentIndex = findIncomeBracketIndex(studentProfile.incomeBracket);

  if (studentIndex < 0) {
    return null;
  }

  const eligibleIndexes = INCOME_BRACKETS
    .map((bracket, index) => ({ bracket, index }))
    .filter(
      ({ bracket }) =>
        Number.isFinite(bracket.ceiling) && bracket.ceiling <= cap
    )
    .map(({ index }) => index);

  if (!eligibleIndexes.includes(studentIndex)) {
    return null;
  }

  const tightest = Math.max(...eligibleIndexes);
  const distance = tightest - studentIndex;

  if (distance <= 0) {
    return 60;
  }

  if (distance === 1) {
    return 80;
  }

  return 100;
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

const getWeights = (scholarship) => {
  const weights = scholarship.criteriaWeights || {};

  const gwaWeight = Number(weights.gwaWeight);
  const incomeWeight = Number(weights.incomeWeight);
  const tagsWeight = Number(weights.tagsWeight);

  return {
    gwaWeight: Number.isFinite(gwaWeight)
      ? gwaWeight
      : DEFAULT_WEIGHTS.gwaWeight,
    incomeWeight: Number.isFinite(incomeWeight)
      ? incomeWeight
      : DEFAULT_WEIGHTS.incomeWeight,
    tagsWeight: Number.isFinite(tagsWeight)
      ? tagsWeight
      : DEFAULT_WEIGHTS.tagsWeight
  };
};

const classifyScore = (totalScore) => {
  if (totalScore >= 90) {
    return 'Highly Recommended';
  }

  if (totalScore >= 70) {
    return 'Recommended';
  }

  if (totalScore >= 50) {
    return 'Potential Match';
  }

  return 'Low Compatibility';
};

/**
 * Returns null when any hard filter fails, so a failed scholarship
 * never receives a ranking score.
 *
 * S_total = (gpaScore * gwaWeight) + (incomeScore * incomeWeight) + (tagsScore * tagsWeight)
 * Component scores are 0–100 and weights sum to 1, so S_total is 0–100.
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

const getEligibleScholarships = async (
  studentProfile,
  now = new Date()
) => {
  const [scholarships, aliasIndex] = await Promise.all([
    Scholarship.find({
      status: 'Open',
      isArchived: false
    }).lean(),
    loadAliasIndex()
  ]);

  return scholarships.filter((scholarship) =>
    passesHardFilters(studentProfile, scholarship, aliasIndex, now)
  );
};

const getRankedScholarships = async (
  studentProfile,
  now = new Date()
) => {
  const [scholarships, aliasIndex] = await Promise.all([
    Scholarship.find({
      status: 'Open',
      isArchived: false
    }).lean(),
    loadAliasIndex()
  ]);

  return rankScholarships(studentProfile, scholarships, aliasIndex, now);
};

module.exports = {
  INCOME_BRACKETS,
  getEligibleScholarships,
  getRankedScholarships,
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
  classifyScore
};
