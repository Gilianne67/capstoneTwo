const express = require('express');
const { 
  register, 
  login, 
  getMe, 
  logout, 
  resendVerification,
  verifyEmail,
  updateUnverifiedEmail,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/logout', protect, logout);
router.post('/resend-verification', resendVerification);
router.get('/verify-email/:token', verifyEmail); 
router.put('/update-unverified-email', updateUnverifiedEmail);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);
router.put('/update-unverified-email', protect, updateUnverifiedEmail);

module.exports = router;