const {
  COURSE_CATALOG,
  expandCourseAliases
} = require('../data/courseCatalog');

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

/**
 * One normalized alias at one academic level may belong to only one
 * canonical course. Conflicting claims are left unresolved so an
 * ambiguous abbreviation cannot pick a program by overwrite order.
 */
const collectAliasClaims = (entries) => {
  const claims = new Map();

  (entries || []).forEach((entry) => {
    const expanded = expandCourseAliases(entry);

    if (!expanded?.canonicalId || !expanded?.academicLevel) {
      return;
    }

    collectAliasStrings(expanded).forEach((alias) => {
      const normalized = normalizeCourseText(alias);

      if (!normalized) {
        return;
      }

      const key = aliasIndexKey(expanded.academicLevel, normalized);

      if (!claims.has(key)) {
        claims.set(key, new Set());
      }

      claims.get(key).add(expanded.canonicalId);
    });
  });

  return claims;
};

const buildAliasIndex = (entries) => {
  const index = new Map();

  collectAliasClaims(entries).forEach((ids, key) => {
    if (ids.size === 1) {
      index.set(key, ids.values().next().value);
    }
  });

  return index;
};

const mergeAliasIndex = (base, incoming) => {
  const merged = new Map(base);
  const ambiguous = new Set();

  (incoming || new Map()).forEach((canonicalId, key) => {
    if (ambiguous.has(key)) {
      return;
    }

    const existing = merged.get(key);

    if (existing && existing !== canonicalId) {
      merged.delete(key);
      ambiguous.add(key);
      return;
    }

    merged.set(key, canonicalId);
  });

  return merged;
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

module.exports = {
  FILLER_WORDS,
  COURSE_CATALOG,
  expandCourseAliases,
  normalizeCourseText,
  collectAliasClaims,
  buildAliasIndex,
  mergeAliasIndex,
  resolveCanonical,
  toMatchIds,
  setsIntersect,
  CATALOG_INDEX
};
