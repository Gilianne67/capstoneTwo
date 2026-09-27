const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createProfile,
  getProfile,
  updateProfile
} = require('../controllers/studentProfileController');
const {
  getSavedScholarships,
  saveScholarship,
  removeSavedScholarship
} = require('../controllers/savedScholarshipController');

router.post('/profile', protect, authorize('student'), createProfile);
router.get('/profile', protect, authorize('student'), getProfile);
router.put('/profile', protect, authorize('student'), updateProfile);

router.get(
  '/saved-scholarships',
  protect,
  authorize('student'),
  getSavedScholarships
);
router.post(
  '/saved-scholarships/:scholarshipId',
  protect,
  authorize('student'),
  saveScholarship
);
router.delete(
  '/saved-scholarships/:scholarshipId',
  protect,
  authorize('student'),
  removeSavedScholarship
);

module.exports = router;