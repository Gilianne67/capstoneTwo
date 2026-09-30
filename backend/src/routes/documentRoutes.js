const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const path = require('path');
const Provider = require('../models/Provider');

// Import authentication middleware
const authMiddleware = require('../middleware/auth');
const protect = authMiddleware.protect || authMiddleware;

const ADMIN_ROLES = new Set(['admin', 'superadmin', 'super_admin', 'super-admin']);

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const userCanAccessFile = async (user, file) => {
  if (!user || !file) return false;

  const role = String(user.role || '').toLowerCase();
  if (ADMIN_ROLES.has(role)) return true;

  const currentUserId = String(user._id || user.id || '');
  const uploaderId = file.metadata?.uploadedBy ? String(file.metadata.uploadedBy) : '';

  if (uploaderId && currentUserId && uploaderId === currentUserId) {
    return true;
  }

  if (!currentUserId || !file.filename) return false;

  const owner = await Provider.findOne({
    userId: user._id || user.id,
    verificationDocuments: {
      $elemMatch: {
        fileUrl: { $regex: escapeRegex(file.filename) },
      },
    },
  }).select('_id');

  return Boolean(owner);
};

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

    const allowed = await userCanAccessFile(req.user, file);
    if (!allowed) {
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