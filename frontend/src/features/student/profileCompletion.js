export const hasProfileValue = (value) =>
  value !== null &&
  value !== undefined &&
  String(value).trim() !== '';

export const getSectionCompletion = (data = {}) => ({
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

export const isProfileComplete = (data) => {
  const sections = getSectionCompletion(data);
  return sections.personal && sections.academic && sections.financial;
};
