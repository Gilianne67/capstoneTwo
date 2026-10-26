const { Client } = require('@elastic/elasticsearch');

const TRUE_VALUES = new Set(['true', '1', 'yes']);

const isElasticsearchEnabled = () =>
  TRUE_VALUES.has(
    String(process.env.ELASTICSEARCH_ENABLED || '').trim().toLowerCase()
  );

const getElasticsearchNode = () =>
  String(process.env.ELASTICSEARCH_NODE || 'http://127.0.0.1:9200').trim();

const getElasticsearchApiKey = () =>
  String(process.env.ELASTICSEARCH_API_KEY || '').trim();

const getElasticsearchUsername = () =>
  String(process.env.ELASTICSEARCH_USERNAME || '').trim();

const getElasticsearchPassword = () =>
  String(process.env.ELASTICSEARCH_PASSWORD || '').trim();

const getElasticsearchIndex = () =>
  String(process.env.ELASTICSEARCH_INDEX || 'scholarships').trim();

const redactSecret = (message, secret) => {
  const value = String(secret || '');

  if (value.length < 4) {
    return message;
  }

  return message.split(value).join('[redacted]');
};

const sanitizeErrorMessage = (message) => {
  const username = getElasticsearchUsername();
  const password = getElasticsearchPassword();
  let text = String(message || 'Unexpected Elasticsearch error.')
    .replace(/mongodb(?:\+srv)?:\/\/[^@\s]+@/gi, 'mongodb://[redacted]@')
    .replace(/\/\/([^/\s:@]*):([^/\s@]*)@/g, '//[redacted]@')
    .replace(
      /(api[_-]?key|authorization|password)(['"\s:=]+)[^\s'"]+/gi,
      '$1$2[redacted]'
    );

  text = redactSecret(text, password);

  if (username && password) {
    const basicToken = Buffer.from(`${username}:${password}`).toString('base64');
    text = redactSecret(text, basicToken);
  }

  return text;
};

/**
 * Loading this module does not open a connection.
 * A client is created only when keyword search or indexing runs.
 */
const createElasticsearchClient = (overrides = {}) => {
  const enabled =
    overrides.enabled === undefined
      ? isElasticsearchEnabled()
      : Boolean(overrides.enabled);

  if (!enabled) {
    const error = new Error(
      'Elasticsearch is disabled. Set ELASTICSEARCH_ENABLED=true before indexing or searching.'
    );
    error.code = 'ELASTICSEARCH_DISABLED';
    throw error;
  }

  const node = String(overrides.node || getElasticsearchNode()).trim();

  if (!node) {
    throw new Error('ELASTICSEARCH_NODE is empty.');
  }

  const apiKey =
    overrides.apiKey === undefined
      ? getElasticsearchApiKey()
      : String(overrides.apiKey || '').trim();

  const username =
    overrides.username === undefined
      ? getElasticsearchUsername()
      : String(overrides.username || '').trim();

  const password =
    overrides.password === undefined
      ? getElasticsearchPassword()
      : String(overrides.password || '').trim();

  const config = {
    node,
    requestTimeout: overrides.requestTimeout ?? 10000,
    pingTimeout: overrides.pingTimeout ?? 3000,
    maxRetries: overrides.maxRetries ?? 2
  };

  if (apiKey) {
    config.auth = { apiKey };
  } else if (username && password) {
    config.auth = { username, password };
  }

  return new Client(config);
};

const assertClusterReady = async (client) => {
  if (!client) {
    throw new Error('Elasticsearch client is required.');
  }

  let health;

  try {
    health = await client.cluster.health({ timeout: '3s' });
  } catch (error) {
    const wrapped = new Error(
      `Elasticsearch is unreachable. ${sanitizeErrorMessage(error.message)}`
    );
    wrapped.code = 'ELASTICSEARCH_UNAVAILABLE';
    throw wrapped;
  }

  const body = health && health.body ? health.body : health;
  const status = body && body.status;

  if (status !== 'green' && status !== 'yellow') {
    throw new Error(
      `Elasticsearch cluster is not ready (status: ${status || 'unknown'}).`
    );
  }

  return body;
};

const asBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value && typeof value.body === 'boolean') {
    return value.body;
  }

  return Boolean(value);
};

module.exports = {
  isElasticsearchEnabled,
  getElasticsearchNode,
  getElasticsearchApiKey,
  getElasticsearchUsername,
  getElasticsearchPassword,
  getElasticsearchIndex,
  sanitizeErrorMessage,
  createElasticsearchClient,
  assertClusterReady,
  asBoolean
};
