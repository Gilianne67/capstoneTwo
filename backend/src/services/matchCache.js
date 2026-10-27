const crypto = require('crypto');

const { manilaCalendarDate } = require('../utils/scholarshipInputValidation');
const {
  FLAG_TAGS,
  scoringConfiguration,
  isDeadlineOpen
} = require('./matchingEngine');

let defaultRedis;

const getDefaultRedis = () => {
  if (!defaultRedis) {
    defaultRedis = require('../config/redis');
  }
  return defaultRedis;
};

const MATCH_CACHE_TTL_SECONDS = 60;
const MATCH_CACHE_KEY_PREFIX = 'match:v1:';
const MATCH_CACHE_GENERATION_KEY = 'match:gen';
const MATCH_CACHE_TRUST_KEY = 'match:trust';
const CACHE_TRUSTED = '1';
const CACHE_UNTRUSTED = '0';
const DATE_MARK = '__matchCacheDate';

let invalidationTrusted = true;

const safeNotify = (notify, detail) => {
  if (typeof notify !== 'function') {
    return;
  }

  try {
    notify(detail);
  } catch (error) {
    console.error('Match cache observer failed.');
  }
};

const isReady = (client) => Boolean(client && client.isOpen && client.isReady);

const resolveClient = (client) => client || getDefaultRedis();

const normalizeMatchQuery = (query) => String(query || '').trim();

const profileMatchFields = (studentProfile) => {
  if (!studentProfile || typeof studentProfile !== 'object') {
    return null;
  }

  const userId = studentProfile.userId;
  const studentId = userId === undefined || userId === null
    ? ''
    : String(userId).trim();

  if (!studentId) {
    return null;
  }

  const flags = studentProfile.specialEligibilityFlags || {};
  const specialEligibilityFlags = {};

  FLAG_TAGS.forEach((entry) => {
    specialEligibilityFlags[entry.flag] = Boolean(flags[entry.flag]);
  });

  return {
    studentId,
    academicLevel: studentProfile.academicLevel ?? null,
    course: studentProfile.course ?? null,
    gwa: studentProfile.gwa ?? null,
    gwaScale: studentProfile.gwaScale ?? null,
    incomeBracket: studentProfile.incomeBracket ?? null,
    region: studentProfile.region ?? null,
    province: studentProfile.province ?? null,
    municipalityCity: studentProfile.municipalityCity ?? null,
    citizenship: studentProfile.citizenship ?? null,
    specialEligibilityFlags
  };
};

const matchCacheTimeKey = (now, explicitNow) => {
  const timestamp = now instanceof Date ? now : new Date(now);

  if (Number.isNaN(timestamp.getTime())) {
    return null;
  }

  if (explicitNow) {
    return `instant:${timestamp.toISOString()}`;
  }

  const manilaDay = manilaCalendarDate(timestamp);
  return manilaDay ? `manila:${manilaDay}` : null;
};

const buildMatchCacheKey = ({
  generation,
  studentProfile,
  query,
  now,
  explicitNow,
  scoring
} = {}) => {
  const profile = profileMatchFields(studentProfile);
  const timeKey = matchCacheTimeKey(now, explicitNow);
  const generationText = String(generation ?? '');

  if (!profile || !timeKey || !/^\d+$/.test(generationText)) {
    return null;
  }

  const digest = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      studentId: profile.studentId,
      profile,
      query: normalizeMatchQuery(query),
      scoring: scoring || scoringConfiguration(),
      timeKey
    }))
    .digest('hex');

  return `${MATCH_CACHE_KEY_PREFIX}${generationText}:${digest}`;
};

const matchesRespectDeadlines = (matches, now) =>
  matches.every((match) => {
    const scholarship = match && match.scholarship;
    return Boolean(scholarship) && isDeadlineOpen(scholarship.deadline, now);
  });

const readTrust = async (client) => {
  const value = await client.get(MATCH_CACHE_TRUST_KEY);

  if (value === null || value === undefined) {
    return CACHE_TRUSTED;
  }

  return String(value) === CACHE_UNTRUSTED ? CACHE_UNTRUSTED : CACHE_TRUSTED;
};

const markInvalidationUntrusted = async (client) => {
  invalidationTrusted = false;

  try {
    if (isReady(client) && typeof client.set === 'function') {
      await client.set(MATCH_CACHE_TRUST_KEY, CACHE_UNTRUSTED);
    }
  } catch (error) {
    console.error('Match cache trust update failed.');
  }
};

const markInvalidationTrusted = async (client) => {
  try {
    if (isReady(client) && typeof client.set === 'function') {
      await client.set(MATCH_CACHE_TRUST_KEY, CACHE_TRUSTED);
    }
  } catch (error) {
    invalidationTrusted = false;
    console.error('Match cache trust update failed.');
    return;
  }

  invalidationTrusted = true;
};

const readGeneration = async (client) => {
  const value = await client.get(MATCH_CACHE_GENERATION_KEY);

  if (value === null || value === undefined) {
    return '0';
  }

  const text = String(value);
  return /^\d+$/.test(text) ? text : null;
};

const markValue = (value) => {
  if (value instanceof Date) {
    return { [DATE_MARK]: value.toISOString() };
  }

  if (Array.isArray(value)) {
    return value.map(markValue);
  }

  if (value && typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);

    if (
      prototype !== Object.prototype &&
      prototype !== null &&
      typeof value.toJSON === 'function'
    ) {
      const jsonValue = value.toJSON();
      return jsonValue === value ? value : markValue(jsonValue);
    }

    const output = {};
    Object.keys(value).forEach((key) => {
      output[key] = markValue(value[key]);
    });
    return output;
  }

  return value;
};

const unmarkValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(unmarkValue);
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value);

    if (
      keys.length === 1 &&
      keys[0] === DATE_MARK &&
      typeof value[DATE_MARK] === 'string'
    ) {
      const date = new Date(value[DATE_MARK]);
      return Number.isNaN(date.getTime()) ? value : date;
    }

    const output = {};
    keys.forEach((key) => {
      output[key] = unmarkValue(value[key]);
    });
    return output;
  }

  return value;
};

const asCacheText = (raw) => {
  if (typeof raw === 'string') {
    return raw;
  }

  if (Buffer.isBuffer(raw)) {
    return raw.toString('utf8');
  }

  return null;
};

const decodeEntry = (raw, identity) => {
  const text = asCacheText(raw);

  if (!text) {
    return null;
  }

  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return null;
  }

  if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.matches)) {
    return null;
  }

  if (parsed.studentId !== identity.studentId) {
    return null;
  }

  if (parsed.query !== identity.query) {
    return null;
  }

  if (parsed.timeKey !== identity.timeKey) {
    return null;
  }

  return unmarkValue(parsed.matches);
};

const bypass = (notify, reason) => {
  safeNotify(notify, { event: 'bypass', reason });
  return { hit: false, store: false };
};

const readMatchCache = async ({
  studentProfile,
  query,
  now,
  explicitNow,
  redisClient,
  notify
} = {}) => {
  const client = resolveClient(redisClient);

  try {
    if (!invalidationTrusted) {
      return bypass(notify, 'invalidation_untrusted');
    }

    if (!isReady(client)) {
      return bypass(notify, 'redis_unavailable');
    }

    let trust;

    try {
      trust = await readTrust(client);
    } catch (error) {
      console.error('Match cache trust read failed.');
      return bypass(notify, 'invalidation_untrusted');
    }

    if (trust === CACHE_UNTRUSTED) {
      return bypass(notify, 'invalidation_untrusted');
    }

    const profile = profileMatchFields(studentProfile);

    if (!profile) {
      return bypass(notify, 'missing_student_id');
    }

    const normalizedQuery = normalizeMatchQuery(query);
    const timeKey = matchCacheTimeKey(now, explicitNow);

    if (!timeKey) {
      return bypass(notify, 'invalid_time');
    }

    const generation = await readGeneration(client);

    if (generation === null) {
      return bypass(notify, 'generation_unreadable');
    }

    const key = buildMatchCacheKey({
      generation,
      studentProfile,
      query: normalizedQuery,
      now,
      explicitNow
    });

    if (!key || !key.startsWith(MATCH_CACHE_KEY_PREFIX)) {
      return bypass(notify, 'key_unavailable');
    }

    const identity = {
      studentId: profile.studentId,
      query: normalizedQuery,
      timeKey
    };

    let raw;

    try {
      raw = await client.get(key);
    } catch (error) {
      console.error('Match cache read failed.');
      return bypass(notify, 'redis_read_failed');
    }

    if (raw !== null && raw !== undefined) {
      const matches = decodeEntry(raw, identity);

      if (matches && !matchesRespectDeadlines(matches, now)) {
        safeNotify(notify, {
          event: 'miss',
          key,
          generation,
          reason: 'deadline_elapsed'
        });
        return {
          hit: false,
          store: true,
          client,
          generation,
          key,
          identity,
          notify
        };
      }

      if (matches) {
        safeNotify(notify, { event: 'hit', key, generation });
        return {
          hit: true,
          store: false,
          matches,
          client,
          generation,
          key,
          identity,
          notify
        };
      }
    }

    safeNotify(notify, { event: 'miss', key, generation });
    return {
      hit: false,
      store: true,
      client,
      generation,
      key,
      identity,
      notify
    };
  } catch (error) {
    console.error('Match cache read failed.');
    return bypass(notify, 'redis_read_failed');
  }
};

const writeMatchCache = async (lookup, matches) => {
  if (!lookup || lookup.store !== true || !Array.isArray(matches)) {
    return { stored: false, reason: 'not_cacheable' };
  }

  const notify = lookup.notify;

  try {
    if (!isReady(lookup.client) || !lookup.key || !lookup.identity) {
      safeNotify(notify, { event: 'store-skipped', reason: 'redis_unavailable' });
      return { stored: false, reason: 'redis_unavailable' };
    }

    if (!String(lookup.key).startsWith(MATCH_CACHE_KEY_PREFIX)) {
      safeNotify(notify, { event: 'store-skipped', reason: 'unexpected_key' });
      return { stored: false, reason: 'unexpected_key' };
    }

    const current = await readGeneration(lookup.client);

    if (current !== lookup.generation) {
      safeNotify(notify, {
        event: 'store-skipped',
        key: lookup.key,
        reason: 'generation_changed'
      });
      return { stored: false, reason: 'generation_changed' };
    }

    const payload = JSON.stringify({
      v: 1,
      studentId: lookup.identity.studentId,
      query: lookup.identity.query,
      timeKey: lookup.identity.timeKey,
      matches: markValue(matches)
    });

    await lookup.client.set(lookup.key, payload, {
      EX: MATCH_CACHE_TTL_SECONDS
    });
    safeNotify(notify, { event: 'store', key: lookup.key, generation: lookup.generation });
    return { stored: true, key: lookup.key };
  } catch (error) {
    console.error('Match cache write failed.');
    safeNotify(notify, {
      event: 'store-skipped',
      key: lookup.key,
      reason: 'redis_write_failed'
    });
    return { stored: false, reason: 'redis_write_failed' };
  }
};

/**
 * Advances the match-result generation. Older match:v1 entries are left
 * to expire and are not read again. Session keys are not touched.
 */
const invalidateMatchCache = async (client) => {
  const redis = resolveClient(client);

  try {
    if (!isReady(redis) || typeof redis.incr !== 'function') {
      await markInvalidationUntrusted(redis);
      return { ok: false, reason: 'redis_unavailable' };
    }

    const generation = await redis.incr(MATCH_CACHE_GENERATION_KEY);
    await markInvalidationTrusted(redis);
    return { ok: true, generation: String(generation) };
  } catch (error) {
    console.error('Match cache invalidation failed.');
    await markInvalidationUntrusted(redis);
    return { ok: false, reason: 'redis_write_failed' };
  }
};

module.exports = {
  MATCH_CACHE_TTL_SECONDS,
  MATCH_CACHE_KEY_PREFIX,
  MATCH_CACHE_GENERATION_KEY,
  MATCH_CACHE_TRUST_KEY,
  normalizeMatchQuery,
  profileMatchFields,
  matchCacheTimeKey,
  buildMatchCacheKey,
  readMatchCache,
  writeMatchCache,
  invalidateMatchCache
};
