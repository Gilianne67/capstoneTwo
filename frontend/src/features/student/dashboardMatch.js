export const INCOMPLETE_PROFILE_TITLE = 'Complete your student profile';
export const INCOMPLETE_PROFILE_MESSAGE =
  'Finish your profile to receive scholarship matches based on your academic background, household income, location, and eligibility.';
export const EMPTY_MATCH_TITLE = 'No eligible scholarship match right now';

export const mapDashboardMatch = (match) => {
  const scholarship = match?.scholarship || {};

  return {
    _id: scholarship._id,
    title: scholarship.name,
    provider: scholarship.scholarshipType,
    amount: scholarship.grantValue,
    deadline: scholarship.deadline,
    description: scholarship.description || scholarship.eligibilityCriteria || 'No description provided for this grant.',
    weightedScore: match?.totalScore,
    tag: match?.classification,
    isSaved: false,
    externalUrl: scholarship.applicationURL,
    matchBreakdown: {
      gwa: {
        score: match?.gpaScore,
        max: 100,
        detail: 'GPA / GWA compatibility'
      },
      specialEligibility: {
        score: match?.tagsScore,
        max: 100,
        detail: 'Special eligibility alignment'
      },
      financial: {
        score: match?.incomeScore,
        max: 100,
        detail: 'Income compatibility'
      }
    },
    scholarship
  };
};

/**
 * A complete match response omits profileComplete. Only an explicit false
 * means the profile is unfinished. The dashboard still shows one top card.
 */
export const interpretDashboardMatches = (data) => {
  if (data && data.profileComplete === false) {
    return {
      profileIncomplete: true,
      matches: [],
      count: 0
    };
  }

  const rankedMatches = Array.isArray(data?.matches) ? data.matches : [];
  const topMatch = rankedMatches.length > 0 ? [rankedMatches[0]] : [];

  return {
    profileIncomplete: false,
    matches: topMatch.map(mapDashboardMatch),
    count: typeof data?.count === 'number' ? data.count : topMatch.length
  };
};
