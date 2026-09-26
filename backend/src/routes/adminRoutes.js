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

// Import auth middleware functions
const authMiddleware = require('../middleware/auth');

const protect = authMiddleware.protect || authMiddleware;

// 1. Authenticate user session
if (protect) router.use(protect);

// 2. Strict & Safe Role Authorization
router.use((req, res, next) => {
  const allowedRoles = ['superadmin', 'admin', 'super_admin'];

  if (!req.user || !req.user.role) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  // Case-insensitive role comparison
  const userRole = String(req.user.role).toLowerCase();

  if (allowedRoles.includes(userRole)) {
    return next();
  }

  return res.status(403).json({ success: false, error: 'Not authorized to access this route' });
});

// ================================
// DASHBOARD & QUEUE ACTION ROUTES
// ================================

// GET /api/v1/admin/dashboard - Fetch metrics and top 10 queue items
router.get('/dashboard', getAdminDashboard);

// GET /api/v1/admin/verifications - Fetch all verifications queue items
router.get('/verifications', getVerifications);
router.get('/verification-queue', getVerifications); // Alias for frontend routing alignment

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

// STATIC ROUTE FIRST: Fetch all applications pending review
router.get('/providers/pending', getPendingProviders);

// PARAMETERIZED ROUTES SECOND: Fetch/Update specific provider by ID
router.get('/providers/:providerId', getProviderById);
router.put('/providers/:providerId/review', reviewProviderApplication);

module.exports = router;