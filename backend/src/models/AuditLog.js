const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: String,
      required: [true, 'Actor name or ID is required'],
      trim: true,
      index: true
    },
    // Optional stable account id. Older rows omit it and stay valid.
    actorId: {
      type: String,
      trim: true,
      maxlength: 64,
    },
    role: {
      type: String,
      enum: ['Admin', 'Superadmin', 'Provider', 'Student', 'System'],
      default: 'System',
      index: true
    },
    action: {
      type: String,
      required: [true, 'Audit action code is required'],
      trim: true,
      index: true // e.g. 'USER_LOGIN', 'EXPORT_LOGS', 'DOCUMENT_VIEW'
    },
    details: {
      type: String,
      required: [true, 'Audit details are required'],
      trim: true
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1'
    },
    severity: {
      type: String,
      enum: ['Info', 'Warning', 'Critical'],
      default: 'Info',
      index: true
    }
  },
  {
    timestamps: true
  }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);