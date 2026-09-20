const mongoose = require('mongoose');

const studentProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    personal: {
      firstName: {
        type: String,
        trim: true,
        required: true,
      },
      lastName: {
        type: String,
        trim: true,
        required: true,
      },
      phone: {
        type: String,
        trim: true,
        default: '',
      },
      dateOfBirth: {
        type: Date,
        required: true,
      },
    },

    academic: {
      university: {
        type: String,
        trim: true,
        required: true,
      },
      course: {
        type: String,
        trim: true,
        required: true,
      },
      academicLevel: {
        type: String,
        trim: true,
        required: true,
      },
      gwa: {
        type: Number,
        required: true,
      },
      gwaScale: {
        type: String,
        enum: ['1.00-5.00', '60-100'],
        required: true,
      },
    },

    financial: {
      incomeBracket: {
        type: String,
        enum: [
          'Below ₱10,000',
          '₱10,001 - ₱20,000',
          '₱20,001 - ₱40,000',
          'Above ₱40,000',
        ],
        required: true,
      },
      monthlyFamilyIncome: {
        type: Number,
        default: 0,
      },
    },

    location: {
      municipality: {
        type: String,
        trim: true,
        required: true,
      },
      province: {
        type: String,
        trim: true,
        required: true,
      },
      region: {
        type: String,
        trim: true,
        required: true,
      },
    },

    eligibilityFlags: {
      isIP: {
        type: Boolean,
        default: false,
      },
      isPWD: {
        type: Boolean,
        default: false,
      },
      isSoloParentDependent: {
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

    onboardingCompleted: {
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