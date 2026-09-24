const mongoose = require('mongoose');

const scholarshipSchema = new mongoose.Schema(
  {
    // ==========================================
    // 1. BASIC PROGRAM DETAILS
    // ==========================================
    title: {
      type: String,
      required: [true, 'Scholarship Program Title is required'],
      trim: true,
      index: true
    },
    grantValue: {
      type: String,
      required: [true, 'Grant / Financial Value is required'],
      trim: true
    },
    category: {
      type: [{
        type: String,
        enum: [
          'Merit-Based',
          'Need-Based',
          'STEM Specialized',
          'Agricultural',
          'Municipal / Local'
        ]
      }],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'At least one scholarship category must be selected'
      }
    },
    applicationDeadline: {
      type: Date,
      required: [true, 'Application Deadline is required']
    },
    externalUrl: {
      type: String,
      trim: true,
      default: ''
    },
    overview: {
      type: String,
      trim: true,
      default: ''
    },
    contactDetails: {
      type: String,
      trim: true,
      default: ''
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // References the provider account creating the listing
      required: false
    },

    // ==========================================
    // 2. HARD REQUIREMENTS (Gatekeeper Constraints)
    // ==========================================
    hardRequirements: {
      academicLevel: {
        type: [{
          type: String,
          enum: [
            'Senior High School',
            'College / Undergraduate',
            "Graduate Studies (Master's / PhD)"
          ]
        }],
        default: []
      },
      citizenship: {
        type: String,
        enum: ['Filipino Citizen Only', 'Open to Any Citizenship'],
        default: 'Filipino Citizen Only'
      },
      maxAllowableGwa: {
        type: Number,
        default: null
      },
      minGwaPercentage: {
        type: Number,
        default: null
      },
      annualIncomeCeiling: {
        type: Number,
        default: null
      },
      eligibleDegreePrograms: {
        type: [String],
        default: []
      },
      geographicBounds: {
        type: [String],
        default: []
      },
      customHardRequirements: {
        type: [String],
        default: []
      }
    },

    // ==========================================
    // 3. SPECIAL ELIGIBILITY TAGS (Dynamic Gatekeeping)
    // ==========================================
    specialEligibilityTags: {
      // System Standard Demographic Tags ("Require", "Prefer", or "None")
      fourPsBeneficiary: {
        type: String,
        enum: ['Require', 'Prefer', 'None'],
        default: 'None'
      },
      indigenousPeoples: {
        type: String,
        enum: ['Require', 'Prefer', 'None'],
        default: 'None'
      },
      pwd: {
        type: String,
        enum: ['Require', 'Prefer', 'None'],
        default: 'None'
      },
      soloParentDependent: {
        type: String,
        enum: ['Require', 'Prefer', 'None'],
        default: 'None'
      },
      orphanStatus: {
        type: String,
        enum: ['Require', 'Prefer', 'None'],
        default: 'None'
      },
      childOfFarmerFisherfolk: {
        type: String,
        enum: ['Require', 'Prefer', 'None'],
        default: 'None'
      },
      disasterAffectedFamily: {
        type: String,
        enum: ['Require', 'Prefer', 'None'],
        default: 'None'
      },
      workingStudent: {
        type: String,
        enum: ['Require', 'Prefer', 'None'],
        default: 'None'
      },
      femaleOnly: {
        type: String,
        enum: ['Require', 'Prefer', 'None'],
        default: 'None'
      },
      ofwDependent: {
        type: String,
        enum: ['Require', 'Prefer', 'None'],
        default: 'None'
      },

      // Custom Dynamic Lists added by provider
      customRequiredTags: {
        type: [String],
        default: []
      },
      customPreferredTags: {
        type: [String],
        default: []
      }
    },

    // ==========================================
    // 4. PROVIDER-DEFINED RANKING WEIGHT DISTRIBUTION
    // ==========================================
    rankingWeights: {
      wGpa: {
        type: Number,
        required: true,
        min: [20, 'Academic Score weight must be at least 20%'],
        max: [70, 'Academic Score weight cannot exceed 70%'],
        default: 40
      },
      wIncome: {
        type: Number,
        required: true,
        min: [20, 'Financial Need weight must be at least 20%'],
        max: [70, 'Financial Need weight cannot exceed 70%'],
        default: 40
      },
      wTags: {
        type: Number,
        required: true,
        min: [0, 'Preferred Tags weight must be at least 0%'],
        max: [30, 'Preferred Tags weight cannot exceed 30%'],
        default: 20
      }
    },

    // Metadata
    isPublished: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// ==========================================
// BACKEND VALIDATION: Enforce Weight Total = 100%
// ==========================================
scholarshipSchema.pre('save', function (next) {
  if (this.rankingWeights) {
    const { wGpa, wIncome, wTags } = this.rankingWeights;
    const total = (wGpa || 0) + (wIncome || 0) + (wTags || 0);

    if (total !== 100) {
      return next(
        new Error(`Ranking weights must sum up to exactly 100%. Current sum: ${total}%`)
      );
    }
  }
  next();
});

scholarshipSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  const weights = update.rankingWeights || (update.$set && update.$set.rankingWeights);

  if (weights) {
    const { wGpa, wIncome, wTags } = weights;
    if (wGpa !== undefined && wIncome !== undefined && wTags !== undefined) {
      const total = wGpa + wIncome + wTags;
      if (total !== 100) {
        return next(
          new Error(`Ranking weights must sum up to exactly 100%. Current sum: ${total}%`)
        );
      }
    }
  }
  next();
});

module.exports = mongoose.models.Scholarship || mongoose.model('Scholarship', scholarshipSchema);