import assert from 'node:assert/strict';
import {
  analyticsQueryString,
  customRangeReady,
  heatIntensity,
  periodCaption,
  reportDownloadName,
} from './analyticsReports.js';

assert.equal(analyticsQueryString({ range: '30d' }), 'range=30d');
assert.equal(analyticsQueryString({ range: 'custom', from: '2026-10-01', to: '2026-10-29' }), 'from=2026-10-01&to=2026-10-29');
assert.equal(analyticsQueryString({ range: '7d' }), 'range=7d');
assert.equal(customRangeReady({ range: '30d' }), true);
assert.equal(customRangeReady({ range: 'custom', from: '2026-10-01', to: '' }), false);
assert.equal(customRangeReady({ range: 'custom', from: '2026-10-01', to: '2026-10-29' }), true);
assert.equal(heatIntensity(0, 10), 0);
assert.equal(heatIntensity(10, 0), 0);
assert.equal(heatIntensity(5, 10), 0.5);
assert.equal(heatIntensity(10, 10), 1);
assert.equal(
  reportDownloadName('registrations', { from: '2026-10-01', to: '2026-10-29' }),
  'iskolarmatch-registrations-2026-10-01-to-2026-10-29.csv'
);
assert.equal(
  periodCaption({ from: '2026-10-01', to: '2026-10-29', grouping: 'day', timeZone: 'Asia/Manila' }),
  '2026-10-01 to 2026-10-29 · daily · Asia/Manila'
);

console.log('Admin analytics report helper tests passed');
