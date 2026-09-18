const express = require('express');
const { verifyConsentToken, approveConsent } = require('../controllers/consentController');

const router = express.Router();

// GET /api/v1/consent/verify?token=...
router.get('/verify', verifyConsentToken);

// POST /api/v1/consent/approve
router.post('/approve', approveConsent);

module.exports = router;