const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * End of the deadline's calendar day in Asia/Manila.
 * Matches the backend rule: a date-only deadline stays open
 * through 23:59:59.999 on that date.
 */
export const manilaDeadlineEnd = (deadline) => {
  if (!deadline) return null;

  const parsed = new Date(deadline);

  if (Number.isNaN(parsed.getTime())) return null;

  const manila = new Date(parsed.getTime() + MANILA_OFFSET_MS);

  return Date.UTC(
    manila.getUTCFullYear(),
    manila.getUTCMonth(),
    manila.getUTCDate(),
    15,
    59,
    59,
    999
  );
};

export const isDeadlineOpen = (deadline, now = new Date()) => {
  const end = manilaDeadlineEnd(deadline);

  if (end === null) return false;

  return now.getTime() <= end;
};

export const daysUntilDeadline = (deadline, now = new Date()) => {
  const end = manilaDeadlineEnd(deadline);

  if (end === null) return 0;

  const remaining = end - now.getTime();

  if (remaining <= 0) return 0;

  return Math.ceil(remaining / DAY_MS);
};

const DEADLINE_MONTHS = [
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
  'December'
];

/**
 * Display-only calendar date in Asia/Manila.
 * Uses the same offset as manilaDeadlineEnd so the shown day
 * matches the deadline's Manila date.
 */
export const formatDeadlineDate = (deadline) => {
  if (!deadline) return '';

  const parsed = new Date(deadline);

  if (Number.isNaN(parsed.getTime())) return '';

  const manila = new Date(parsed.getTime() + MANILA_OFFSET_MS);

  return `${DEADLINE_MONTHS[manila.getUTCMonth()]} ${manila.getUTCDate()}, ${manila.getUTCFullYear()}`;
};
