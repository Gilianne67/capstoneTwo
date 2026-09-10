const mongoose = require('mongoose');

const courseAliasSchema = new mongoose.Schema({
  canonicalName: {
    type: String,
    required: true,
    unique: true
  },
  aliases: {
    type: [String],
    default: []
  }
});

module.exports = mongoose.model('CourseAlias', courseAliasSchema);