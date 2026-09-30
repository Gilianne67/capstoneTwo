// backend/src/routes/consentRoutes.js (or wherever your consent endpoints are defined)
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { 
  verifyConsent, 
  approveConsent, 
  resendConsentEmail 
} = require('../controllers/userController');

// GET /api/v1/consent/verify?token=...
router.get('/verify', verifyConsent);
router.post('/approve', approveConsent);
router.post('/resend', protect, resendConsentEmail);

module.exports = router;