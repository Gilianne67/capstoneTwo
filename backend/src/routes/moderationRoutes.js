const express = require('express');
const router = express.Router();

const {
  getModerationReports,
  updateModerationReport,
} = require('../controllers/moderationController');

const { protect, authorize } = require('../middleware/auth'); 

// Consistent admin & super_admin authorization
router.use(protect, authorize('admin', 'super_admin'));

router.route('/reports')
  .get(getModerationReports);

router.route('/reports/:id')
  .patch(updateModerationReport);

module.exports = router;