const express = require('express');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const { getMatches } = require('../controllers/matchingController');

router.get(
  '/',
  protect,
  authorize('student'),
  getMatches
);

module.exports = router;