const mongoose = require('mongoose');
const { recordAuditLog } = require('./auditController');

let gfsBucket;

// Initialize GridFS bucket once MongoDB connection is open
mongoose.connection.once('open', () => {
  gfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads', // Must match bucketName in your GridFsStorage configuration
  });
});

/**
 * Stream file from MongoDB GridFS by Filename
 * GET /api/v1/documents/:filename
 */
exports.getFileByFilename = async (req, res) => {
  try {
    const { filename } = req.params;

    if (!gfsBucket) {
      return res.status(500).json({
        success: false,
        message: 'GridFS bucket not initialized yet.',
      });
    }

    // Find the file metadata in uploads.files
    const files = await gfsBucket.find({ filename }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found.',
      });
    }

    const file = files[0];

    // 📝 AUDIT LOG: Document Accessed by Filename
    const actorName = req.user 
      ? `${req.user.firstName || req.user.name || ''} ${req.user.lastName || ''}`.trim() || req.user.email 
      : 'User / Visitor';
    const actorRole = req.user ? req.user.role : 'Guest';

    await recordAuditLog({
      actor: actorName,
      role: actorRole,
      action: 'DOCUMENT_ACCESS',
      details: `User accessed document (${file.filename}) [ID: ${file._id}]`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      severity: 'Info'
    });

    // Set proper response headers
    res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);

    // Stream the file directly to the client response
    const downloadStream = gfsBucket.openDownloadStreamByName(filename);

    downloadStream.on('error', (error) => {
      console.error('❌ GridFS Stream Error:', error);
      if (!res.headersSent) {
        return res.status(404).json({
          success: false,
          message: 'Error streaming file.',
        });
      }
    });

    downloadStream.pipe(res);
  } catch (error) {
    console.error('❌ Get File Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching document.',
    });
  }
};

/**
 * Stream file from MongoDB GridFS by ObjectId
 * GET /api/v1/documents/id/:id
 */
exports.getFileById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Document ID format.',
      });
    }

    if (!gfsBucket) {
      return res.status(500).json({
        success: false,
        message: 'GridFS bucket not initialized yet.',
      });
    }

    const _id = new mongoose.Types.ObjectId(id);
    const files = await gfsBucket.find({ _id }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found.',
      });
    }

    const file = files[0];

    // 📝 AUDIT LOG: Document Accessed by ID
    const actorName = req.user 
      ? `${req.user.firstName || req.user.name || ''} ${req.user.lastName || ''}`.trim() || req.user.email 
      : 'User / Visitor';
    const actorRole = req.user ? req.user.role : 'Guest';

    await recordAuditLog({
      actor: actorName,
      role: actorRole,
      action: 'DOCUMENT_ACCESS',
      details: `User accessed document (${file.filename}) [ID: ${file._id}]`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      severity: 'Info'
    });

    res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);

    const downloadStream = gfsBucket.openDownloadStream(_id);

    downloadStream.on('error', (error) => {
      console.error('❌ GridFS Stream Error:', error);
      if (!res.headersSent) {
        return res.status(404).json({
          success: false,
          message: 'Error streaming file.',
        });
      }
    });

    downloadStream.pipe(res);
  } catch (error) {
    console.error('❌ Get File By ID Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching document.',
    });
  }
};