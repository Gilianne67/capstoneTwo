import assert from 'node:assert/strict';
import {
  ARCHIVE_REASONS,
  buildArchiveRequest,
  isArchivedScholarship,
} from './scholarshipArchive.js';

const missing = buildArchiveRequest('', '');
assert.equal(missing.ok, false);
assert.match(missing.error, /reason/i);

const unknown = buildArchiveRequest('Not a reason', '');
assert.equal(unknown.ok, false);

const preset = buildArchiveRequest(' Policy violation ', 'ignored');
assert.equal(preset.ok, true);
assert.deepEqual(preset.body, { reason: 'Policy violation' });

const otherMissing = buildArchiveRequest('Other', '   ');
assert.equal(otherMissing.ok, false);

const other = buildArchiveRequest('Other', '  The same grant was posted twice.  ');
assert.equal(other.ok, true);
assert.deepEqual(other.body, {
  reason: 'Other',
  otherReason: 'The same grant was posted twice.',
});

assert.equal(ARCHIVE_REASONS.includes('Suspected fraudulent scholarship'), true);
assert.equal(ARCHIVE_REASONS.includes('Expired or outdated listing'), true);

assert.equal(isArchivedScholarship({
  isArchived: true,
  listingState: 'Archived',
  canArchive: false,
}), true);
assert.equal(isArchivedScholarship({
  isArchived: false,
  adminRemovedAt: null,
  listingState: 'Active',
  canArchive: true,
}), false);
assert.equal(isArchivedScholarship({
  isArchived: false,
  adminRemovedAt: '2026-10-28T00:00:00.000Z',
  canArchive: false,
}), true);

console.log('scholarship archive request tests passed');
