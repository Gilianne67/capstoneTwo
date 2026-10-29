const mongoose = require('mongoose');

/**
 * Structured scholarship-search filters chosen by a student.
 * Keyword text and student identifiers are not stored.
 * Documents expire after 730 days.
 */
const categoryDemandEventSchema = new mongoose.Schema(
  {
    dimension: {
      type: String,
      enum: ['academicLevel', 'region', 'eligibilityTag'],
      required: true,
      index: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

categoryDemandEventSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 730 }
);
categoryDemandEventSchema.index({ dimension: 1, value: 1, createdAt: 1 });

module.exports =
  mongoose.models.CategoryDemandEvent ||
  mongoose.model('CategoryDemandEvent', categoryDemandEventSchema);
