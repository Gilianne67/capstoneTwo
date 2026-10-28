const express = require('express');
const router = express.Router();
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const mongoose = require('mongoose');
const path = require('path');

// multer-gridfs-storage 6.x opens its own client when given a url, and it
// throws immediately if that url is missing. This module is loaded before
// server.js calls mongoose.connect(), so wait for the shared connection and
// hand that database to GridFS. Uploads are buffered until it opens.
const connectedDatabase = () => {
  const connection = mongoose.connection;

  if (connection.readyState === 1 && connection.db) {
    return Promise.resolve(connection);
  }

  return new Promise((resolve, reject) => {
    const onOpen = () => {
      connection.removeListener('error', onError);
      if (!connection.db) {
        reject(new Error('MongoDB connection opened without a database handle.'));
        return;
      }
      resolve(connection);
    };

    const onError = (error) => {
      connection.removeListener('open', onOpen);
      reject(error);
    };

    connection.once('open', onOpen);
    connection.once('error', onError);
  });
};

// Configure GridFS storage engine
const storage = new GridFsStorage({
  db: connectedDatabase(),
  file: (req, file) => {
    return new Promise((resolve) => {
      const filename = `doc-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
      const fileInfo = {
        filename: filename,
        bucketName: 'uploads',
        metadata: {
          uploadedBy: req.user ? (req.user._id || req.user.id) : null,
          originalName: file.originalname,
          mimetype: file.mimetype
        },
      };
      resolve(fileInfo);
    });
  },
});

// File validation filter (.pdf, .png, .jpg, .jpeg)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeType = allowedTypes.test(file.mimetype);

  if (extName && mimeType) {
    return cb(null, true);
  } else {
    cb(new Error('Only .pdf, .jpg, .jpeg, and .png files are allowed!'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter,
});

// Middleware
const authMiddleware = require('../middleware/auth'); 
const protect = authMiddleware.protect || authMiddleware;
const authorize = authMiddleware.authorize || authMiddleware.restrictTo;

// Controllers
const {
  getProfile,
  updateProfile,
  getDashboard,
  getAnalytics,
  handleOnboarding,
} = require('../controllers/providerController');

const {
  getMyEligibilityCriterionRequests,
  getMyEligibilityCriterionRequest,
  createEligibilityCriterionRequest,
} = require('../controllers/eligibilityCriterionRequestController');

const {
  getProviderNotifications,
  getProviderUnreadCount,
  markProviderNotificationRead,
} = require('../controllers/providerNotificationController');

// Global Router Authentication Guard
router.use(protect);

if (typeof authorize === 'function') {
  router.use(authorize('provider'));
}

// Routes
// Note: 'protect' runs globally via router.use(protect) ABOVE, ensuring req.user is ready for upload.single
router.post('/onboarding', upload.single('verificationDoc'), handleOnboarding);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.get('/dashboard', getDashboard);
router.get('/analytics', getAnalytics);
router.get('/notifications', getProviderNotifications);
router.get('/notifications/unread-count', getProviderUnreadCount);
router.patch('/notifications/:id/read', markProviderNotificationRead);

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

router.get(
  '/eligibility-criterion-requests/:id',
  protect,
  authorize('provider'),
  getMyEligibilityCriterionRequest
);

module.exports = router;