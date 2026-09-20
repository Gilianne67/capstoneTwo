const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// Import your authentication middleware
const authMiddleware = require('../middleware/auth');
const protect = authMiddleware.protect || authMiddleware;

let gfsBucket;

// Initialize GridFS bucket once MongoDB connection opens
mongoose.connection.once('open', () => {
  gfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads',
  });
});

/**
 * GET /api/v1/documents/:filename
 * Protected route: Only Admins or the file owner can stream/view the file
 */
router.get('/:filename', protect, async (req, res) => {
  try {
    if (!gfsBucket) {
      return res.status(500).json({
        success: false,
        message: 'Database connection not initialized yet.',
      });
    }

    const { filename } = req.params;

    // 1. Locate file metadata in GridFS
    const files = await gfsBucket.find({ filename }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found in database.',
      });
    }

    const file = files[0];

    // 2. Authorization Check: Must be 'admin' OR the original uploader
    const currentUserId = req.user.id || req.user._id;
    const currentUserRole = req.user.role;
    const fileUploaderId = file.metadata?.uploadedBy;

    const isAdmin = currentUserRole === 'admin';
    const isOwner = fileUploaderId && fileUploaderId.toString() === currentUserId.toString();

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to view this document.',
      });
    }

    // 3. Set response headers for inline viewing or streaming
    res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
    res.setHeader('Content-Length', file.length);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${file.metadata?.originalName || file.filename}"`
    );

    // 4. Stream file directly from MongoDB GridFS
    const readStream = gfsBucket.openDownloadStreamByName(filename);

    readStream.on('error', (err) => {
      console.error('❌ GridFS Stream Error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Error streaming document.' });
      }
    });

    readStream.pipe(res);
  } catch (error) {
    console.error('❌ Get Document Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error retrieving file.',
    });
  }
});

module.exports = router;