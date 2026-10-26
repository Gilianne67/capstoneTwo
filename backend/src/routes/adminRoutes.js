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
  getSystemConfig,
  updateSystemConfig,
  inviteAdmin,
} = require('../controllers/adminController');

// Import auth middleware functions safely
const authMiddleware = require('../middleware/auth');
const protect = authMiddleware.protect || authMiddleware;

// 1. Authenticate user session for all routes on this router
if (protect) router.use(protect);

// 2. Strict & Safe Role Authorization (Covers all endpoints below)
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

router.get('/dashboard', getAdminDashboard);
router.get('/verifications', getVerifications);
router.get('/verification-queue', getVerifications); // Alias

router.patch('/verifications/:id/status', updateVerificationQueueStatus);
router.patch('/providers/:id/verification', updateProviderVerification);
router.patch('/scholarships/:id/status', updateScholarshipStatus);
router.patch('/parental-consent/:id/status', updateConsentStatus);

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