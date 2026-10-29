import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  auditExportFilters,
  auditListParams,
  auditResultRange,
  readAuditPage,
  shouldDownloadAuditCsv,
} from './auditCompliance.js';

const params = auditListParams({
  page: 2,
  pageSize: 20,
  search: 'a+b (.*)',
  severity: 'Warning',
  action: 'LOGIN_FAILED',
  from: '2026-10-01',
  to: '2026-10-02',
});
assert.equal(params.get('page'), '2');
assert.equal(params.get('pageSize'), '20');
assert.equal(params.get('search'), 'a+b (.*)');
assert.equal(params.get('severity'), 'Warning');
assert.equal(params.get('action'), 'LOGIN_FAILED');
assert.equal(params.get('from'), '2026-10-01');
assert.equal(params.toString().includes('a%2Bb'), true);

const exportFilters = auditExportFilters({
  page: 2,
  pageSize: 20,
  search: ' Ada ',
  severity: 'All',
  action: 'EXPORT_LOGS',
  from: '2026-10-01',
});
assert.deepEqual(exportFilters, {
  search: 'Ada',
  action: 'EXPORT_LOGS',
  from: '2026-10-01',
});
assert.equal(Object.hasOwn(exportFilters, 'page'), false);
assert.equal(Object.hasOwn(exportFilters, 'pageSize'), false);

const page = readAuditPage({
  data: [{ _id: 'log-1' }, { _id: 'log-2' }],
  count: 2,
  total: 50,
  summary: { info: 40, warning: 8, critical: 2, total: 50 },
  pagination: { page: 3, pageSize: 2, pages: 25, total: 50 },
});
assert.equal(page.records.length, 2);
assert.equal(page.total, 50);
assert.equal(page.pages, 25);
assert.equal(page.summary.critical, 2);
assert.deepEqual(auditResultRange(3, 2, page.total), { start: 5, end: 6, total: 50 });
assert.deepEqual(auditResultRange(1, 20, 0), { start: 0, end: 0, total: 0 });

assert.equal(shouldDownloadAuditCsv({ ok: false, contentType: 'text/csv' }), false);
assert.equal(shouldDownloadAuditCsv({ ok: true, contentType: 'application/json' }), false);
assert.equal(shouldDownloadAuditCsv({ ok: true, contentType: 'text/csv; charset=utf-8' }), true);

const empty = readAuditPage({ success: true, data: [], total: 0, pagination: { pages: 0, total: 0 } });
assert.equal(empty.total, 0);
assert.equal(empty.records.length, 0);

const pageSource = fs.readFileSync(new URL('./pages/AuditCompliance.jsx', import.meta.url), 'utf8');
assert.equal(pageSource.includes("apiUrl('admin/audit-logs')"), true);
assert.equal(pageSource.includes("apiUrl('admin/audit-logs/export')"), true);
assert.equal(pageSource.includes("fetch('/api/v1/admin/audit-logs'"), false);
assert.equal(pageSource.includes('shouldDownloadAuditCsv'), true);
assert.equal(pageSource.includes('Math.random'), false);

console.log('audit compliance helper tests passed');
