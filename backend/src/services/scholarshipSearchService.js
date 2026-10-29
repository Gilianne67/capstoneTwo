const mongoose = require('mongoose');

const { REGIONS } = require('../data/regions');
const {
  COURSE_CATALOG,
  resolveCanonical,
  expandCourseAliases
} = require('../utils/courseCanonicalCore');
const {
  createElasticsearchClient,
  assertClusterReady,
  getElasticsearchIndex,
  asBoolean,
  sanitizeErrorMessage
} = require('../config/elasticsearch');

/**
 * These groups mirror FLAG_TAGS in matchingEngine.js and the extra
 * labels already used by the student search page. Phase 1 does not
 * import the matching engine, so scoring and eligibility rules stay put.
 */
const ELIGIBILITY_SYNONYM_GROUPS = [
  ['Indigenous Peoples (IP)', 'IP', 'Indigenous Peoples'],
  ['Person with Disability (PWD)', 'PWD', 'PWD Status'],
  ['Solo Parent Dependent', 'Solo Parent Child'],
  ['Orphan Status', 'Orphan'],
  [
    'Child of Farmer / Fisherfolk',
    'Farmer/Fisherfolk Child',
    'Farmer / Fisherfolk Child'
  ],
  ['Disaster-Affected Family', 'Disaster Affected'],
  ['4Ps Beneficiary', '4Ps']
];

/**
 * Canonical names match REGIONS in frontend/src/data/locationData.js
 * and the backend copy in src/data/regions.js.
 * Extra labels reuse the region aliases already present in ScholarshipSearch.jsx
 * and the standard Philippine region codes for the remaining regions.
 */
const REGION_SYNONYM_GROUPS = [
  ['National Capital Region', 'NCR'],
  ['Cordillera Administrative Region', 'CAR'],
  ['Ilocos Region', 'Region I', 'Region 1'],
  ['Cagayan Valley', 'Region II', 'Region 2'],
  ['Central Luzon', 'Region III', 'Region 3'],
  [
    'CALABARZON',
    'Region IV-A',
    'Region 4-A',
    'Region IVA',
    'Region IV-A (CALABARZON)'
  ],
  ['MIMAROPA', 'MIMAROPA Region', 'Region IV-B', 'Region 4-B'],
  ['Bicol Region', 'Region V', 'Region 5', 'Region V (Bicol Region)'],
  ['Western Visayas', 'Region VI', 'Region 6'],
  ['Central Visayas', 'Region VII', 'Region 7'],
  ['Eastern Visayas', 'Region VIII', 'Region 8'],
  ['Zamboanga Peninsula', 'Region IX', 'Region 9'],
  ['Northern Mindanao', 'Region X', 'Region 10'],
  ['Davao Region', 'Region XI', 'Region 11'],
  ['SOCCSKSARGEN', 'Region XII', 'Region 12'],
  ['Caraga', 'Region XIII', 'Region 13'],
  ['Bangsamoro Autonomous Region in Muslim Mindanao', 'BARMM']
];

/**
 * Must stay aligned with the course_dots, course_separators, and
 * course_edge_underscores char filters below, followed by lowercase.
 * Each course, location, or eligibility phrase becomes one token so
 * "IT" does not match text that merely contains those letters.
 */
const toSynonymToken = (value) => {
  let text = String(value || '').toLowerCase().trim();
  text = text.replace(/\./g, '');
  text = text.replace(/[^a-z0-9]+/g, '_');
  text = text.replace(/^_+|_+$/g, '');
  return text;
};

const unique = (values) => {
  const seen = new Set();
  const result = [];

  values.forEach((value) => {
    if (!value || seen.has(value)) {
      return;
    }

    seen.add(value);
    result.push(value);
  });

  return result;
};

const buildSynonymLines = (groups) => {
  const owner = new Map();
  const lines = [];

  groups.forEach((group, index) => {
    const tokens = [];

    (group || []).forEach((phrase) => {
      const token = toSynonymToken(phrase);

      if (!token) {
        return;
      }

      const previous = owner.get(token);

      if (previous !== undefined && previous !== index) {
        throw new Error(
          `Synonym token "${token}" belongs to more than one group. Aliases must stay unambiguous.`
        );
      }

      owner.set(token, index);

      if (!tokens.includes(token)) {
        tokens.push(token);
      }
    });

    if (tokens.length > 1) {
      lines.push(tokens.join(', '));
    }
  });

  return lines;
};

const copyCourseEntry = (entry) => ({
  canonicalId: entry.canonicalId,
  canonicalName: entry.canonicalName,
  academicLevel: entry.academicLevel,
  aliases: Array.isArray(entry.aliases) ? [...entry.aliases] : []
});

const mergeCourseEntries = (dbEntries = []) => {
  const byId = new Map(
    COURSE_CATALOG.map((entry) => [entry.canonicalId, copyCourseEntry(entry)])
  );

  dbEntries.forEach((entry) => {
    if (!entry || !entry.canonicalId) {
      return;
    }

    const existing = byId.get(entry.canonicalId);
    const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];

    if (!existing) {
      byId.set(entry.canonicalId, {
        canonicalId: entry.canonicalId,
        canonicalName: entry.canonicalName || '',
        academicLevel: entry.academicLevel || '',
        aliases
      });
      return;
    }

    if (entry.canonicalName) {
      existing.aliases.push(entry.canonicalName);
    }

    existing.aliases.push(...aliases);
  });

  return Array.from(byId.values()).map((entry) => expandCourseAliases(entry));
};

const courseGroupsFromEntries = (entries) =>
  entries.map((entry) =>
    unique([
      entry.canonicalName,
      ...(Array.isArray(entry.aliases) ? entry.aliases : [])
    ])
  );

const loadDbCourseEntries = async () => {
  if (mongoose.connection.readyState !== 1) {
    return [];
  }

  const CourseAlias = require('../models/CourseAlias');
  return CourseAlias.find().lean();
};

const loadCanonicalRegions = async () => {
  if (!Array.isArray(REGIONS) || REGIONS.length === 0) {
    throw new Error('regions.js did not export a region list.');
  }

  return REGIONS;
};

const assertRegionGroupsCoverCatalog = (regions) => {
  const catalog = new Set(regions);
  const seen = new Set();

  REGION_SYNONYM_GROUPS.forEach((group) => {
    const name = group[0];

    if (!catalog.has(name)) {
      throw new Error(
        `Location synonym group "${name}" is not a region in locationData.js.`
      );
    }

    if (seen.has(name)) {
      throw new Error(`Duplicate location synonym group for "${name}".`);
    }

    seen.add(name);
  });

  regions.forEach((region) => {
    if (!seen.has(region)) {
      throw new Error(`Region "${region}" has no location synonym group.`);
    }
  });
};

const phraseCharFilters = ['phrase_dots', 'phrase_separators', 'phrase_edge_underscores'];

const buildAnalysisSettings = (courseLines, locationLines, eligibilityLines) => ({
  number_of_shards: 1,
  number_of_replicas: 0,
  analysis: {
    char_filter: {
      phrase_dots: {
        type: 'pattern_replace',
        pattern: '\\.',
        replacement: ''
      },
      phrase_separators: {
        type: 'pattern_replace',
        pattern: '[^A-Za-z0-9]+',
        replacement: '_'
      },
      phrase_edge_underscores: {
        type: 'pattern_replace',
        pattern: '(^_+|_+$)',
        replacement: ''
      }
    },
    filter: {
      english_stop: {
        type: 'stop',
        stopwords: '_english_'
      },
      course_synonyms: {
        type: 'synonym_graph',
        synonyms: courseLines,
        lenient: false
      },
      location_synonyms: {
        type: 'synonym_graph',
        synonyms: locationLines,
        lenient: false
      },
      eligibility_synonyms: {
        type: 'synonym_graph',
        synonyms: eligibilityLines,
        lenient: false
      }
    },
    analyzer: {
      course_index: {
        type: 'custom',
        char_filter: phraseCharFilters,
        tokenizer: 'keyword',
        filter: ['lowercase']
      },
      course_search: {
        type: 'custom',
        char_filter: phraseCharFilters,
        tokenizer: 'keyword',
        filter: ['lowercase', 'course_synonyms']
      },
      location_index: {
        type: 'custom',
        char_filter: phraseCharFilters,
        tokenizer: 'keyword',
        filter: ['lowercase']
      },
      location_search: {
        type: 'custom',
        char_filter: phraseCharFilters,
        tokenizer: 'keyword',
        filter: ['lowercase', 'location_synonyms']
      },
      eligibility_index: {
        type: 'custom',
        char_filter: phraseCharFilters,
        tokenizer: 'keyword',
        filter: ['lowercase']
      },
      eligibility_search: {
        type: 'custom',
        char_filter: phraseCharFilters,
        tokenizer: 'keyword',
        filter: ['lowercase', 'eligibility_synonyms']
      },
      literal_text: {
        type: 'custom',
        tokenizer: 'standard',
        filter: ['lowercase']
      },
      description_text: {
        type: 'custom',
        tokenizer: 'standard',
        filter: ['lowercase', 'english_stop']
      }
    }
  }
});

const INDEX_MAPPINGS = {
  dynamic: 'strict',
  properties: {
    scholarshipId: { type: 'keyword' },
    name: {
      type: 'text',
      analyzer: 'literal_text',
      search_analyzer: 'literal_text'
    },
    scholarshipType: {
      type: 'text',
      analyzer: 'literal_text',
      search_analyzer: 'literal_text'
    },
    description: {
      type: 'text',
      analyzer: 'description_text',
      search_analyzer: 'description_text'
    },
    benefits: {
      type: 'text',
      analyzer: 'description_text',
      search_analyzer: 'description_text'
    },
    grantValue: { type: 'keyword' },
    academicLevel: { type: 'keyword' },
    courseProgram: {
      type: 'text',
      analyzer: 'course_index',
      search_analyzer: 'course_search'
    },
    canonicalCourseIds: { type: 'keyword' },
    locations: {
      type: 'text',
      analyzer: 'location_index',
      search_analyzer: 'location_search'
    },
    locationScope: { type: 'keyword' },
    citizenshipStatus: { type: 'keyword' },
    eligibilityTags: {
      type: 'text',
      analyzer: 'eligibility_index',
      search_analyzer: 'eligibility_search'
    },
    status: { type: 'keyword' },
    isArchived: { type: 'boolean' },
    deadline: { type: 'date' },
    updatedAt: { type: 'date' }
  }
};

const responseBody = (value) => (value && value.body ? value.body : value);

const isSearchableScholarship = (scholarship) => {
  if (!scholarship || scholarship.isArchived === true || scholarship.adminRemovedAt) {
    return false;
  }

  return String(scholarship.status || '').trim().toLowerCase() === 'open';
};

const requireScholarshipId = (scholarship) => {
  const id = scholarship && (scholarship._id || scholarship.id);

  if (id === undefined || id === null || String(id).trim() === '') {
    throw new Error('Cannot index a scholarship without an id.');
  }

  return String(id);
};

const asStringList = (values) =>
  (Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean);

const toIsoDate = (value, label, id) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Scholarship ${id} has an invalid ${label}.`);
  }

  return date.toISOString();
};

const toSearchDocument = (scholarship) => {
  const id = requireScholarshipId(scholarship);

  if (!isSearchableScholarship(scholarship)) {
    return null;
  }

  const hardFilters = scholarship.hardFilters || {};
  const geographicLocation = hardFilters.geographicLocation || {};
  const academicLevel = String(hardFilters.academicLevel || '').trim();
  const courseProgram = asStringList(hardFilters.courseProgram);
  const canonicalCourseIds = unique(
    courseProgram
      .map((course) => resolveCanonical(course, academicLevel))
      .filter(Boolean)
  );

  const document = {
    scholarshipId: id,
    name: String(scholarship.name || '').trim(),
    scholarshipType: String(scholarship.scholarshipType || '').trim(),
    description: String(scholarship.description || '').trim(),
    benefits: asStringList(scholarship.benefits),
    grantValue: String(scholarship.grantValue || '').trim(),
    academicLevel,
    courseProgram,
    canonicalCourseIds,
    locations: asStringList([
      ...(geographicLocation.regions || []),
      ...(geographicLocation.provinces || []),
      ...(geographicLocation.municipalities || [])
    ]),
    locationScope: String(geographicLocation.scope || '').trim(),
    citizenshipStatus: String(hardFilters.citizenshipStatus || '').trim(),
    eligibilityTags: asStringList(
      (scholarship.specialTags || []).map((tag) => tag && tag.tagName)
    ),
    status: 'Open',
    isArchived: false
  };

  const deadline = toIsoDate(scholarship.deadline, 'deadline', id);
  const updatedAt = toIsoDate(scholarship.updatedAt, 'updatedAt', id);

  if (deadline) {
    document.deadline = deadline;
  }

  if (updatedAt) {
    document.updatedAt = updatedAt;
  }

  return document;
};

const buildIndexDefinition = async () => {
  const regions = await loadCanonicalRegions();
  assertRegionGroupsCoverCatalog(regions);

  const dbEntries = await loadDbCourseEntries();
  const courseLines = buildSynonymLines(
    courseGroupsFromEntries(mergeCourseEntries(dbEntries))
  );
  const locationLines = buildSynonymLines(REGION_SYNONYM_GROUPS);
  const eligibilityLines = buildSynonymLines(ELIGIBILITY_SYNONYM_GROUPS);

  if (courseLines.length === 0 || locationLines.length === 0 || eligibilityLines.length === 0) {
    throw new Error('Synonym rules were empty. Refusing to create the search index.');
  }

  return {
    settings: buildAnalysisSettings(courseLines, locationLines, eligibilityLines),
    mappings: INDEX_MAPPINGS
  };
};

const resolveClient = (options = {}) =>
  options.client || createElasticsearchClient();

// Status and archive sync wait on this client. A closed Elasticsearch port
// must fail the health check immediately. The default client retries with
// multi-second backoff, which held the PATCH open. Student search keeps
// that default client.
const resolveSyncClient = (options = {}) =>
  options.client || createElasticsearchClient({ maxRetries: 0 });

const resolveIndexName = (options = {}) =>
  options.indexName || getElasticsearchIndex();

const deleteIndexIfExists = async (client, indexName) => {
  const exists = asBoolean(await client.indices.exists({ index: indexName }));

  if (!exists) {
    return;
  }

  await client.indices.delete({ index: indexName });
};

const createPhysicalIndex = async (client, physicalName) => {
  const definition = await buildIndexDefinition();

  try {
    await client.indices.create({
      index: physicalName,
      settings: definition.settings,
      mappings: definition.mappings
    });
  } catch (error) {
    throw new Error(
      `Failed to create Elasticsearch index ${physicalName}. ${sanitizeErrorMessage(error.message)}`
    );
  }
};

const bulkIndex = async (client, indexName, documents) => {
  const chunkSize = 100;

  for (let offset = 0; offset < documents.length; offset += chunkSize) {
    const chunk = documents.slice(offset, offset + chunkSize);
    const operations = chunk.flatMap((document) => [
      { index: { _index: indexName, _id: document.scholarshipId } },
      document
    ]);

    let result;

    try {
      result = await client.bulk({ refresh: false, operations });
    } catch (error) {
      throw new Error(
        `Bulk indexing failed. ${sanitizeErrorMessage(error.message)}`
      );
    }

    const body = responseBody(result);

    if (body && body.errors) {
      const failed = (body.items || []).filter(
        (item) => item && item.index && item.index.error
      );
      const first = failed[0] && failed[0].index && failed[0].index.error;
      const reason = first
        ? `${first.type || 'error'}: ${sanitizeErrorMessage(first.reason)}`
        : 'unknown bulk error';

      throw new Error(
        `Bulk indexing failed for ${failed.length} document(s). ${reason}`
      );
    }
  }
};

const swapAlias = async (client, aliasName, physicalName) => {
  const aliasExists = asBoolean(
    await client.indices.existsAlias({ name: aliasName })
  );
  const nameExists = asBoolean(
    await client.indices.exists({ index: aliasName })
  );

  if (nameExists && !aliasExists) {
    throw new Error(
      `Cannot use "${aliasName}" as an alias because a concrete index already has that name.`
    );
  }

  let previous = [];

  if (aliasExists) {
    const current = responseBody(
      await client.indices.getAlias({ name: aliasName })
    );
    previous = Object.keys(current || {}).filter((name) => name !== physicalName);
  }

  try {
    await client.indices.updateAliases({
      actions: [
        ...previous.map((index) => ({ remove: { index, alias: aliasName } })),
        { add: { index: physicalName, alias: aliasName } }
      ]
    });
  } catch (error) {
    throw new Error(
      `Failed to point alias "${aliasName}" at ${physicalName}. ${sanitizeErrorMessage(error.message)}`
    );
  }

  if (previous.length === 0) {
    return;
  }

  try {
    await client.indices.delete({ index: previous });
  } catch (error) {
    throw new Error(
      `Alias "${aliasName}" now points at ${physicalName}, but deleting the previous index failed. ${sanitizeErrorMessage(error.message)}`
    );
  }
};

const rebuildIndex = async (scholarships, options = {}) => {
  if (!Array.isArray(scholarships)) {
    throw new Error('rebuildIndex requires an array of scholarships.');
  }

  const client = resolveClient(options);
  const aliasName = resolveIndexName(options);
  await assertClusterReady(client);

  const documents = [];
  let skipped = 0;

  scholarships.forEach((scholarship) => {
    const document = toSearchDocument(scholarship);

    if (!document) {
      skipped += 1;
      return;
    }

    documents.push(document);
  });

  const physicalName = `${aliasName}-${Date.now()}`;

  try {
    await createPhysicalIndex(client, physicalName);
    await bulkIndex(client, physicalName, documents);
    await client.indices.refresh({ index: physicalName });
    await swapAlias(client, aliasName, physicalName);
  } catch (error) {
    try {
      await deleteIndexIfExists(client, physicalName);
    } catch (cleanupError) {
      throw new Error(
        `${sanitizeErrorMessage(error.message)} Cleanup of ${physicalName} also failed. ${sanitizeErrorMessage(cleanupError.message)}`
      );
    }

    throw error;
  }

  return {
    aliasName,
    physicalName,
    indexed: documents.length,
    skipped
  };
};

const removeScholarship = async (id, options = {}) => {
  const scholarshipId = String(id || '').trim();

  if (!scholarshipId) {
    throw new Error('Cannot remove a scholarship without an id.');
  }

  const client = resolveSyncClient(options);
  const indexName = resolveIndexName(options);
  await assertClusterReady(client);

  try {
    await client.delete({
      index: indexName,
      id: scholarshipId,
      refresh: 'wait_for'
    });
  } catch (error) {
    const status = error && error.meta && error.meta.statusCode;

    if (status === 404 && options.ignoreMissing) {
      return { removed: false, id: scholarshipId };
    }

    if (status === 404) {
      throw new Error(
        `Scholarship ${scholarshipId} was not in the Elasticsearch index.`
      );
    }

    throw new Error(
      `Failed to remove scholarship ${scholarshipId} from Elasticsearch. ${sanitizeErrorMessage(error.message)}`
    );
  }

  return { removed: true, id: scholarshipId };
};

const indexScholarship = async (scholarship, options = {}) => {
  const id = requireScholarshipId(scholarship);
  const document = toSearchDocument(scholarship);

  if (!document) {
    await removeScholarship(id, { ...options, ignoreMissing: true });
    return { indexed: false, id, reason: 'closed-or-archived' };
  }

  const client = resolveSyncClient(options);
  const indexName = resolveIndexName(options);
  await assertClusterReady(client);

  try {
    await client.index({
      index: indexName,
      id,
      document,
      refresh: 'wait_for'
    });
  } catch (error) {
    throw new Error(
      `Failed to index scholarship ${id}. ${sanitizeErrorMessage(error.message)}`
    );
  }

  return { indexed: true, id };
};

const searchScholarships = async ({
  query,
  academicLevel,
  indexName,
  client,
  size = 20
} = {}) => {
  const text = String(query || '').trim();

  if (!text) {
    throw new Error('A search query is required.');
  }

  const es = client || createElasticsearchClient();
  const index = indexName || getElasticsearchIndex();
  await assertClusterReady(es);

  const filter = [
    { term: { status: 'Open' } },
    { term: { isArchived: false } }
  ];

  if (academicLevel) {
    filter.push({ term: { academicLevel: String(academicLevel).trim() } });
  }

  const matchText = (field, analyzerOptions = {}) => ({
    match: {
      [field]: {
        query: text,
        operator: 'and',
        zero_terms_query: 'none',
        ...analyzerOptions
      }
    }
  });

  let result;

  try {
    result = await es.search({
      index,
      size,
      query: {
        bool: {
          filter,
          should: [
            matchText('courseProgram'),
            matchText('locations'),
            matchText('eligibilityTags'),
            matchText('name'),
            matchText('scholarshipType'),
            matchText('description'),
            matchText('benefits')
          ],
          minimum_should_match: 1
        }
      }
    });
  } catch (error) {
    throw new Error(
      `Elasticsearch query failed. ${sanitizeErrorMessage(error.message)}`
    );
  }

  const body = responseBody(result);
  const hits = ((body.hits && body.hits.hits) || []).map((hit) => ({
    id: hit._id,
    score: hit._score,
    name: (hit._source && hit._source.name) || '',
    academicLevel: (hit._source && hit._source.academicLevel) || '',
    status: (hit._source && hit._source.status) || '',
    isArchived: Boolean(hit._source && hit._source.isArchived)
  }));
  const totalValue = body.hits && body.hits.total;
  const total =
    totalValue && typeof totalValue === 'object'
      ? totalValue.value
      : totalValue || hits.length;

  return { total, hits };
};

const PRODUCTION_INDEX_NAMES = new Set(['scholarships', '_all']);

const requireExactIndexName = (indexName) => {
  const name = String(indexName || '').trim();

  if (!name || name === '_all' || /[*?\s,]/.test(name)) {
    throw new Error(
      'Refusing to delete a wildcard or multi-index expression.'
    );
  }

  if (PRODUCTION_INDEX_NAMES.has(name) || /^scholarships-\d+$/.test(name)) {
    throw new Error(`Refusing to delete production index "${name}".`);
  }

  return name;
};

const isDedicatedTestIndexName = (name) =>
  name === 'scholarships_phase1_test' ||
  name === 'scholarships_phase1_reject' ||
  name === 'scholarships_phase1_missing' ||
  /^scholarships_phase1_test-\d+$/.test(name);

/**
 * Deletes one known test index, or the concrete index behind the test alias.
 * The delete call always receives one exact name. Wildcard expressions are rejected.
 */
const deleteExactIndex = async (client, indexName) => {
  const name = requireExactIndexName(indexName);

  if (!isDedicatedTestIndexName(name)) {
    throw new Error(
      `Refusing to delete "${name}" because it is not the dedicated test index.`
    );
  }

  const aliasExists = asBoolean(
    await client.indices.existsAlias({ name })
  );

  if (aliasExists) {
    const current = responseBody(
      await client.indices.getAlias({ name })
    );
    const concreteNames = Object.keys(current || {});

    concreteNames.forEach((concreteName) => {
      requireExactIndexName(concreteName);

      if (!/^scholarships_phase1_test-\d+$/.test(concreteName)) {
        throw new Error(
          `Refusing to delete "${concreteName}" while removing test alias "${name}".`
        );
      }
    });

    for (const concreteName of concreteNames) {
      const description = responseBody(
        await client.indices.get({ index: concreteName })
      );
      const aliases =
        (description &&
          description[concreteName] &&
          description[concreteName].aliases) ||
        {};

      if (!Object.prototype.hasOwnProperty.call(aliases, name)) {
        throw new Error(
          `Index "${concreteName}" is not attached to test alias "${name}".`
        );
      }

      await client.indices.delete({ index: concreteName });
    }

    return;
  }

  const exists = asBoolean(await client.indices.exists({ index: name }));

  if (!exists) {
    return;
  }

  await client.indices.delete({ index: name });
};

module.exports = {
  ELIGIBILITY_SYNONYM_GROUPS,
  REGION_SYNONYM_GROUPS,
  toSynonymToken,
  buildSynonymLines,
  mergeCourseEntries,
  isSearchableScholarship,
  toSearchDocument,
  buildIndexDefinition,
  rebuildIndex,
  indexScholarship,
  removeScholarship,
  searchScholarships,
  deleteExactIndex
};
