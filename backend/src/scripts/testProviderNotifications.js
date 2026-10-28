const assert = require('assert');
const Provider = require('../models/Provider');
const ProviderNotification = require('../models/ProviderNotification');
const providerRoutes = require('../routes/providerRoutes');
const { authorize } = require('../middleware/auth');
const {
  getProviderNotifications,
  getProviderUnreadCount,
  markProviderNotificationRead
} = require('../controllers/providerNotificationController');

const OWNER_PROVIDER = '507f1f77bcf86cd799439011';
const OTHER_PROVIDER = '507f1f77bcf86cd799439012';
const OWNER_NOTICE = '507f1f77bcf86cd799439021';
const OTHER_NOTICE = '507f1f77bcf86cd799439022';
const SCHOLARSHIP_ID = '507f1f77bcf86cd799439031';

const originals = {
  providerFindOne: Provider.findOne,
  notificationFind: ProviderNotification.find,
  notificationCount: ProviderNotification.countDocuments,
  notificationUpdate: ProviderNotification.findOneAndUpdate
};

const notices = [
  {
    _id: OWNER_NOTICE,
    providerId: OWNER_PROVIDER,
    type: 'listing_removed',
    title: 'Merit Grant was removed',
    message: 'Merit Grant was removed by an administrator on 2026-10-28T04:00:00.000Z. Admin explanation: The listing requests payment before review.',
    scholarshipId: SCHOLARSHIP_ID,
    removedAt: new Date('2026-10-28T04:00:00.000Z'),
    isRead: false,
    readAt: null
  },
  {
    _id: OTHER_NOTICE,
    providerId: OTHER_PROVIDER,
    type: 'listing_removed',
    title: 'Other Grant was removed',
    message: 'Other Grant was removed by an administrator on 2026-10-28T04:00:00.000Z. Admin explanation: Not this provider.',
    scholarshipId: '507f1f77bcf86cd799439032',
    removedAt: new Date('2026-10-28T05:00:00.000Z'),
    isRead: false,
    readAt: null
  }
];

const mockRes = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

const invoke = async (handler, req) => {
  const res = mockRes();
  await handler(req, res);
  return res;
};

const restore = () => {
  Provider.findOne = originals.providerFindOne;
  ProviderNotification.find = originals.notificationFind;
  ProviderNotification.countDocuments = originals.notificationCount;
  ProviderNotification.findOneAndUpdate = originals.notificationUpdate;
};

const main = async () => {
  const queries = [];

  try {
    Provider.findOne = async (filter) => (
      String(filter.userId) === 'user-owner' ? { _id: OWNER_PROVIDER } : null
    );
    ProviderNotification.find = (filter) => {
      queries.push(filter);
      return {
        sort: async () => notices.filter((item) => String(item.providerId) === String(filter.providerId))
      };
    };
    ProviderNotification.countDocuments = async (filter) => notices.filter((item) => (
      String(item.providerId) === String(filter.providerId) && item.isRead === filter.isRead
    )).length;
    ProviderNotification.findOneAndUpdate = async (filter, update) => {
      const match = notices.find((item) => (
        String(item._id) === String(filter._id)
        && String(item.providerId) === String(filter.providerId)
      ));
      if (!match) return null;
      match.isRead = update.$set.isRead;
      match.readAt = update.$set.readAt;
      return match;
    };

    const listRoute = providerRoutes.stack.find(
      (entry) => entry.route && entry.route.path === '/notifications' && entry.route.methods.get
    );
    const countRoute = providerRoutes.stack.find(
      (entry) => entry.route
        && entry.route.path === '/notifications/unread-count'
        && entry.route.methods.get
    );
    const readRoute = providerRoutes.stack.find(
      (entry) => entry.route
        && entry.route.path === '/notifications/:id/read'
        && entry.route.methods.patch
    );
    assert.ok(listRoute);
    assert.ok(countRoute);
    assert.ok(readRoute);

    const studentBlocked = await new Promise((resolve) => {
      const res = mockRes();
      authorize('provider')(
        { user: { role: 'student', status: 'active' } },
        res,
        () => resolve({ nextCalled: true, statusCode: res.statusCode })
      );
      if (res.statusCode) resolve({ nextCalled: false, statusCode: res.statusCode });
    });
    assert.equal(studentBlocked.nextCalled, false);
    assert.equal(studentBlocked.statusCode, 403);

    const owner = { id: 'user-owner', role: 'provider', status: 'active' };
    const listed = await invoke(getProviderNotifications, {
      user: owner,
      query: { providerId: OTHER_PROVIDER }
    });
    assert.equal(listed.statusCode, 200);
    assert.equal(listed.body.count, 1);
    assert.equal(String(queries[0].providerId), OWNER_PROVIDER);
    assert.equal(listed.body.notifications[0].scholarshipTitle, 'Merit Grant');
    assert.equal(
      listed.body.notifications[0].explanation,
      'The listing requests payment before review.'
    );
    assert.equal(String(listed.body.notifications[0].scholarshipId), SCHOLARSHIP_ID);
    assert.equal(listed.body.unreadCount, 1);
    assert.equal(
      listed.body.notifications.some((item) => item.scholarshipTitle === 'Other Grant'),
      false
    );

    const unread = await invoke(getProviderUnreadCount, { user: owner });
    assert.equal(unread.statusCode, 200);
    assert.equal(unread.body.count, 1);

    const crossRead = await invoke(markProviderNotificationRead, {
      user: owner,
      params: { id: OTHER_NOTICE }
    });
    assert.equal(crossRead.statusCode, 404);
    assert.equal(notices.find((item) => item._id === OTHER_NOTICE).isRead, false);

    const marked = await invoke(markProviderNotificationRead, {
      user: owner,
      params: { id: OWNER_NOTICE }
    });
    assert.equal(marked.statusCode, 200);
    assert.equal(marked.body.notification.isRead, true);
    assert.equal(marked.body.notification.explanation, 'The listing requests payment before review.');
    assert.ok(marked.body.notification.readAt instanceof Date);

    const afterRead = await invoke(getProviderUnreadCount, { user: owner });
    assert.equal(afterRead.statusCode, 200);
    assert.equal(afterRead.body.count, 0);

    console.log('provider notification tests passed');
  } finally {
    restore();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
