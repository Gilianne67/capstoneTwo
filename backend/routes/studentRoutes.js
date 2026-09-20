const express = require('express');

const {
  getStudentProfile,
  createStudentProfile,
  updateStudentProfile,
  getProfileStatus,
} = require('../controllers/studentController');

const { protect, authorize } = require('../src/middleware/auth');

const router = express.Router();

router.use(protect);

router.use(authorize('student'));

router.get('/profile', getStudentProfile);

router.post('/profile', createStudentProfile);

router.put('/profile', updateStudentProfile);

router.get('/profile/status', getProfileStatus);

module.exports = router;