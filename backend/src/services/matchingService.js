const Scholarship = require('../models/Scholarship');

/**
 * Checks whether a student's course matches
 * one of the scholarship's eligible courses.
 */
const matchesCourse = (studentCourse, scholarshipCourses) => {
  // Empty course list means the scholarship has no course restriction.
  if (!scholarshipCourses || scholarshipCourses.length === 0) {
    return true;
  }

  if (!studentCourse) {
    return false;
  }

  const studentCourseNormalized = studentCourse.trim().toLowerCase();

  return scholarshipCourses.some(
    (course) =>
      course &&
      course.trim().toLowerCase() === studentCourseNormalized
  );
};

/**
 * Checks whether the student's location satisfies
 * the scholarship's geographic requirements.
 */
const matchesLocation = (studentProfile, geographicLocation) => {
  if (!geographicLocation) {
    return true;
  }

  const {
    regions = [],
    provinces = [],
    municipalities = [],
  } = geographicLocation;

  // No geographic restrictions = eligible.
  if (
    regions.length === 0 &&
    provinces.length === 0 &&
    municipalities.length === 0
  ) {
    return true;
  }

  const studentRegion = studentProfile.region?.trim().toLowerCase();
  const studentProvince = studentProfile.province?.trim().toLowerCase();
  const studentMunicipality =
    studentProfile.municipalityCity?.trim().toLowerCase();

  // If a scholarship specifies a region, student must match it.
  if (
    regions.length > 0 &&
    !regions.some(
      (region) =>
        region?.trim().toLowerCase() === studentRegion
    )
  ) {
    return false;
  }

  // If a scholarship specifies a province, student must match it.
  if (
    provinces.length > 0 &&
    !provinces.some(
      (province) =>
        province?.trim().toLowerCase() === studentProvince
    )
  ) {
    return false;
  }

  // If a scholarship specifies a municipality/city, student must match it.
  if (
    municipalities.length > 0 &&
    !municipalities.some(
      (municipality) =>
        municipality?.trim().toLowerCase() === studentMunicipality
    )
  ) {
    return false;
  }

  return true;
};

/**
 * Converts a student's special eligibility flags
 * into the tag names used by scholarships.
 */
const getStudentTags = (studentProfile) => {
  const flags = studentProfile.specialEligibilityFlags || {};

  const tags = [];

  if (flags.isIndigenous) tags.push('IP');
  if (flags.isPWD) tags.push('PWD');
  if (flags.isSoloParentChild) tags.push('Solo Parent Child');
  if (flags.isOrphan) tags.push('Orphan');
  if (flags.isFarmerFisherfolkChild) tags.push('Farmer/Fisherfolk Child');
  if (flags.isDisasterAffected) tags.push('Disaster Affected');
  if (flags.isWorkingStudent) tags.push('Working Student');
  if (flags.is4PsBeneficiary) tags.push('4Ps');

  return tags;
};

/**
 * Checks Exclusive special eligibility tags.
 *
 * Exclusive = mandatory.
 * If the student does not have the required tag,
 * the scholarship is excluded.
 */
const matchesExclusiveTags = (studentProfile, specialTags) => {
  if (!specialTags || specialTags.length === 0) {
    return true;
  }

  const studentTags = getStudentTags(studentProfile).map((tag) =>
    tag.toLowerCase()
  );

  const exclusiveTags = specialTags.filter(
    (tag) => tag.mode === 'Exclusive'
  );

  return exclusiveTags.every((requiredTag) =>
    studentTags.includes(requiredTag.tagName.trim().toLowerCase())
  );
};

/**
 * Applies all hard eligibility filters to one scholarship.
 */
const passesHardFilters = (studentProfile, scholarship) => {
  // 1. Academic Level
  if (
    scholarship.hardFilters?.academicLevel &&
    scholarship.hardFilters.academicLevel.trim().toLowerCase() !==
      studentProfile.academicLevel.trim().toLowerCase()
  ) {
    return false;
  }

  // 2. Course / Program
  if (
    !matchesCourse(
      studentProfile.course,
      scholarship.hardFilters?.courseProgram
    )
  ) {
    return false;
  }

  // 3. Citizenship
  if (
    scholarship.hardFilters?.citizenshipStatus &&
    scholarship.hardFilters.citizenshipStatus.trim().toLowerCase() !==
      studentProfile.citizenship.trim().toLowerCase()
  ) {
    return false;
  }

  // 4. Geographic Location
  if (
    !matchesLocation(
      studentProfile,
      scholarship.hardFilters?.geographicLocation
    )
  ) {
    return false;
  }

  // 5. Exclusive Special Eligibility Tags
  if (
    !matchesExclusiveTags(
      studentProfile,
      scholarship.specialTags
    )
  ) {
    return false;
  }

  return true;
};

/**
 * Gets scholarships that pass all hard eligibility filters.
 */
const getEligibleScholarships = async (studentProfile) => {
  const scholarships = await Scholarship.find({
    status: 'Open',
    isArchived: false,
  }).lean();

  return scholarships.filter((scholarship) =>
    passesHardFilters(studentProfile, scholarship)
  );
};

module.exports = {
  getEligibleScholarships,
  passesHardFilters,
  matchesCourse,
  matchesLocation,
  matchesExclusiveTags,
  getStudentTags,
};