const mongoose = require('mongoose');

const CRITERION_TYPES = [
  'Preferred Tag',
  'Exclusive Tag',
  'Hard Eligibility Tag',
];

// Older submissions used these labels. They remain valid so existing
// records can still be reviewed. New submissions store the canonical names.
const LEGACY_CRITERION_TYPES = [
  'Preferred Eligibility',
  'Required Eligibility',
  'Hard Requirement',
];

const REVIEW_STATUSES = ['Pending', 'Approved', 'Rejected'];
const FULFILLMENT_STATUSES = ['Pending', 'In Progress', 'Done'];

/**
 * Provider request for an eligibility criterion the matching engine does not support yet.
 * Review status and fulfillment status are administrative only.
 * This record is never read by scholarship matching.
 */
const eligibilityCriterionRequestSchema = new mongoose.Schema(
  {
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
      index: true,
    },

    criterionName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    criterionType: {
      type: String,
      enum: [...CRITERION_TYPES, ...LEGACY_CRITERION_TYPES],
      required: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    // Administrator review decision. A new request starts Pending.
    status: {
      type: String,
      enum: REVIEW_STATUSES,
      default: 'Pending',
    },

    // Implementation progress after approval. Approval leaves this Pending.
    fulfillmentStatus: {
      type: String,
      enum: FULFILLMENT_STATUSES,
      default: 'Pending',
    },

    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    reviewedAt: {
      type: Date,
    },

    // Set only after the completion email is accepted. Cleared if sending fails.
    completionEmailSentAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  'EligibilityCriterionRequest',
  eligibilityCriterionRequestSchema
);

module.exports.CRITERION_TYPES = CRITERION_TYPES;
module.exports.LEGACY_CRITERION_TYPES = LEGACY_CRITERION_TYPES;
module.exports.REVIEW_STATUSES = REVIEW_STATUSES;
module.exports.FULFILLMENT_STATUSES = FULFILLMENT_STATUSES;
module.exports.REQUEST_STATUSES = REVIEW_STATUSES;
