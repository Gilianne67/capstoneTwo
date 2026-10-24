const AuditLog = require('../models/AuditLog');

/**
 * @desc    Get system audit & compliance logs with search & severity filters
 * @route   GET /api/v1/admin/audit-logs
 * @access  Private/Admin
 */
exports.getAuditLogs = async (req, res) => {
  try {
    const { severity, search } = req.query;
    let query = {};

    if (severity && severity !== 'All') {
      query.severity = severity;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { actor: searchRegex },
        { action: searchRegex },
        { details: searchRegex }
      ];
    }

    const logs = await AuditLog.find(query).sort({ createdAt: -1 }).limit(100);

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit log trails',
      error: error.message
    });
  }
};

/**
 * @desc    Log Export Action (When Admin downloads CSV report)
 * @route   POST /api/v1/admin/audit-logs/export
 * @access  Private/Admin
 */
exports.logExportAction = async (req, res) => {
  try {
    const actorName = req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email : 'Admin User';
    
    await exports.recordAuditLog({
      actor: actorName,
      role: req.user ? req.user.role : 'Admin',
      action: 'EXPORT_LOGS',
      details: 'Exported compliance audit logs to CSV format.',
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      severity: 'Info'
    });

    res.status(200).json({
      success: true,
      message: 'Export action recorded successfully'
    });
  } catch (error) {
    console.error('Error logging export action:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record export audit action',
      error: error.message
    });
  }
};

/**
 * @desc    Helper utility to programmatically insert audit logs from other controllers
 */
exports.recordAuditLog = async ({ actor, role, action, details, ipAddress, severity }) => {
  try {
    await AuditLog.create({
      actor: actor || 'System',
      role: role || 'System',
      action,
      details,
      ipAddress: ipAddress || '127.0.0.1',
      severity: severity || 'Info'
    });
  } catch (error) {
    console.error('Failed to record audit log:', error.message);
  }
};