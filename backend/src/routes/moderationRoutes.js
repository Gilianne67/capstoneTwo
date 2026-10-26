const express = require('express');
const router = express.Router();

const {
  getModerationReports,
  updateModerationReport,
} = require('../controllers/moderationController');

const { protect, authorize } = require('../middleware/auth');

// Require authentication and admin privileges for all moderation routes
router.use(protect, authorize('admin', 'super_admin', 'superadmin'));

// GET /api/v1/admin/moderation/reports
router.route('/reports')
  .get(getModerationReports);

// PATCH /api/v1/admin/moderation/reports/:id
router.route('/reports/:id')
  .patch(updateModerationReport);

module.exports = router;