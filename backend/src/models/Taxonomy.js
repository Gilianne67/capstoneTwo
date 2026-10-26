const mongoose = require('mongoose');

const taxonomySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Canonical tag name is required'],
      trim: true,
      unique: true,
      index: true
    },
    category: {
      type: String,
      required: [true, 'Taxonomy category is required'],
      enum: {
        values: ['Field of Study', 'Education Level', 'Demographic', 'Award Type'],
        message: '{VALUE} is not a valid taxonomy category'
      },
      index: true
    },
    aliases: [
      {
        type: String,
        trim: true,
        lowercase: true
      }
    ],
    usageCount: {
      type: Number,
      default: 0,
      min: 0
    },
    isSystem: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

taxonomySchema.index({ name: 'text', aliases: 'text' });

module.exports = mongoose.model('Taxonomy', taxonomySchema);