const express = require('express');
const { getAuditLogs, logExportAction } = require('../controllers/auditController');
const auth = require('../middleware/auth');

const router = express.Router();

if (auth && auth.protect) router.use(auth.protect);
if (auth && auth.adminOnly) router.use(auth.adminOnly);

router.get('/', getAuditLogs);
router.post('/export', logExportAction);

module.exports = router;