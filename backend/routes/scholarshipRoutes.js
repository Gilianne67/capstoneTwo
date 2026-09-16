const express = require('express');

const {
  createScholarship,
} = require('../controllers/scholarshipController');

const {
  protect,
  authorize,
} = require('../middleware/auth');

const router = express.Router();

// Create scholarship
// Requires authentication and provider role
router.post(
  '/',
  protect,
  authorize('provider'),
  createScholarship
);

module.exports = router;