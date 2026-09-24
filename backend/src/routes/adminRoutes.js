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
} = require('../controllers/adminController');

// Import your auth middleware functions
const authMiddleware = require('../middleware/auth');

// Support both destructured export or default export pattern
const protect = authMiddleware.protect || authMiddleware;
const authorize = authMiddleware.authorize || authMiddleware.authorizeRoles || authMiddleware.restrictTo;

// Protect all routes below and restrict access to superadmin/admin roles
if (protect) router.use(protect);

if (typeof authorize === 'function') {
  router.use(authorize('superadmin', 'admin', 'super_admin'));
} else {
  // Fallback inline middleware if authorize function name differs in auth.js
  router.use((req, res, next) => {
    const allowedRoles = ['superadmin', 'admin', 'super_admin'];
    if (req.user && allowedRoles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({ success: false, error: 'Not authorized to access this route' });
  });
}

// ================================
// DASHBOARD & QUEUE ACTION ROUTES
// ================================

// GET /api/v1/admin/dashboard - Fetch metrics and top 10 queue items
router.get('/dashboard', getAdminDashboard);

// GET /api/v1/admin/verifications - Fetch all verifications queue items
router.get('/verifications', getVerifications);

// PATCH /api/v1/admin/verifications/:id/status - Approve/Reject verification
router.patch('/verifications/:id/status', updateVerificationQueueStatus);

// PATCH /api/v1/admin/providers/:id/verification - Verify/Reject provider from dashboard queue
router.patch('/providers/:id/verification', updateProviderVerification);

// PATCH /api/v1/admin/scholarships/:id/status - Approve/Reject scholarship from dashboard queue
router.patch('/scholarships/:id/status', updateScholarshipStatus);

// PATCH /api/v1/admin/parental-consent/:id/status - Verify/Reject parental consent from dashboard queue
router.patch('/parental-consent/:id/status', updateConsentStatus);


// ================================
// PROVIDER REVIEW & DETAIL ROUTES
// ================================

// GET /api/v1/admin/providers/pending - Fetch all applications pending review
router.get('/providers/pending', getPendingProviders);

// GET /api/v1/admin/providers/:providerId - Fetch details for a specific provider
router.get('/providers/:providerId', getProviderById);

// PUT /api/v1/admin/providers/:providerId/review - Approve or Reject an application
router.put('/providers/:providerId/review', reviewProviderApplication);

module.exports = router;