const express = require('express');
const router = express.Router();

const {
  getModerationReports,
  updateModerationReport,
} = require('../controllers/moderationController');

// Auth & Admin Middleware
const { protect, authorize } = require('../middleware/auth'); 

// Apply middleware
router.use(protect);
router.use(authorize('admin'));

router.route('/reports')
  .get(getModerationReports);

router.route('/reports/:id')
  .patch(updateModerationReport);

module.exports = router;