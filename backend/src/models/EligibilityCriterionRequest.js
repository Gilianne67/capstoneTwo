const mongoose = require('mongoose');

const CRITERION_TYPES = [
  'Required Eligibility',
  'Preferred Eligibility',
  'Hard Requirement',
];

const REQUEST_STATUSES = ['Pending', 'Approved', 'Rejected'];

/**
 * Provider request for an eligibility criterion the matching engine does not support yet.
 * Approval is an administrative decision only. This record is never read by matching.
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
      enum: CRITERION_TYPES,
      required: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    status: {
      type: String,
      enum: REQUEST_STATUSES,
      default: 'Pending',
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
module.exports.REQUEST_STATUSES = REQUEST_STATUSES;
