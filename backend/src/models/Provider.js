const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  institutionName: { type: String, required: true },
  institutionType: {
    type: String,
    enum: ['University', 'Non-Profit', 'Corporate', 'Government', 'Other'],
    default: 'Other',
  },
  website: { type: String },
  contactNumber: { type: String },
  address: {
    street: String,
    city: String,
    province: String,
    region: String,
  },
  representative: {
    name: String,
    title: String,
    workEmail: String,
  },
  // Verification Document Files
  verificationDocuments: [{
    documentType: { type: String, enum: ['SEC_DTI', 'CHED_DepEd', 'Authorization_Letter', 'Gov_ID'] },
    fileUrl: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now }
  }],
  verificationStatus: {
    type: String,
    enum: ['Pending', 'Submitted', 'Verified', 'Rejected'],
    default: 'Pending',
  },
  rejectionReason: { type: String },
  submittedAt: { type: Date },
  verifiedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Provider', providerSchema);