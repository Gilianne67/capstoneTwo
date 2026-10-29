const DEGREE_TO_LEVEL = {
  Undergraduate: 'College',
  College: 'College',
  'Senior High School': 'Senior High School',
  Postgraduate: 'Graduate Studies',
  'Graduate Studies': 'Graduate Studies',
};

const FLAG_TO_TAG = {
  isIP: 'Indigenous Peoples (IP)',
  isPWD: 'Person with Disability (PWD)',
  isSoloParentDependent: 'Solo Parent Dependent',
  isOrphan: 'Orphan Status',
  isFarmerFisherfolkChild: 'Child of Farmer / Fisherfolk',
  isDisasterAffected: 'Disaster-Affected Family',
  isWorkingStudent: 'Working Student',
  is4PsBeneficiary: '4Ps Beneficiary',
};

export function buildFilterDemandPayload({
  selectedRegion = 'All',
  selectedDegree = 'All',
  selectedFlags = [],
} = {}) {
  const payload = {};
  const academicLevel = DEGREE_TO_LEVEL[selectedDegree];
  if (academicLevel) payload.academicLevel = academicLevel;
  if (selectedRegion && selectedRegion !== 'All') payload.region = selectedRegion;
  const eligibilityTags = [...new Set(
    (Array.isArray(selectedFlags) ? selectedFlags : [])
      .map((flag) => FLAG_TO_TAG[flag])
      .filter(Boolean)
  )];
  if (eligibilityTags.length > 0) payload.eligibilityTags = eligibilityTags;
  if (!payload.academicLevel && !payload.region && !payload.eligibilityTags) return null;
  return payload;
}

export async function postFilterDemand(apiBaseUrl, token, payload) {
  if (!payload || !token) return { ok: false };
  try {
    const response = await fetch(`${apiBaseUrl}/students/analytics/filter-demand`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    return { ok: response.ok };
  } catch {
    return { ok: false };
  }
}
