/**
 * Admin analytics periods use Asia/Manila calendar dates.
 * Bounds are half-open: start is included and end is excluded.
 * Manila has no daylight-saving time, so UTC+8 is the whole calendar.
 */

const TIME_ZONE = 'Asia/Manila';
const OFFSET_MS = 8 * 60 * 60 * 1000;
const MAX_INCLUSIVE_DAYS = 366;
const DAY_GROUPING_LIMIT = 92;
const PRESET_DAYS = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const fail = (message) => ({ ok: false, message });

const pad = (value) => String(value).padStart(2, '0');

const manilaParts = (date) => {
  const shifted = new Date(date.getTime() + OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
};

const dateKey = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;

const monthKey = (year, month) => `${year}-${pad(month)}`;

const manilaStartUtc = (year, month, day) =>
  new Date(Date.UTC(year, month - 1, day) - OFFSET_MS);

const addDays = (year, month, day, delta) => {
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + delta);
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
};

const compareDates = (left, right) => {
  if (left.year !== right.year) return left.year - right.year;
  if (left.month !== right.month) return left.month - right.month;
  return left.day - right.day;
};

const inclusiveDays = (from, to) => {
  const start = Date.UTC(from.year, from.month - 1, from.day);
  const end = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1;
};

const parseDay = (value) => {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
};

const dayLabel = (year, month, day) => `${SHORT_MONTHS[month - 1]} ${day}, ${year}`;

const monthLabel = (year, month) => `${MONTH_NAMES[month - 1]} ${year}`;

const buildBuckets = (from, to) => {
  const span = inclusiveDays(from, to);
  const grouping = span <= DAY_GROUPING_LIMIT ? 'day' : 'month';
  const buckets = [];

  if (grouping === 'day') {
    for (let offset = 0; offset < span; offset += 1) {
      const parts = addDays(from.year, from.month, from.day, offset);
      buckets.push({
        key: dateKey(parts.year, parts.month, parts.day),
        label: dayLabel(parts.year, parts.month, parts.day),
      });
    }
  } else {
    let cursor = { year: from.year, month: from.month, day: 1 };
    const endMonth = { year: to.year, month: to.month, day: 1 };
    while (compareDates(cursor, endMonth) <= 0) {
      buckets.push({
        key: monthKey(cursor.year, cursor.month),
        label: monthLabel(cursor.year, cursor.month),
      });
      const nextMonth = cursor.month === 12 ? 1 : cursor.month + 1;
      const nextYear = cursor.month === 12 ? cursor.year + 1 : cursor.year;
      cursor = { year: nextYear, month: nextMonth, day: 1 };
    }
  }

  return { grouping, buckets };
};

const buildPeriod = ({ range, from, to }) => {
  const span = inclusiveDays(from, to);
  if (span > MAX_INCLUSIVE_DAYS) {
    return fail('Date range cannot exceed 366 days.');
  }

  const endParts = addDays(to.year, to.month, to.day, 1);
  const { grouping, buckets } = buildBuckets(from, to);

  return {
    ok: true,
    period: {
      range: range || null,
      from: dateKey(from.year, from.month, from.day),
      to: dateKey(to.year, to.month, to.day),
      start: manilaStartUtc(from.year, from.month, from.day),
      end: manilaStartUtc(endParts.year, endParts.month, endParts.day),
      timeZone: TIME_ZONE,
      grouping,
      bucketFormat: grouping === 'day' ? '%Y-%m-%d' : '%Y-%m',
      buckets,
    },
  };
};

const resolveAnalyticsPeriod = (query = {}, now = new Date()) => {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    return fail('A valid current date is required to resolve the range.');
  }

  const range = query.range;
  const from = query.from;
  const to = query.to;
  if (Array.isArray(range) || Array.isArray(from) || Array.isArray(to)) {
    return fail('Invalid date range.');
  }

  const hasRange = range !== undefined && range !== '';
  const hasFrom = from !== undefined && from !== '';
  const hasTo = to !== undefined && to !== '';

  if (!hasRange && !hasFrom && !hasTo) {
    const current = manilaParts(now);
    const start = addDays(current.year, current.month, current.day, -(PRESET_DAYS['30d'] - 1));
    return buildPeriod({ range: '30d', from: start, to: current });
  }

  if (hasRange && (hasFrom || hasTo)) {
    return fail('Use either range or from and to, not both.');
  }

  const current = manilaParts(now);

  if (hasRange) {
    if (typeof range !== 'string' || !Object.prototype.hasOwnProperty.call(PRESET_DAYS, range)) {
      return fail('range must be one of 7d, 30d, or 90d.');
    }
    const start = addDays(current.year, current.month, current.day, -(PRESET_DAYS[range] - 1));
    return buildPeriod({ range, from: start, to: current });
  }

  if (hasFrom !== hasTo) {
    return fail('Both from and to are required.');
  }

  const fromParts = parseDay(from);
  const toParts = parseDay(to);
  if (!fromParts || !toParts) {
    return fail('from and to must use YYYY-MM-DD.');
  }
  if (compareDates(fromParts, toParts) > 0) {
    return fail('from must be the same day as to, or earlier.');
  }
  if (compareDates(toParts, current) > 0) {
    return fail('Date range cannot extend beyond today in Asia/Manila.');
  }

  return buildPeriod({ range: null, from: fromParts, to: toParts });
};

const formatInManila = (date, format) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const parts = manilaParts(date);
  if (format === '%Y-%m-%d') return dateKey(parts.year, parts.month, parts.day);
  if (format === '%Y-%m') return monthKey(parts.year, parts.month);
  return null;
};

const addManilaDays = (date, days) => {
  const parts = manilaParts(date);
  const shifted = addDays(parts.year, parts.month, parts.day, days);
  return manilaStartUtc(shifted.year, shifted.month, shifted.day);
};

module.exports = {
  TIME_ZONE,
  MAX_INCLUSIVE_DAYS,
  resolveAnalyticsPeriod,
  formatInManila,
  manilaParts,
  manilaStartUtc,
  addManilaDays,
};
