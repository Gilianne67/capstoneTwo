const Scholarship = require('../models/Scholarship');
const { loadAliasIndex } = require('../utils/courseCanonical');
const { runMatchingWorker } = require('./matchingWorkerRunner');
const { searchScholarships } = require('./scholarshipSearchService');
const engine = require('./matchingEngine');
const { passesHardFilters } = engine;

const SEARCH_CANDIDATE_LIMIT = 1000;

const searchUnavailable = () => {
  const error = new Error(
    'Scholarship search is unavailable. Keyword results cannot be shown until search is restored.'
  );
  error.code = 'SEARCH_UNAVAILABLE';
  return error;
};

const isRankingOptions = (value) =>
  Boolean(value) &&
  typeof value === 'object' &&
  !(value instanceof Date);

const findOpenScholarships = (filter) => Scholarship.find(filter).lean();

const loadOpenScholarships = async (ids, findScholarships) => {
  if (Array.isArray(ids) && ids.length === 0) {
    return [];
  }

  const filter = {
    status: 'Open',
    isArchived: false
  };

  if (Array.isArray(ids)) {
    filter._id = { $in: ids };
  }

  return findScholarships(filter);
};

const loadKeywordCandidateIds = async (query, search) => {
  let result;

  try {
    result = await search({
      query,
      size: SEARCH_CANDIDATE_LIMIT
    });
  } catch {
    throw searchUnavailable();
  }

  const hits = Array.isArray(result && result.hits) ? result.hits : [];
  const total = Number(result && result.total);

  if (Number.isFinite(total) && total > hits.length) {
    throw searchUnavailable();
  }

  return hits
    .map((hit) => hit && hit.id)
    .filter((id) => id !== undefined && id !== null && String(id).trim() !== '');
};

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
  nowOrOptions = new Date()
) => {
  const options = isRankingOptions(nowOrOptions) ? nowOrOptions : {};
  const now = isRankingOptions(nowOrOptions)
    ? (options.now instanceof Date ? options.now : new Date())
    : new Date(nowOrOptions);
  const query = String(options.query || '').trim();
  const findScholarships = options.findScholarships || findOpenScholarships;
  const search = options.searchScholarships || searchScholarships;
  const readAliasIndex = options.loadAliasIndex || loadAliasIndex;
  const candidateIds = query
    ? await loadKeywordCandidateIds(query, search)
    : null;
  const [scholarships, aliasIndex] = await Promise.all([
    loadOpenScholarships(candidateIds, findScholarships),
    readAliasIndex()
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
