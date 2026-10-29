export const ARCHIVE_REASONS = [
  'Expired or outdated listing',
  'Misleading or inaccurate information',
  'Suspected fraudulent scholarship',
  'Policy violation',
  'Duplicate listing',
  'Other',
];

const MAX_OTHER_REASON_LENGTH = 1000;

export function buildArchiveRequest(reason, otherReason) {
  const selected = String(reason ?? '').trim();

  if (!ARCHIVE_REASONS.includes(selected)) {
    return { ok: false, error: 'Select an archive reason.' };
  }

  if (selected !== 'Other') {
    return {
      ok: true,
      body: { reason: selected },
    };
  }

  const details = String(otherReason ?? '').trim();
  if (!details) {
    return { ok: false, error: 'Describe the archive reason when you select Other.' };
  }

  if (details.length > MAX_OTHER_REASON_LENGTH) {
    return { ok: false, error: 'Archive reason cannot exceed 1000 characters.' };
  }

  return {
    ok: true,
    body: {
      reason: selected,
      otherReason: details,
    },
  };
}

export function isArchivedScholarship(scholarship) {
  return scholarship?.isArchived === true
    || Boolean(scholarship?.adminRemovedAt)
    || scholarship?.listingState === 'Archived'
    || scholarship?.canArchive === false;
}
