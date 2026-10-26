const {
  MUNICIPALITIES,
  PROVINCES,
  REGIONS
} = require('../data/locationCatalog');

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const GEOGRAPHIC_SCOPES = ['Nationwide', 'Region', 'Province', 'Municipality'];

const PAST_DEADLINE_MESSAGE = 'Deadline must be today or a future date.';
const INVALID_DEADLINE_MESSAGE = 'Enter a valid deadline date.';
const REQUIRED_DEADLINE_MESSAGE = 'Application deadline is required.';
const REQUIRED_URL_MESSAGE = 'Application URL is required.';
const INVALID_URL_MESSAGE = 'Enter a valid HTTP or HTTPS application URL.';

const pad = (value) => String(value).padStart(2, '0');

const calendarDateFromParts = (year, month, day) =>
  `${year}-${pad(month)}-${pad(day)}`;

const isRealCalendarDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

const manilaCalendarDate = (value = new Date()) => {
  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const manila = new Date(parsed.getTime() + MANILA_OFFSET_MS);
  return calendarDateFromParts(
    manila.getUTCFullYear(),
    manila.getUTCMonth() + 1,
    manila.getUTCDate()
  );
};

const deadlineCalendarDate = (value) => {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
  }

  return manilaCalendarDate(value);
};

const asStringList = (value) => {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  const items = Array.isArray(value) ? value : [value];

  return items.map((item) => String(item ?? '').trim()).filter(Boolean);
};

const deadlineError = (value, now = new Date()) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return REQUIRED_DEADLINE_MESSAGE;
  }

  const calendarDate = deadlineCalendarDate(value);

  if (!calendarDate || !isRealCalendarDate(calendarDate)) {
    return INVALID_DEADLINE_MESSAGE;
  }

  if (calendarDate < manilaCalendarDate(now)) {
    return PAST_DEADLINE_MESSAGE;
  }

  return '';
};

const applicationUrlError = (value) => {
  const trimmed = String(value ?? '').trim();

  if (!trimmed) {
    return REQUIRED_URL_MESSAGE;
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return INVALID_URL_MESSAGE;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return INVALID_URL_MESSAGE;
  }

  if (!parsed.hostname) {
    return INVALID_URL_MESSAGE;
  }

  return '';
};

const locationError = (geographicLocation) => {
  if (!geographicLocation || typeof geographicLocation !== 'object') {
    return '';
  }

  const scope = String(geographicLocation.scope || 'Nationwide').trim();

  if (!GEOGRAPHIC_SCOPES.includes(scope)) {
    return 'Select a geographic scope.';
  }

  const regions = asStringList(geographicLocation.regions);
  const provinces = asStringList(geographicLocation.provinces);
  const municipalities = asStringList(geographicLocation.municipalities);

  const unknownRegion = regions.find((region) => !REGIONS.includes(region));
  if (unknownRegion) {
    return 'Select a region from the list.';
  }

  if (scope === 'Nationwide') {
    return '';
  }

  if (regions.length === 0) {
    return 'Region is required for this geographic scope.';
  }

  const allowedProvinces = regions.flatMap((region) => PROVINCES[region] || []);
  const unknownProvince = provinces.find(
    (province) => !allowedProvinces.includes(province)
  );
  if (unknownProvince) {
    return 'Select a province from the list.';
  }

  if (scope === 'Region') {
    return '';
  }

  if (provinces.length === 0) {
    return 'Province is required for this geographic scope.';
  }

  if (scope === 'Province') {
    return '';
  }

  const allowedMunicipalities = provinces.flatMap(
    (province) => MUNICIPALITIES[province] || []
  );
  const unknownMunicipality = municipalities.find(
    (municipality) => !allowedMunicipalities.includes(municipality)
  );
  if (unknownMunicipality) {
    return 'Select a municipality or city from the list.';
  }

  if (municipalities.length === 0) {
    return 'Municipality or city is required for this geographic scope.';
  }

  return '';
};

const firstError = (...messages) => messages.find(Boolean) || '';

const validateScholarshipInput = (input = {}, options = {}) => {
  const required = options.required !== false;
  const now = options.now || new Date();
  const errors = {};

  if (required || input.deadline !== undefined) {
    const message = deadlineError(input.deadline, now);
    if (message) errors.deadline = message;
  }

  if (required || input.applicationURL !== undefined) {
    const message = applicationUrlError(input.applicationURL);
    if (message) errors.applicationURL = message;
  }

  const geographicLocation =
    input.geographicLocation ||
    input.hardFilters?.geographicLocation;

  if (geographicLocation) {
    const message = locationError(geographicLocation);
    if (message) errors.geographicLocation = message;
  }

  const message = firstError(
    errors.deadline,
    errors.applicationURL,
    errors.geographicLocation
  );

  return {
    valid: !message,
    message,
    errors
  };
};

module.exports = {
  PAST_DEADLINE_MESSAGE,
  INVALID_DEADLINE_MESSAGE,
  REQUIRED_DEADLINE_MESSAGE,
  REQUIRED_URL_MESSAGE,
  INVALID_URL_MESSAGE,
  manilaCalendarDate,
  deadlineCalendarDate,
  deadlineError,
  applicationUrlError,
  locationError,
  validateScholarshipInput
};
