// routes/authRoutes.js
const express = require('express');
const { register, login, getMe, logout, forgotPassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');


const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/logout', protect, logout);
router.post('/forgotpassword', forgotPassword);

// Parent Consent / Onboarding routes
// router.post('/user/onboarding', protect, onboardingHandler);
// router.get('/consent/verify', consentVerifyHandler);
// router.post('/consent/approve', consentApproveHandler);

module.exports = router;