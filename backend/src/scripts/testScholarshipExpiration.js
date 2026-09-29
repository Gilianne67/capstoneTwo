const assert = require('assert');
const {
  isDeadlineOpen
} = require('../services/matchingService');
const {
  shouldAutoCloseScholarship
} = require('../services/scholarshipExpirationService');

const DURING_DEADLINE_DAY = new Date('2026-09-25T10:00:00.000Z');
const END_OF_DEADLINE_DAY = new Date('2026-09-25T15:59:59.999Z');
const AFTER_DEADLINE_DAY = new Date('2026-09-25T16:00:00.000Z');

const openScholarship = (deadline, extras = {}) => ({
  status: 'Open',
  isArchived: false,
  deadline,
  ...extras
});

assert.strictEqual(
  isDeadlineOpen('2026-09-25', DURING_DEADLINE_DAY),
  true,
  'date-only deadline stays open during that Manila day'
);

assert.strictEqual(
  isDeadlineOpen('2026-09-25', END_OF_DEADLINE_DAY),
  true,
  'date-only deadline stays open through 23:59:59.999 Manila'
);

assert.strictEqual(
  isDeadlineOpen('2026-09-25', AFTER_DEADLINE_DAY),
  false,
  'date-only deadline is closed after that Manila day'
);

assert.strictEqual(
  shouldAutoCloseScholarship(
    openScholarship('2026-09-25'),
    DURING_DEADLINE_DAY
  ),
  false
);

assert.strictEqual(
  shouldAutoCloseScholarship(
    openScholarship('2026-09-25'),
    AFTER_DEADLINE_DAY
  ),
  true
);

assert.strictEqual(
  shouldAutoCloseScholarship(
    openScholarship('2026-12-31', { status: 'Closed' }),
    AFTER_DEADLINE_DAY
  ),
  false,
  'a provider-closed scholarship is not selected for automatic changes'
);

assert.strictEqual(
  shouldAutoCloseScholarship(
    openScholarship('2026-09-25', { isArchived: true }),
    AFTER_DEADLINE_DAY
  ),
  false
);

assert.strictEqual(
  shouldAutoCloseScholarship(
    openScholarship('2026-12-31'),
    AFTER_DEADLINE_DAY
  ),
  false
);

console.log('Scholarship expiration tests passed');
