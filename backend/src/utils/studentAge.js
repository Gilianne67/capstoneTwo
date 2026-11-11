const mongoose = require('mongoose');
const StudentProfile = require('../models/StudentProfile');

const MINIMUM_STUDENT_AGE = 18;

const UNDERAGE_STUDENT_MESSAGE =
  'ISKOLARMATCH is currently available only to students aged 18 and above.';
const DOB_REQUIRED_MESSAGE = 'Date of birth is required.';
const DOB_INVALID_MESSAGE = 'Date of birth is invalid.';
const DOB_FUTURE_MESSAGE = 'Date of birth cannot be in the future.';
const MISSING_DOB_ACCESS_MESSAGE =
  'This account cannot access the platform until a valid date of birth is provided and verified.';
const DOB_CONFLICT_MESSAGE =
  'This account has conflicting dates of birth and cannot access the platform until a valid date of birth is verified.';

const resolvedDobSymbol = Symbol.for('iskolar.resolvedStudentDob');
const ageDecisionSymbol = Symbol.for('iskolar.studentAgeDecision');

const realProfileFindOne = StudentProfile.findOne;

const calendarParts = (value) => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const year = value.getUTCFullYear();
    const month = value.getUTCMonth() + 1;
    const day = value.getUTCDate();
    return {
      year,
      month,
      day,
      date: new Date(Date.UTC(year, month - 1, day)),
    };
  }

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

  return { year, month, day, date };
};

const evaluateDateOfBirth = (value, now = new Date()) => {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
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

  return { ok: true, code: 'adult', age, date: parts.date, message: '' };
};

const hasBirthValue = (value) => (
  value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '')
);

const calendarKey = (value) => {
  const parts = calendarParts(value);
  if (!parts) return null;
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${parts.year}-${month}-${day}`;
};

const birthDatesConflict = (left, right) => {
  if (!hasBirthValue(left) || !hasBirthValue(right)) return false;
  const leftKey = calendarKey(left);
  const rightKey = calendarKey(right);
  if (leftKey && rightKey) return leftKey !== rightKey;
  if (leftKey || rightKey) return true;
  return String(left) !== String(right);
};

const ageDenial = (code, message, underage = false) => ({
  statusCode: 403,
  code,
  message,
  underage,
});

const denialForResult = (result) => {
  if (result.code === 'underage') {
    return ageDenial('UNDERAGE_STUDENT', result.message, true);
  }
  if (result.code === 'future') return ageDenial('DOB_FUTURE', result.message);
  if (result.code === 'invalid') return ageDenial('DOB_INVALID', result.message);
  return ageDenial('DOB_UNVERIFIED', MISSING_DOB_ACCESS_MESSAGE);
};

const storedBirthDate = (user) => {
  if (hasBirthValue(user.dob)) return user.dob;
  if (hasBirthValue(user.dateOfBirth)) return user.dateOfBirth;
  if (hasBirthValue(user[resolvedDobSymbol])) return user[resolvedDobSymbol];
  return null;
};

const studentAgeDenial = (user) => {
  if (!user || String(user.role || '').toLowerCase() !== 'student') return null;
  if (ageDecisionSymbol in user) return user[ageDecisionSymbol];

  const raw = storedBirthDate(user);
  if (!hasBirthValue(raw)) {
    return ageDenial('DOB_UNVERIFIED', MISSING_DOB_ACCESS_MESSAGE);
  }

  const result = evaluateDateOfBirth(raw);
  if (!result.ok) return denialForResult(result);
  return null;
};

const loadProfileDateOfBirth = async (userId) => {
  if (!userId || typeof StudentProfile.findOne !== 'function') return null;

  const finder = StudentProfile.findOne;
  if (finder === realProfileFindOne && mongoose.connection.readyState !== 1) {
    return null;
  }

  const query = finder.call(StudentProfile, { userId });
  if (!query) return null;
  const profile = typeof query.select === 'function'
    ? await query.select('dateOfBirth')
    : await query;
  return profile ? profile.dateOfBirth : null;
};

const enforceStudentAge = async (user) => {
  if (!user || String(user.role || '').toLowerCase() !== 'student') return null;

  delete user[ageDecisionSymbol];
  delete user[resolvedDobSymbol];

  const userDob = hasBirthValue(user.dob)
    ? user.dob
    : hasBirthValue(user.dateOfBirth)
      ? user.dateOfBirth
      : null;
  const profileDob = await loadProfileDateOfBirth(user._id || user.id);

  if (hasBirthValue(userDob) && hasBirthValue(profileDob) && birthDatesConflict(userDob, profileDob)) {
    const conflict = ageDenial('DOB_CONFLICT', DOB_CONFLICT_MESSAGE);
    user[ageDecisionSymbol] = conflict;
    return conflict;
  }

  if (!hasBirthValue(userDob) && hasBirthValue(profileDob)) {
    user[resolvedDobSymbol] = profileDob;
  }

  const denial = studentAgeDenial(user);
  user[ageDecisionSymbol] = denial;
  return denial;
};

module.exports = {
  MINIMUM_STUDENT_AGE,
  UNDERAGE_STUDENT_MESSAGE,
  DOB_REQUIRED_MESSAGE,
  DOB_INVALID_MESSAGE,
  DOB_FUTURE_MESSAGE,
  MISSING_DOB_ACCESS_MESSAGE,
  DOB_CONFLICT_MESSAGE,
  evaluateDateOfBirth,
  studentAgeDenial,
  enforceStudentAge,
};
