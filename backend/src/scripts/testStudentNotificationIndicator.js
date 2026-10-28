const assert = require('assert');
const Notification = require('../models/Notification');
const SavedMatch = require('../models/SavedMatch');
const {
  countUnreadAlertNotifications,
  countUnreadDeadlineAlerts,
  currentAlertWindow,
  syncDeadlineNotifications
} = require('../services/notificationService');

const studentProfileId = 'student-profile-1';
const openScholarship = {
  _id: 'sch-open',
  deadline: '2027-12-31',
  status: 'Open',
  isArchived: false
};
const archivedScholarship = {
  _id: 'sch-archived',
  deadline: '2027-12-31',
  status: 'Closed',
  isArchived: true
};

const originals = {
  countDocuments: Notification.countDocuments,
  create: Notification.create,
  find: SavedMatch.find
};

const manilaDate = (offsetDays) => {
  const manila = new Date(Date.now() + (8 * 60 * 60 * 1000) + (offsetDays * 24 * 60 * 60 * 1000));
  const month = String(manila.getUTCMonth() + 1).padStart(2, '0');
  const day = String(manila.getUTCDate()).padStart(2, '0');
  return `${manila.getUTCFullYear()}-${month}-${day}`;
};

const calls = [];

const mockSaved = (items) => {
  SavedMatch.find = () => ({
    populate: async () => items
  });
};

const mockCounts = ({ deadlineUnread = 0, decisionUnread = 0 } = {}) => {
  calls.length = 0;
  Notification.countDocuments = async (filter) => {
    calls.push(filter);
    if (filter.type === 'deadline' && filter.isRead === false) return deadlineUnread;
    if (filter.type === 'report_decision' && filter.isRead === false) return decisionUnread;
    return 99;
  };
};

const assertQualifyingQueriesOnly = () => {
  assert.ok(calls.length > 0);
  calls.forEach((filter) => {
    assert.ok(filter.type === 'deadline' || filter.type === 'report_decision');
    assert.equal(filter.isRead, false);
    assert.equal(String(filter.studentProfileId), studentProfileId);
  });
};

const main = async () => {
  try {
    const now = new Date('2026-10-28T04:00:00.000Z');
    assert.equal(currentAlertWindow('2026-11-03', now), '7d');
    assert.equal(currentAlertWindow('2026-10-30', now), '7d');
    assert.equal(currentAlertWindow('2026-10-28', now), '7d');
    assert.equal(currentAlertWindow('2026-11-20', now), null);
    assert.equal(currentAlertWindow('2026-10-27', now), null);

    const created = [];
    Notification.create = async (doc) => {
      created.push(doc);
      return doc;
    };
    await syncDeadlineNotifications('student-profile-1', [
      {
        scholarshipId: {
          _id: 'sch-week',
          name: 'Week Grant',
          deadline: manilaDate(5),
          status: 'Open',
          isArchived: false
        }
      },
      {
        scholarshipId: {
          _id: 'sch-soon',
          name: 'Soon Grant',
          deadline: manilaDate(2),
          status: 'Open',
          isArchived: false
        }
      },
      {
        scholarshipId: {
          _id: 'sch-today',
          name: 'Today Grant',
          deadline: manilaDate(0),
          status: 'Open',
          isArchived: false
        }
      },
      {
        scholarshipId: {
          _id: 'sch-later',
          name: 'Later Grant',
          deadline: manilaDate(20),
          status: 'Open',
          isArchived: false
        }
      }
    ]);
    assert.equal(created.length, 3);
    assert.ok(created.every((item) => item.type === 'deadline' && item.alertWindow === '7d'));
    assert.equal(created.some((item) => item.alertWindow === '3d' || item.alertWindow === '24h'), false);
    assert.ok(created.every((item) => item.dedupeKey.endsWith(':7d')));
    Notification.create = originals.create;

    mockSaved([{ scholarshipId: openScholarship }]);
    mockCounts({ deadlineUnread: 1, decisionUnread: 0 });
    assert.equal(await countUnreadDeadlineAlerts(studentProfileId), 1);
    assert.equal(await countUnreadAlertNotifications(studentProfileId), 1);
    assertQualifyingQueriesOnly();

    mockSaved([]);
    mockCounts({ deadlineUnread: 5, decisionUnread: 1 });
    assert.equal(await countUnreadAlertNotifications(studentProfileId), 1);
    assert.ok(calls.every((filter) => filter.type === 'report_decision'));

    mockSaved([{ scholarshipId: openScholarship }]);
    mockCounts({ deadlineUnread: 2, decisionUnread: 1 });
    assert.equal(await countUnreadAlertNotifications(studentProfileId), 3);
    assertQualifyingQueriesOnly();

    mockCounts({ deadlineUnread: 0, decisionUnread: 0 });
    assert.equal(await countUnreadAlertNotifications(studentProfileId), 0);

    mockSaved([{ scholarshipId: archivedScholarship }]);
    mockCounts({ deadlineUnread: 4, decisionUnread: 0 });
    assert.equal(await countUnreadDeadlineAlerts(studentProfileId), 0);
    assert.equal(await countUnreadAlertNotifications(studentProfileId), 0);
    assert.ok(calls.every((filter) => filter.type === 'report_decision'));

    console.log('student notification indicator tests passed');
  } finally {
    Notification.countDocuments = originals.countDocuments;
    Notification.create = originals.create;
    SavedMatch.find = originals.find;
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
