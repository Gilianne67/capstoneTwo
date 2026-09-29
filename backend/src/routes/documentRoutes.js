const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const path = require('path');

// Import authentication middleware
const authMiddleware = require('../middleware/auth');
const protect = authMiddleware.protect || authMiddleware;

let gfsBucket;

// Helper to get or initialize GridFS bucket dynamically
const getBucket = () => {
  if (!gfsBucket && mongoose.connection.db) {
    gfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'uploads',
    });
  }
  return gfsBucket;
};

// Initialize GridFS bucket once MongoDB connection opens
mongoose.connection.once('open', () => {
  getBucket();
});

// Helper for inferring content-type if missing in GridFS metadata
const getMimeType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.pdf': return 'application/pdf';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.png': return 'image/png';
    default: return 'application/octet-stream';
  }
};

/**
 * GET /api/v1/documents/:filename
 * Protected route: Admins, Super Admins, or the original file uploader can stream/view the file
 */
router.get('/:filename', protect, async (req, res) => {
  try {
    const bucket = getBucket();

    if (!bucket) {
      return res.status(500).json({
        success: false,
        message: 'Database connection not initialized yet.',
      });
    }

    const { filename } = req.params;

    // 1. Locate file metadata in GridFS
    const files = await bucket.find({ filename }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found in database.',
      });
    }

    const file = files[0];

    // 2. Authorization Check: Admin / Super Admin OR the original uploader
    const currentUserId = req.user ? (req.user._id || req.user.id).toString() : null;
    const currentUserRole = req.user?.role;
    const fileUploaderId = file.metadata?.uploadedBy ? file.metadata.uploadedBy.toString() : null;

    const isAdmin = ['admin', 'super-admin', 'superadmin'].includes(currentUserRole);
    const isOwner = fileUploaderId ? fileUploaderId === currentUserId : true; // Fallback to allow logged-in user if missing

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to view this document.',
      });
    }

    // 3. Resolve content type
    const contentType = file.contentType || file.metadata?.mimetype || getMimeType(file.filename);

    // 4. Set response headers for inline browser previewing
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', file.length);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${file.metadata?.originalName || file.filename}"`
    );

    // 5. Stream file directly from MongoDB GridFS
    const readStream = bucket.openDownloadStreamByName(filename);

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