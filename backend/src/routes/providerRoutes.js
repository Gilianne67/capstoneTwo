const express = require('express');
const router = express.Router();
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const crypto = require('crypto');
const path = require('path');

// Middleware
const authMiddleware = require('../middleware/auth'); 

// Resolve auth functions cleanly
const protect = authMiddleware.protect || authMiddleware;
const authorize = authMiddleware.authorize || authMiddleware.restrictTo;

// Controllers
const {
  getProfile,
  updateProfile,
  getDashboard,
  handleOnboarding,
} = require('../controllers/providerController');

// -------------------------------------------------------------
// MongoDB GridFS Storage Engine Setup
// -------------------------------------------------------------
const mongoURI = process.env.MONGO_URI;

const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) return reject(err);

        const filename = buf.toString('hex') + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: 'uploads', // Saves to 'uploads.files' and 'uploads.chunks' in MongoDB
          metadata: {
            originalName: file.originalname,
            uploadedBy: req.user?.id || req.user?._id,
          },
        };
        resolve(fileInfo);
      });
    });
  },
});

const upload = multer({ storage });

// -------------------------------------------------------------
// Global Router Guards (All routes below require authenticated provider)
// -------------------------------------------------------------
router.use(protect);
if (typeof authorize === 'function') {
  router.use(authorize('provider'));
}

// -------------------------------------------------------------
// Routes
// -------------------------------------------------------------

// Onboarding route (accepts single file input 'verificationDoc' saved straight to MongoDB)
router.post('/onboarding', upload.single('verificationDoc'), handleOnboarding);

// Profile and Dashboard routes
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.get('/dashboard', getDashboard);

module.exports = router;