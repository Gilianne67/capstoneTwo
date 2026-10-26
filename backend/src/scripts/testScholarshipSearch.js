const assert = require('assert');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env'), quiet: true });

if (!String(process.env.ELASTICSEARCH_ENABLED || '').trim()) {
  process.env.ELASTICSEARCH_ENABLED = 'true';
}

const {
  createElasticsearchClient,
  assertClusterReady,
  sanitizeErrorMessage,
  isElasticsearchEnabled
} = require('../config/elasticsearch');
const {
  toSynonymToken,
  buildSynonymLines,
  rebuildIndex,
  indexScholarship,
  removeScholarship,
  searchScholarships,
  deleteExactIndex
} = require('../services/scholarshipSearchService');

const TEST_INDEX = 'scholarships_phase1_test';
const REJECT_INDEX = 'scholarships_phase1_reject';
const LEAKED_AUTO_INDEX = 'scholarships_phase1_missing';
let activeClient = null;
const exactIndexesToRemove = new Set([
  TEST_INDEX,
  REJECT_INDEX,
  LEAKED_AUTO_INDEX
]);

const daysFromNow = (days) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

const scholarship = (id, overrides = {}) => ({
  _id: id,
  name: 'Computing Tuition Grant',
  scholarshipType: 'Merit',
  description: 'Tuition assistance for computing students.',
  benefits: ['Full tuition'],
  grantValue: 'Full tuition',
  status: 'Open',
  isArchived: false,
  deadline: daysFromNow(30),
  updatedAt: new Date().toISOString(),
  hardFilters: {
    academicLevel: 'College',
    courseProgram: ['BS Information Technology'],
    geographicLocation: {
      scope: 'Region',
      regions: ['National Capital Region'],
      provinces: [],
      municipalities: []
    },
    citizenshipStatus: 'Filipino'
  },
  specialTags: [{ tagName: 'Person with Disability (PWD)', mode: 'Preferred' }],
  ...overrides
});

const fixtures = () => [
  scholarship('test-college-it'),
  scholarship('test-shs-stem', {
    name: 'Senior High Science Support',
    description: 'Submit it before Friday so the science cohort can be reviewed.',
    benefits: ['Book allowance'],
    hardFilters: {
      academicLevel: 'Senior High School',
      courseProgram: ['STEM'],
      geographicLocation: {
        scope: 'Region',
        regions: ['Bicol Region'],
        provinces: [],
        municipalities: []
      },
      citizenshipStatus: 'Filipino'
    },
    specialTags: []
  }),
  scholarship('test-college-nursing', {
    name: 'Nursing Assistance Award',
    description: 'Assistance for nursing students in Central Luzon.',
    hardFilters: {
      academicLevel: 'College',
      courseProgram: ['BS Nursing'],
      geographicLocation: {
        scope: 'Region',
        regions: ['Central Luzon'],
        provinces: [],
        municipalities: []
      },
      citizenshipStatus: 'Filipino'
    },
    specialTags: []
  }),
  scholarship('test-closed-it', {
    status: 'Closed',
    description: 'Closed information technology award that must stay out of search.'
  }),
  scholarship('test-archived-marine', {
    isArchived: true,
    name: 'Marine Biology Archive',
    description: 'Marine biology field support.',
    hardFilters: {
      academicLevel: 'College',
      courseProgram: ['BS Biology'],
      geographicLocation: {
        scope: 'Region',
        regions: ['Davao Region'],
        provinces: [],
        municipalities: []
      },
      citizenshipStatus: 'Filipino'
    },
    specialTags: []
  })
];

const idsFor = async (client, query, academicLevel) => {
  const result = await searchScholarships({
    query,
    academicLevel,
    indexName: TEST_INDEX,
    client
  });

  return result.hits.map((hit) => hit.id).sort();
};

const assertIds = async (client, query, expected, academicLevel) => {
  const actual = await idsFor(client, query, academicLevel);
  assert.deepStrictEqual(
    actual,
    [...expected].sort(),
    `${query} => ${actual.join(', ') || '(none)'}`
  );
};

const run = async () => {
  assert.strictEqual(toSynonymToken('B.S.I.T.'), 'bsit');
  assert.strictEqual(toSynonymToken('IT'), 'it');
  assert.strictEqual(
    toSynonymToken('Information Technology'),
    'information_technology'
  );
  assert.strictEqual(
    toSynonymToken('National Capital Region'),
    'national_capital_region'
  );
  assert.strictEqual(
    toSynonymToken('Person with Disability (PWD)'),
    'person_with_disability_pwd'
  );

  const collegeLine = buildSynonymLines([
    ['BS Information Technology', 'Information Technology', 'IT', 'BSIT']
  ])[0];
  assert.ok(collegeLine.includes('it'));
  assert.ok(collegeLine.includes('information_technology'));
  assert.ok(collegeLine.includes('bs_information_technology'));

  assert.throws(
    () => createElasticsearchClient({ enabled: false }),
    /Elasticsearch is disabled/
  );

  if (!isElasticsearchEnabled()) {
    throw new Error(
      'Elasticsearch is disabled. Set ELASTICSEARCH_ENABLED=true to run search tests.'
    );
  }

  const unreachable = createElasticsearchClient({
    enabled: true,
    node: 'http://127.0.0.1:9',
    requestTimeout: 1500,
    maxRetries: 0
  });

  await assert.rejects(
    () => assertClusterReady(unreachable),
    (error) => {
      assert.match(error.message, /Elasticsearch is unreachable/);
      assert.ok(!/api[_-]?key|mongodb(?:\+srv)?:\/\//i.test(error.message));
      return true;
    }
  );

  const client = createElasticsearchClient({ requestTimeout: 15000 });
  activeClient = client;
  const options = { client, indexName: TEST_INDEX };
  await assertClusterReady(client);
  await removeKnownTestIndexes(client);

  await assert.rejects(
    () => searchScholarships({ query: 'IT', ...options }),
    /index_not_found/i
  );

  const first = await rebuildIndex(fixtures(), options);
  exactIndexesToRemove.add(first.physicalName);
  assert.strictEqual(first.indexed, 3);
  assert.strictEqual(first.skipped, 2);
  assert.strictEqual(first.aliasName, TEST_INDEX);

  const analyzedItBody = await client.indices.analyze({
    index: TEST_INDEX,
    analyzer: 'course_search',
    text: 'IT'
  });
  const analyzedIt = analyzedItBody.body || analyzedItBody;
  const itTokens = (analyzedIt.tokens || []).map((token) => token.token);
  assert.ok(itTokens.includes('information_technology'), itTokens.join(', '));
  assert.ok(itTokens.includes('bs_information_technology'), itTokens.join(', '));

  const analyzedDescriptionBody = await client.indices.analyze({
    index: TEST_INDEX,
    field: 'description',
    text: 'Submit it before Friday'
  });
  const analyzedDescription = analyzedDescriptionBody.body || analyzedDescriptionBody;
  const descriptionTokens = (analyzedDescription.tokens || []).map(
    (token) => token.token
  );
  assert.ok(!descriptionTokens.includes('it'), descriptionTokens.join(', '));

  await assertIds(client, 'IT', ['test-college-it']);
  await assertIds(client, 'Information Technology', ['test-college-it']);
  await assertIds(client, 'BSIT', ['test-college-it']);
  await assertIds(client, 'Bachelor of Science in Information Technology', [
    'test-college-it'
  ]);
  await assertIds(client, 'NCR', ['test-college-it']);
  await assertIds(client, 'National Capital Region', ['test-college-it']);
  await assertIds(client, 'PWD', ['test-college-it']);
  await assertIds(client, 'Person with Disability (PWD)', ['test-college-it']);
  await assertIds(client, 'Natioanl Capital Regon', []);
  await assertIds(client, 'STEM', ['test-shs-stem']);
  await assertIds(client, 'STEM', [], 'College');
  await assertIds(client, 'marine biology', []);

  const updated = scholarship('test-college-it', {
    hardFilters: {
      academicLevel: 'College',
      courseProgram: ['BS Nursing'],
      geographicLocation: {
        scope: 'Region',
        regions: ['National Capital Region'],
        provinces: [],
        municipalities: []
      },
      citizenshipStatus: 'Filipino'
    }
  });
  const updateResult = await indexScholarship(updated, options);
  assert.strictEqual(updateResult.indexed, true);
  await assertIds(client, 'IT', []);
  await assertIds(client, 'BS Nursing', [
    'test-college-it',
    'test-college-nursing'
  ]);

  const closed = scholarship('test-college-it', { status: 'Closed' });
  const closeResult = await indexScholarship(closed, options);
  assert.deepStrictEqual(closeResult, {
    indexed: false,
    id: 'test-college-it',
    reason: 'closed-or-archived'
  });
  await assertIds(client, 'BS Nursing', ['test-college-nursing']);

  const archived = scholarship('test-college-nursing', { isArchived: true });
  const archiveResult = await indexScholarship(archived, options);
  assert.strictEqual(archiveResult.indexed, false);
  await assertIds(client, 'BS Nursing', []);

  const removed = await removeScholarship('test-shs-stem', options);
  assert.strictEqual(removed.removed, true);
  await assertIds(client, 'STEM', []);

  const second = await rebuildIndex(fixtures(), options);
  exactIndexesToRemove.add(second.physicalName);
  assert.strictEqual(second.indexed, 3);
  assert.strictEqual(second.skipped, 2);
  assert.notStrictEqual(second.physicalName, first.physicalName);
  await assertIds(client, 'IT', ['test-college-it']);
  await assertIds(client, 'STEM', ['test-shs-stem']);
  await assertIds(client, 'marine biology', []);

  await client.indices.create({
    index: REJECT_INDEX,
    settings: {
      number_of_shards: 1,
      number_of_replicas: 0
    },
    mappings: {
      dynamic: 'strict',
      properties: {
        scholarshipId: { type: 'keyword' }
      }
    }
  });
  await assert.rejects(
    () =>
      indexScholarship(scholarship('test-index-failure'), {
        client,
        indexName: REJECT_INDEX
      }),
    /Failed to index scholarship test-index-failure[\s\S]*strict_dynamic_mapping_exception/i
  );

  const alias = await client.indices.getAlias({ name: TEST_INDEX });
  const aliasIndices = Object.keys(alias.body || alias);
  assert.deepStrictEqual(aliasIndices, [second.physicalName]);
};

const removeKnownTestIndexes = async (client) => {
  for (const indexName of exactIndexesToRemove) {
    await deleteExactIndex(client, indexName);
  }
};

const cleanup = async (client) => {
  if (!client) {
    return;
  }

  try {
    await removeKnownTestIndexes(client);
  } catch (error) {
    const message = sanitizeErrorMessage(error.message);

    if (/ECONNREFUSED|unreachable/i.test(message)) {
      return;
    }

    console.error(`Test index cleanup failed. ${message}`);
    process.exitCode = 1;
  }
};

const main = async () => {
  try {
    await run();
    console.log('scholarship search tests passed');
  } catch (error) {
    console.error(sanitizeErrorMessage(error && error.message ? error.message : error));
    process.exitCode = 1;
  } finally {
    await cleanup(activeClient);
  }
};

main();
