const Scholarship = require('../models/Scholarship');
const { loadAliasIndex } = require('../utils/courseCanonical');
const { runMatchingWorker } = require('./matchingWorkerRunner');
const { searchScholarships } = require('./scholarshipSearchService');
const matchCache = require('./matchCache');
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

const publishedScholarshipFilter = () => ({
  status: 'Open',
  isArchived: false,
  adminRemovedAt: null
});

const loadOpenScholarships = async (ids, findScholarships) => {
  if (Array.isArray(ids) && ids.length === 0) {
    return [];
  }

  const filter = publishedScholarshipFilter();

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
    Scholarship.find(publishedScholarshipFilter()).lean(),
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
  const explicitNow = nowOrOptions instanceof Date || options.now instanceof Date;
  const lookup = await matchCache.readMatchCache({
    studentProfile,
    query,
    now,
    explicitNow,
    redisClient: options.matchCacheClient,
    notify: options.onMatchCache
  });

  if (lookup.hit) {
    return lookup.matches;
  }

  const candidateIds = query
    ? await loadKeywordCandidateIds(query, search)
    : null;
  const [scholarships, aliasIndex] = await Promise.all([
    loadOpenScholarships(candidateIds, findScholarships),
    readAliasIndex()
  ]);
  const matches = await runMatchingWorker({
    studentProfile,
    scholarships,
    aliasIndex,
    now
  });

  if (Array.isArray(matches)) {
    await matchCache.writeMatchCache(lookup, matches);
  }

  return matches;
};

module.exports = {
  ...engine,
  getEligibleScholarships,
  getRankedScholarships
};
