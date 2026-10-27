const mongoose = require('mongoose');  

const scholarshipSchema = new mongoose.Schema(
  {

    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
      index: true
    },


    name: {
      type: String,
      required: true,
      trim: true
    },

    scholarshipType: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      required: true,
      trim: true
    },

    benefits: {
      type: [String],
      default: []
    },

    grantValue: {
      type: String,
      required: true,
      trim: true
    },

    academicRequirement: {
      minimumGPA: {
        type: Number,
        min: 1,
        max: 100
      },

      gradingScale: {
        type: String,
        enum: ['1.00-5.00', '60-100', '1-5']
      }
    },

    academicRequirements: {
      type: [
        {
          _id: false,
          gradingScale: {
            type: String,
            enum: ['1.00-5.00', '60-100'],
            required: true
          },
          minimumGPA: {
            type: Number,
            required: true,
            min: 1,
            max: 100
          }
        }
      ],
      default: []
    },

    hardFilters: {
      academicLevel: {
        type: String,
        required: true,
        trim: true
      },

      courseProgram: {
        type: [String],
        default: []
      },

      geographicLocation: {
        scope: {
          type: String,
          enum: [
            'Nationwide',
            'Region',
            'Province',
            'Municipality'
          ],
          default: 'Nationwide',
          required: true
        },

        regions: {
          type: [String],
          default: []
        },

        provinces: {
          type: [String],
          default: []
        },

        municipalities: {
          type: [String],
          default: []
        }
      },

      citizenshipStatus: {
        type: String,
        required: true,
        trim: true
      }
    },

   
    incomeRequirement: {
      maxMonthlyIncome: {
        type: Number,
        default: null,
        min: 0
      },

      maximumIncome: {
        type: Number,
        default: null,
        min: 0
      }
    },

 
    specialTags: [
      {
        tagName: {
          type: String,
          required: true,
          trim: true
        },

        mode: {
          type: String,
          enum: ['Preferred', 'Exclusive'],
          required: true
        }
      }
    ],

    
    criteriaWeights: {
      gwaWeight: {
        type: Number,
        default: 0.40,
        min: 0.20,
        max: 0.70
      },

      incomeWeight: {
        type: Number,
        default: 0.40,
        min: 0.20,
        max: 0.70
      },

      tagsWeight: {
        type: Number,
        default: 0.20,
        min: 0,
        max: 0.30
      }
    },

    rankingMode: {
      type: String,
      required: true,
      default: 'Weighted'
    },


    deadline: {
      type: Date,
      required: true
    },

    applicationURL: {
      type: String,
      required: true,
      trim: true
    },

  
    status: {
      type: String,
      enum: ['Open', 'Closed'],
      default: 'Open',
      index: true
    },


    isArchived: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);




scholarshipSchema.pre('validate', function () {
  const hasNewRequirements =
    Array.isArray(this.academicRequirements) &&
    this.academicRequirements.length > 0;

  const hasLegacyRequirement =
    this.academicRequirement &&
    this.academicRequirement.minimumGPA != null &&
    Boolean(this.academicRequirement.gradingScale);

  if (!hasNewRequirements && !hasLegacyRequirement) {
    throw new Error(
      'At least one academic grading scale requirement is required.'
    );
  }

  const weights = this.criteriaWeights;

  if (!weights) {
    return;
  }

  const gwaWeight = weights.gwaWeight;
  const incomeWeight = weights.incomeWeight;
  const tagsWeight = weights.tagsWeight;
  const componentsAreFinite =
    typeof gwaWeight === 'number' && Number.isFinite(gwaWeight) &&
    typeof incomeWeight === 'number' && Number.isFinite(incomeWeight) &&
    typeof tagsWeight === 'number' && Number.isFinite(tagsWeight);

  if (!componentsAreFinite) {
    throw new Error(
      'GPA, income, and special eligibility weights must total 100%.'
    );
  }

  const total = gwaWeight + incomeWeight + tagsWeight;

  // Keep 0.0001. Exact equality rejects 0.7 + 0.2 + 0.1, the stored
  // form of the provider form's 70/20/10, because that sum is
  // 0.9999999999999999 in IEEE-754. The form itself uses !== 100 on
  // integer percentages.
  if (Math.abs(total - 1.0) > 0.0001) {
    throw new Error(
      'GPA, income, and special eligibility weights must total 100%.'
    );
  }
});


module.exports = mongoose.model('Scholarship', scholarshipSchema);