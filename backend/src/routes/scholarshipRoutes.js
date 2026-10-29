const express = require('express');

const {
  createScholarship,
  getMyScholarships,
  getScholarshipById,
  updateScholarship,
  updateScholarshipStatus,
  archiveScholarship,
} = require('../controllers/scholarshipController');

const {
  protect,
  authorize,
} = require('../middleware/auth');

const router = express.Router();

router.get(
  '/my',
  protect,
  authorize('provider'),
  getMyScholarships
);

router.patch(
  '/:id/status',
  protect,
  authorize('provider'),
  updateScholarshipStatus
);

router.patch(
  '/:id/archive',
  protect,
  authorize('provider', 'admin', 'super_admin', 'superadmin'),
  archiveScholarship
);

router.get(
  '/:id',
  protect,
  authorize('provider', 'student', 'admin', 'super_admin', 'superadmin'),
  getScholarshipById
);

// Create scholarship
// Requires authentication and provider role
router.post(
  '/',
  protect,
  authorize('provider'),
  createScholarship
);

router.put(
  '/:id',
  protect,
  authorize('provider'),
  updateScholarship
);

module.exports = router;