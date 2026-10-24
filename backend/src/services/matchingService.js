const Scholarship = require('../models/Scholarship');
const { loadAliasIndex } = require('../utils/courseCanonical');
const { runMatchingWorker } = require('./matchingWorkerRunner');
const engine = require('./matchingEngine');
const { passesHardFilters } = engine;

const getEligibleScholarships = async (
  studentProfile,
  now = new Date()
) => {
  const [scholarships, aliasIndex] = await Promise.all([
    Scholarship.find({
      status: 'Open',
      isArchived: false
    }).lean(),
    loadAliasIndex()
  ]);

  return scholarships.filter((scholarship) =>
    passesHardFilters(studentProfile, scholarship, aliasIndex, now)
  );
};

const getRankedScholarships = async (
  studentProfile,
  now = new Date()
) => {
  const [scholarships, aliasIndex] = await Promise.all([
    Scholarship.find({
      status: 'Open',
      isArchived: false
    }).lean(),
    loadAliasIndex()
  ]);

  return runMatchingWorker({
    studentProfile,
    scholarships,
    aliasIndex,
    now
  });
};

module.exports = {
  ...engine,
  getEligibleScholarships,
  getRankedScholarships
};
