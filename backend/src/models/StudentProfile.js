
const mongoose = require('mongoose');

const studentProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    // =========================
    // STUDENT IDENTITY
    // =========================

    fullName: {
      type: String,
      trim: true,
      required: [true, 'Full name is required'],
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: [true, 'Email is required'],
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please provide a valid email address',
      ],
    },

    // =========================
    // ONBOARDING INFORMATION
    // =========================

    dateOfBirth: {
      type: Date,
    },

    academicLevel: {
      type: String,
      enum: ['Senior High School', 'College', 'Graduate Studies'],
    },

    yearLevel: {
      type: String,
      enum: [
        'Grade 11',
        'Grade 12',
        '1st Year',
        '2nd Year',
        '3rd Year',
        '4th Year',
        'Masteral',
        'Doctoral',
      ],
    },

    course: {
      type: String,
      trim: true,
      default: '',
    },

    gwa: {
      type: Number,
      default: null,
    },

    gwaScale: {
      type: String,
      enum: ['1.00-5.00', '60-100', null],
      default: null,
    },

    incomeBracket: {
      type: String,
      enum: [
        'Below ₱10,000 / month',
        '₱10,001 – ₱21,190 / month',
        '₱21,191 – ₱43,828 / month',
        '₱43,829 – ₱76,669 / month',
        '₱76,670 – ₱131,484 / month',
        'Above ₱131,484 / month',
        null,
      ],
      default: null,
    },

    region: {
      type: String,
      trim: true,
      default: '',
    },

    province: {
      type: String,
      trim: true,
      default: '',
    },

    municipalityCity: {
      type: String,
      trim: true,
      default: '',
    },

    // =========================
    // STUDENT PROFILE INFORMATION
    // =========================

    schoolName: {
      type: String,
      trim: true,
      default: '',
    },

    schoolType: {
      type: String,
      enum: ['Public', 'Private', null],
      default: null,
    },

    citizenship: {
      type: String,
      enum: ['Filipino', 'Non-Filipino'],
      default: 'Filipino',
    },

    // =========================
    // SPECIAL ELIGIBILITY
    // =========================

    specialEligibilityFlags: {
      isIndigenous: { type: Boolean, default: false },
      isPWD: { type: Boolean, default: false },
      isSoloParentChild: { type: Boolean, default: false },
      isFarmerFisherfolkChild: { type: Boolean, default: false },
      isWorkingStudent: { type: Boolean, default: false },
      isOFWChild: { type: Boolean, default: false },
      is4PsBeneficiary: { type: Boolean, default: false },
    },

    // =========================
    // MINOR STATUS
    // =========================

    isMinor: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'studentprofiles',
  }
);

module.exports =
  mongoose.models.StudentProfile ||
  mongoose.model('StudentProfile', studentProfileSchema);