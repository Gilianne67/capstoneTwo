import assert from 'node:assert/strict';

import { verificationTabFromSearch } from './verificationQueue.js';

assert.equal(verificationTabFromSearch('Verified'), 'Verified');
assert.equal(verificationTabFromSearch('Pending Review'), 'Pending Review');
assert.equal(verificationTabFromSearch('Rejected'), 'Rejected');
assert.equal(verificationTabFromSearch('All'), 'All');
assert.equal(verificationTabFromSearch(null), 'Pending Review');
assert.equal(verificationTabFromSearch(''), 'Pending Review');
assert.equal(verificationTabFromSearch('verified'), 'Pending Review');
assert.equal(verificationTabFromSearch('Approved'), 'Pending Review');

console.log('verification queue tab tests passed');
