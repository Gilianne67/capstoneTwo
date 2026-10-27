const mongoose = require('mongoose');

const courseAliasSchema = new mongoose.Schema(
  {
    canonicalId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    canonicalName: {
      type: String,
      required: true,
      trim: true,
      unique: false
    },

    academicLevel: {
      type: String,
      enum: ['Senior High School', 'College', 'Graduate Studies'],
      required: true,
      index: true
    },

    kind: {
      type: String,
      enum: ['strand', 'program'],
      required: true
    },

    aliases: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

courseAliasSchema.index({ academicLevel: 1, canonicalName: 1 });

const invalidateCourseAliasCache = () => {
  const matchCache = require('../services/matchCache');
  return matchCache.invalidateMatchCache();
};

[
  'save',
  'insertMany',
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete'
].forEach((hook) => {
  courseAliasSchema.post(hook, function invalidateAliasMatchCache() {
    return invalidateCourseAliasCache();
  });
});

module.exports =
  mongoose.models.CourseAlias ||
  mongoose.model('CourseAlias', courseAliasSchema);
