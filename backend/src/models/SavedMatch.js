const mongoose = require('mongoose');

const savedMatchSchema = new mongoose.Schema({
  studentProfileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentProfile',
    required: true
  },
  scholarshipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scholarship',
    required: true
  },
  dateSaved: {
    type: Date,
    default: Date.now
  }
});

savedMatchSchema.index(
  { studentProfileId: 1, scholarshipId: 1 },
  { unique: true }
);

module.exports = mongoose.model('SavedMatch', savedMatchSchema);
