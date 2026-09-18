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

    academicRequirement: {
      minimumGPA: {
        type: Number,
        required: true,
        min: 1,
        max: 100
      },

      gradingScale: {
        type: String,
        enum: ['1-5', '60-100'],
        required: true
      }
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
  const weights = this.criteriaWeights;

  if (!weights) {
    return;
  }

  const total =
    weights.gwaWeight +
    weights.incomeWeight +
    weights.tagsWeight;

  if (Math.abs(total - 1.0) > 0.0001) {
    throw new Error(
      'GPA, income, and special eligibility weights must total 100%.'
    );
  }
});


module.exports = mongoose.model('Scholarship', scholarshipSchema);