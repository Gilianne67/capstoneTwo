const express = require('express');

const {
  getProfile,
  updateProfile,
   getDashboard,
} = require('../controllers/providerController');

const {
  getMyEligibilityCriterionRequests,
  createEligibilityCriterionRequest,
} = require('../controllers/eligibilityCriterionRequestController');

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All provider routes require authentication and provider role
router.get('/profile', protect, authorize('provider'), getProfile);
router.put('/profile', protect, authorize('provider'), updateProfile);

router.get(
  '/dashboard',
  protect,
  authorize('provider'),
  getDashboard
);

router.get(
  '/eligibility-criterion-requests',
  protect,
  authorize('provider'),
  getMyEligibilityCriterionRequests
);

router.post(
  '/eligibility-criterion-requests',
  protect,
  authorize('provider'),
  createEligibilityCriterionRequest
);

module.exports = router;