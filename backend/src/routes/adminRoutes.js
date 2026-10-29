const express = require('express');
const router = express.Router();
const {
  getAdminDashboard,
  updateProviderVerification,
  updateScholarshipStatus,
  updateConsentStatus,
  getPendingProviders,
  getProviderById,
  reviewProviderApplication,
  getVerifications,
  updateVerificationQueueStatus,
  updateUserAccountStatus,
  getAdminUsers,
  getSystemConfig,
  updateSystemConfig,
  inviteAdmin,
} = require('../controllers/adminController');
const {
  getEligibilityCriterionRequests,
  reviewEligibilityCriterionRequest,
  updateEligibilityCriterionFulfillment,
} = require('../controllers/eligibilityCriterionRequestController');
const { getAdminScholarships } = require('../controllers/adminScholarshipController');
const {
  getOverview,
  getRegistrations,
  getScholarships: getScholarshipAnalytics,
  getCategoryDemand,
  getStudentInsights,
  getProviderInsights,
  exportReport,
} = require('../controllers/adminAnalyticsController');

// Import auth middleware functions safely
const authMiddleware = require('../middleware/auth');
const protect = authMiddleware.protect || authMiddleware;
const canonicalRole = authMiddleware.canonicalRole || ((role) => String(role || '').toLowerCase());

// 1. Authenticate user session for all routes on this router
if (protect) router.use(protect);

// 2. Strict & Safe Role Authorization (Covers all endpoints below)
router.use((req, res, next) => {
  const allowedRoles = ['superadmin', 'admin'];

  if (!req.user || !req.user.role) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const userRole = canonicalRole(req.user.role);

  if (allowedRoles.includes(userRole)) {
    return next();
  }

  return res.status(403).json({ success: false, error: 'Not authorized to access this route' });
});

// ================================
// DASHBOARD & QUEUE ACTION ROUTES
// ================================

router.get('/dashboard', getAdminDashboard);
router.get('/analytics/overview', getOverview);
router.get('/analytics/registrations', getRegistrations);
router.get('/analytics/scholarships', getScholarshipAnalytics);
router.get('/analytics/category-demand', getCategoryDemand);
router.get('/analytics/student-insights', getStudentInsights);
router.get('/analytics/provider-insights', getProviderInsights);
router.get('/analytics/export', exportReport);
router.get('/verifications', getVerifications);
router.get('/verification-queue', getVerifications); // Alias

router.patch('/verifications/:id/status', updateVerificationQueueStatus);
router.patch('/providers/:id/verification', updateProviderVerification);

router.get('/eligibility-criterion-requests', getEligibilityCriterionRequests);
router.patch(
  '/eligibility-criterion-requests/:id/decision',
  reviewEligibilityCriterionRequest
);
router.patch(
  '/eligibility-criterion-requests/:id/fulfillment',
  updateEligibilityCriterionFulfillment
);
router.get('/scholarships', getAdminScholarships);
router.patch('/scholarships/:id/status', updateScholarshipStatus);
router.patch('/parental-consent/:id/status', updateConsentStatus);

// GET /api/v1/admin/users - Paginated directory. Search name/email and filter by role.
router.get('/users', getAdminUsers);

// PATCH /api/v1/admin/users/:id/status - Change account status; suspension revokes tracked sessions
router.patch('/users/:id/status', updateUserAccountStatus);

// ================================
// PROVIDER REVIEW & DETAIL ROUTES
// ================================

router.get('/providers/pending', getPendingProviders);
router.get('/providers/:providerId', getProviderById);
router.put('/providers/:providerId/review', reviewProviderApplication);

// ================================
// SYSTEM CONFIGURATION & ADMIN PROVISIONING
// ================================

router.route('/config')
  .get(getSystemConfig)
  .put(updateSystemConfig);
  
router.post('/invite', inviteAdmin);

module.exports = router;
