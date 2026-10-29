const User = require('../models/User');
const Provider = require('../models/Provider');
const Scholarship = require('../models/Scholarship');
const Report = require('../models/Report');
const EligibilityCriterionRequest = require('../models/EligibilityCriterionRequest');
const SystemConfig = require('../models/SystemConfig');
const AuditLog = require('../models/AuditLog');

const PENDING_VERIFICATION_STATUSES = [
  'Pending Review',
  'Submitted',
  'Pending',
  'PENDING',
  'PENDING REVIEW',
];

const VERIFIED_ORGANIZATION_STATUSES = ['Approved', 'Verified', 'APPROVED', 'VERIFIED'];

const UNRESOLVED_REPORT_STATUSES = ['Pending Review', 'Under Investigation'];

const ACTIVITY_LIMIT = 8;
const ACTIVITY_SCAN_LIMIT = 24;

/**
 * Same pending set used by the verification queue and provider review list.
 */
const PENDING_PROVIDER_QUERY = {
  verificationStatus: { $in: PENDING_VERIFICATION_STATUSES },
};

/**
 * Same clauses as All Scholarships status Open and Archived.
 * Open includes listings from suspended providers.
 */
const OPEN_SCHOLARSHIP_FILTER = {
  status: 'Open',
  isArchived: false,
  adminRemovedAt: null,
};

const ARCHIVED_SCHOLARSHIP_FILTER = {
  $or: [
    { isArchived: true },
    { adminRemovedAt: { $ne: null } },
  ],
};

const ACTIVITY_DESCRIPTIONS = {
  USER_REGISTER: 'A new account was registered.',
  PROVIDER_VERIFICATION_SUBMITTED: 'A provider submitted a verification request.',
  PROVIDER_VERIFIED: 'A provider verification was approved.',
  PROVIDER_REJECTED: 'A provider verification was rejected.',
  SCHOLARSHIP_CREATED: 'A scholarship listing was created.',
  SCHOLARSHIP_UPDATED: 'A scholarship listing was updated.',
  SCHOLARSHIP_ARCHIVED: 'A scholarship listing was archived.',
  SCHOLARSHIP_CLOSED: 'A scholarship listing was closed.',
  SCHOLARSHIP_REOPENED: 'A scholarship listing was reopened.',
  SCHOLARSHIP_MODERATED: 'A scholarship moderation action was recorded.',
  SCHOLARSHIP_REPORTED: 'A scholarship report was submitted.',
  MODERATION_REPORT_RESOLVED: 'A scholarship report was resolved.',
  MODERATION_REPORT_RETRY: 'A scholarship report decision was retried.',
  ELIGIBILITY_REQUEST_SUBMIT: 'An eligibility criterion request was submitted.',
  ELIGIBILITY_REQUEST_APPROVE: 'An eligibility criterion request was approved.',
  ELIGIBILITY_REQUEST_REJECT: 'An eligibility criterion request was rejected.',
  ELIGIBILITY_REQUEST_STATUS: 'An eligibility criterion request was updated.',
  ACCOUNT_STATUS_CHANGE: 'An account status was changed.',
  ADMIN_ACCOUNT_PROVISIONED: 'An administrator account was invited.',
  SYSTEM_CONFIG_UPDATED: 'System settings were updated.',
  LOGIN_BLOCKED: 'A sign-in was blocked.',
  PASSWORD_CHANGED: 'An account password was changed.',
  CONSENT_VERIFIED: 'Guardian consent was verified for a student account.',
};

const ACTIVITY_ACTIONS = Object.keys(ACTIVITY_DESCRIPTIONS);
const SEVERITIES = new Set(['Info', 'Warning', 'Critical']);

const SUMMARY_CAPTIONS = {
  studentAccounts: 'Current total. Not limited to a date range.',
  providerAccounts: 'Registered provider accounts. Separate from verified organizations.',
  activeAccounts: 'Current user accounts with status active, across all roles. This is not the verified-organization count.',
  suspendedAccounts: 'Current user accounts with status suspended, across all roles.',
  verifiedProviderOrganizations: 'Provider profiles with verification status Approved or Verified.',
  openScholarships: 'Matches the All Scholarships Open filter. Includes listings from suspended providers.',
  archivedScholarships: 'Matches the All Scholarships Archived filter.',
};

const readFailure = (message) => {
  const error = new Error(message);
  error.code = 'OPERATIONS_READ_FAILED';
  return error;
};

const requireCount = (value, label) => {
  if (!Number.isInteger(value) || value < 0) {
    throw readFailure(`${label} could not be read.`);
  }
  return value;
};

const requireRows = (value, label) => {
  if (!Array.isArray(value)) {
    throw readFailure(`${label} could not be read.`);
  }
  return value;
};

const tallyAccounts = (rows) => {
  const summary = {
    studentAccounts: 0,
    providerAccounts: 0,
    activeAccounts: 0,
    suspendedAccounts: 0,
    pendingConsentStudents: 0,
  };

  requireRows(rows, 'Account totals').forEach((row) => {
    const count = requireCount(row && row.count, 'Account totals');
    const role = row && row._id ? row._id.role : undefined;
    const status = row && row._id ? row._id.status : undefined;
    if (role === 'student') summary.studentAccounts += count;
    if (role === 'provider') summary.providerAccounts += count;
    if (status === 'active') summary.activeAccounts += count;
    if (status === 'suspended') summary.suspendedAccounts += count;
    if (role === 'student' && status === 'pending_consent') {
      summary.pendingConsentStudents += count;
    }
  });

  return summary;
};

const tallyVerification = (rows) => {
  let pendingProviderVerifications = 0;
  let verifiedProviderOrganizations = 0;

  requireRows(rows, 'Provider verification totals').forEach((row) => {
    const count = requireCount(row && row.count, 'Provider verification totals');
    const status = row ? row._id : undefined;
    if (PENDING_VERIFICATION_STATUSES.includes(status)) pendingProviderVerifications += count;
    if (VERIFIED_ORGANIZATION_STATUSES.includes(status)) verifiedProviderOrganizations += count;
  });

  return { pendingProviderVerifications, verifiedProviderOrganizations };
};

const matchesOpenScholarship = (doc) => Boolean(
  doc
  && doc.status === 'Open'
  && doc.isArchived === false
  && (doc.adminRemovedAt === null || doc.adminRemovedAt === undefined)
);

const matchesArchivedScholarship = (doc) => Boolean(
  doc
  && (
    doc.isArchived === true
    || (doc.adminRemovedAt !== null && doc.adminRemovedAt !== undefined)
  )
);

/**
 * Fixed description for an allowlisted audit action.
 * Raw details, actors, addresses, and unknown actions are omitted.
 */
const presentOperationalActivity = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  const description = ACTIVITY_DESCRIPTIONS[entry.action];
  if (!description) return null;
  const createdAt = entry.createdAt ? new Date(entry.createdAt) : null;
  if (!createdAt || Number.isNaN(createdAt.getTime())) return null;
  const severity = SEVERITIES.has(entry.severity) ? entry.severity : 'Info';
  const id = entry._id || entry.id || `${entry.action}:${createdAt.toISOString()}`;
  return {
    id: String(id),
    action: entry.action,
    description,
    severity,
    createdAt: createdAt.toISOString(),
  };
};

const metric = (id, label, value, iconKey, color) => ({
  id,
  label,
  value: String(value),
  iconKey,
  color,
});

const buildDashboard = ({
  accounts,
  verification,
  openScholarships,
  archivedScholarships,
  unresolvedReports,
  pendingEligibilityReviews,
  maintenanceMode,
  activity,
}) => {
  const summary = {
    scope: 'current',
    studentAccounts: accounts.studentAccounts,
    providerAccounts: accounts.providerAccounts,
    activeAccounts: accounts.activeAccounts,
    suspendedAccounts: accounts.suspendedAccounts,
    verifiedProviderOrganizations: verification.verifiedProviderOrganizations,
    openScholarships,
    archivedScholarships,
    captions: SUMMARY_CAPTIONS,
  };

  const pendingActions = [
    {
      id: 'provider-verification',
      label: 'Pending provider verification',
      count: verification.pendingProviderVerifications,
      path: '/dashboard/admin/verification',
      note: 'Opens the verification queue on Pending Review.',
    },
    {
      id: 'scholarship-reports',
      label: 'Unresolved scholarship reports',
      count: unresolvedReports,
      path: '/dashboard/admin/moderation?status=Unresolved',
      note: 'Opens Content Moderation on Unresolved: Pending Review and Under Investigation.',
    },
    {
      id: 'eligibility-reviews',
      label: 'Pending eligibility reviews',
      count: pendingEligibilityReviews,
      path: '/dashboard/admin/eligibility-criteria?status=Pending',
      note: 'Opens eligibility requests that are pending review.',
    },
    {
      id: 'guardian-consent',
      label: 'Students awaiting guardian consent',
      count: accounts.pendingConsentStudents,
      path: '/dashboard/admin/users?role=student&status=pending_consent',
      note: 'Waiting on the guardian. This dashboard does not approve consent.',
    },
  ];

  const alerts = [];
  if (maintenanceMode === true) {
    alerts.push({
      id: 'maintenance-mode',
      severity: 'warning',
      message: 'Maintenance mode is enabled.',
      path: '/dashboard/admin/settings',
    });
  }

  return {
    summary,
    pendingActions,
    activity,
    alerts,
    metrics: [
      metric('students', 'Student accounts', summary.studentAccounts, 'Users', 'blue'),
      metric('providers', 'Provider accounts', summary.providerAccounts, 'Building2', 'indigo'),
      metric('active-accounts', 'Active accounts', summary.activeAccounts, 'CheckSquare', 'emerald'),
      metric('suspended-accounts', 'Suspended accounts', summary.suspendedAccounts, 'AlertTriangle', 'rose'),
      metric('verified-organizations', 'Verified organizations', summary.verifiedProviderOrganizations, 'ShieldCheck', 'emerald'),
      metric('open-scholarships', 'Open scholarships', summary.openScholarships, 'GraduationCap', 'amber'),
      metric('archived-scholarships', 'Archived scholarships', summary.archivedScholarships, 'Archive', 'blue'),
    ],
  };
};

const loadOperationsDashboard = async () => {
  const [
    accountRows,
    verificationRows,
    openScholarships,
    archivedScholarships,
    unresolvedReports,
    pendingEligibilityReviews,
    config,
    activityRows,
  ] = await Promise.all([
    User.aggregate([
      { $group: { _id: { role: '$role', status: '$status' }, count: { $sum: 1 } } },
    ]),
    Provider.aggregate([
      { $group: { _id: '$verificationStatus', count: { $sum: 1 } } },
    ]),
    Scholarship.countDocuments(OPEN_SCHOLARSHIP_FILTER),
    Scholarship.countDocuments(ARCHIVED_SCHOLARSHIP_FILTER),
    Report.countDocuments({ status: { $in: UNRESOLVED_REPORT_STATUSES } }),
    EligibilityCriterionRequest.countDocuments({ status: 'Pending' }),
    SystemConfig.findOne().select('maintenanceMode').lean(),
    AuditLog.find({ action: { $in: ACTIVITY_ACTIONS } })
      .sort({ createdAt: -1, _id: -1 })
      .limit(ACTIVITY_SCAN_LIMIT)
      .select('action severity createdAt')
      .lean(),
  ]);

  const accounts = tallyAccounts(accountRows);
  const verification = tallyVerification(verificationRows);
  const activity = requireRows(activityRows, 'Recent activity')
    .map(presentOperationalActivity)
    .filter(Boolean)
    .slice(0, ACTIVITY_LIMIT);

  return buildDashboard({
    accounts,
    verification,
    openScholarships: requireCount(openScholarships, 'Open scholarships'),
    archivedScholarships: requireCount(archivedScholarships, 'Archived scholarships'),
    unresolvedReports: requireCount(unresolvedReports, 'Unresolved scholarship reports'),
    pendingEligibilityReviews: requireCount(pendingEligibilityReviews, 'Pending eligibility reviews'),
    maintenanceMode: Boolean(config && config.maintenanceMode === true),
    activity,
  });
};

module.exports = {
  ACTIVITY_ACTIONS,
  ACTIVITY_DESCRIPTIONS,
  ARCHIVED_SCHOLARSHIP_FILTER,
  OPEN_SCHOLARSHIP_FILTER,
  PENDING_PROVIDER_QUERY,
  UNRESOLVED_REPORT_STATUSES,
  loadOperationsDashboard,
  matchesArchivedScholarship,
  matchesOpenScholarship,
  presentOperationalActivity,
  tallyAccounts,
  tallyVerification,
};
