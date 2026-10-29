import assert from 'node:assert/strict';
import {
  SAVED_MESSAGE,
  bannerPresentation,
  broadcastPhase,
  buildBroadcastPayload,
  compareBroadcasts,
  countLiveBroadcasts,
  dispatchServiceLabel,
  interpretBroadcastList,
  interpretBroadcastResponse,
  interpretRevokeResponse,
  priorityTone,
  validateBroadcastDraft,
} from './broadcastDispatch.js';

const hours = (amount) => new Date(Date.now() + amount * 60 * 60 * 1000).toISOString();

const valid = {
  target: 'Students Only',
  priority: 'Urgent',
  title: '  Portal maintenance  ',
  message: '  The portal will be unavailable tonight.  ',
  startDate: '',
  expiresAt: hours(24),
};

const saved = buildBroadcastPayload(valid);
assert.equal(saved.ok, true);
assert.equal(saved.body.title, 'Portal maintenance');
assert.equal(saved.body.message, 'The portal will be unavailable tonight.');
assert.equal(saved.body.target, 'Students Only');
assert.equal(saved.body.priority, 'Urgent');
assert.equal('startDate' in saved.body, false);
assert.match(saved.body.expiresAt, /Z$/);

const localStart = '2026-12-20T09:30';
const zoned = buildBroadcastPayload({
  ...valid,
  startDate: localStart,
  expiresAt: '2026-12-21T09:30',
});
assert.equal(zoned.ok, true);
assert.equal(Date.parse(zoned.body.startDate), new Date(localStart).getTime());
assert.match(zoned.body.startDate, /Z$/);
assert.match(zoned.body.expiresAt, /Z$/);
const readableBanner = (priority, textToken, iconClass) => {
  const style = bannerPresentation(priority);
  const classes = `${style.card} ${style.text} ${style.badge} ${style.dismiss}`;
  assert.match(style.icon, new RegExp(iconClass));
  assert.match(style.card, new RegExp(textToken));
  assert.match(style.text, new RegExp(textToken));
  assert.doesNotMatch(classes, /dark:text-|opacity-/);
};

readableBanner('Info', 'text-blue-950', 'bg-blue-500');
readableBanner('Warning', 'text-amber-950', 'bg-amber-500');
readableBanner('Urgent', 'text-rose-950', 'bg-rose-500');
assert.equal(bannerPresentation(undefined).tone, 'info');
assert.match(bannerPresentation('Info').card, /bg-blue-500\/10/);

assert.equal(priorityTone(saved.body.priority), 'urgent');
assert.equal(priorityTone('Warning'), 'warning');
assert.equal(priorityTone('Info'), 'info');
assert.equal(priorityTone(undefined), 'info');

assert.equal(validateBroadcastDraft({ ...valid, title: '   ' }).ok, false);
assert.equal(validateBroadcastDraft({ ...valid, message: '' }).ok, false);
assert.equal(validateBroadcastDraft({ ...valid, expiresAt: '' }).ok, false);
assert.match(validateBroadcastDraft({ ...valid, target: 'Everyone' }).error, /audience/i);
assert.match(validateBroadcastDraft({ ...valid, priority: 'Critical' }).error, /priority/i);
assert.match(validateBroadcastDraft({ ...valid, expiresAt: 'not-a-date' }).error, /expiration/i);
assert.match(validateBroadcastDraft({ ...valid, title: 'A'.repeat(121) }).error, /120/);
assert.match(validateBroadcastDraft({ ...valid, message: 'A'.repeat(2001) }).error, /2000/);

const range = validateBroadcastDraft({
  ...valid,
  startDate: hours(48),
  expiresAt: hours(24),
});
assert.equal(range.ok, false);
assert.match(range.error, /after the start date/i);

const alreadyOver = validateBroadcastDraft({
  ...valid,
  startDate: hours(-48),
  expiresAt: hours(-1),
});
assert.equal(alreadyOver.ok, false);
assert.match(alreadyOver.error, /in the future/i);

const scheduled = buildBroadcastPayload({
  ...valid,
  target: 'Grant Providers Only',
  priority: 'Warning',
  startDate: hours(48),
  expiresAt: hours(72),
});
assert.equal(scheduled.ok, true);
assert.equal(scheduled.body.target, 'Grant Providers Only');
assert.equal(scheduled.body.priority, 'Warning');
assert.match(scheduled.body.startDate, /Z$/);

const now = new Date();
const live = {
  title: 'Live',
  status: 'Active',
  priority: 'Info',
  startDate: hours(-1),
  expiresAt: hours(5),
  createdAt: hours(-2),
};
const upcoming = {
  title: 'Upcoming',
  status: 'Active',
  priority: 'Urgent',
  startDate: hours(10),
  expiresAt: hours(20),
  createdAt: hours(-1),
};
const expired = {
  title: 'Old',
  status: 'Active',
  priority: 'Warning',
  startDate: hours(-30),
  expiresAt: hours(-2),
  createdAt: hours(-30),
};

assert.equal(broadcastPhase(live, now), 'live');
assert.equal(broadcastPhase(upcoming, now), 'scheduled');
assert.equal(broadcastPhase(expired, now), 'expired');
assert.equal(broadcastPhase({ ...live, status: 'Revoked' }, now), 'revoked');
assert.equal(countLiveBroadcasts([live, upcoming, expired], now), 1);
assert.equal(countLiveBroadcasts({ activeCount: 99 }, now), 0);

const listed = interpretBroadcastList({
  ok: true,
  body: { success: true, activeCount: 99, broadcasts: [live, upcoming, expired] },
}, now);
assert.equal(listed.outcome, 'loaded');
assert.equal(listed.activeCount, 1);
assert.deepEqual(
  [live, upcoming, expired].slice().sort(compareBroadcasts).map((item) => item.title),
  ['Upcoming', 'Old', 'Live'],
);

const loadFailed = interpretBroadcastList({
  ok: false,
  body: { success: false, message: 'Announcements could not be loaded. Please try again.' },
});
assert.equal(loadFailed.outcome, 'error');
assert.match(loadFailed.message, /could not be loaded/i);

const missingList = interpretBroadcastList({ ok: true, body: { success: true } });
assert.equal(missingList.outcome, 'error');

const created = interpretBroadcastResponse({
  ok: true,
  body: {
    success: true,
    message: SAVED_MESSAGE,
    broadcast: { _id: 'abc123', title: 'Portal maintenance', priority: 'Urgent' },
    warnings: [{ message: 'The audit record could not be saved.' }],
  },
});
assert.equal(created.outcome, 'saved');
assert.equal(created.message, SAVED_MESSAGE);
assert.match(created.warning, /audit/i);
assert.doesNotMatch(SAVED_MESSAGE, /email|push|every user|online & secure/i);

const unconfirmed = interpretBroadcastResponse({ ok: true, body: { success: true } });
assert.equal(unconfirmed.outcome, 'error');
assert.match(unconfirmed.message, /did not confirm/i);

const rejected = interpretBroadcastResponse({
  ok: false,
  body: { success: false, message: 'Expiration date must be after the start date.' },
});
assert.equal(rejected.outcome, 'error');
assert.match(rejected.message, /after the start date/i);

const databaseDown = interpretBroadcastResponse({
  ok: false,
  body: { success: false, message: 'The announcement could not be saved. Please try again.' },
});
assert.equal(databaseDown.outcome, 'error');
assert.doesNotMatch(databaseDown.message, /will show it/i);

assert.equal(interpretRevokeResponse({ ok: true, body: { success: true } }).outcome, 'removed');
assert.equal(interpretRevokeResponse({ ok: false, status: 404, body: {} }).outcome, 'removed');
assert.equal(interpretRevokeResponse({ ok: false, status: 500, body: { message: 'The announcement could not be revoked. Please try again.' } }).outcome, 'error');

assert.equal(dispatchServiceLabel({ loading: true, loadError: false }), 'Checking');
assert.equal(dispatchServiceLabel({ loading: false, loadError: true }), 'Unavailable');
assert.equal(dispatchServiceLabel({ loading: false, loadError: false }), 'Connected');
assert.notEqual(dispatchServiceLabel(), 'Online & Secure');

console.log('broadcast dispatch client checks passed');
