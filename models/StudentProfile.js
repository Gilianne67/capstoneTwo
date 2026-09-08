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
  gwa: {
    type: Number,
    required: true
  },
  gwaScale: {
    type: String,
    enum: ['1.00-5.00', '60-100'],
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
  course: {
    type: String,
    required: true
  },
  isMinor: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('StudentProfile', studentProfileSchema);