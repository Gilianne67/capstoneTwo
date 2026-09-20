const express = require('express');
const router = express.Router();
const {
  getPendingProviders,
  getProviderById,
  reviewProviderApplication,
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

// GET /api/v1/admin/providers/pending - Fetch all applications pending review
router.get('/providers/pending', getPendingProviders);

// GET /api/v1/admin/providers/:providerId - Fetch details for a specific provider
router.get('/providers/:providerId', getProviderById);

// PUT /api/v1/admin/providers/:providerId/review - Approve or Reject an application
router.put('/providers/:providerId/review', reviewProviderApplication);

module.exports = router;