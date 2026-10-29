const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const {
  EXPORT_MAX,
  parseAuditQuery,
  buildAuditFilter,
  exportAuditDetails,
  auditRowsToCsv,
} = require('../utils/auditHistory');

const AUDIT_NOT_SAVED = 'The audit record could not be saved.';
const STORED_ROLES = new Set(['Admin', 'Superadmin', 'Provider', 'Student', 'System']);
const SAFE_ACTOR_ID = /^[A-Za-z0-9_-]{1,64}$/;
const persistedCreate = AuditLog.create;
const persistedFind = AuditLog.find;

const auditStoreIsConnected = () => !(
  AuditLog.find === persistedFind && mongoose.connection.readyState !== 1
);

const LIST_SORT = { createdAt: -1, _id: -1 };

/**
 * Map account roles onto the audit schema. Historical rows keep Admin.
 * New superadmin actions are stored as Superadmin.
 */
const normalizeAuditRole = (role) => {
  if (role === undefined || role === null || String(role).trim() === '') return 'System';
  const value = String(role).trim();
  if (STORED_ROLES.has(value)) return value;
  const lower = value.toLowerCase().replace(/-/g, '_');
  if (lower === 'superadmin' || lower === 'super_admin' || lower.includes('superadmin') || lower.includes('super_admin')) {
    return 'Superadmin';
  }
  if (lower.includes('admin')) return 'Admin';
  if (lower.includes('provider')) return 'Provider';
  if (lower.includes('student')) return 'Student';
  if (lower.includes('system')) return 'System';
  return null;
};

const normalizeActorId = (actorId) => {
  if (actorId === undefined || actorId === null || actorId === '') return undefined;
  const value = String(actorId).trim();
  return SAFE_ACTOR_ID.test(value) ? value : undefined;
};

const failedAudit = (reason) => {
  console.error(`Failed to record audit log: ${reason}`);
  return { ok: false, message: AUDIT_NOT_SAVED };
};

/**
 * Insert one audit row.
 * `{ ok: true, id }` means MongoDB accepted the document.
 * `{ ok: false, message }` means nothing was stored. This does not throw.
 * A database outage is a failed insert, not a successful audit.
 */
exports.recordAuditLog = async ({ actor, actorId, role, action, details, ipAddress, severity } = {}) => {
  const storedRole = normalizeAuditRole(role);
  if (!storedRole) return failedAudit('unsupported role');

  const storedAction = typeof action === 'string' ? action.trim() : '';
  const storedDetails = typeof details === 'string' ? details.trim() : '';
  if (!storedAction || !storedDetails) return failedAudit('action and details are required');

  const usingPersistedCreate = AuditLog.create === persistedCreate;
  if (usingPersistedCreate && mongoose.connection.readyState !== 1) {
    return failedAudit('database is not connected');
  }

  const storedActorId = normalizeActorId(actorId);
  try {
    const log = await AuditLog.create({
      actor: actor || 'System',
      ...(storedActorId ? { actorId: storedActorId } : {}),
      role: storedRole,
      action: storedAction,
      details: storedDetails,
      ipAddress: ipAddress || '127.0.0.1',
      severity: severity || 'Info',
    });
    if (!log) return failedAudit('insert returned no document');
    return { ok: true, id: log._id };
  } catch (error) {
    return failedAudit(error.message);
  }
};

/**
 * Add an audit warning only when an insert explicitly failed.
 * Successful business payloads stay unchanged when the insert succeeded
 * or when a test stand-in does not report a failure.
 */
exports.withAuditWarning = (body, ...results) => {
  const failed = results.filter((result) => result && result.ok === false);
  if (failed.length === 0) return body;
  const warnings = Array.isArray(body.warnings) ? body.warnings.slice() : [];
  failed.forEach((result) => {
    warnings.push({
      step: 'audit',
      message: result.message || AUDIT_NOT_SAVED,
    });
  });
  return { ...body, warnings };
};

exports.AUDIT_NOT_SAVED = AUDIT_NOT_SAVED;

/**
 * @desc    Get system audit & compliance logs with search & severity filters
 * @route   GET /api/v1/admin/audit-logs
 * @access  Private/Admin
 */
exports.getAuditLogs = async (req, res) => {
  const parsed = parseAuditQuery(req.query);
  if (!parsed.ok) {
    return res.status(400).json({ success: false, message: parsed.message });
  }

  if (!auditStoreIsConnected()) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit log trails',
    });
  }

  try {
    const filter = buildAuditFilter(parsed);
    const skip = (parsed.page - 1) * parsed.pageSize;
    const countSeverity = (severity) => (
      parsed.severity && parsed.severity !== severity
        ? Promise.resolve(0)
        : AuditLog.countDocuments({ ...filter, severity })
    );
    const [data, total, info, warning, critical] = await Promise.all([
      AuditLog.find(filter).sort(LIST_SORT).skip(skip).limit(parsed.pageSize).lean(),
      AuditLog.countDocuments(filter),
      countSeverity('Info'),
      countSeverity('Warning'),
      countSeverity('Critical'),
    ]);
    const pages = total === 0 ? 0 : Math.ceil(total / parsed.pageSize);

    return res.status(200).json({
      success: true,
      count: data.length,
      total,
      data,
      summary: { info, warning, critical, total },
      pagination: {
        page: parsed.page,
        pageSize: parsed.pageSize,
        pages,
        total,
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit log trails',
    });
  }
};

/**
 * @desc    Log Export Action (When Admin downloads CSV report)
 * @route   POST /api/v1/admin/audit-logs/export
 * @access  Private/Admin
 */
exports.logExportAction = async (req, res) => {
  const parsed = parseAuditQuery({ ...(req.query || {}), ...(req.body || {}) }, { forExport: true });
  if (!parsed.ok) {
    return res.status(400).json({ success: false, message: parsed.message });
  }

  if (!auditStoreIsConnected()) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit log trails',
    });
  }

  let rows;
  try {
    rows = await AuditLog.find(buildAuditFilter(parsed))
      .sort(LIST_SORT)
      .limit(EXPORT_MAX + 1)
      .lean();
  } catch (error) {
    console.error('Error fetching audit logs for export:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit log trails',
    });
  }

  if (rows.length > EXPORT_MAX) {
    return res.status(400).json({
      success: false,
      message: `Narrow the filters before exporting. More than ${EXPORT_MAX} records matched.`,
    });
  }

  try {
    const actorName = req.user
      ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email
      : 'Admin User';

    const audit = await exports.recordAuditLog({
      actor: actorName,
      actorId: req.user && (req.user._id || req.user.id),
      role: (req.user && req.user.role) || 'Admin',
      action: 'EXPORT_LOGS',
      details: exportAuditDetails(parsed, rows.length),
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      severity: 'Info',
    });

    if (!audit || audit.ok !== true) {
      return res.status(500).json({
        success: false,
        message: 'Failed to record export audit action',
        warnings: [{
          step: 'audit',
          message: (audit && audit.message) || AUDIT_NOT_SAVED,
        }],
      });
    }

    const day = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Audit_Compliance_Report_${day}.csv"`);
    return res.status(200).send(auditRowsToCsv(rows));
  } catch (error) {
    console.error('Error logging export action:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to record export audit action',
    });
  }
};
