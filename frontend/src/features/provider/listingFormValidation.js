import {
  MUNICIPALITIES,
  PROVINCES,
  REGIONS
} from '../../data/locationData.js';

export const SCHOLARSHIP_CATEGORIES = [
  'Merit-Based',
  'Need-Based',
  'STEM',
  'Agricultural',
  'Municipal / Local'
];

export const ACADEMIC_LEVELS = [
  'Senior High School',
  'College',
  'Graduate Studies'
];

export const CITIZENSHIP_OPTIONS = ['Filipino', 'Any'];

export const GEOGRAPHIC_SCOPES = [
  'Nationwide',
  'Region',
  'Province',
  'Municipality'
];

export const SYSTEM_DEMOGRAPHIC_TAGS = [
  '4Ps Beneficiary',
  'Indigenous Peoples (IP)',
  'Person with Disability (PWD)',
  'Solo Parent Dependent',
  'Orphan Status',
  'Child of Farmer / Fisherfolk',
  'Disaster-Affected Family',
  'Working Student'
];

export const isStandardDemographicTag = (tagName) =>
  SYSTEM_DEMOGRAPHIC_TAGS.includes(tagName);

const REQUIRED_DEADLINE = 'Application deadline is required.';
export const PAST_DEADLINE_MESSAGE = 'Deadline must be today or a future date.';
const INVALID_DEADLINE = 'Enter a valid deadline date.';

export function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function manilaDateInputValue(deadline) {
  if (!deadline) return '';

  if (typeof deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(deadline.trim())) {
    return deadline.trim();
  }

  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) return '';

  const manila = new Date(parsed.getTime() + (8 * 60 * 60 * 1000));
  const year = manila.getUTCFullYear();
  const month = String(manila.getUTCMonth() + 1).padStart(2, '0');
  const day = String(manila.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const isRealCalendarDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
};

export function deadlineError(value, today = localDateInputValue()) {
  const trimmed = String(value ?? '').trim();

  if (!trimmed) return REQUIRED_DEADLINE;
  if (!isRealCalendarDate(trimmed)) return INVALID_DEADLINE;
  if (trimmed < today) return PAST_DEADLINE_MESSAGE;

  return '';
}

export function liveDeadlineError(value, today = localDateInputValue()) {
  const message = deadlineError(value, today);
  return message === REQUIRED_DEADLINE ? '' : message;
}

export function applicationUrlError(value) {
  const trimmed = String(value ?? '').trim();

  if (!trimmed) return 'Application URL is required.';

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return 'Enter a valid HTTP or HTTPS application URL.';
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'Enter a valid HTTP or HTTPS application URL.';
  }

  if (!parsed.hostname) {
    return 'Enter a valid HTTP or HTTPS application URL.';
  }

  return '';
}

const strictNumber = (value) => {
  const trimmed = String(value ?? '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return Number.NaN;
  return Number(trimmed);
};

const cleanList = (items) =>
  (Array.isArray(items) ? items : [])
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);

export function validateListingForm(values, today = localDateInputValue()) {
  const errors = {};
  const title = String(values.title ?? '');
  const grantValue = String(values.grantValue ?? '');
  const description = String(values.description ?? '');

  if (!title.trim()) {
    errors.title = 'Scholarship name is required.';
  }

  if (!grantValue.trim()) {
    errors.grantValue = 'Grant value is required.';
  }

  if (!SCHOLARSHIP_CATEGORIES.includes(values.category)) {
    errors.category = 'Select a scholarship category.';
  }

  const deadlineMessage = deadlineError(values.deadline, today);
  if (deadlineMessage) errors.deadline = deadlineMessage;

  const urlMessage = applicationUrlError(values.portalUrl);
  if (urlMessage) errors.portalUrl = urlMessage;

  if (!description.trim()) {
    errors.description = 'Program description is required.';
  }

  const benefits = Array.isArray(values.benefits) ? values.benefits : [];
  if (benefits.some((benefit) => typeof benefit !== 'string' || !benefit.trim())) {
    errors.benefits = 'Benefit entries cannot be empty.';
  }

  if (!String(values.academicLevel ?? '').trim()) {
    errors.academicLevel = 'Academic level is required.';
  } else if (!ACADEMIC_LEVELS.includes(values.academicLevel)) {
    errors.academicLevel = 'Select a supported academic level.';
  }

  if (!String(values.citizenship ?? '').trim()) {
    errors.citizenship = 'Citizenship requirement is required.';
  } else if (!CITIZENSHIP_OPTIONS.includes(values.citizenship)) {
    errors.citizenship = 'Select a supported citizenship requirement.';
  }

  if (!values.enableScale105 && !values.enableScale60100) {
    errors.gradingScale = 'Select at least one grading scale.';
  }

  if (values.enableScale105) {
    const gwaText = String(values.maxGwa105 ?? '').trim();
    const gwaValue = strictNumber(gwaText);

    if (!gwaText || Number.isNaN(gwaValue)) {
      errors.maxGwa105 = 'Maximum Allowable GWA is required for the 1.00-5.00 scale.';
    } else if (gwaValue < 1 || gwaValue > 5) {
      errors.maxGwa105 = 'Maximum Allowable GWA must be between 1.00 and 5.00.';
    }
  }

  if (values.enableScale60100) {
    const gpaText = String(values.minGpa60100 ?? '').trim();
    const gpaValue = strictNumber(gpaText);

    if (!gpaText || Number.isNaN(gpaValue)) {
      errors.minGpa60100 = 'Minimum Required GPA is required for the 60-100 scale.';
    } else if (gpaValue < 60 || gpaValue > 100) {
      errors.minGpa60100 = 'Minimum Required GPA must be between 60 and 100.';
    }
  }

  const incomeText = String(values.maxIncome ?? '').trim();
  if (incomeText) {
    const incomeValue = strictNumber(incomeText);

    if (Number.isNaN(incomeValue)) {
      errors.maxIncome = 'Maximum Household Monthly Income must be a valid number.';
    } else if (incomeValue < 0) {
      errors.maxIncome = 'Maximum Household Monthly Income cannot be negative.';
    }
  }

  const courses = Array.isArray(values.allowedCourses) ? values.allowedCourses : [];
  if (courses.some((course) => typeof course !== 'string' || !course.trim())) {
    errors.allowedCourses = 'Course names cannot be empty.';
  }

  if (!GEOGRAPHIC_SCOPES.includes(values.geographicScope)) {
    errors.geographicScope = 'Select a geographic scope.';
  } else if (values.geographicScope !== 'Nationwide') {
    if (!values.selectedRegion) {
      errors.selectedRegion = 'Region is required for this geographic scope.';
    } else if (!REGIONS.includes(values.selectedRegion)) {
      errors.selectedRegion = 'Select a region from the list.';
    }

    const needsProvince =
      values.geographicScope === 'Province' ||
      values.geographicScope === 'Municipality';

    if (needsProvince && values.selectedRegion && REGIONS.includes(values.selectedRegion)) {
      const provinces = PROVINCES[values.selectedRegion] || [];

      if (!values.selectedProvince) {
        errors.selectedProvince = 'Province is required for this geographic scope.';
      } else if (!provinces.includes(values.selectedProvince)) {
        errors.selectedProvince = 'Select a province from the list.';
      }
    }

    if (
      values.geographicScope === 'Municipality' &&
      values.selectedProvince &&
      !errors.selectedProvince
    ) {
      const municipalities = MUNICIPALITIES[values.selectedProvince] || [];

      if (!values.selectedMunicipality) {
        errors.selectedMunicipality = 'Municipality or city is required for this geographic scope.';
      } else if (!municipalities.includes(values.selectedMunicipality)) {
        errors.selectedMunicipality = 'Select a municipality or city from the list.';
      }
    }
  }

  const requiredTags = Array.isArray(values.requiredTags) ? values.requiredTags : [];
  const preferredTags = Array.isArray(values.preferredTags) ? values.preferredTags : [];
  const selectedTags = [...requiredTags, ...preferredTags];

  if (
    selectedTags.some((tag) => typeof tag !== 'string' || !tag.trim() || !isStandardDemographicTag(tag))
  ) {
    errors.tags = 'Select eligibility tags from the standard list.';
  } else if (requiredTags.some((tag) => preferredTags.includes(tag))) {
    errors.tags = 'A tag cannot be both required and preferred.';
  }

  const weights = values.weights || {};
  const gpa = Number(weights.gpaWeight);
  const income = Number(weights.incomeWeight);
  const tags = Number(weights.tagsWeight);

  if (![gpa, income, tags].every((weight) => Number.isFinite(weight))) {
    errors.weights = 'Ranking weights must be valid numbers.';
  } else if (gpa < 0 || income < 0 || tags < 0) {
    errors.weights = 'Ranking weights cannot be negative.';
  } else if (gpa < 20 || gpa > 70) {
    errors.weights = 'GPA / GWA Weight must be between 20% and 70%.';
  } else if (income < 20 || income > 70) {
    errors.weights = 'Household Income Weight must be between 20% and 70%.';
  } else if (tags < 0 || tags > 30) {
    errors.weights = 'Special Eligibility Tags Weight must be between 0% and 30%.';
  } else if (gpa + income + tags !== 100) {
    errors.weights = `Total ranking weights must equal exactly 100%. Current total: ${gpa + income + tags}%.`;
  }

  return errors;
}

export function sanitizedListingText(values) {
  return {
    name: String(values.title ?? '').trim(),
    grantValue: String(values.grantValue ?? '').trim(),
    description: String(values.description ?? '').trim(),
    applicationURL: String(values.portalUrl ?? '').trim(),
    benefits: cleanList(values.benefits),
    courses: cleanList(values.allowedCourses)
  };
}
