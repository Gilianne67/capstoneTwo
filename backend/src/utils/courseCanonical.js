const CourseAlias = require('../models/CourseAlias');
const {
  FILLER_WORDS,
  COURSE_CATALOG,
  expandCourseAliases,
  normalizeCourseText,
  collectAliasClaims,
  buildAliasIndex,
  mergeAliasIndex,
  resolveCanonical,
  toMatchIds,
  setsIntersect,
  CATALOG_INDEX
} = require('./courseCanonicalCore');

const loadAliasIndex = async () => {
  const index = buildAliasIndex(COURSE_CATALOG);
  const dbEntries = await CourseAlias.find().lean();

  if (!Array.isArray(dbEntries) || dbEntries.length === 0) {
    return index;
  }

  return mergeAliasIndex(index, buildAliasIndex(dbEntries));
};

module.exports = {
  FILLER_WORDS,
  COURSE_CATALOG,
  expandCourseAliases,
  normalizeCourseText,
  collectAliasClaims,
  buildAliasIndex,
  mergeAliasIndex,
  resolveCanonical,
  toMatchIds,
  setsIntersect,
  loadAliasIndex,
  CATALOG_INDEX
};
