const express = require('express');
const { getAuditLogs, logExportAction } = require('../controllers/auditController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Restrict all audit log routes strictly to admins and super_admins
router.use(protect, authorize('admin', 'super_admin', 'superadmin'));

router.get('/', getAuditLogs);
router.post('/export', logExportAction);

module.exports = router;