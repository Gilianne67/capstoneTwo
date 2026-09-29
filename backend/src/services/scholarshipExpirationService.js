const Scholarship = require('../models/Scholarship');
const { isDeadlineOpen } = require('./matchingService');

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

const closeExpiredScholarships = async (now = new Date()) => {
  const candidates = await Scholarship.find({
    status: 'Open',
    isArchived: false,
    deadline: { $lte: now }
  }).select('_id deadline status isArchived');

  const expiredIds = candidates
    .filter((scholarship) => shouldAutoCloseScholarship(scholarship, now))
    .map((scholarship) => scholarship._id);

  if (expiredIds.length === 0) {
    return { closedCount: 0 };
  }

  const result = await Scholarship.updateMany(
    {
      _id: { $in: expiredIds },
      status: 'Open',
      isArchived: false
    },
    { $set: { status: 'Closed' } }
  );

  return { closedCount: result.modifiedCount || 0 };
};

module.exports = {
  shouldAutoCloseScholarship,
  closeExpiredScholarships
};
