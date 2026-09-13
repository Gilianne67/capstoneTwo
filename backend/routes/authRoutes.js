const express = require('express');
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// 🔍 DEBUG LOGS
console.log('--- ROUTE DEBUG ---');
console.log('register:', typeof register);
console.log('login:', typeof login);
console.log('getMe:', typeof getMe);
console.log('protect:', typeof protect);

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);

module.exports = router;