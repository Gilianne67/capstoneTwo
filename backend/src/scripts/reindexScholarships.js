const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../../.env'), quiet: true });

const Scholarship = require('../models/Scholarship');
const {
  isElasticsearchEnabled,
  sanitizeErrorMessage
} = require('../config/elasticsearch');
const { rebuildIndex } = require('../services/scholarshipSearchService');

const fail = (error) => {
  const message = error && error.message ? error.message : String(error);
  console.error(sanitizeErrorMessage(message));
  process.exit(1);
};

const reindexScholarships = async () => {
  if (!isElasticsearchEnabled()) {
    throw new Error(
      'Elasticsearch is disabled. Set ELASTICSEARCH_ENABLED=true in backend/.env before reindexing.'
    );
  }

  const mongoUri = String(process.env.MONGO_URI || '').trim();

  if (!mongoUri) {
    throw new Error('MONGO_URI is missing. Add it to backend/.env before reindexing.');
  }

  await mongoose.connect(mongoUri);

  try {
    const [total, scholarships] = await Promise.all([
      Scholarship.countDocuments(),
      Scholarship.find({ status: 'Open', isArchived: false }).lean()
    ]);
    const skippedByQuery = total - scholarships.length;
    const result = await rebuildIndex(scholarships);

    console.log(`Scholarships in MongoDB: ${total}`);
    console.log(`Indexed open scholarships: ${result.indexed}`);
    console.log(`Skipped closed or archived: ${skippedByQuery + result.skipped}`);
    console.log(`Alias: ${result.aliasName}`);
    console.log(`Physical index: ${result.physicalName}`);
  } finally {
    await mongoose.disconnect();
  }
};

reindexScholarships().catch(fail);
