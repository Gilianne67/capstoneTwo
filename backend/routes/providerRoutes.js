const express = require('express');

const {
  getProfile,
  updateProfile,
} = require('../controllers/providerController');

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All provider routes require authentication and provider role
router.get('/profile', protect, authorize('provider'), getProfile);
router.put('/profile', protect, authorize('provider'), updateProfile);

module.exports = router;