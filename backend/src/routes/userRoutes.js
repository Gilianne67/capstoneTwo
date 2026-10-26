const express = require('express');
const router = express.Router();
const { 
  handleOnboarding, 
  resendConsentEmail, 
  verifyConsent, 
  approveConsent 
} = require('../controllers/userController');
const { protect } = require('../middleware/auth'); // Adjust path if your auth middleware is located elsewhere

// Protected onboarding step (handles data persistence, student profile creation, and email flows)
router.post('/onboarding', protect, handleOnboarding);

// Resend parental consent email
router.post('/consent/resend', protect, resendConsentEmail);

// Public consent verification endpoints
router.get('/consent/verify', verifyConsent);
router.post('/consent/approve', approveConsent);

module.exports = router;