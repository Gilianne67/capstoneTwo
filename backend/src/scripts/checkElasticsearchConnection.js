
const {
  createElasticsearchClient,
  assertClusterReady,
  sanitizeErrorMessage,
} = require('../config/elasticsearch');

const run = async () => {
  let client;

  try {
    client = createElasticsearchClient();

    const health = await assertClusterReady(client);

    console.log('Elasticsearch connection successful.');
    console.log(`Cluster status: ${health.status}`);
    console.log(`Cluster name: ${health.cluster_name || 'available'}`);
  } catch (error) {
    console.error(
      'Elasticsearch connection check failed:',
      sanitizeErrorMessage(error.message)
    );
    process.exitCode = 1;
  } finally {
    if (client) {
      await client.close().catch(() => {});
    }
  }
};

run();
