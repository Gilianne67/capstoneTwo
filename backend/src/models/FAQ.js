const mongoose = require('mongoose');

const FAQSchema = new mongoose.Schema(
  {
    targetRole: {
      type: String,
      enum: ['student', 'provider', 'admin', 'all'],
      default: 'all',
      required: true,
    },
    category: {
      type: String,
      required: [true, 'Please specify a category'],
      trim: true,
    },
    question: {
      type: String,
      required: [true, 'Please provide a question'],
      trim: true,
    },
    answer: {
      type: String,
      required: [true, 'Please provide an answer'],
      trim: true,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.FAQ || mongoose.model('FAQ', FAQSchema);