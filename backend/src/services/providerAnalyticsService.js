/**
 * Provider analytics from Scholarship and SavedMatch records.
 *
 * Archived listings are included in total created, saves, the creation
 * trend, the performance table, and the most-saved result. Open count
 * includes only scholarships whose status is Open and whose isArchived
 * flag is not true.
 *
 * Month bounds use Asia/Manila calendar months, half-open [start, end).
 * Student saves are all-time counts. They are not applications, views,
 * or clicks, and they are not filtered by the selected period.
 */

const TIME_ZONE = 'Asia/Manila';
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const MAX_RANGE_MONTHS = 24;
const TOP_SCHOLARSHIP_LIMIT = 5;
const PRESET_MONTHS = {
  '3m': 3,
  '6m': 6,
  '12m': 12,
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

const fail = (message) => ({ ok: false, message });

const monthKey = (year, month) =>
  `${year}-${String(month).padStart(2, '0')}`;

const monthLabel = (year, month) => `${MONTH_NAMES[month - 1]} ${year}`;

const manilaParts = (date) => {
  const shifted = new Date(date.getTime() + MANILA_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
  };
};

const addMonths = (year, month, delta) => {
  const index = year * 12 + (month - 1) + delta;
  return {
    year: Math.floor(index / 12),
    month: (index % 12) + 1,
  };
};

const compareMonths = (left, right) => {
  if (left.year !== right.year) {
    return left.year - right.year;
  }
  return left.month - right.month;
};

const monthSpan = (from, to) =>
  (to.year - from.year) * 12 + (to.month - from.month) + 1;

const manilaMonthStartUtc = (year, month) =>
  new Date(Date.UTC(year, month - 1, 1) - MANILA_OFFSET_MS);

const parseMonth = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value.trim());
  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
  };
};

const buildPeriod = ({ range, from, to }) => {
  const span = monthSpan(from, to);
  if (span > MAX_RANGE_MONTHS) {
    return fail('Date range cannot exceed 24 months.');
  }

  const months = [];
  for (let offset = 0; offset < span; offset += 1) {
    const parts = addMonths(from.year, from.month, offset);
    months.push({
      year: parts.year,
      month: parts.month,
      key: monthKey(parts.year, parts.month),
      label: monthLabel(parts.year, parts.month),
    });
  }

  const endParts = addMonths(to.year, to.month, 1);

  return {
    ok: true,
    period: {
      range: range || null,
      from: monthKey(from.year, from.month),
      to: monthKey(to.year, to.month),
      start: manilaMonthStartUtc(from.year, from.month),
      end: manilaMonthStartUtc(endParts.year, endParts.month),
      timeZone: TIME_ZONE,
      months,
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
  const hasRange = range !== undefined;
  const hasFrom = from !== undefined;
  const hasTo = to !== undefined;

  if (Array.isArray(range) || Array.isArray(from) || Array.isArray(to)) {
    return fail('Invalid date range.');
  }

  if (!hasRange && !hasFrom && !hasTo) {
    const current = manilaParts(now);
    const start = addMonths(current.year, current.month, -(PRESET_MONTHS['6m'] - 1));
    return buildPeriod({ range: '6m', from: start, to: current });
  }

  if (hasRange && (hasFrom || hasTo)) {
    return fail('Use either range or from and to, not both.');
  }

  if (hasRange) {
    if (typeof range !== 'string' || !Object.prototype.hasOwnProperty.call(PRESET_MONTHS, range)) {
      return fail('range must be one of 3m, 6m, or 12m.');
    }

    const current = manilaParts(now);
    const start = addMonths(current.year, current.month, -(PRESET_MONTHS[range] - 1));
    return buildPeriod({ range, from: start, to: current });
  }

  if (hasFrom !== hasTo) {
    return fail('Both from and to are required.');
  }

  const fromParts = parseMonth(from);
  const toParts = parseMonth(to);
  if (!fromParts || !toParts) {
    return fail('from and to must use YYYY-MM.');
  }

  if (compareMonths(fromParts, toParts) > 0) {
    return fail('from must be the same month as to, or earlier.');
  }

  const current = manilaParts(now);
  if (compareMonths(toParts, current) > 0) {
    return fail('Date range cannot extend beyond the current month.');
  }

  return buildPeriod({ range: null, from: fromParts, to: toParts });
};

const comparePerformance = (left, right) => {
  if (right.saveCount !== left.saveCount) {
    return right.saveCount - left.saveCount;
  }

  const byName = left.name.localeCompare(right.name, 'en', { sensitivity: 'base' });
  if (byName !== 0) {
    return byName;
  }

  return String(left.id).localeCompare(String(right.id));
};

const selectTopScholarships = (ranked) => {
  if (ranked.length <= TOP_SCHOLARSHIP_LIMIT) {
    return ranked;
  }

  const cutoff = ranked[TOP_SCHOLARSHIP_LIMIT - 1].saveCount;
  return ranked.filter(
    (row, index) => index < TOP_SCHOLARSHIP_LIMIT || row.saveCount === cutoff
  );
};

const buildProviderAnalytics = ({
  providerId,
  scholarships = [],
  saveCounts = [],
  period,
}) => {
  const owned = scholarships.filter(
    (scholarship) => String(scholarship.providerId) === String(providerId)
  );
  const ownedIds = new Set(owned.map((scholarship) => String(scholarship._id)));
  const counts = new Map();

  saveCounts.forEach((entry) => {
    const scholarshipId = String(entry.scholarshipId ?? entry._id);
    const saveCount = Number(entry.saveCount);
    if (!ownedIds.has(scholarshipId)) {
      return;
    }
    if (!Number.isInteger(saveCount) || saveCount < 0) {
      return;
    }
    counts.set(scholarshipId, (counts.get(scholarshipId) || 0) + saveCount);
  });

  const rows = owned.map((scholarship) => {
    const id = String(scholarship._id);
    const createdAt = new Date(scholarship.createdAt);
    const hasCreatedAt = !Number.isNaN(createdAt.getTime());

    return {
      id,
      name: scholarship.name || 'Untitled scholarship',
      status: scholarship.status,
      isArchived: scholarship.isArchived === true,
      saveCount: counts.get(id) || 0,
      createdAt: hasCreatedAt ? createdAt.toISOString() : null,
    };
  });

  const trendCounts = new Map(period.months.map((month) => [month.key, 0]));
  rows.forEach((row) => {
    if (!row.createdAt) {
      return;
    }
    const parts = manilaParts(new Date(row.createdAt));
    const key = monthKey(parts.year, parts.month);
    if (!trendCounts.has(key)) {
      return;
    }
    trendCounts.set(key, trendCounts.get(key) + 1);
  });

  const creationTrend = period.months.map((month) => ({
    year: month.year,
    month: month.month,
    label: month.label,
    count: trendCounts.get(month.key) || 0,
  }));

  const scholarshipsByPerformance = [...rows].sort(comparePerformance);
  const highestSaveCount = scholarshipsByPerformance.reduce(
    (highest, row) => Math.max(highest, row.saveCount),
    0
  );

  return {
    period: {
      range: period.range,
      from: period.from,
      to: period.to,
      start: period.start.toISOString(),
      end: period.end.toISOString(),
      timeZone: period.timeZone,
    },
    overview: {
      totalCreated: rows.length,
      openScholarships: rows.filter(
        (row) => row.status === 'Open' && row.isArchived === false
      ).length,
      totalSaves: rows.reduce((sum, row) => sum + row.saveCount, 0),
      createdInPeriod: creationTrend.reduce((sum, month) => sum + month.count, 0),
    },
    creationTrend,
    topScholarships: selectTopScholarships(scholarshipsByPerformance),
    scholarships: scholarshipsByPerformance,
    mostSaved: rows.length === 0
      ? null
      : {
          saveCount: highestSaveCount,
          scholarships: scholarshipsByPerformance.filter(
            (row) => row.saveCount === highestSaveCount
          ),
        },
  };
};

module.exports = {
  MAX_RANGE_MONTHS,
  TOP_SCHOLARSHIP_LIMIT,
  resolveAnalyticsPeriod,
  buildProviderAnalytics,
};
