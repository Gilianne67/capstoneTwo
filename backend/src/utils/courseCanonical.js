const CourseAlias = require('../models/CourseAlias');
const {
  FILLER_WORDS,
  COURSE_CATALOG,
  normalizeCourseText,
  buildAliasIndex,
  resolveCanonical,
  toMatchIds,
  setsIntersect,
  CATALOG_INDEX
} = require('./courseCanonicalCore');

const loadAliasIndex = async () => {
  const index = buildAliasIndex(COURSE_CATALOG);

  const dbEntries = await CourseAlias.find().lean();

  if (Array.isArray(dbEntries) && dbEntries.length > 0) {
    const dbIndex = buildAliasIndex(dbEntries);
    dbIndex.forEach((canonicalId, key) => {
      index.set(key, canonicalId);
    });
  }

  return index;
};

module.exports = {
  FILLER_WORDS,
  COURSE_CATALOG,
  normalizeCourseText,
  buildAliasIndex,
  resolveCanonical,
  toMatchIds,
  setsIntersect,
  loadAliasIndex,
  CATALOG_INDEX
};
