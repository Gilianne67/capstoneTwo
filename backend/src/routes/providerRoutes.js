const express = require('express');
const router = express.Router();
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const path = require('path');

// MongoDB URI from environment variables
const mongoURI = process.env.MONGO_URI || process.env.MONGODB_URI;

// Configure GridFS storage engine
const storage = new GridFsStorage({
  url: mongoURI,
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
  handleOnboarding,
} = require('../controllers/providerController');

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

module.exports = router;