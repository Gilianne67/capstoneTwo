export const AUDIT_PAGE_SIZE = 20;

export const AUDIT_EVENT_TYPES = [
  'ACCOUNT_LOCKOUT',
  'ACCOUNT_STATUS_CHANGE',
  'ADMIN_ACCOUNT_PROVISIONED',
  'ANALYTICS_REPORT_EXPORT',
  'BROADCAST_DISPATCHED',
  'BROADCAST_REVOKED',
  'CONSENT_MODERATED',
  'CONSENT_REQUESTED',
  'CONSENT_RESENT',
  'CONSENT_TOKEN_INSPECTED',
  'CONSENT_TOKEN_REJECTED',
  'CONSENT_VERIFIED',
  'DOCUMENT_ACCESS',
  'EMAIL_UPDATED',
  'EMAIL_VERIFIED',
  'EXPORT_LOGS',
  'LOGIN_BLOCKED',
  'LOGIN_FAILED',
  'MODERATION_REPORT_RESOLVED',
  'MODERATION_REPORT_RETRY',
  'ONBOARDING_COMPLETE',
  'PASSWORD_CHANGED',
  'PASSWORD_CHANGE_FAILED',
  'PASSWORD_RESET_COMPLETE',
  'PASSWORD_RESET_REQUEST',
  'PROFILE_CREATE',
  'PROFILE_UPDATE',
  'PROVIDER_PROFILE_UPDATE',
  'PROVIDER_REJECTED',
  'PROVIDER_VERIFICATION_SUBMITTED',
  'PROVIDER_VERIFIED',
  'SCHOLARSHIP_ARCHIVED',
  'SCHOLARSHIP_CLOSED',
  'SCHOLARSHIP_CREATED',
  'SCHOLARSHIP_MODERATED',
  'SCHOLARSHIP_REOPENED',
  'SCHOLARSHIP_REPORTED',
  'SCHOLARSHIP_UPDATED',
  'SECURITY_ALERT',
  'SYSTEM_CONFIG_UPDATED',
  'USER_LOGIN',
  'USER_LOGOUT',
  'USER_REGISTER',
];

export function auditListParams({
  page = 1,
  pageSize = AUDIT_PAGE_SIZE,
  search = '',
  severity = 'All',
  action = '',
  from = '',
  to = '',
} = {}) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  const trimmed = String(search || '').trim();
  if (trimmed) params.set('search', trimmed);
  if (severity && severity !== 'All') params.set('severity', severity);
  if (action && action !== 'All') params.set('action', action);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return params;
}

export function auditExportFilters({
  search = '',
  severity = 'All',
  action = '',
  from = '',
  to = '',
} = {}) {
  const filters = {};
  const trimmed = String(search || '').trim();
  if (trimmed) filters.search = trimmed;
  if (severity && severity !== 'All') filters.severity = severity;
  if (action && action !== 'All') filters.action = action;
  if (from) filters.from = from;
  if (to) filters.to = to;
  return filters;
}

export function readAuditPage(payload) {
  const records = Array.isArray(payload?.data) ? payload.data : [];
  const pagination = payload?.pagination || {};
  const totalValue = pagination.total ?? payload?.total;
  const total = Number.isFinite(Number(totalValue)) ? Number(totalValue) : records.length;
  const page = Number(pagination.page) || 1;
  const pageSize = Number(pagination.pageSize) || AUDIT_PAGE_SIZE;
  const pagesValue = Number(pagination.pages);
  const pages = Number.isFinite(pagesValue) ? pagesValue : 0;
  const summary = {
    info: Number(payload?.summary?.info) || 0,
    warning: Number(payload?.summary?.warning) || 0,
    critical: Number(payload?.summary?.critical) || 0,
    total: Number(payload?.summary?.total ?? total) || 0,
  };
  return { records, total, page, pageSize, pages, summary };
}

export function auditResultRange(page, pageSize, total) {
  const safeTotal = Number(total) || 0;
  if (safeTotal === 0) return { start: 0, end: 0, total: 0 };
  const start = (Number(page) - 1) * Number(pageSize) + 1;
  const end = Math.min(Number(page) * Number(pageSize), safeTotal);
  return { start, end, total: safeTotal };
}

export function shouldDownloadAuditCsv({ ok, contentType } = {}) {
  return ok === true && String(contentType || '').toLowerCase().includes('text/csv');
}
