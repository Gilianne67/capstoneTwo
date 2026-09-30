const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const read = (relativePath) =>
  fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');

const main = async () => {
  const apiPath = path.resolve(__dirname, '../../../frontend/src/config/api.js');
  const api = await import(pathToFileURL(apiPath).href);

  assert.strictEqual(api.API_BASE_URL, 'http://localhost:5000/api/v1');
  assert.strictEqual(api.API_ORIGIN, 'http://localhost:5000');
  assert.strictEqual(
    api.resolveApiBaseUrl('https://staging.example.com/api/v1/'),
    'https://staging.example.com/api/v1'
  );
  assert.strictEqual(
    api.resolveApiBaseUrl(''),
    'http://localhost:5000/api/v1'
  );

  assert.strictEqual(
    api.apiUrl('/scholarships/my'),
    'http://localhost:5000/api/v1/scholarships/my'
  );
  assert.strictEqual(
    api.apiUrl('scholarships'),
    'http://localhost:5000/api/v1/scholarships'
  );
  assert.strictEqual(
    api.apiUrl('/scholarships/listing-id'),
    'http://localhost:5000/api/v1/scholarships/listing-id'
  );
  assert.strictEqual(
    api.apiUrl('/matching'),
    'http://localhost:5000/api/v1/matching'
  );

  const sources = {
    listings: read('../../../frontend/src/features/provider/pages/ScholarshipListings.jsx'),
    create: read('../../../frontend/src/features/provider/pages/CreateListing.jsx'),
    details: read('../../../frontend/src/features/provider/pages/ScholarshipDetails.jsx'),
    matches: read('../../../frontend/src/features/student/pages/MatchFeed.jsx'),
    search: read('../../../frontend/src/features/student/pages/ScholarshipSearch.jsx'),
    layout: read('../../../frontend/src/layouts/AppLayout.jsx'),
  };

  assert.match(sources.listings, /\$\{API_BASE_URL\}\/scholarships\/my/);
  assert.match(sources.create, /\$\{API_BASE_URL\}\/scholarships\/\$\{initialData\._id\}/);
  assert.match(sources.create, /\$\{API_BASE_URL\}\/scholarships/);
  assert.match(sources.details, /\$\{API_BASE_URL\}\/scholarships\/\$\{id\}/);
  assert.match(sources.matches, /\$\{API_BASE_URL\}\/matching/);
  assert.match(sources.search, /\$\{API_BASE_URL\}\/matching/);

  Object.values(sources).forEach((source) => {
    assert.doesNotMatch(source, /api\.iskolarmatch/);
    assert.doesNotMatch(source, /import\.meta\.env\.VITE_API_URL/);
  });

  console.log('api base url tests passed');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
