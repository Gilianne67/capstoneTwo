/**
 * FAQ management and portal visibility. Uses an in-memory FAQ stand-in.
 * Does not connect to MongoDB or run the FAQ seed script.
 */
const assert = require('assert');
const Module = require('module');
const mongoose = require('mongoose');

const install = (relativePath, exports) => {
  const filename = require.resolve(relativePath);
  const mock = new Module(filename);
  mock.filename = filename;
  mock.loaded = true;
  mock.exports = exports;
  require.cache[filename] = mock;
  return exports;
};

install('../config/redis', {
  isOpen: false,
  isReady: false,
  async set() { return 'OK'; },
  async get() { return null; },
  async del() { return 1; },
});

const store = new Map();
const findQueries = [];
let clock = Date.parse('2026-01-01T00:00:00.000Z');

const matches = (doc, query) => {
  if (!query || Object.keys(query).length === 0) return true;
  if (query.isPublished !== undefined && doc.isPublished !== query.isPublished) return false;
  if (query.targetRole && Array.isArray(query.targetRole.$in)) {
    return query.targetRole.$in.includes(doc.targetRole);
  }
  return true;
};

const clone = (doc) => ({
  _id: doc._id,
  targetRole: doc.targetRole,
  category: doc.category,
  question: doc.question,
  answer: doc.answer,
  isPublished: doc.isPublished,
  createdBy: doc.createdBy,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const FAQ = {
  find(query) {
    findQueries.push(query);
    const rows = [...store.values()].filter((doc) => matches(doc, query)).map(clone);
    return {
      sort(spec) {
        const [key, direction] = Object.entries(spec || { createdAt: -1 })[0];
        rows.sort((left, right) => {
          const delta = new Date(left[key]).getTime() - new Date(right[key]).getTime();
          return direction < 0 ? -delta : delta;
        });
        return Promise.resolve(rows);
      },
    };
  },
  async create(data) {
    const id = new mongoose.Types.ObjectId().toString();
    clock += 1000;
    const now = new Date(clock);
    const doc = {
      _id: id,
      targetRole: data.targetRole,
      category: data.category,
      question: data.question,
      answer: data.answer,
      isPublished: data.isPublished !== false,
      createdBy: data.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    store.set(id, doc);
    return clone(doc);
  },
  async findById(id) {
    const doc = store.get(String(id));
    if (!doc) return null;
    return {
      ...clone(doc),
      async save() {
        store.set(String(this._id), {
          ...clone(this),
          updatedAt: new Date(),
        });
        return this;
      },
      async deleteOne() {
        store.delete(String(this._id));
      },
    };
  },
};

install('../models/FAQ', FAQ);

const { authorize } = require('../middleware/auth');
const {
  getFAQs,
  createFAQ,
  updateFAQ,
  deleteFAQ,
} = require('../controllers/faqController');
const faqRouter = require('../routes/faqRoutes');

const invoke = (handler, req) => new Promise((resolve, reject) => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      resolve({ statusCode: this.statusCode, body, nextCalled: false });
    },
  };

  Promise.resolve(handler(req, res, (error) => {
    if (!error) {
      resolve({ statusCode: res.statusCode, body: res.body, nextCalled: true });
      return;
    }
    resolve({ statusCode: 500, body: { message: error.message }, nextCalled: false });
  })).catch(reject);
});

const handlersFor = (method, path) => {
  const layer = faqRouter.stack.find((entry) => (
    entry.route
    && entry.route.path === path
    && entry.route.methods[method]
  ));
  assert.ok(layer, `missing ${method.toUpperCase()} ${path}`);
  return layer.route.stack.map((entry) => entry.handle);
};

const namesFor = (method, path) => handlersFor(method, path).map((handler) => handler.name);

const questions = (result) => result.body.faqs.map((faq) => faq.question);
const answers = (result) => JSON.stringify(result.body);

const admin = { _id: new mongoose.Types.ObjectId().toString(), role: 'admin' };
const superadmin = { _id: new mongoose.Types.ObjectId().toString(), role: 'superadmin' };
const student = { _id: new mongoose.Types.ObjectId().toString(), role: 'student' };
const provider = { _id: new mongoose.Types.ObjectId().toString(), role: 'provider' };

const baseArticle = {
  category: 'Matching',
  question: 'Question',
  answer: 'Answer',
  isPublished: true,
};

const run = async () => {
  assert.deepEqual(namesFor('get', '/'), ['protect', 'getFAQs']);
  assert.deepEqual(namesFor('post', '/'), ['protect', 'authorizeRequest', 'createFAQ']);
  assert.deepEqual(namesFor('patch', '/:id'), ['protect', 'authorizeRequest', 'updateFAQ']);
  assert.deepEqual(namesFor('delete', '/:id'), ['protect', 'authorizeRequest', 'deleteFAQ']);

  const writeRoutes = [
    handlersFor('post', '/'),
    handlersFor('patch', '/:id'),
    handlersFor('delete', '/:id'),
  ];
  for (const handlers of writeRoutes) {
    const unauthenticated = await invoke(handlers[0], { headers: {}, method: 'POST' });
    assert.equal(unauthenticated.statusCode, 401);

    const studentDenied = await invoke(handlers[1], { user: student, headers: {} });
    assert.equal(studentDenied.statusCode, 403);
    assert.equal(studentDenied.nextCalled, false);

    const providerDenied = await invoke(handlers[1], { user: provider, headers: {} });
    assert.equal(providerDenied.statusCode, 403);

    const adminAllowed = await invoke(handlers[1], { user: admin, headers: {} });
    assert.equal(adminAllowed.nextCalled, true);

    const superAllowed = await invoke(handlers[1], { user: { role: 'super_admin' }, headers: {} });
    assert.equal(superAllowed.nextCalled, true);
  }

  assert.equal(authorize('admin', 'super_admin', 'superadmin').name, 'authorizeRequest');

  const noSession = await invoke(getFAQs, { query: { role: 'admin' }, headers: {} });
  assert.equal(noSession.statusCode, 401);
  assert.equal(findQueries.length, 0);

  const studentCreate = await invoke(createFAQ, {
    user: student,
    body: { ...baseArticle, targetRole: 'student', question: 'Student cannot create' },
    headers: {},
  });
  assert.equal(studentCreate.statusCode, 403);
  assert.equal(store.size, 0);

  const missingFields = await invoke(createFAQ, {
    user: admin,
    body: { targetRole: 'student', category: ' ', question: 'Q', answer: 'A' },
    headers: {},
  });
  assert.equal(missingFields.statusCode, 400);
  assert.equal(store.size, 0);

  const badAudience = await invoke(createFAQ, {
    user: admin,
    body: { ...baseArticle, targetRole: 'public' },
    headers: {},
  });
  assert.equal(badAudience.statusCode, 400);

  const badStatus = await invoke(createFAQ, {
    user: admin,
    body: { ...baseArticle, targetRole: 'student', isPublished: 'yes' },
    headers: {},
  });
  assert.equal(badStatus.statusCode, 400);
  assert.equal(store.size, 0);

  const create = async (user, fields) => {
    const result = await invoke(createFAQ, {
      user,
      body: { ...baseArticle, ...fields },
      headers: {},
    });
    assert.equal(result.statusCode, 201, JSON.stringify(result.body));
    return result.body.faq;
  };

  const studentArticle = await create(admin, {
    targetRole: 'student',
    question: 'Student match',
    answer: 'student-only-answer',
    category: 'Matching',
  });
  const sharedArticle = await create(superadmin, {
    targetRole: 'all',
    question: 'Shared guide',
    answer: 'all-audience-answer',
    category: 'General',
  });
  const providerArticle = await create(admin, {
    targetRole: 'provider',
    question: 'Provider listing',
    answer: 'provider-only-answer',
    category: 'Listings',
  });
  const adminArticle = await create(admin, {
    targetRole: 'admin',
    question: 'Admin procedure',
    answer: 'admin-only-answer',
    category: 'Verification',
  });
  const draftArticle = await create(admin, {
    targetRole: 'student',
    question: 'Hidden student draft',
    answer: 'unpublished-answer',
    category: 'Matching',
    isPublished: false,
  });

  assert.equal(studentArticle.createdBy, admin._id);
  assert.equal(draftArticle.isPublished, false);
  assert.equal(store.size, 5);

  const adminList = await invoke(getFAQs, {
    user: { role: 'super_admin' },
    query: { role: 'student' },
    headers: {},
  });
  assert.equal(adminList.statusCode, 200);
  assert.equal(adminList.body.count, 5);
  assert.deepEqual(findQueries.at(-1), {});
  assert.deepEqual(questions(adminList).sort(), [
    'Admin procedure',
    'Hidden student draft',
    'Provider listing',
    'Shared guide',
    'Student match',
  ]);

  const studentView = await invoke(getFAQs, {
    user: student,
    query: { role: 'admin' },
    headers: {},
  });
  assert.equal(studentView.statusCode, 200);
  assert.deepEqual(findQueries.at(-1), {
    isPublished: true,
    targetRole: { $in: ['student', 'all'] },
  });
  assert.deepEqual(questions(studentView), ['Shared guide', 'Student match']);
  assert.equal(answers(studentView).includes('provider-only-answer'), false);
  assert.equal(answers(studentView).includes('admin-only-answer'), false);
  assert.equal(answers(studentView).includes('unpublished-answer'), false);

  const providerView = await invoke(getFAQs, {
    user: provider,
    query: { role: 'student' },
    headers: {},
  });
  assert.equal(providerView.statusCode, 200);
  assert.deepEqual(findQueries.at(-1).targetRole.$in, ['provider', 'all']);
  assert.equal(findQueries.at(-1).isPublished, true);
  assert.deepEqual(questions(providerView), ['Provider listing', 'Shared guide']);
  assert.equal(answers(providerView).includes('student-only-answer'), false);
  assert.equal(answers(providerView).includes('admin-only-answer'), false);
  assert.equal(answers(providerView).includes('unpublished-answer'), false);

  const unpublished = await invoke(updateFAQ, {
    user: admin,
    params: { id: sharedArticle._id },
    body: { isPublished: false },
    headers: {},
  });
  assert.equal(unpublished.statusCode, 200);
  assert.equal(unpublished.body.faq.isPublished, false);
  assert.equal(store.has(sharedArticle._id), true);
  assert.equal(store.get(sharedArticle._id).question, 'Shared guide');

  const studentAfterUnpublish = await invoke(getFAQs, { user: student, query: {}, headers: {} });
  const providerAfterUnpublish = await invoke(getFAQs, { user: provider, query: {}, headers: {} });
  const adminAfterUnpublish = await invoke(getFAQs, { user: admin, query: {}, headers: {} });
  assert.deepEqual(questions(studentAfterUnpublish), ['Student match']);
  assert.deepEqual(questions(providerAfterUnpublish), ['Provider listing']);
  assert.equal(adminAfterUnpublish.body.count, 5);
  assert.equal(answers(adminAfterUnpublish).includes('all-audience-answer'), true);

  const moved = await invoke(updateFAQ, {
    user: superadmin,
    params: { id: studentArticle._id },
    body: {
      targetRole: 'provider',
      category: 'Listings',
      question: 'Moved to providers',
      answer: 'now-provider-answer',
      isPublished: true,
    },
    headers: {},
  });
  assert.equal(moved.statusCode, 200);
  assert.equal(moved.body.faq.targetRole, 'provider');
  assert.equal(store.get(studentArticle._id).createdBy, admin._id);

  const studentAfterMove = await invoke(getFAQs, { user: student, query: { role: 'provider' }, headers: {} });
  const providerAfterMove = await invoke(getFAQs, { user: provider, query: {}, headers: {} });
  assert.deepEqual(questions(studentAfterMove), []);
  assert.deepEqual(questions(providerAfterMove), ['Provider listing', 'Moved to providers']);

  const republished = await invoke(updateFAQ, {
    user: admin,
    params: { id: sharedArticle._id },
    body: { isPublished: true },
    headers: {},
  });
  assert.equal(republished.statusCode, 200);
  const studentAfterPublish = await invoke(getFAQs, { user: student, query: {}, headers: {} });
  const providerAfterPublish = await invoke(getFAQs, { user: provider, query: {}, headers: {} });
  assert.deepEqual(questions(studentAfterPublish), ['Shared guide']);
  assert.ok(questions(providerAfterPublish).includes('Shared guide'));

  const providerUpdate = await invoke(updateFAQ, {
    user: provider,
    params: { id: providerArticle._id },
    body: { question: 'Changed by provider' },
    headers: {},
  });
  assert.equal(providerUpdate.statusCode, 403);
  assert.equal(store.get(providerArticle._id).question, 'Provider listing');

  const badId = await invoke(updateFAQ, {
    user: admin,
    params: { id: 'not-an-id' },
    body: { question: 'Nope' },
    headers: {},
  });
  assert.equal(badId.statusCode, 400);

  const missingId = new mongoose.Types.ObjectId().toString();
  const missing = await invoke(deleteFAQ, {
    user: admin,
    params: { id: missingId },
    headers: {},
  });
  assert.equal(missing.statusCode, 404);

  const invalidDelete = await invoke(deleteFAQ, {
    user: admin,
    params: { id: '123' },
    headers: {},
  });
  assert.equal(invalidDelete.statusCode, 400);
  assert.equal(store.size, 5);

  const emptyUpdate = await invoke(updateFAQ, {
    user: admin,
    params: { id: adminArticle._id },
    body: { createdBy: student._id },
    headers: {},
  });
  assert.equal(emptyUpdate.statusCode, 400);
  assert.equal(store.get(adminArticle._id).answer, 'admin-only-answer');

  const badUpdateStatus = await invoke(updateFAQ, {
    user: admin,
    params: { id: draftArticle._id },
    body: { isPublished: 1 },
    headers: {},
  });
  assert.equal(badUpdateStatus.statusCode, 400);
  assert.equal(store.get(draftArticle._id).isPublished, false);

  const removed = await invoke(deleteFAQ, {
    user: admin,
    params: { id: providerArticle._id },
    headers: {},
  });
  assert.equal(removed.statusCode, 200);
  assert.equal(store.has(providerArticle._id), false);

  const providerAfterDelete = await invoke(getFAQs, { user: provider, query: {}, headers: {} });
  const adminAfterDelete = await invoke(getFAQs, { user: admin, query: {}, headers: {} });
  assert.equal(questions(providerAfterDelete).includes('Provider listing'), false);
  assert.equal(questions(adminAfterDelete).includes('Provider listing'), false);
  assert.equal(adminAfterDelete.body.count, 4);

  const originalFind = FAQ.find;
  FAQ.find = () => {
    throw new Error('database password leaked');
  };
  const failedRead = await invoke(getFAQs, { user: student, query: {}, headers: {} });
  assert.equal(failedRead.statusCode, 500);
  assert.equal(JSON.stringify(failedRead.body).includes('database password'), false);
  assert.equal(failedRead.body.message, 'Unable to load help articles.');
  FAQ.find = originalFind;

  console.log('faq management tests passed');
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
