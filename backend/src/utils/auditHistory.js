const { renderCsv } = require('./csvExport');

const SEVERITIES = new Set(['Info', 'Warning', 'Critical']);
const ACTION_PATTERN = /^[A-Za-z0-9_]{1,80}$/;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_PAGE = 10000;
const MAX_SEARCH_LENGTH = 100;
const EXPORT_MAX = 10000;

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parsePositiveInt = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 1) return null;
    return value;
  }
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value.trim())) return null;
  const number = Number(value.trim());
  if (!Number.isSafeInteger(number)) return null;
  return number;
};

const readText = (value, label) => {
  if (value === undefined || value === null || value === '') return { ok: true, value: '' };
  if (typeof value !== 'string') return { ok: false, message: `${label} must be text.` };
  return { ok: true, value: value.trim() };
};

const parseDateBound = (value, bound) => {
  if (value === undefined || value === null || value === '') return { ok: true, value: undefined };
  if (typeof value !== 'string') return { ok: false, message: 'Dates must be text.' };
  const text = value.trim();
  if (!text) return { ok: true, value: undefined };

  const dateOnly = DATE_ONLY.exec(text);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    const utc = new Date(Date.UTC(year, month - 1, day));
    if (
      utc.getUTCFullYear() !== year
      || utc.getUTCMonth() !== month - 1
      || utc.getUTCDate() !== day
    ) {
      return { ok: false, message: 'Use a valid date.' };
    }
    const start = new Date(utc.getTime() - MANILA_OFFSET_MS);
    if (bound === 'start') return { ok: true, value: start };
    const end = new Date(utc.getTime() + 24 * 60 * 60 * 1000 - MANILA_OFFSET_MS - 1);
    return { ok: true, value: end };
  }

  const instant = new Date(text);
  if (Number.isNaN(instant.getTime())) return { ok: false, message: 'Use a valid date.' };
  return { ok: true, value: instant };
};

/**
 * Validate listing and export filters.
 * Export ignores page and page size so the file is the full match set.
 */
const parseAuditQuery = (source = {}, options = {}) => {
  const forExport = options.forExport === true;
  const searchResult = readText(source.search, 'Search');
  if (!searchResult.ok) return searchResult;
  if (searchResult.value.length > MAX_SEARCH_LENGTH) {
    return { ok: false, message: 'Search must be 100 characters or fewer.' };
  }

  const severityResult = readText(source.severity, 'Severity');
  if (!severityResult.ok) return severityResult;
  let severity = '';
  if (severityResult.value && severityResult.value.toLowerCase() !== 'all') {
    if (!SEVERITIES.has(severityResult.value)) {
      return { ok: false, message: 'Severity must be Info, Warning, or Critical.' };
    }
    severity = severityResult.value;
  }

  const actionResult = readText(source.action, 'Event type');
  if (!actionResult.ok) return actionResult;
  const eventResult = readText(source.event, 'Event type');
  if (!eventResult.ok) return eventResult;
  if (actionResult.value && eventResult.value && actionResult.value !== eventResult.value) {
    return { ok: false, message: 'Event type was sent twice with different values.' };
  }
  const actionText = actionResult.value || eventResult.value;
  let action = '';
  if (actionText && actionText.toLowerCase() !== 'all') {
    if (!ACTION_PATTERN.test(actionText)) {
      return { ok: false, message: 'Event type must contain only letters, numbers, and underscores.' };
    }
    action = actionText;
  }

  const fromResult = parseDateBound(source.from, 'start');
  if (!fromResult.ok) return fromResult;
  const toResult = parseDateBound(source.to, 'end');
  if (!toResult.ok) return toResult;
  if (fromResult.value && toResult.value && fromResult.value > toResult.value) {
    return { ok: false, message: 'The start date must be on or before the end date.' };
  }

  let page = 1;
  let pageSize = DEFAULT_PAGE_SIZE;
  if (!forExport) {
    const parsedPage = parsePositiveInt(source.page);
    if (parsedPage === null || (parsedPage !== undefined && parsedPage > MAX_PAGE)) {
      return { ok: false, message: 'Page must be a positive integer.' };
    }
    page = parsedPage || 1;

    const sizeSource = source.pageSize !== undefined && source.pageSize !== ''
      ? source.pageSize
      : source.limit;
    const parsedSize = parsePositiveInt(sizeSource);
    if (parsedSize === null) {
      return { ok: false, message: 'Page size must be a positive integer.' };
    }
    pageSize = Math.min(parsedSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  }

  return {
    ok: true,
    search: searchResult.value,
    severity,
    action,
    from: fromResult.value,
    to: toResult.value,
    page,
    pageSize,
  };
};

const buildAuditFilter = (parsed) => {
  const filter = {};
  if (parsed.severity) filter.severity = parsed.severity;
  if (parsed.action) filter.action = parsed.action;
  if (parsed.from || parsed.to) {
    filter.createdAt = {};
    if (parsed.from) filter.createdAt.$gte = parsed.from;
    if (parsed.to) filter.createdAt.$lte = parsed.to;
  }
  if (parsed.search) {
    const regex = new RegExp(escapeRegex(parsed.search), 'i');
    filter.$or = [
      { actor: regex },
      { role: regex },
      { action: regex },
      { details: regex },
      { ipAddress: regex },
    ];
  }
  return filter;
};

const exportAuditDetails = (parsed, count) => {
  const parts = [
    'Exported compliance audit logs to CSV format.',
    `Matching records: ${count}.`,
  ];
  if (parsed.severity) parts.push(`Severity: ${parsed.severity}.`);
  if (parsed.action) parts.push(`Event: ${parsed.action}.`);
  if (parsed.from) parts.push(`From: ${parsed.from.toISOString()}.`);
  if (parsed.to) parts.push(`To: ${parsed.to.toISOString()}.`);
  if (parsed.search) parts.push(`Search length: ${parsed.search.length}.`);
  return parts.join(' ');
};

const auditRowsToCsv = (rows) => renderCsv([
  ['Timestamp', 'Actor', 'Role', 'Action', 'Details', 'IP Address', 'Severity'],
  ...rows.map((row) => [
    row.createdAt ? new Date(row.createdAt).toISOString() : '',
    row.actor || '',
    row.role || '',
    row.action || '',
    row.details || '',
    row.ipAddress || '',
    row.severity || '',
  ]),
]);

module.exports = {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  EXPORT_MAX,
  parseAuditQuery,
  buildAuditFilter,
  exportAuditDetails,
  auditRowsToCsv,
};
