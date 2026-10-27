const Scholarship = require('../models/Scholarship');
const { isDeadlineOpen } = require('./matchingService');
const { syncScholarshipSearch } = require('./scholarshipSearchSync');
const matchCache = require('./matchCache');

/**
 * Open, non-archived scholarships past the Manila end of their
 * deadline day are closed. A scholarship that is already Closed
 * is left Closed, including when a provider later moves the
 * deadline forward. The document has no field that separates a
 * provider close from an automatic close, so this does not reopen.
 */
const shouldAutoCloseScholarship = (scholarship, now = new Date()) => {
  if (!scholarship || scholarship.status !== 'Open') {
    return false;
  }

  if (scholarship.isArchived === true) {
    return false;
  }

  return !isDeadlineOpen(scholarship.deadline, now);
};

const closeExpiredScholarships = async (now = new Date(), dependencies = {}) => {
  const findCandidates = dependencies.findCandidates || ((filter) =>
    Scholarship.find(filter).select('_id deadline status isArchived')
  );
  const updateMany = dependencies.updateMany || ((filter, update) =>
    Scholarship.updateMany(filter, update)
  );
  const findPersisted = dependencies.findPersisted || ((ids) =>
    Scholarship.find({ _id: { $in: ids } })
  );
  const sync = dependencies.syncScholarshipSearch || syncScholarshipSearch;

  const candidates = await findCandidates({
    status: 'Open',
    isArchived: false,
    deadline: { $lte: now }
  });

  const expiredIds = candidates
    .filter((scholarship) => shouldAutoCloseScholarship(scholarship, now))
    .map((scholarship) => scholarship._id);

  if (expiredIds.length === 0) {
    return { closedCount: 0 };
  }

  const result = await updateMany(
    {
      _id: { $in: expiredIds },
      status: 'Open',
      isArchived: false
    },
    { $set: { status: 'Closed' } }
  );
  const closedCount = result.modifiedCount || 0;

  if (closedCount > 0) {
    const persisted = await findPersisted(expiredIds);

    for (const scholarship of persisted) {
      await sync(scholarship);
    }

    const invalidate = dependencies.invalidateMatchCache
      || (() => matchCache.invalidateMatchCache());

    try {
      await invalidate();
    } catch (error) {
      console.error('Match cache invalidation failed.');
    }
  }

  return { closedCount };
};

module.exports = {
  shouldAutoCloseScholarship,
  closeExpiredScholarships
};
