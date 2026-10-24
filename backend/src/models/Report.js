const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    // The user (student/provider) who submitted the flag
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Report must be associated with a user.'],
    },

    // Flexible reference: target scholarship listing, post, or comment being reported
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scholarship', 
      required: false,
    },

    // Denormalized title/names for fast search/rendering
    listingTitle: {
      type: String,
      trim: true,
    },
    providerName: {
      type: String,
      trim: true,
    },

    // Category / Main reason for reporting
    category: {
      type: String,
      enum: [
        'Scam or Fraud',
        'Inaccurate Information',
        'Expired Listing',
        'Inappropriate Content',
        'Spam',
        'Other',
      ],
      default: 'Scam or Fraud',
    },

    // Detailed explanation provided by the reporter
    reason: {
      type: String,
      required: [true, 'Please provide a reason for reporting this content.'],
      trim: true,
      maxlength: [1000, 'Reason cannot exceed 1000 characters.'],
    },

    // Priority level for admin queue sorting
    severity: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
    },

    // Moderation status lifecycle
    status: {
      type: String,
      enum: ['Pending Review', 'Under Investigation', 'Resolved', 'Dismissed'],
      default: 'Pending Review',
    },

    // Action taken upon resolution
    resolution: {
      type: String,
      enum: ['NONE', 'DISMISS_REPORT', 'REMOVE_LISTING', 'WARN_USER', 'BAN_USER'],
      default: 'NONE',
    },

    // Admin notes (internal tracking)
    adminNotes: {
      type: String,
      trim: true,
    },

    // Admin user who processed the report
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    resolvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true, // Automatically manages createdAt (flaggedAt) and updatedAt
  }
);

// Indexes for fast admin queue filtering
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ listingId: 1 });
reportSchema.index({ reportedBy: 1 });

module.exports = mongoose.model('Report', reportSchema);