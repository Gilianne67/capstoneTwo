/**
 * Same completion rules as frontend/src/features/student/profileCompletion.js.
 * This only decides whether matching may run. It does not score scholarships.
 */

const hasProfileValue = (value) =>
  value !== null &&
  value !== undefined &&
  String(value).trim() !== '';

const getSectionCompletion = (data = {}) => ({
  personal:
    hasProfileValue(data.dateOfBirth) &&
    hasProfileValue(data.citizenship) &&
    hasProfileValue(data.region) &&
    hasProfileValue(data.province) &&
    hasProfileValue(data.municipalityCity),
  academic:
    hasProfileValue(data.academicLevel) &&
    hasProfileValue(data.yearLevel) &&
    hasProfileValue(data.course) &&
    hasProfileValue(data.gwa) &&
    hasProfileValue(data.gwaScale),
  financial: hasProfileValue(data.incomeBracket)
});

const isProfileComplete = (data) => {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const sections = getSectionCompletion(data);
  return sections.personal && sections.academic && sections.financial;
};

/**
 * Incomplete profiles receive no matches. A complete profile is passed
 * to the existing ranker unchanged.
 */
const rankIfProfileComplete = (studentProfile, scholarships, rank) => {
  if (!isProfileComplete(studentProfile)) {
    return [];
  }

  return rank(studentProfile, scholarships);
};

module.exports = {
  hasProfileValue,
  getSectionCompletion,
  isProfileComplete,
  rankIfProfileComplete
};
