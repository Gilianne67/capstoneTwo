const CourseAlias = require('../models/CourseAlias');
const { COURSE_CATALOG } = require('../data/courseCatalog');

const FILLER_WORDS = new Set(['the', 'in', 'of', 'and', 'a', 'an']);

const DEGREE_PREFIXES = [
  [/\bbachelor'?s?\s+of\s+science\s+in\b/g, 'bs '],
  [/\bbachelor'?s?\s+of\s+science\b/g, 'bs '],
  [/\bbachelor'?s?\s+of\s+arts\s+in\b/g, 'ba '],
  [/\bbachelor'?s?\s+of\s+arts\b/g, 'ba '],
  [/\bbachelor'?s?\s+of\s+secondary\s+education\b/g, 'bsed '],
  [/\bmaster'?s?\s+of\s+science\s+in\b/g, 'ms '],
  [/\bmaster'?s?\s+of\s+science\b/g, 'ms '],
  [/\bmaster'?s?\s+of\s+business\s+administration\b/g, 'mba '],
  [/\bmaster\s+of\s+business\s+administration\b/g, 'mba ']
];

const normalizeCourseText = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  let text = String(value).toLowerCase().trim();

  if (!text) {
    return '';
  }

  text = text.replace(/&/g, ' and ');

  // Collapse dotted acronyms: b.s.i.t. → bsit, b.s. → bs
  text = text.replace(/\b(?:[a-z]\.)+[a-z]\.?\b/g, (match) =>
    match.replace(/\./g, '')
  );

  DEGREE_PREFIXES.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });

  text = text.replace(/[^a-z0-9]+/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();

  text = text
    .split(' ')
    .filter((word) => word && !FILLER_WORDS.has(word))
    .join(' ');

  return text;
};

const aliasIndexKey = (academicLevel, normalizedAlias) =>
  `${academicLevel}::${normalizedAlias}`;

const collectAliasStrings = (entry) => {
  const values = [
    entry.canonicalId,
    entry.canonicalName,
    ...(Array.isArray(entry.aliases) ? entry.aliases : [])
  ];

  if (typeof entry.canonicalId === 'string' && entry.canonicalId.includes('-')) {
    const withoutPrefix = entry.canonicalId.replace(/^(shs|college|grad)-/, '');
    values.push(withoutPrefix.replace(/-/g, ' '));
  }

  return values;
};

const buildAliasIndex = (entries) => {
  const index = new Map();

  (entries || []).forEach((entry) => {
    if (!entry?.canonicalId || !entry?.academicLevel) {
      return;
    }

    collectAliasStrings(entry).forEach((alias) => {
      const normalized = normalizeCourseText(alias);

      if (!normalized) {
        return;
      }

      index.set(
        aliasIndexKey(entry.academicLevel, normalized),
        entry.canonicalId
      );
    });
  });

  return index;
};

const CATALOG_INDEX = buildAliasIndex(COURSE_CATALOG);

const resolveCanonical = (value, academicLevel, aliasIndex = CATALOG_INDEX) => {
  const normalized = normalizeCourseText(value);

  if (!normalized || !academicLevel) {
    return null;
  }

  return aliasIndex.get(aliasIndexKey(academicLevel, normalized)) || null;
};

const toMatchIds = (value, academicLevel, aliasIndex = CATALOG_INDEX) => {
  const normalized = normalizeCourseText(value);
  const ids = new Set();

  if (!normalized) {
    return ids;
  }

  const canonicalId = resolveCanonical(value, academicLevel, aliasIndex);

  if (canonicalId) {
    ids.add(canonicalId);
    return ids;
  }

  ids.add(`raw:${normalized}`);
  return ids;
};

const setsIntersect = (left, right) => {
  for (const value of left) {
    if (right.has(value)) {
      return true;
    }
  }

  return false;
};

const loadAliasIndex = async () => {
  const index = buildAliasIndex(COURSE_CATALOG);

  const dbEntries = await CourseAlias.find().lean();

  if (Array.isArray(dbEntries) && dbEntries.length > 0) {
    const dbIndex = buildAliasIndex(dbEntries);
    dbIndex.forEach((canonicalId, key) => {
      index.set(key, canonicalId);
    });
  }

  return index;
};

module.exports = {
  FILLER_WORDS,
  COURSE_CATALOG,
  normalizeCourseText,
  buildAliasIndex,
  resolveCanonical,
  toMatchIds,
  setsIntersect,
  loadAliasIndex,
  CATALOG_INDEX
};
