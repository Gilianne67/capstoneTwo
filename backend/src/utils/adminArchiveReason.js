const ADMIN_ARCHIVE_REASONS = [
  'Expired or outdated listing',
  'Misleading or inaccurate information',
  'Suspected fraudulent scholarship',
  'Policy violation',
  'Duplicate listing',
  'Other',
];

const MAX_OTHER_REASON_LENGTH = 1000;

const resolveAdminArchiveReason = (body = {}) => {
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (!ADMIN_ARCHIVE_REASONS.includes(reason)) {
    return {
      ok: false,
      message: 'A valid archive reason is required.',
    };
  }

  if (reason !== 'Other') {
    return { ok: true, reason };
  }

  const details = typeof body.otherReason === 'string' ? body.otherReason.trim() : '';

  if (!details) {
    return {
      ok: false,
      message: 'Describe the archive reason when you select Other.',
    };
  }

  if (details.length > MAX_OTHER_REASON_LENGTH) {
    return {
      ok: false,
      message: 'Archive reason cannot exceed 1000 characters.',
    };
  }

  return { ok: true, reason: `Other: ${details}` };
};

module.exports = {
  ADMIN_ARCHIVE_REASONS,
  MAX_OTHER_REASON_LENGTH,
  resolveAdminArchiveReason,
};
