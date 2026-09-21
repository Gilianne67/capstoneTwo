const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createProfile,
  getProfile,
  updateProfile
} = require('../controllers/studentProfileController');

router.post('/profile', protect, authorize('student'), createProfile);
router.get('/profile', protect, authorize('student'), getProfile);
router.put('/profile', protect, authorize('student'), updateProfile);

module.exports = router;