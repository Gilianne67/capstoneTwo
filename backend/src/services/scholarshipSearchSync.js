const {
  isElasticsearchEnabled,
  sanitizeErrorMessage
} = require('../config/elasticsearch');
const { indexScholarship } = require('./scholarshipSearchService');

const scholarshipId = (scholarship) => {
  const id = scholarship && (scholarship._id || scholarship.id);
  return id === undefined || id === null || String(id).trim() === ''
    ? 'unknown'
    : String(id);
};

/**
 * Indexes the saved scholarship, or removes it when it is closed or archived.
 * A search failure is logged and returned. It does not throw, so the MongoDB
 * save that already succeeded stays saved.
 */
const syncScholarshipSearch = async (scholarship, options = {}) => {
  const id = scholarshipId(scholarship);
  const log = options.log || console.error;
  const enabled =
    options.enabled === undefined
      ? isElasticsearchEnabled()
      : Boolean(options.enabled);

  if (!enabled) {
    log(
      `Scholarship search sync skipped for ${id} because Elasticsearch is disabled.`
    );
    return { synchronized: false, id, reason: 'disabled' };
  }

  const index = options.indexScholarship || indexScholarship;

  try {
    const result = await index(scholarship, options);
    return { synchronized: true, id, ...result };
  } catch (error) {
    log(
      `Scholarship search sync failed for ${id}. ${sanitizeErrorMessage(error && error.message)}`
    );
    return { synchronized: false, id, reason: 'failed' };
  }
};

module.exports = {
  syncScholarshipSearch
};
