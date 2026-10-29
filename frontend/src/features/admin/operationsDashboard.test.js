import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PENDING_ACTION_PATHS,
  eligibilityStatusFromSearch,
  scholarshipSearchWithStatus,
  scholarshipStatusFromSearch,
  summaryCards,
  visibleActivity,
  visibleAlerts,
  visiblePendingActions,
} from './operationsDashboard.js';
import {
  directoryFiltersFromSearch,
  directorySearchWithFilters,
} from './userManagement.js';

const current = {
  scope: 'current',
  studentAccounts: 4,
  providerAccounts: 3,
  activeAccounts: 6,
  suspendedAccounts: 2,
  verifiedProviderOrganizations: 1,
  openScholarships: 5,
  archivedScholarships: 2,
  captions: {
    studentAccounts: 'Current total. Not limited to a date range.',
    providerAccounts: 'Registered provider accounts. Separate from verified organizations.',
    activeAccounts: 'Current user accounts with status active, across all roles. This is not the verified-organization count.',
    suspendedAccounts: 'Current user accounts with status suspended, across all roles.',
    verifiedProviderOrganizations: 'Provider profiles with verification status Approved or Verified.',
    openScholarships: 'Matches the All Scholarships Open filter. Includes listings from suspended providers.',
    archivedScholarships: 'Matches the All Scholarships Archived filter.',
  },
};

const cards = summaryCards(current);
assert.equal(cards.length, 7);
assert.equal(cards.find((card) => card.id === 'openScholarships').href, '/dashboard/admin/scholarships?status=Open');
assert.equal(cards.find((card) => card.id === 'archivedScholarships').href, '/dashboard/admin/scholarships?status=Archived');
assert.match(cards.find((card) => card.id === 'openScholarships').caption, /suspended providers/i);
assert.match(cards.find((card) => card.id === 'activeAccounts').caption, /not the verified-organization count/i);
assert.match(cards.find((card) => card.id === 'providerAccounts').caption, /Separate from verified organizations/i);
assert.equal(
  cards.find((card) => card.id === 'verifiedProviderOrganizations').href,
  '/dashboard/admin/verification?status=Verified',
);
assert.equal(cards.find((card) => card.id === 'verifiedProviderOrganizations').value, 1);

const zeros = summaryCards({
  scope: 'current',
  studentAccounts: 0,
  providerAccounts: 0,
  activeAccounts: 0,
  suspendedAccounts: 0,
  verifiedProviderOrganizations: 0,
  openScholarships: 0,
  archivedScholarships: 0,
});
assert.equal(zeros.length, 7);
assert.equal(zeros.every((card) => card.value === 0), true);
assert.equal(summaryCards({ ...current, openScholarships: undefined }).length, 0);
assert.equal(summaryCards(null).length, 0);

const actions = visiblePendingActions([
  { id: 'provider-verification', label: 'Pending provider verification', count: 3, path: PENDING_ACTION_PATHS['provider-verification'] },
  { id: 'scholarship-reports', label: 'Unresolved scholarship reports', count: 0, path: PENDING_ACTION_PATHS['scholarship-reports'] },
  { id: 'eligibility-reviews', label: 'Pending eligibility reviews', count: 1, path: PENDING_ACTION_PATHS['eligibility-reviews'] },
  { id: 'guardian-consent', label: 'Students awaiting guardian consent', count: 2, path: PENDING_ACTION_PATHS['guardian-consent'], note: 'Waiting on the guardian.' },
  { id: 'fake-task', label: 'Invented queue', count: 9, path: 'javascript:alert(1)' },
]);
assert.deepEqual(actions.map((item) => [item.id, item.count, item.path]), [
  ['provider-verification', 3, '/dashboard/admin/verification'],
  ['scholarship-reports', 0, '/dashboard/admin/moderation?status=Unresolved'],
  ['eligibility-reviews', 1, '/dashboard/admin/eligibility-criteria?status=Pending'],
  ['guardian-consent', 2, '/dashboard/admin/users?role=student&status=pending_consent'],
]);
assert.equal(visiblePendingActions([]).length, 0);

const activity = visibleActivity([
  {
    id: '1',
    action: 'USER_REGISTER',
    description: 'A new account was registered.',
    severity: 'Info',
    createdAt: '2026-04-01T00:00:00.000Z',
    details: 'leak@student.test s3cret-password jwt-token-value',
    email: 'leak@student.test',
  },
  {
    id: '2',
    action: 'USER_LOGIN',
    description: '',
    createdAt: '2026-04-01T00:00:00.000Z',
    details: 'should not appear',
  },
]);
assert.equal(activity.length, 1);
assert.equal(JSON.stringify(activity).includes('leak@student.test'), false);
assert.equal(JSON.stringify(activity).includes('s3cret-password'), false);
assert.deepEqual(Object.keys(activity[0]).sort(), ['action', 'createdAt', 'description', 'id', 'severity']);
assert.equal(visibleActivity([]).length, 0);

const alerts = visibleAlerts([
  { id: 'maintenance-mode', message: 'Maintenance mode is enabled.', path: '/dashboard/admin/settings' },
  { id: 'database-read', message: 'Operational data could not be read from the database.' },
  { id: 'system-health', message: 'All systems healthy' },
]);
assert.equal(alerts.length, 1);
assert.equal(alerts[0].id, 'maintenance-mode');
assert.equal(alerts[0].path, '/dashboard/admin/settings');
assert.equal(JSON.stringify(alerts).includes('healthy'), false);

assert.equal(eligibilityStatusFromSearch('Pending'), 'Pending');
assert.equal(eligibilityStatusFromSearch('Approved'), 'All');
assert.equal(eligibilityStatusFromSearch(null), 'All');

assert.equal(scholarshipStatusFromSearch('Open'), 'Open');
assert.equal(scholarshipStatusFromSearch('Archived'), 'Archived');
assert.equal(scholarshipStatusFromSearch('Pending'), 'All');
assert.equal(scholarshipStatusFromSearch('open'), 'All');
assert.equal(scholarshipStatusFromSearch(null), 'All');

const openSearch = scholarshipSearchWithStatus('', 'Open');
assert.equal(scholarshipStatusFromSearch(openSearch.get('status')), 'Open');
const archivedSearch = scholarshipSearchWithStatus(openSearch, 'Archived');
assert.equal(archivedSearch.get('status'), 'Archived');
const clearedSearch = scholarshipSearchWithStatus(archivedSearch, 'All');
assert.equal(clearedSearch.get('status'), null);
assert.equal(scholarshipStatusFromSearch(clearedSearch.get('status')), 'All');

const consentSearch = directorySearchWithFilters('', {
  role: 'student',
  status: 'pending_consent',
});
assert.deepEqual(directoryFiltersFromSearch(consentSearch), {
  role: 'student',
  status: 'pending_consent',
});
const changedRole = directorySearchWithFilters(consentSearch, {
  role: 'provider',
  status: 'pending_consent',
});
assert.equal(changedRole.get('role'), 'provider');
assert.equal(changedRole.get('status'), 'pending_consent');
const clearedDirectory = directorySearchWithFilters(changedRole, { role: 'all', status: 'all' });
assert.equal(clearedDirectory.get('role'), null);
assert.equal(clearedDirectory.get('status'), null);
assert.deepEqual(directoryFiltersFromSearch(''), { role: 'all', status: 'all' });
assert.deepEqual(directoryFiltersFromSearch({ role: 'faculty', status: 'Published' }), {
  role: 'all',
  status: 'all',
});

const dashboardSource = readFileSync(new URL('./pages/AdminDashboard.jsx', import.meta.url), 'utf8');
assert.equal(dashboardSource.includes('Publish Listing'), false);
assert.equal(dashboardSource.includes('Verify Consent'), false);
assert.equal(dashboardSource.includes('parental-consent'), false);
assert.equal(dashboardSource.includes('Retry'), true);
assert.equal(dashboardSource.includes('Current totals'), true);
assert.equal(dashboardSource.includes('include listings from suspended providers'), true);
assert.equal(dashboardSource.includes('separate from active accounts'), true);
assert.equal(dashboardSource.includes('Pending actions'), true);
assert.equal(dashboardSource.includes('Recent activity'), true);
assert.equal(dashboardSource.includes('Audit & Compliance'), true);

const scholarshipSource = readFileSync(new URL('./pages/AllScholarships.jsx', import.meta.url), 'utf8');
assert.equal(scholarshipSource.includes('scholarshipStatusFromSearch'), true);
assert.equal(scholarshipSource.includes('scholarshipSearchWithStatus'), true);

const userSource = readFileSync(new URL('./pages/UserManagement.jsx', import.meta.url), 'utf8');
assert.equal(userSource.includes('directoryFiltersFromSearch'), true);
assert.equal(userSource.includes('directorySearchWithFilters'), true);
assert.equal(userSource.includes('status: statusFilter'), true);

console.log('operations dashboard UI rules passed');
