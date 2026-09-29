const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

const LEGACY_PLACES = {
  Cebu: ['Cebu City', 'Lapu-Lapu City', 'Mandaue City'],
  Bohol: ['Tagbilaran City'],
  Bataan: ['Balanga City'],
  Bulacan: ['Malolos City'],
  Pampanga: ['Angeles City', 'San Fernando City']
};

const main = async () => {
  const locationPath = path.resolve(
    __dirname,
    '../../../frontend/src/data/locationData.js'
  );
  const { REGIONS, PROVINCES, MUNICIPALITIES } = await import(
    pathToFileURL(locationPath).href
  );
  const provinces = Object.values(PROVINCES).flat();

  assert.strictEqual(REGIONS.length, 17);
  assert.strictEqual(provinces.length, 83);
  assert.ok(REGIONS.includes('Bicol Region'));
  assert.ok(REGIONS.includes('National Capital Region'));
  assert.deepStrictEqual(PROVINCES['National Capital Region'], ['Metro Manila']);

  let total = 0;

  for (const province of provinces) {
    const places = MUNICIPALITIES[province];
    assert.ok(Array.isArray(places) && places.length > 0, province);
    assert.strictEqual(new Set(places).size, places.length, province);
    total += places.length;
  }

  assert.strictEqual(Object.keys(MUNICIPALITIES).length, provinces.length);
  assert.strictEqual(total, 1634);
  assert.ok(MUNICIPALITIES['Camarines Sur'].includes('Naga City'));
  assert.ok(MUNICIPALITIES['Metro Manila'].includes('Quezon City'));
  assert.ok(MUNICIPALITIES['Metro Manila'].includes('Manila'));

  for (const [province, names] of Object.entries(LEGACY_PLACES)) {
    for (const name of names) {
      assert.ok(
        MUNICIPALITIES[province].includes(name),
        `${province} should still include ${name}`
      );
    }
  }

  console.log('Location data tests passed');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});