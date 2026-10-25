const assert = require('assert');
const fs = require('fs');
const path = require('path');

const Provider = require('../models/Provider');
const Scholarship = require('../models/Scholarship');
const Report = require('../models/Report');
const scholarshipController = require('../controllers/scholarshipController');
const {
  updateModerationReport
} = require('../controllers/moderationController');
const searchSync = require('../services/scholarshipSearchSync');
const { syncScholarshipSearch } = searchSync;
const { toSearchDocument } = require('../services/scholarshipSearchService');
const {
  closeExpiredScholarships
} = require('../services/scholarshipExpirationService');

const originals = {
  providerFindOne: Provider.findOne,
  scholarshipCreate: Scholarship.create,
  scholarshipFindOne: Scholarship.findOne,
  scholarshipFindByIdAndUpdate: Scholarship.findByIdAndUpdate,
  reportFindById: Report.findById,
  sync: searchSync.syncScholarshipSearch
};

const restore = () => {
  Provider.findOne = originals.providerFindOne;
  Scholarship.create = originals.scholarshipCreate;
  Scholarship.findOne = originals.scholarshipFindOne;
  Scholarship.findByIdAndUpdate = originals.scholarshipFindByIdAndUpdate;
  Report.findById = originals.reportFindById;
  searchSync.syncScholarshipSearch = originals.sync;
};

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

const provider = {
  _id: 'provider-1',
  verificationStatus: 'Verified'
};

const openRecord = (overrides = {}) => ({
  _id: 'sch-1',
  providerId: provider._id,
  name: 'Cebu IT Excellence Grant',
  scholarshipType: 'Merit-Based',
  description: 'Support for information technology students in Cebu.',
  benefits: ['Tuition'],
  grantValue: '10000',
  hardFilters: {
    academicLevel: 'College',
    courseProgram: ['BS Information Technology'],
    geographicLocation: {
      scope: 'Municipality',
      regions: ['Central Visayas'],
      provinces: ['Cebu'],
      municipalities: ['Cebu City']
    },
    citizenshipStatus: 'Filipino'
  },
  status: 'Open',
  isArchived: false,
  deadline: new Date('2026-12-31T00:00:00.000Z'),
  ...overrides,
  async save() {
    return this;
  }
});

const indexWithMapping = async (scholarship) => {
  const document = toSearchDocument(scholarship);
  const id = String(scholarship._id || scholarship.id);

  if (!document) {
    return { indexed: false, id, reason: 'closed-or-archived' };
  }

  return { indexed: true, id, document };
};

const silence = () => {};

const runSyncTests = async () => {
  const created = openRecord();
  const createdResult = await syncScholarshipSearch(created, {
    enabled: true,
    log: silence,
    indexScholarship: indexWithMapping
  });

  assert.strictEqual(createdResult.synchronized, true);
  assert.strictEqual(createdResult.indexed, true);
  assert.strictEqual(createdResult.document.name, 'Cebu IT Excellence Grant');
  assert.ok(
    createdResult.document.canonicalCourseIds.includes('college-bsit'),
    'creation uses the existing course mapping'
  );
  assert.deepStrictEqual(createdResult.document.locations, [
    'Central Visayas',
    'Cebu',
    'Cebu City'
  ]);

  const edited = openRecord({
    name: 'Cebu IT Excellence Grant',
    description: 'Renewed grant for Cebu City BSIT students.',
    hardFilters: {
      ...openRecord().hardFilters,
      courseProgram: ['BSIT']
    }
  });
  const editedResult = await syncScholarshipSearch(edited, {
    enabled: true,
    log: silence,
    indexScholarship: indexWithMapping
  });

  assert.strictEqual(
    editedResult.document.description,
    'Renewed grant for Cebu City BSIT students.'
  );
  assert.deepStrictEqual(editedResult.document.courseProgram, ['BSIT']);
  assert.ok(editedResult.document.canonicalCourseIds.includes('college-bsit'));

  const closedResult = await syncScholarshipSearch(
    openRecord({ status: 'Closed' }),
    {
      enabled: true,
      log: silence,
      indexScholarship: indexWithMapping
    }
  );
  assert.strictEqual(closedResult.synchronized, true);
  assert.strictEqual(closedResult.indexed, false);
  assert.strictEqual(closedResult.reason, 'closed-or-archived');

  const archivedResult = await syncScholarshipSearch(
    openRecord({ isArchived: true }),
    {
      enabled: true,
      log: silence,
      indexScholarship: indexWithMapping
    }
  );
  assert.strictEqual(archivedResult.synchronized, true);
  assert.strictEqual(archivedResult.reason, 'closed-or-archived');

  const reopenedResult = await syncScholarshipSearch(
    openRecord({ status: 'Open', isArchived: false }),
    {
      enabled: true,
      log: silence,
      indexScholarship: indexWithMapping
    }
  );
  assert.strictEqual(reopenedResult.indexed, true);

  let indexCalled = false;
  const disabledLogs = [];
  const disabledResult = await syncScholarshipSearch(created, {
    enabled: false,
    log: (message) => disabledLogs.push(message),
    indexScholarship: async () => {
      indexCalled = true;
    }
  });
  assert.strictEqual(indexCalled, false);
  assert.strictEqual(disabledResult.synchronized, false);
  assert.strictEqual(disabledResult.reason, 'disabled');
  assert.ok(disabledLogs[0].includes('Elasticsearch is disabled'));

  const failureLogs = [];
  const failureResult = await syncScholarshipSearch(created, {
    enabled: true,
    log: (message) => failureLogs.push(message),
    indexScholarship: async () => {
      throw new Error(
        'Elasticsearch is unreachable. connect ECONNREFUSED 127.0.0.1:9200'
      );
    }
  });
  assert.strictEqual(failureResult.synchronized, false);
  assert.strictEqual(failureResult.reason, 'failed');
  assert.strictEqual(failureResult.indexed, undefined);
  assert.ok(failureLogs[0].includes('Scholarship search sync failed for sch-1'));
  assert.ok(failureLogs[0].includes('Elasticsearch is unreachable'));
};

const runControllerTests = async () => {
  const synced = [];
  searchSync.syncScholarshipSearch = async (scholarship) => {
    synced.push(scholarship);
    return { synchronized: true, id: String(scholarship._id) };
  };
  Provider.findOne = async () => provider;

  const created = openRecord();
  Scholarship.create = async (data) => ({ ...created, ...data });
  const createRes = mockRes();
  await scholarshipController.createScholarship(
    {
      user: { id: 'user-1' },
      body: {
        name: created.name,
        deadline: '2026-12-31',
        applicationURL: 'https://example.test/apply',
        hardFilters: created.hardFilters
      }
    },
    createRes
  );
  assert.strictEqual(createRes.statusCode, 201);
  assert.strictEqual(createRes.body.success, true);
  assert.strictEqual(createRes.body.message, 'Scholarship created successfully');
  assert.strictEqual(createRes.body.synchronized, undefined);
  assert.strictEqual(synced.length, 1);
  assert.strictEqual(synced[0].name, created.name);

  synced.length = 0;
  const editable = openRecord();
  Scholarship.findOne = async () => editable;
  const updateRes = mockRes();
  await scholarshipController.updateScholarship(
    {
      user: { id: 'user-1' },
      params: { id: 'sch-1' },
      body: {
        description: 'Edited description for Cebu.',
        hardFilters: {
          ...editable.hardFilters,
          courseProgram: ['BSIT'],
          geographicLocation: {
            scope: 'Province',
            regions: ['Central Visayas'],
            provinces: ['Cebu'],
            municipalities: []
          }
        }
      }
    },
    updateRes
  );
  assert.strictEqual(updateRes.statusCode, 200);
  assert.strictEqual(updateRes.body.success, true);
  assert.strictEqual(synced.length, 1);
  assert.strictEqual(synced[0].description, 'Edited description for Cebu.');
  assert.deepStrictEqual(synced[0].hardFilters.courseProgram, ['BSIT']);
  assert.deepStrictEqual(
    toSearchDocument(synced[0]).locations,
    ['Central Visayas', 'Cebu']
  );

  synced.length = 0;
  const closable = openRecord();
  Scholarship.findOne = async () => closable;
  const closeRes = mockRes();
  await scholarshipController.updateScholarshipStatus(
    {
      user: { id: 'user-1' },
      params: { id: 'sch-1' },
      body: { status: 'Closed' }
    },
    closeRes
  );
  assert.strictEqual(closeRes.statusCode, 200);
  assert.strictEqual(synced[0].status, 'Closed');
  assert.strictEqual(toSearchDocument(synced[0]), null);

  synced.length = 0;
  const reopen = openRecord({ status: 'Closed' });
  Scholarship.findOne = async () => reopen;
  const reopenRes = mockRes();
  await scholarshipController.updateScholarshipStatus(
    {
      user: { id: 'user-1' },
      params: { id: 'sch-1' },
      body: { status: 'Open' }
    },
    reopenRes
  );
  assert.strictEqual(reopenRes.statusCode, 200);
  assert.strictEqual(synced[0].status, 'Open');
  assert.strictEqual(synced[0].isArchived, false);
  assert.ok(toSearchDocument(synced[0]));

  synced.length = 0;
  const archivable = openRecord();
  Scholarship.findOne = async () => archivable;
  const archiveRes = mockRes();
  await scholarshipController.archiveScholarship(
    { user: { id: 'user-1' }, params: { id: 'sch-1' } },
    archiveRes
  );
  assert.strictEqual(archiveRes.statusCode, 200);
  assert.strictEqual(synced[0].isArchived, true);
  assert.strictEqual(toSearchDocument(synced[0]), null);

  synced.length = 0;
  Scholarship.findOne = async () => openRecord({ isArchived: true });
  const repeatArchive = mockRes();
  await scholarshipController.archiveScholarship(
    { user: { id: 'user-1' }, params: { id: 'sch-1' } },
    repeatArchive
  );
  assert.strictEqual(repeatArchive.statusCode, 400);
  assert.strictEqual(synced.length, 0);

  const controllerSource = fs.readFileSync(
    path.join(__dirname, '../controllers/scholarshipController.js'),
    'utf8'
  );
  assert.strictEqual(
    controllerSource.includes('isArchived = false'),
    false,
    'unarchiving is not a supported scholarship action'
  );

  const failureLogs = [];
  searchSync.syncScholarshipSearch = (scholarship) =>
    syncScholarshipSearch(scholarship, {
      enabled: true,
      log: (message) => failureLogs.push(message),
      indexScholarship: async () => {
        throw new Error(
          'Elasticsearch is unreachable. connect ECONNREFUSED 127.0.0.1:9200'
        );
      }
    });
  Scholarship.create = async () => openRecord();
  const failedRes = mockRes();
  await scholarshipController.createScholarship(
    {
      user: { id: 'user-1' },
      body: {
        name: 'Still saved',
        deadline: '2026-12-31',
        applicationURL: 'https://example.test/apply',
        hardFilters: openRecord().hardFilters
      }
    },
    failedRes
  );
  assert.strictEqual(failedRes.statusCode, 201);
  assert.strictEqual(failedRes.body.success, true);
  assert.strictEqual(failedRes.body.synchronized, undefined);
  assert.ok(failureLogs[0].includes('Scholarship search sync failed'));

  synced.length = 0;
  searchSync.syncScholarshipSearch = async (scholarship) => {
    synced.push(scholarship);
  };
  Report.findById = async () => ({
    listingId: 'sch-9',
    async save() {
      return this;
    }
  });
  Scholarship.findByIdAndUpdate = async (id, update, options) => {
    assert.strictEqual(options.new, true);
    assert.strictEqual(update.status, 'Closed');
    assert.strictEqual(update.isArchived, true);
    return {
      _id: id,
      status: update.status,
      isArchived: update.isArchived,
      name: 'Removed listing'
    };
  };
  const moderationRes = mockRes();
  await updateModerationReport(
    {
      params: { id: 'report-1' },
      body: { action: 'REMOVE_LISTING', status: 'Resolved' },
      user: { _id: 'admin-1' }
    },
    moderationRes
  );
  assert.strictEqual(moderationRes.statusCode, 200);
  assert.strictEqual(moderationRes.body.success, true);
  assert.strictEqual(synced.length, 1);
  assert.strictEqual(synced[0].status, 'Closed');
  assert.strictEqual(synced[0].isArchived, true);
};

const runExpirationTests = async () => {
  const afterDeadline = new Date('2026-09-25T16:00:00.000Z');
  const duringDeadline = new Date('2026-09-25T10:00:00.000Z');
  const persisted = {
    _id: 'expired-1',
    name: 'Expired Grant',
    status: 'Closed',
    isArchived: false,
    deadline: '2026-09-25'
  };
  const logs = [];
  let findPersistedCalls = 0;

  const closed = await closeExpiredScholarships(afterDeadline, {
    findCandidates: async (filter) => {
      assert.strictEqual(filter.status, 'Open');
      assert.strictEqual(filter.isArchived, false);
      return [
        {
          _id: 'expired-1',
          status: 'Open',
          isArchived: false,
          deadline: '2026-09-25'
        },
        {
          _id: 'future-1',
          status: 'Open',
          isArchived: false,
          deadline: '2026-12-31'
        }
      ];
    },
    updateMany: async (filter, update) => {
      assert.deepStrictEqual(filter._id.$in, ['expired-1']);
      assert.deepStrictEqual(update, { $set: { status: 'Closed' } });
      return { modifiedCount: 1 };
    },
    findPersisted: async (ids) => {
      findPersistedCalls += 1;
      assert.deepStrictEqual(ids, ['expired-1']);
      return [persisted];
    },
    syncScholarshipSearch: async (scholarship) => {
      assert.strictEqual(scholarship, persisted);
      return syncScholarshipSearch(scholarship, {
        enabled: true,
        log: (message) => logs.push(message),
        indexScholarship: async () => {
          throw new Error(
            'Elasticsearch is unreachable. connect ECONNREFUSED 127.0.0.1:9200'
          );
        }
      });
    }
  });

  assert.strictEqual(closed.closedCount, 1);
  assert.strictEqual(findPersistedCalls, 1);
  assert.ok(logs[0].includes('Scholarship search sync failed for expired-1'));

  const removal = [];
  const removed = await closeExpiredScholarships(afterDeadline, {
    findCandidates: async () => [
      {
        _id: 'expired-1',
        status: 'Open',
        isArchived: false,
        deadline: '2026-09-25'
      }
    ],
    updateMany: async () => ({ modifiedCount: 1 }),
    findPersisted: async () => [persisted],
    syncScholarshipSearch: async (scholarship) => {
      const result = await syncScholarshipSearch(scholarship, {
        enabled: true,
        log: silence,
        indexScholarship: indexWithMapping
      });
      removal.push(result);
      return result;
    }
  });
  assert.strictEqual(removed.closedCount, 1);
  assert.strictEqual(removal[0].synchronized, true);
  assert.strictEqual(removal[0].reason, 'closed-or-archived');

  let synced = false;
  const unchanged = await closeExpiredScholarships(duringDeadline, {
    findCandidates: async () => [
      {
        _id: 'open-1',
        status: 'Open',
        isArchived: false,
        deadline: '2026-09-25'
      }
    ],
    updateMany: async () => {
      throw new Error('updateMany should not run before the deadline day ends');
    },
    findPersisted: async () => {
      throw new Error('closed scholarships should be reloaded only after a save');
    },
    syncScholarshipSearch: async () => {
      synced = true;
    }
  });
  assert.strictEqual(unchanged.closedCount, 0);
  assert.strictEqual(synced, false);

  const notSaved = await closeExpiredScholarships(afterDeadline, {
    findCandidates: async () => [
      {
        _id: 'expired-1',
        status: 'Open',
        isArchived: false,
        deadline: '2026-09-25'
      }
    ],
    updateMany: async () => ({ modifiedCount: 0 }),
    findPersisted: async () => {
      throw new Error('a failed close must not be synchronized');
    },
    syncScholarshipSearch: async () => {
      synced = true;
    }
  });
  assert.strictEqual(notSaved.closedCount, 0);
  assert.strictEqual(synced, false);
};

const main = async () => {
  try {
    await runSyncTests();
    await runControllerTests();
    await runExpirationTests();
    console.log('scholarship search sync tests passed');
  } finally {
    restore();
  }
};

main().catch((error) => {
  restore();
  console.error(error);
  process.exit(1);
});
