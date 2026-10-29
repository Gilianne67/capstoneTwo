const Scholarship = require('../models/Scholarship');
const searchSync = require('./scholarshipSearchSync');
const matchCache = require('./matchCache');

/**
 * Soft-removes a scholarship the same way report moderation does.
 * The document, related reports, applications, and saved matches stay in place.
 */
const administrativelyRemoveScholarship = async (listingId, followUpErrors, explanation) => {
  const removedAt = new Date();
  const scholarship = await Scholarship.findByIdAndUpdate(
    listingId,
    {
      status: 'Closed',
      isArchived: true,
      adminRemovedAt: removedAt,
      adminRemovalReason: typeof explanation === 'string' ? explanation.trim() : '',
    },
    { new: true }
  );

  if (!scholarship) return null;

  if (typeof searchSync?.syncScholarshipSearch === 'function') {
    try {
      const syncResult = await searchSync.syncScholarshipSearch(scholarship);
      if (syncResult && syncResult.synchronized === false && syncResult.reason === 'failed') {
        followUpErrors.push({
          step: 'searchSync',
          message: 'Scholarship search synchronization failed.',
        });
      }
    } catch (syncError) {
      console.error('Scholarship search sync failed during moderation:', syncError.message);
      followUpErrors.push({
        step: 'searchSync',
        message: 'Scholarship search synchronization failed.',
      });
    }
  }

  try {
    const cacheResult = await matchCache.invalidateMatchCache();
    if (cacheResult && cacheResult.ok === false && cacheResult.reason === 'redis_write_failed') {
      followUpErrors.push({
        step: 'matchCache',
        message: 'Match cache invalidation failed.',
      });
    }
  } catch (cacheError) {
    console.error('Match cache invalidation failed during moderation:', cacheError.message);
    followUpErrors.push({
      step: 'matchCache',
      message: 'Match cache invalidation failed.',
    });
  }

  return scholarship;
};

module.exports = {
  administrativelyRemoveScholarship,
};
