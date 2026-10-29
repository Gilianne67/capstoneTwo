/**
 * Server-side audit history: pagination, filters, export, and authorization.
 * MongoDB is not required. AuditLog queries are stand-ins.
 */
const assert = require('assert');
const mongoose = require('mongoose');

const AuditLog = require('../models/AuditLog');
const auditController = require('../controllers/auditController');
const auditRoutes = require('../routes/auditRoutes');
const { protect } = require('../middleware/auth');
const { EXPORT_MAX } = require('../utils/auditHistory');

const originalCreate = AuditLog.create;
const originalFind = AuditLog.find;
const originalCount = AuditLog.countDocuments;

const audits = [];
let createImpl = async (entry) => {
  audits.push(entry);
  return { _id: `audit-${audits.length}`, ...entry };
};

const store = [
  entry('log-01', '2026-10-01T08:00:00.000Z', {
    action: 'USER_LOGIN', severity: 'Info', actor: 'Ada Admin', role: 'Admin',
    details: 'Signed in', ipAddress: '10.0.0.1',
  }),
  entry('log-02', '2026-10-02T08:00:00.000Z', {
    action: 'LOGIN_FAILED', severity: 'Warning', actor: 'Ada Admin', role: 'Admin',
    details: 'Invalid credentials', ipAddress: '10.0.0.2',
  }),
  entry('log-03', '2026-10-02T08:00:00.000Z', {
    action: 'LOGIN_FAILED', severity: 'Warning', actor: 'Bea Student', role: 'Student',
    details: 'Invalid credentials again', ipAddress: '10.0.0.3',
  }),
  entry('log-04', '2026-10-03T08:00:00.000Z', {
    action: 'SCHOLARSHIP_CREATED', severity: 'Info', actor: 'Pat Provider', role: 'Provider',
    details: 'Created listing', ipAddress: '10.0.0.4',
  }),
  entry('log-05', '2026-10-04T08:00:00.000Z', {
    action: 'ACCOUNT_LOCKOUT', severity: 'Critical', actor: 'Cara', role: 'Student',
    details: 'Locked', ipAddress: '10.0.0.5',
  }),
  entry('log-06', '2026-10-05T08:00:00.000Z', {
    action: 'USER_LOGIN', severity: 'Info', actor: 'Ada Admin', role: 'Admin',
    details: 'literal .* value', ipAddress: '10.0.0.6',
  }),
  entry('log-07', '2026-10-06T08:00:00.000Z', {
    action: 'DOCUMENT_ACCESS', severity: 'Info', actor: 'Ada Admin', role: 'Admin',
    details: 'a+b (test)', ipAddress: '10.0.0.7',
  }),
  entry('log-08', '2026-10-07T08:00:00.000Z', {
    action: 'EXPORT_LOGS', severity: 'Info', actor: '=HYPERLINK("http://evil")', role: 'Admin',
    details: '=HYPERLINK("http://evil")', ipAddress: '10.0.0.8',
  }),
];

function entry(id, createdAt, fields) {
  return { _id: id, createdAt: new Date(createdAt), ...fields };
}

let queries = [];
let countImpl = null;

const matches = (row, filter = {}) => {
  if (filter.severity && row.severity !== filter.severity) return false;
  if (filter.action && row.action !== filter.action) return false;
  if (filter.createdAt?.$gte && row.createdAt < filter.createdAt.$gte) return false;
  if (filter.createdAt?.$lte && row.createdAt > filter.createdAt.$lte) return false;
  if (Array.isArray(filter.$or)) {
    const hit = filter.$or.some((clause) => {
      const [field, regex] = Object.entries(clause)[0];
      return regex.test(String(row[field] ?? ''));
    });
    if (!hit) return false;
  }
  return true;
};

const ordered = (rows, sort) => rows.slice().sort((left, right) => {
  const leftTime = left.createdAt.getTime();
  const rightTime = right.createdAt.getTime();
  if (leftTime !== rightTime) return sort.createdAt === 1 ? leftTime - rightTime : rightTime - leftTime;
  if (left._id === right._id) return 0;
  const idOrder = left._id < right._id ? -1 : 1;
  return sort._id === 1 ? idOrder : -idOrder;
});

const installStore = () => {
  queries = [];
  AuditLog.create = (doc) => createImpl(doc);
  AuditLog.countDocuments = async (filter) => {
    if (countImpl) return countImpl(filter);
    return store.filter((row) => matches(row, filter)).length;
  };
  AuditLog.find = (filter) => {
    const state = { filter, sort: null, skip: 0, limit: null };
    queries.push(state);
    const api = {
      sort(value) {
        state.sort = value;
        return api;
      },
      skip(value) {
        state.skip = value;
        return api;
      },
      limit(value) {
        state.limit = value;
        return api;
      },
      async lean() {
        const rows = ordered(store.filter((row) => matches(row, state.filter)), state.sort || { createdAt: -1, _id: -1 });
        return rows.slice(state.skip, state.limit == null ? undefined : state.skip + state.limit);
      },
    };
    return api;
  };
};

const restore = () => {
  AuditLog.create = originalCreate;
  AuditLog.find = originalFind;
  AuditLog.countDocuments = originalCount;
};

const mockRes = () => ({
  statusCode: 200,
  body: null,
  headers: {},
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  setHeader(name, value) {
    this.headers[name] = value;
    return this;
  },
  send(body) {
    this.body = body;
    return this;
  },
});

const invoke = async (handler, req) => {
  const res = mockRes();
  await handler(req, res, () => {});
  return res;
};

const list = (query) => invoke(auditController.getAuditLogs, { query, headers: {} });

const csvRows = (body) => String(body).trim().split('\n').slice(1);

const run = async () => {
  assert.notStrictEqual(mongoose.connection.readyState, 1);
  installStore();

  const firstPage = await list({ page: '1', pageSize: '2' });
  assert.strictEqual(firstPage.statusCode, 200);
  assert.strictEqual(firstPage.body.success, true);
  assert.strictEqual(firstPage.body.total, store.length);
  assert.strictEqual(firstPage.body.count, 2);
  assert.strictEqual(firstPage.body.pagination.pages, 4);
  assert.strictEqual(firstPage.body.pagination.page, 1);
  assert.strictEqual(firstPage.body.pagination.pageSize, 2);
  assert.strictEqual(firstPage.body.pagination.total, store.length);
  assert.deepStrictEqual(firstPage.body.data.map((row) => row._id), ['log-08', 'log-07']);
  assert.deepStrictEqual(queries.at(-1).sort, { createdAt: -1, _id: -1 });

  const tied = await list({ action: 'LOGIN_FAILED', page: '1', pageSize: '1' });
  assert.strictEqual(tied.body.total, 2);
  assert.strictEqual(tied.body.count, 1);
  assert.strictEqual(tied.body.pagination.pages, 2);
  assert.strictEqual(tied.body.data[0]._id, 'log-03');
  const tiedSecond = await list({ action: 'LOGIN_FAILED', page: '2', pageSize: '1' });
  assert.strictEqual(tiedSecond.body.data[0]._id, 'log-02');
  assert.strictEqual(tiedSecond.body.total, 2);

  const severity = await list({ severity: 'Critical' });
  assert.deepStrictEqual(severity.body.data.map((row) => row._id), ['log-05']);
  assert.strictEqual(severity.body.total, 1);
  assert.strictEqual(severity.body.summary.critical, 1);
  assert.strictEqual(severity.body.summary.info, 0);
  assert.strictEqual(severity.body.summary.total, 1);

  const event = await list({ event: 'SCHOLARSHIP_CREATED' });
  assert.deepStrictEqual(event.body.data.map((row) => row._id), ['log-04']);

  const dates = await list({ from: '2026-10-02', to: '2026-10-02' });
  assert.deepStrictEqual(dates.body.data.map((row) => row._id), ['log-03', 'log-02']);
  assert.strictEqual(dates.body.total, 2);
  assert.strictEqual(queries.at(-1).filter.createdAt.$gte.toISOString(), '2026-10-01T16:00:00.000Z');
  assert.strictEqual(queries.at(-1).filter.createdAt.$lte.toISOString(), '2026-10-02T15:59:59.999Z');

  const search = await list({ search: 'Bea' });
  assert.deepStrictEqual(search.body.data.map((row) => row._id), ['log-03']);
  assert.strictEqual(queries.at(-1).filter.$or[0].actor.source, 'Bea');

  const combined = await list({
    severity: 'Warning',
    action: 'LOGIN_FAILED',
    from: '2026-10-02',
    to: '2026-10-02',
    search: 'again',
  });
  assert.deepStrictEqual(combined.body.data.map((row) => row._id), ['log-03']);
  assert.strictEqual(combined.body.total, 1);
  assert.strictEqual(combined.body.summary.warning, 1);

  const literalDot = await list({ search: '.*' });
  assert.deepStrictEqual(literalDot.body.data.map((row) => row._id), ['log-06']);
  assert.strictEqual(literalDot.body.total, 1);
  assert.strictEqual(queries.at(-1).filter.$or[3].details.source, '\\.\\*');

  const metacharacters = await list({ search: 'a+b (' });
  assert.deepStrictEqual(metacharacters.body.data.map((row) => row._id), ['log-07']);
  assert.strictEqual(queries.at(-1).filter.$or[3].details.source, 'a\\+b \\(');

  const harmlessPattern = await list({ search: '(a+)+$' });
  assert.strictEqual(harmlessPattern.statusCode, 200);
  assert.strictEqual(harmlessPattern.body.total, 0);
  assert.strictEqual(queries.at(-1).filter.$or[0].actor.source, '\\(a\\+\\)\\+\\$');

  const empty = await list({ action: 'NO_SUCH_EVENT' });
  assert.strictEqual(empty.statusCode, 200);
  assert.deepStrictEqual(empty.body.data, []);
  assert.strictEqual(empty.body.total, 0);
  assert.strictEqual(empty.body.count, 0);
  assert.strictEqual(empty.body.pagination.pages, 0);

  const capped = await list({ pageSize: '250' });
  assert.strictEqual(capped.statusCode, 200);
  assert.strictEqual(capped.body.pagination.pageSize, 100);
  assert.strictEqual(queries.at(-1).limit, 100);

  const limitAlias = await list({ limit: '5' });
  assert.strictEqual(limitAlias.body.pagination.pageSize, 5);

  for (const page of ['0', '-1', '1.5', 'abc', '10001']) {
    const invalid = await list({ page });
    assert.strictEqual(invalid.statusCode, 400, `page ${page}`);
    assert.strictEqual(invalid.body.success, false);
    assert.strictEqual(invalid.body.error, undefined);
  }
  for (const pageSize of ['0', '-4', '2.5', 'abc']) {
    const invalid = await list({ pageSize });
    assert.strictEqual(invalid.statusCode, 400, `pageSize ${pageSize}`);
  }
  const badDate = await list({ from: '2026-02-31' });
  assert.strictEqual(badDate.statusCode, 400);
  const inverted = await list({ from: '2026-10-08', to: '2026-10-01' });
  assert.strictEqual(inverted.statusCode, 400);
  assert.match(inverted.body.message, /start date/i);
  const badSeverity = await list({ severity: 'High' });
  assert.strictEqual(badSeverity.statusCode, 400);
  const badAction = await list({ action: 'LOGIN.*' });
  assert.strictEqual(badAction.statusCode, 400);
  const longSearch = await list({ search: 'a'.repeat(101) });
  assert.strictEqual(longSearch.statusCode, 400);
  const objectSearch = await list({ search: { $gt: '' } });
  assert.strictEqual(objectSearch.statusCode, 400);

  countImpl = async () => {
    throw new Error('mongo secret-db-detail');
  };
  const dbFailure = await list({});
  countImpl = null;
  assert.strictEqual(dbFailure.statusCode, 500);
  assert.strictEqual(dbFailure.body.message, 'Failed to retrieve audit log trails');
  assert.strictEqual(JSON.stringify(dbFailure.body).includes('secret-db-detail'), false);
  assert.strictEqual(dbFailure.body.error, undefined);

  const exported = await invoke(auditController.logExportAction, {
    query: { page: '2', pageSize: '1' },
    body: { action: 'LOGIN_FAILED', severity: 'Warning' },
    user: { firstName: 'Ada', lastName: 'Admin', email: 'ada@example.com', role: 'admin' },
    ip: '203.0.113.8',
    headers: {},
  });
  assert.strictEqual(exported.statusCode, 200);
  assert.match(exported.headers['Content-Type'], /text\/csv/);
  const exportedIds = csvRows(exported.body);
  assert.strictEqual(exportedIds.length, 2);
  assert.match(exportedIds[0], /Invalid credentials again/);
  assert.match(exportedIds[1], /Invalid credentials/);
  assert.strictEqual(queries.at(-1).skip, 0);
  assert.strictEqual(queries.at(-1).limit, EXPORT_MAX + 1);
  assert.strictEqual(audits.at(-1).action, 'EXPORT_LOGS');
  assert.match(audits.at(-1).details, /Matching records: 2/);
  assert.strictEqual(audits.at(-1).details.includes('Invalid credentials'), false);

  const formula = await invoke(auditController.logExportAction, {
    body: { action: 'EXPORT_LOGS' },
    user: { email: 'ada@example.com' },
    headers: {},
  });
  assert.strictEqual(formula.statusCode, 200);
  assert.match(formula.body, /'=HYPERLINK\(""http:\/\/evil""\)/);

  const beforeFailure = audits.length;
  createImpl = async () => {
    throw new Error('audit store unavailable');
  };
  const blocked = await invoke(auditController.logExportAction, {
    body: { severity: 'Critical' },
    user: { email: 'ada@example.com' },
    headers: {},
  });
  assert.strictEqual(blocked.statusCode, 500);
  assert.strictEqual(blocked.body.success, false);
  assert.strictEqual(blocked.body.message, 'Failed to record export audit action');
  assert.strictEqual(blocked.body.message.includes('recorded successfully'), false);
  assert.strictEqual(blocked.body.warnings[0].step, 'audit');
  assert.strictEqual(blocked.headers['Content-Type'], undefined);
  assert.strictEqual(typeof blocked.body, 'object');
  assert.strictEqual(audits.length, beforeFailure);

  const previousFind = AuditLog.find;
  AuditLog.find = () => ({
    sort() { return this; },
    limit() { return this; },
    lean: async () => Array.from({ length: EXPORT_MAX + 1 }, (_, index) => ({ _id: `extra-${index}` })),
  });
  const overflow = await invoke(auditController.logExportAction, {
    body: {},
    user: { email: 'ada@example.com' },
    headers: {},
  });
  AuditLog.find = previousFind;
  assert.strictEqual(overflow.statusCode, 400);
  assert.match(overflow.body.message, /Narrow the filters/);
  assert.strictEqual(overflow.headers['Content-Type'], undefined);

  createImpl = async () => {
    throw new Error('audit store unavailable');
  };
  const failedInsert = await auditController.recordAuditLog({
    actor: 'Ada Admin',
    role: 'Admin',
    action: 'HEALTH_CHECK',
    details: 'Insert failed.',
  });
  assert.strictEqual(failedInsert.ok, false);
  assert.strictEqual(failedInsert.message, auditController.AUDIT_NOT_SAVED);

  const gate = auditRoutes.stack.map((layer) => layer.handle).find((handle) => handle.name === 'authorizeRequest');
  assert.strictEqual(typeof gate, 'function');
  const anonymous = await invoke(protect, { headers: {}, originalUrl: '/api/v1/admin/audit-logs' });
  assert.strictEqual(anonymous.statusCode, 401);
  assert.strictEqual(anonymous.body.success, false);

  for (const role of ['student', 'provider']) {
    const denied = await invoke(gate, { user: { role }, headers: {} });
    assert.strictEqual(denied.statusCode, 403, role);
    assert.strictEqual(denied.body.success, false);
  }
  for (const role of ['admin', 'superadmin', 'super_admin']) {
    let allowed = false;
    await gate({ user: { role }, headers: {} }, mockRes(), () => {
      allowed = true;
    });
    assert.strictEqual(allowed, true, role);
  }

  console.log('audit history tests passed');
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(restore);
