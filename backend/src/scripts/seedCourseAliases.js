const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const CourseAlias = require('../models/CourseAlias');
const { COURSE_CATALOG } = require('../data/courseCatalog');

const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/iskolarmatch';

const reportCatalogDuplicates = () => {
  const duplicateIds = [];
  const duplicateNames = [];
  const seenIds = new Map();
  const seenNames = new Map();

  COURSE_CATALOG.forEach((entry, index) => {
    const idKey = entry.canonicalId;
    const nameKey = `${entry.academicLevel}::${entry.canonicalName}`;

    if (seenIds.has(idKey)) {
      duplicateIds.push({
        canonicalId: idKey,
        firstIndex: seenIds.get(idKey),
        duplicateIndex: index
      });
    } else {
      seenIds.set(idKey, index);
    }

    if (seenNames.has(nameKey)) {
      duplicateNames.push({
        canonicalName: entry.canonicalName,
        academicLevel: entry.academicLevel,
        firstIndex: seenNames.get(nameKey),
        duplicateIndex: index
      });
    } else {
      seenNames.set(nameKey, index);
    }
  });

  if (duplicateIds.length > 0) {
    console.error('Duplicate canonicalId values in courseCatalog.js:');
    console.error(JSON.stringify(duplicateIds, null, 2));
  }

  if (duplicateNames.length > 0) {
    console.error(
      'Duplicate canonicalName values at the same academicLevel in courseCatalog.js:'
    );
    console.error(JSON.stringify(duplicateNames, null, 2));
  }

  return duplicateIds.length === 0 && duplicateNames.length === 0;
};

const dropLegacyCanonicalNameUniqueIndex = async (collection) => {
  const indexes = await collection.indexes();

  console.log(
    'Current coursealiases indexes:',
    indexes.map((index) => ({
      name: index.name,
      unique: Boolean(index.unique),
      key: index.key
    }))
  );

  const legacyUniqueNameIndex = indexes.find(
    (index) =>
      index.name === 'canonicalName_1' &&
      index.unique === true &&
      index.key &&
      index.key.canonicalName === 1 &&
      Object.keys(index.key).length === 1
  );

  if (!legacyUniqueNameIndex) {
    console.log('No leftover unique canonicalName_1 index found.');
    return;
  }

  console.log(
    'Required index change: drop unique index canonicalName_1 on scholarship_matching_db.coursealiases.'
  );
  console.log(
    'Reason: canonicalName is display text and may repeat across academic levels; identity is canonicalId.'
  );
  console.log('This does not delete CourseAlias documents.');

  await collection.dropIndex('canonicalName_1');

  console.log('Dropped index: canonicalName_1');
};

const upsertCatalogEntry = async (entry) => {
  const existingById = await CourseAlias.findOne({
    canonicalId: entry.canonicalId
  });

  if (existingById) {
    existingById.canonicalName = entry.canonicalName;
    existingById.academicLevel = entry.academicLevel;
    existingById.kind = entry.kind;
    existingById.aliases = entry.aliases;
    await existingById.save();
    return 'updated';
  }

  const existingByName = await CourseAlias.findOne({
    canonicalName: entry.canonicalName,
    academicLevel: entry.academicLevel,
    $or: [
      { canonicalId: { $exists: false } },
      { canonicalId: null },
      { canonicalId: '' }
    ]
  });

  if (existingByName) {
    existingByName.canonicalId = entry.canonicalId;
    existingByName.canonicalName = entry.canonicalName;
    existingByName.academicLevel = entry.academicLevel;
    existingByName.kind = entry.kind;
    existingByName.aliases = entry.aliases;
    await existingByName.save();
    return 'migrated';
  }

  await CourseAlias.create(entry);
  return 'created';
};

const seedCourseAliases = async () => {
  if (!reportCatalogDuplicates()) {
    throw new Error(
      'courseCatalog.js contains duplicate entries. Seed aborted before writing.'
    );
  }

  await mongoose.connect(MONGO_URI, {
    dbName: 'scholarship_matching_db'
  });

  console.log(
    `Connected to ${mongoose.connection.host}/${mongoose.connection.name}`
  );

  const collection = CourseAlias.collection;

  await dropLegacyCanonicalNameUniqueIndex(collection);

  const counts = {
    updated: 0,
    migrated: 0,
    created: 0
  };

  for (const entry of COURSE_CATALOG) {
    const result = await upsertCatalogEntry(entry);
    counts[result] += 1;
  }

  console.log(
    `Seed complete. updated=${counts.updated}, migrated=${counts.migrated}, created=${counts.created}.`
  );
  console.log(`Catalog size: ${COURSE_CATALOG.length}.`);

  const finalIndexes = await collection.indexes();
  console.log(
    'Indexes after seed:',
    finalIndexes.map((index) => ({
      name: index.name,
      unique: Boolean(index.unique),
      key: index.key
    }))
  );

  await mongoose.disconnect();
};

seedCourseAliases().catch(async (error) => {
  console.error('CourseAlias seed failed:', error);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    console.error('Disconnect failed:', disconnectError);
  }
  process.exit(1);
});
