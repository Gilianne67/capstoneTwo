const express = require('express');
const { handleOnboarding, resendConsentEmail } = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { verifyConsent, approveConsent } = require('../controllers/userController');

const router = express.Router();

// Protected onboarding step
router.post('/onboarding', protect, handleOnboarding);

// Resend parental consent email
router.post('/consent/resend', protect, resendConsentEmail);

// Consent endpoints
router.get('/consent/verify', verifyConsent);
router.post('/consent/approve', approveConsent);

module.exports = router;