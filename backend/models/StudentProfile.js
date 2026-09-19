const mongoose = require('mongoose');

const studentProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  academicLevel: {
    type: String,
    enum: ['Senior High School', 'College', 'Graduate Studies'],
    required: true
  },
  course: {
    type: String,
    required: true
  },
  gwa: {
    type: Number,
    required: true
  },
  gwaScale: {
    type: String,
    enum: ['1.00-5.00', '60-100'],
    required: true
  },
  schoolName: {
    type: String,
    required: true
  },
  schoolType: {
    type: String,
    enum: ['Public', 'Private'],
    required: true
  },
  incomeBracket: {
    type: String,
    enum: ['Category A', 'Category B', 'Category C', 'Category D'],
    required: true
  },
  region: {
    type: String,
    required: true
  },
  province: {
    type: String,
    required: true
  },
  municipalityCity: {
    type: String,
    required: true
  },
  citizenship: {
    type: String,
    enum: ['Filipino', 'Non-Filipino'],
    required: true
  },
  specialEligibilityFlags: {
    isIndigenous: { type: Boolean, default: false },
    isPWD: { type: Boolean, default: false },
    isSoloParentChild: { type: Boolean, default: false },
    isOrphan: { type: Boolean, default: false },
    isFarmerFisherfolkChild: { type: Boolean, default: false },
    isDisasterAffected: { type: Boolean, default: false },
    isWorkingStudent: { type: Boolean, default: false },
    is4PsBeneficiary: { type: Boolean, default: false }
  },
  isMinor: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.StudentProfile || mongoose.model('StudentProfile', studentProfileSchema);