const { REGIONS } = require('../data/regions');

const ACADEMIC_LEVELS = ['Senior High School', 'College', 'Graduate Studies'];
const ELIGIBILITY_TAGS = [
  '4Ps Beneficiary',
  'Indigenous Peoples (IP)',
  'Person with Disability (PWD)',
  'Solo Parent Dependent',
  'Orphan Status',
  'Child of Farmer / Fisherfolk',
  'Disaster-Affected Family',
  'Working Student',
];

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

const DEGREE_TO_LEVEL = {
  Undergraduate: 'College',
  College: 'College',
  'Senior High School': 'Senior High School',
  Postgraduate: 'Graduate Studies',
  'Graduate Studies': 'Graduate Studies',
};

const ALLOWED_FIELDS = new Set(['academicLevel', 'region', 'eligibilityTags']);
const DEDUPE_MS = 10 * 60 * 1000;

const fail = (message) => ({ ok: false, message });

const normalizeAcademicLevel = (value) => {
  if (value === undefined || value === null || value === '' || value === 'All') return null;
  if (typeof value !== 'string') return fail('Academic level filter is not valid.');
  const canonical = DEGREE_TO_LEVEL[value.trim()];
  if (!canonical || !ACADEMIC_LEVELS.includes(canonical)) {
    return fail('Academic level filter is not valid.');
  }
  return canonical;
};

const normalizeRegion = (value) => {
  if (value === undefined || value === null || value === '' || value === 'All') return null;
  if (typeof value !== 'string' || !REGIONS.includes(value.trim())) {
    return fail('Region filter is not valid.');
  }
  return value.trim();
};

const normalizeTag = (value) => {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (FLAG_TO_TAG[text]) return FLAG_TO_TAG[text];
  if (ELIGIBILITY_TAGS.includes(text)) return text;
  return null;
};

const normalizeDemandInput = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Filter demand must be an object.');
  }

  const unknown = Object.keys(body).filter((key) => !ALLOWED_FIELDS.has(key));
  if (unknown.length > 0) {
    return fail('Only academic level, region, and eligibility tags can be recorded. Search text is not stored.');
  }

  const academicLevel = normalizeAcademicLevel(body.academicLevel);
  if (academicLevel && typeof academicLevel === 'object') return academicLevel;
  const region = normalizeRegion(body.region);
  if (region && typeof region === 'object') return region;

  let tags = [];
  if (body.eligibilityTags !== undefined) {
    if (!Array.isArray(body.eligibilityTags) || body.eligibilityTags.length > ELIGIBILITY_TAGS.length) {
      return fail('Eligibility tags are not valid.');
    }
    tags = [...new Set(body.eligibilityTags.map(normalizeTag))];
    if (tags.some((tag) => !tag)) return fail('Eligibility tags are not valid.');
  }

  const events = [];
  if (academicLevel) events.push({ dimension: 'academicLevel', value: academicLevel });
  if (region) events.push({ dimension: 'region', value: region });
  tags.forEach((tag) => events.push({ dimension: 'eligibilityTag', value: tag }));

  return { ok: true, events };
};

const createDemandRecorder = ({ insertMany, now = () => new Date(), dedupeMs = DEDUPE_MS } = {}) => {
  const recent = new Map();

  return async ({ userId, body }) => {
    const normalized = normalizeDemandInput(body);
    if (!normalized.ok) return normalized;

    const timestamp = now().getTime();
    for (const [key, seenAt] of recent) {
      if (timestamp - seenAt >= dedupeMs) recent.delete(key);
    }

    const fresh = [];
    let skippedDuplicates = 0;
    normalized.events.forEach((event) => {
      const key = `${userId || 'anonymous'}|${event.dimension}|${event.value}`;
      const seenAt = recent.get(key);
      if (seenAt !== undefined && timestamp - seenAt < dedupeMs) {
        skippedDuplicates += 1;
        return;
      }
      recent.set(key, timestamp);
      fresh.push({ dimension: event.dimension, value: event.value });
    });

    if (fresh.length > 0 && typeof insertMany === 'function') {
      await insertMany(fresh);
    }

    return {
      ok: true,
      recorded: fresh.length,
      skippedDuplicates,
    };
  };
};

module.exports = {
  ACADEMIC_LEVELS,
  ELIGIBILITY_TAGS,
  DEDUPE_MS,
  normalizeDemandInput,
  normalizeAcademicLevel,
  normalizeRegion,
  createDemandRecorder,
};
