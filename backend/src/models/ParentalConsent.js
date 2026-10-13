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
      default: 'Student'
    },
    age: {
      type: Number,
      default: 17
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
      default: 'PENDING_TOKEN_VERIFICATION'
    },
    consentToken: {
      type: String
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'Pending', 'Verified', 'Rejected'],
      default: 'pending'
    },
    approvedAt: {
      type: Date
    },
    verifiedAt: {
      type: Date
    },
    rejectionReason: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('ParentalConsent', ParentalConsentSchema);