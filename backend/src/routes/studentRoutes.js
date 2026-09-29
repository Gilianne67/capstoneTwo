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
const {
  getNotifications,
  getUnreadCount,
  getUnreadDeadlineCount,
  markNotificationRead,
  markAllNotificationsRead
} = require('../controllers/notificationController');

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

router.get(
  '/notifications',
  protect,
  authorize('student'),
  getNotifications
);
router.get(
  '/notifications/unread-count',
  protect,
  authorize('student'),
  getUnreadCount
);
router.get(
  '/notifications/unread-deadline-count',
  protect,
  authorize('student'),
  getUnreadDeadlineCount
);
router.patch(
  '/notifications/read-all',
  protect,
  authorize('student'),
  markAllNotificationsRead
);
router.patch(
  '/notifications/:id/read',
  protect,
  authorize('student'),
  markNotificationRead
);

module.exports = router;