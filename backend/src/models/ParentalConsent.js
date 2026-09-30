const mongoose = require('mongoose');

const ParentalConsentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    studentName: {
      type: String,
      required: [true, 'Student name is required']
    },
    age: {
      type: Number,
      required: [true, 'Student age is required']
    },
    guardianName: {
      type: String,
      required: [true, 'Guardian name is required']
    },
    guardianEmail: {
      type: String,
      required: [true, 'Guardian email is required'],
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address'
      ]
    },
    guardianPhone: {
      type: String
    },
    relationship: {
      type: String,
      default: 'Parent/Legal Guardian'
    },
    documentUrl: {
      type: String,
      default: '' // Made optional during initial registration if uploaded later
    },
    status: {
      type: String,
      enum: ['Pending', 'Verified', 'Rejected'],
      default: 'Pending'
    },
    verifiedAt: {
      type: Date
    },
    rejectionReason: {
      type: String
    }
  },
  {
    timestamps: true,
    collection: 'parentalconsents'
  }
);

module.exports = mongoose.model('ParentalConsent', ParentalConsentSchema);