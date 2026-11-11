const express = require('express');
const router = express.Router();
const { handleOnboarding } = require('../controllers/userController');
const { protect } = require('../middleware/auth');

router.post('/onboarding', protect, handleOnboarding);

module.exports = router;
