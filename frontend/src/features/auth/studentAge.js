export const UNDERAGE_STUDENT_MESSAGE =
  'ISKOLARMATCH is currently available only to students aged 18 and above.';

const DOB_REQUIRED_MESSAGE = 'Date of birth is required.';
const DOB_INVALID_MESSAGE = 'Date of birth is invalid.';
const DOB_FUTURE_MESSAGE = 'Date of birth cannot be in the future.';
const MINIMUM_STUDENT_AGE = 18;

function calendarParts(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function evaluateDateOfBirth(value, now = new Date()) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return { ok: false, code: 'required', message: DOB_REQUIRED_MESSAGE };
  }

  const parts = calendarParts(value);
  if (!parts) {
    return { ok: false, code: 'invalid', message: DOB_INVALID_MESSAGE };
  }

  const today = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };

  const isFuture = parts.year > today.year
    || (parts.year === today.year && parts.month > today.month)
    || (parts.year === today.year && parts.month === today.month && parts.day > today.day);

  if (isFuture) {
    return { ok: false, code: 'future', message: DOB_FUTURE_MESSAGE };
  }

  let age = today.year - parts.year;
  if (today.month < parts.month || (today.month === parts.month && today.day < parts.day)) {
    age -= 1;
  }

  if (age < MINIMUM_STUDENT_AGE) {
    return { ok: false, code: 'underage', age, message: UNDERAGE_STUDENT_MESSAGE };
  }

  return { ok: true, code: 'adult', age, message: '' };
}

export function todayInputValue(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
