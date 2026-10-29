import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyReportDecision,
  buildModerationDecision,
  canStartReportDecision,
  commitReportDecision,
  MODERATION_STATUS_FILTERS,
  moderationStatusFromSearch,
  reportMatchesModerationStatus,
  visibleReportQueue
} from './scholarshipReportQueue.js';

const pending = {
  _id: 'report-1',
  status: 'Pending Review',
  resolution: 'NONE',
  listingTitle: 'Merit Grant'
};

const sibling = {
  _id: 'report-2',
  status: 'Pending Review',
  resolution: 'NONE',
  listingTitle: 'Merit Grant'
};

const queue = [pending, sibling];

const remove = buildModerationDecision('remove', ' The application link asks for a fee. ');
assert.equal(remove.ok, true);
assert.deepEqual(remove.body, {
  status: 'Removed',
  action: 'REMOVE_LISTING',
  decisionReason: 'The application link asks for a fee.'
});
assert.equal(Object.hasOwn(remove.body, 'isArchived'), false);
assert.equal(Object.hasOwn(remove.body, 'adminRemovedAt'), false);

const removed = commitReportDecision(queue, 'report-1', remove, {
  ok: true,
  body: {
    data: {
      status: 'Removed',
      resolution: 'REMOVE_LISTING',
      decisionReason: remove.body.decisionReason
    }
  }
});
assert.equal(removed.feedback.type, 'success');
assert.equal(removed.reports[0].status, 'Removed');
assert.equal(removed.reports[0].resolution, 'REMOVE_LISTING');
assert.equal(removed.reports[1].status, 'Pending Review');
assert.deepEqual(
  visibleReportQueue(removed.reports, 'Pending Review').map((report) => report._id),
  ['report-2']
);

const retain = buildModerationDecision('retain', 'Eligibility text matches the provider record.');
assert.equal(retain.ok, true);
assert.deepEqual(retain.body, {
  status: 'Retained',
  action: 'RETAIN_LISTING',
  decisionReason: 'Eligibility text matches the provider record.'
});
assert.equal(retain.body.status === 'Closed', false);
assert.equal(retain.body.action === 'REMOVE_LISTING', false);

const retained = commitReportDecision(queue, 'report-1', retain, {
  ok: true,
  body: {
    data: {
      status: 'Retained',
      resolution: 'RETAIN_LISTING',
      decisionReason: retain.body.decisionReason
    }
  }
});
assert.equal(retained.feedback.type, 'success');
assert.match(retained.feedback.message, /remains available/);
assert.equal(retained.reports[0].status, 'Retained');
assert.equal(retained.reports[1].status, 'Pending Review');
assert.equal(visibleReportQueue(retained.reports, 'Pending Review').length, 1);

const missingExplanation = buildModerationDecision('remove', '   ');
assert.equal(missingExplanation.ok, false);
assert.equal(missingExplanation.error, 'A decision explanation is required.');
assert.equal(missingExplanation.body, undefined);

const failed = commitReportDecision(queue, 'report-1', remove, {
  ok: false,
  body: { message: 'Server error while resolving moderation report.' }
});
assert.equal(failed.persisted, false);
assert.equal(failed.feedback.type, 'error');
assert.equal(failed.feedback.message, 'Server error while resolving moderation report.');
assert.equal(failed.reports, queue);
assert.deepEqual(
  visibleReportQueue(failed.reports, 'Pending Review').map((report) => report._id),
  ['report-1', 'report-2']
);

const partial = commitReportDecision(queue, 'report-1', remove, {
  ok: false,
  body: {
    message: 'The report was updated, but a follow-up step failed.',
    data: {
      status: 'Removed',
      resolution: 'REMOVE_LISTING',
      decisionReason: 'The application link asks for a fee.'
    }
  }
});
assert.equal(partial.persisted, true);
assert.equal(partial.feedback.type, 'error');
assert.match(partial.feedback.message, /follow-up/);
assert.equal(partial.reports[0].status, 'Removed');
assert.equal(visibleReportQueue(partial.reports, 'Pending Review').length, 1);

const conflict = commitReportDecision(queue, 'report-1', retain, {
  ok: false,
  body: {
    success: false,
    message: 'This report already has a resolution and cannot be overwritten.',
    data: pending
  }
});
assert.equal(conflict.persisted, false);
assert.equal(conflict.reports[0].status, 'Pending Review');
assert.match(conflict.feedback.message, /cannot be overwritten/);

assert.equal(canStartReportDecision(null), true);
assert.equal(canStartReportDecision(false), true);
assert.equal(canStartReportDecision('report-1'), false);

const untouchedSibling = applyReportDecision(queue, 'missing-report', {
  status: 'Removed',
  resolution: 'REMOVE_LISTING'
});
assert.equal(untouchedSibling[0].status, 'Pending Review');
assert.equal(untouchedSibling[1].status, 'Pending Review');

const unresolvedQueue = [
  pending,
  { _id: 'report-3', status: 'Under Investigation' },
  { _id: 'report-4', status: 'Retained' },
];
assert.deepEqual(
  visibleReportQueue(unresolvedQueue, 'Unresolved').map((report) => report._id),
  ['report-1', 'report-3']
);
assert.equal(reportMatchesModerationStatus(unresolvedQueue[2], 'Unresolved'), false);

const tabReports = [
  { _id: 'pending', status: 'Pending Review' },
  { _id: 'investigation', status: 'Under Investigation' },
  { _id: 'retained', status: 'Retained' },
  { _id: 'removed', status: 'Removed' },
  { _id: 'resolved', status: 'Resolved' },
  { _id: 'dismissed', status: 'Dismissed' },
];
const idsFor = (status) => visibleReportQueue(tabReports, status).map((report) => report._id);

assert.deepEqual(MODERATION_STATUS_FILTERS, [
  'Unresolved',
  'Retained',
  'Removed',
  'All',
]);
assert.equal(MODERATION_STATUS_FILTERS.includes('Pending Review'), false);
assert.equal(MODERATION_STATUS_FILTERS.includes('Under Investigation'), false);
assert.equal(MODERATION_STATUS_FILTERS.includes('Resolved'), false);
assert.deepEqual(idsFor('Unresolved'), ['pending', 'investigation']);
assert.deepEqual(idsFor('Under Investigation'), ['investigation']);
assert.deepEqual(idsFor('Retained'), ['retained']);
assert.deepEqual(idsFor('Removed'), ['removed']);
assert.deepEqual(idsFor('Resolved'), ['resolved']);
assert.deepEqual(idsFor('All'), [
  'pending',
  'investigation',
  'retained',
  'removed',
  'resolved',
  'dismissed',
]);
assert.equal(reportMatchesModerationStatus(tabReports[0], 'Unresolved'), true);
assert.equal(reportMatchesModerationStatus(tabReports[1], 'Unresolved'), true);
assert.equal(reportMatchesModerationStatus(tabReports[5], 'All'), true);

assert.equal(moderationStatusFromSearch(null), 'Unresolved');
assert.equal(moderationStatusFromSearch(''), 'Unresolved');
assert.equal(moderationStatusFromSearch('Unresolved'), 'Unresolved');
assert.equal(moderationStatusFromSearch('Pending Review'), 'Pending Review');
assert.deepEqual(idsFor(moderationStatusFromSearch('Pending Review')), ['pending']);
assert.equal(moderationStatusFromSearch('Under Investigation'), 'Under Investigation');
assert.deepEqual(idsFor(moderationStatusFromSearch('Under Investigation')), ['investigation']);
assert.equal(moderationStatusFromSearch('Retained'), 'Retained');
assert.equal(moderationStatusFromSearch('Removed'), 'Removed');
assert.equal(moderationStatusFromSearch('Resolved'), 'Resolved');
assert.deepEqual(idsFor(moderationStatusFromSearch('Resolved')), ['resolved']);
assert.equal(moderationStatusFromSearch('All'), 'All');
assert.equal(moderationStatusFromSearch('Not a status'), 'Unresolved');

const page = readFileSync(new URL('./pages/ContentModeration.jsx', import.meta.url), 'utf8');
assert.equal(page.includes('Submit decision'), false);
assert.equal(page.includes('setSelectedAction'), false);
assert.match(page, /handleDecision\(report, 'remove'\)/);
assert.match(page, /handleDecision\(report, 'retain'\)/);
assert.match(page, /'Remove'/);
assert.match(page, /'Retain'/);
assert.match(page, /MODERATION_STATUS_FILTERS\.map/);
assert.match(page, /status === 'Unresolved'\) next\.delete\('status'\)/);
assert.equal(page.includes("status === 'Pending Review') next.delete('status')"), false);

console.log('scholarship report queue tests passed');
