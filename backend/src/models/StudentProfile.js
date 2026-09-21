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
    // ONBOARDING INFORMATION
    // =========================

    dateOfBirth: {
      type: Date,
      required: true,
    },

    academicLevel: {
      type: String,
      enum: ['Senior High School', 'College', 'Graduate Studies'],
      required: true,
    },

    yearLevel: {
  type: String,
  enum: [
    'Grade 11',
    'Grade 12',
    '1st Year',
    '2nd Year',
    '3rd Year',
    '4th Year', 'Masteral', 'Doctoral'
  ],
  required: true
},

    course: {
      type: String,
      required: true,
      trim: true,
    },

    gwa: {
      type: Number,
      required: true,
    },

    gwaScale: {
      type: String,
      enum: ['1.00-5.00', '60-100'],
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
        'Above ₱131,484 / month'
      ],
      required: true
    },

    region: {
      type: String,
      required: true,
      trim: true,
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
      enum: ['Public', 'Private'],
      default: null,
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

    citizenship: {
      type: String,
      enum: ['Filipino', 'Non-Filipino'],
      default: 'Filipino',
    },

    // =========================
    // SPECIAL ELIGIBILITY
    // =========================

    specialEligibilityFlags: {
      isIndigenous: {
        type: Boolean,
        default: false,
      },

      isPWD: {
        type: Boolean,
        default: false,
      },

      isSoloParentChild: {
        type: Boolean,
        default: false,
      },

      isOrphan: {
        type: Boolean,
        default: false,
      },

      isFarmerFisherfolkChild: {
        type: Boolean,
        default: false,
      },

      isDisasterAffected: {
        type: Boolean,
        default: false,
      },

      isWorkingStudent: {
        type: Boolean,
        default: false,
      },

      is4PsBeneficiary: {
        type: Boolean,
        default: false,
      },
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
  }
);

module.exports =
  mongoose.models.StudentProfile ||
  mongoose.model('StudentProfile', studentProfileSchema);