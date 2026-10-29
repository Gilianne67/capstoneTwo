const User = require('../models/User');
const Scholarship = require('../models/Scholarship');
const SavedMatch = require('../models/SavedMatch');
const Application = require('../models/Application');
const StudentProfile = require('../models/StudentProfile');
const Provider = require('../models/Provider');
const CategoryDemandEvent = require('../models/CategoryDemandEvent');
const suspendedProviderFilter = require('./suspendedProviderFilter');
const {
  resolveAnalyticsPeriod,
  addManilaDays,
  TIME_ZONE,
} = require('./adminAnalyticsPeriod');
const { renderCsv, reportStamp } = require('../utils/csvExport');

const SCHOLARSHIP_CATEGORIES = [
  'Merit-Based',
  'Need-Based',
  'STEM',
  'Agricultural',
  'Municipal / Local',
];
const VERIFICATION_STATUSES = [
  'Pending',
  'Pending Review',
  'Submitted',
  'Approved',
  'Verified',
  'Rejected',
];
const REPORTS = [
  'registrations',
  'scholarships',
  'category-demand',
  'student-insights',
  'provider-insights',
];
const PROVIDER_PAGE_LIMIT = 20;
const PROVIDER_MAX_LIMIT = 50;

const DEFINITIONS = {
  timeZone: 'Counts use Asia/Manila calendar days. A period includes the start date and excludes the following day at midnight.',
  totalVersusPeriod: 'Summary totals count all stored records. Trend charts count only records inside the selected period. Cumulative registration totals count accounts created before a boundary and are separate from the period chart.',
  activeScholarship: 'A student-facing open scholarship has status Open, is not archived, was not administratively removed, and its provider account is not suspended.',
  archivedScholarship: 'Archived means isArchived is true. Administratively removed listings are also archived and are reported as their own count. Archived listings are not active.',
  suspendedProviderListings: 'Listings whose provider account is suspended are excluded from student-facing availability and reported separately.',
  categoryAssignment: 'Each scholarship is assigned to exactly one category: its scholarshipType, or Unspecified when that field is blank. A scholarship with several eligibility tags is still one category row.',
  eligibilityTags: 'Eligibility-tag rows count a scholarship once per tag. Those rows overlap and must not be added together.',
  geographicAssignment: 'Each scholarship is placed in one geographic bucket: Nationwide, a single region, province, or municipality, Multiple regions/provinces/municipalities, or Unspecified.',
  savedInterest: 'A saved scholarship is a SavedMatch record. It is not an application, a completed match, or proof that a student received the scholarship.',
  recordedApplications: 'Application counts include only Application documents. Opening a provider application link does not create one, and none are inferred.',
  searchDemand: 'Search demand counts structured filters (academic level, region, eligibility tag) recorded after tracking began. Keyword text is not stored, and earlier searches are not estimated.',
  matchingActivity: 'Scholarship recommendations are calculated when a student asks for them and are not stored, so they are not reported as matches.',
  emailVersusOrganization: 'Email verification is User.isVerified. Organization verification is Provider.verificationStatus. They are separate.',
};

const LIMITATIONS = [
  'Keyword scholarship searches are not stored, so scholarship-type popularity cannot be measured from search text.',
  'Structured filter tracking starts when this feature is deployed. Older demand is not backfilled.',
  'Generated recommendations are not stored and are not counted as successful matches.',
  'Students apply through the provider application link. That action is not an Application record unless one was stored.',
  'Account status and verification charts describe the current records, not a historical status on each day.',
];

const fail = (message) => ({ ok: false, message });

const sumWhen = (condition) => ({ $sum: { $cond: [condition, 1, 0] } });

const categoryExpression = (path = '$scholarshipType') => ({
  $cond: [
    { $eq: [{ $trim: { input: { $ifNull: [path, ''] } } }, ''] },
    'Unspecified',
    { $trim: { input: { $ifNull: [path, ''] } } },
  ],
});

const placeSize = (path) => ({ $size: { $ifNull: [path, []] } });

const geographicBucketExpression = () => {
  const scope = '$hardFilters.geographicLocation.scope';
  const regions = '$hardFilters.geographicLocation.regions';
  const provinces = '$hardFilters.geographicLocation.provinces';
  const municipalities = '$hardFilters.geographicLocation.municipalities';
  const single = (scopeName, path, label) => ({
    case: { $and: [{ $eq: [scope, scopeName] }, { $eq: [placeSize(path), 1] }] },
    then: { $arrayElemAt: [{ $ifNull: [path, []] }, 0] },
  });
  const multiple = (scopeName, path, label) => ({
    case: { $and: [{ $eq: [scope, scopeName] }, { $gt: [placeSize(path), 1] }] },
    then: label,
  });
  return {
    $switch: {
      branches: [
        { case: { $eq: [scope, 'Nationwide'] }, then: 'Nationwide' },
        single('Region', regions),
        multiple('Region', regions, 'Multiple regions'),
        single('Province', provinces),
        multiple('Province', provinces, 'Multiple provinces'),
        single('Municipality', municipalities),
        multiple('Municipality', municipalities, 'Multiple municipalities'),
      ],
      default: 'Unspecified',
    },
  };
};

const listingStages = (suspendedIds) => {
  const stage1 = {
    category: categoryExpression('$scholarshipType'),
    providerSuspended: { $in: ['$providerId', suspendedIds] },
    administrativelyRemoved: { $ne: [{ $ifNull: ['$adminRemovedAt', null] }, null] },
    geographicBucket: geographicBucketExpression(),
    openNotRemoved: {
      $and: [
        { $eq: ['$status', 'Open'] },
        { $ne: ['$isArchived', true] },
        { $eq: [{ $ifNull: ['$adminRemovedAt', null] }, null] },
      ],
    },
    closedNotArchived: {
      $and: [
        { $eq: ['$status', 'Closed'] },
        { $ne: ['$isArchived', true] },
      ],
    },
  };
  const stage2 = {
    studentFacingAvailable: {
      $and: ['$openNotRemoved', { $eq: ['$providerSuspended', false] }],
    },
  };
  return [stage1, stage2];
};

const deadlineBounds = (now) => {
  const todayStart = addManilaDays(now, 0);
  return {
    todayStart,
    horizon: addManilaDays(now, 14),
  };
};

const dateBucket = (period, path) => ({
  $dateToString: {
    format: period.bucketFormat,
    date: path,
    timezone: TIME_ZONE,
  },
});

const parsePaging = (query) => {
  const page = query.page === undefined || query.page === '' ? 1 : query.page;
  const limit = query.limit === undefined || query.limit === '' ? PROVIDER_PAGE_LIMIT : query.limit;
  if (Array.isArray(page) || Array.isArray(limit)) return fail('Invalid pagination.');
  if (typeof page === 'string' && !/^\d+$/.test(page)) return fail('Page must be a positive integer.');
  if (typeof limit === 'string' && !/^\d+$/.test(limit)) return fail('Limit must be a positive integer.');
  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 10000) {
    return fail('Page must be a positive integer.');
  }
  if (!Number.isInteger(limitNumber) || limitNumber < 1 || limitNumber > PROVIDER_MAX_LIMIT) {
    return fail('Limit must be a positive integer no greater than 50.');
  }
  return { ok: true, page: pageNumber, limit: limitNumber };
};

const resolveAnalyticsQuery = (query = {}, now = new Date(), options = {}) => {
  const periodResult = resolveAnalyticsPeriod(query, now);
  if (!periodResult.ok) return periodResult;

  let page = 1;
  let limit = PROVIDER_PAGE_LIMIT;
  if (options.paginate) {
    const paging = parsePaging(query);
    if (!paging.ok) return paging;
    page = paging.page;
    limit = paging.limit;
  }

  return {
    ok: true,
    period: periodResult.period,
    page,
    limit,
    now,
  };
};

const publicPeriod = (parsed) => ({
  range: parsed.period.range,
  from: parsed.period.from,
  to: parsed.period.to,
  start: parsed.period.start.toISOString(),
  end: parsed.period.end.toISOString(),
  timeZone: parsed.period.timeZone,
  grouping: parsed.period.grouping,
});

const envelope = (parsed, data) => ({
  period: publicPeriod(parsed),
  definitions: DEFINITIONS,
  limitations: LIMITATIONS,
  ...data,
});

const emptyRoles = () => ({
  students: 0,
  providers: 0,
  admins: 0,
  superadmins: 0,
  other: 0,
  total: 0,
});

const roleKey = (role) => {
  if (role === 'student') return 'students';
  if (role === 'provider') return 'providers';
  if (role === 'admin') return 'admins';
  if (role === 'superadmin') return 'superadmins';
  return 'other';
};

const addRole = (target, role, count) => {
  target[roleKey(role)] += count;
  target.total += count;
};

const roleTotals = (rows) => {
  const totals = emptyRoles();
  (rows || []).forEach((row) => addRole(totals, row._id, row.count || 0));
  return totals;
};

const fillSeries = (period, rows, readKey, readCount) => {
  const counts = new Map();
  (rows || []).forEach((row) => {
    const key = readKey(row);
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + readCount(row));
  });
  return period.buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    count: counts.get(bucket.key) || 0,
  }));
};

const registrationSeries = (period, rows) => {
  const counts = new Map();
  (rows || []).forEach((row) => {
    const bucket = row._id && row._id.bucket;
    if (!bucket) return;
    const current = counts.get(bucket) || emptyRoles();
    addRole(current, row._id.role, row.count || 0);
    counts.set(bucket, current);
  });
  return period.buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    ...(counts.get(bucket.key) || emptyRoles()),
  }));
};

const accountSnapshot = (rows) => {
  const roles = emptyRoles();
  const status = { active: 0, suspended: 0, pending_consent: 0, other: 0, total: 0 };
  const email = {
    studentsVerified: 0,
    studentsUnverified: 0,
    providersVerified: 0,
    providersUnverified: 0,
  };
  (rows || []).forEach((row) => {
    const count = row.count || 0;
    const role = row._id && row._id.role;
    const accountStatus = row._id && row._id.status;
    const verified = Boolean(row._id && row._id.isVerified === true);
    addRole(roles, role, count);
    if (Object.prototype.hasOwnProperty.call(status, accountStatus)) {
      status[accountStatus] += count;
    } else {
      status.other += count;
    }
    status.total += count;
    if (role === 'student') email[verified ? 'studentsVerified' : 'studentsUnverified'] += count;
    if (role === 'provider') email[verified ? 'providersVerified' : 'providersUnverified'] += count;
  });
  return { roles, status, email };
};

const countOf = (rows) => (rows && rows[0] && rows[0].count) || 0;

const firstOf = (rows) => (rows && rows[0]) || {};

const zeroScholarshipTotals = () => ({
  totalListings: 0,
  activeOpenScholarships: 0,
  openListingsIncludingSuspendedProviders: 0,
  archivedScholarships: 0,
  administrativelyRemovedScholarships: 0,
  closedNotArchived: 0,
  suspendedProviderListings: 0,
  approachingDeadline: 0,
  pastDeadlineStillOpen: 0,
  suspendedProviderApproachingDeadline: 0,
  suspendedProviderPastDeadlineStillOpen: 0,
});

const scholarshipTotals = (row) => ({
  totalListings: row.totalListings || 0,
  activeOpenScholarships: row.available || 0,
  openListingsIncludingSuspendedProviders: row.openNotRemoved || 0,
  archivedScholarships: row.archived || 0,
  administrativelyRemovedScholarships: row.adminRemoved || 0,
  closedNotArchived: row.closedNotArchived || 0,
  suspendedProviderListings: row.suspendedProviderListings || 0,
  approachingDeadline: row.approaching || 0,
  pastDeadlineStillOpen: row.pastOpen || 0,
  suspendedProviderApproachingDeadline: row.suspendedApproaching || 0,
  suspendedProviderPastDeadlineStillOpen: row.suspendedPastOpen || 0,
});

const groupedCount = (rows) => {
  const map = new Map();
  (rows || []).forEach((row) => {
    const key = row._id == null || row._id === '' ? 'Unspecified' : String(row._id);
    map.set(key, (map.get(key) || 0) + (row.count || row.scholarships || 0));
  });
  return map;
};

const ratio = (saved, available) => {
  if (!available) return null;
  return Math.round((saved / available) * 100) / 100;
};

const buildCategoryRows = ({ supplyRows, saveRows, applicationRows }) => {
  const supply = new Map((supplyRows || []).map((row) => [String(row._id || 'Unspecified'), row]));
  const saves = groupedCount(saveRows);
  const applications = groupedCount(applicationRows);
  const categories = new Set(SCHOLARSHIP_CATEGORIES);
  supply.forEach((_row, key) => categories.add(key));
  saves.forEach((_count, key) => categories.add(key));
  applications.forEach((_count, key) => categories.add(key));

  return [...categories].sort((left, right) => left.localeCompare(right)).map((category) => {
    const source = supply.get(category) || {};
    const available = source.available || 0;
    const savedInterest = saves.get(category) || 0;
    const recordedApplications = applications.get(category) || 0;
    return {
      category,
      availableScholarships: available,
      totalListings: source.totalListings || 0,
      archivedListings: source.archived || 0,
      administrativelyRemoved: source.adminRemoved || 0,
      suspendedProviderListings: source.suspendedProviderListings || 0,
      openListingsIncludingSuspendedProviders: source.openNotRemoved || 0,
      savedInterest,
      recordedApplications,
      structuredSearchEvents: null,
      savedInterestPerAvailableScholarship: ratio(savedInterest, available),
      interestWithoutAvailableSupply: available === 0 && savedInterest > 0,
    };
  });
};

const topGroups = (rows, limit = 12) => {
  const sorted = (rows || [])
    .map((row) => ({
      label: row._id == null || row._id === '' ? 'Unknown' : String(row._id),
      count: row.count || row.students || 0,
      students: row.students,
      saves: row.saves,
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  if (sorted.length <= limit) return sorted.map(({ label, count }) => ({ label, count }));
  const head = sorted.slice(0, limit).map(({ label, count }) => ({ label, count }));
  const rest = sorted.slice(limit).reduce((sum, row) => sum + row.count, 0);
  if (rest > 0) head.push({ label: 'Other', count: rest });
  return head;
};

const labeledRows = (rows, valueField = 'count') =>
  (rows || [])
    .map((row) => ({
      label: row._id == null || row._id === '' ? 'Unknown' : String(row._id),
      count: row[valueField] || row.count || 0,
    }))
    .filter((row) => row.label !== 'Unknown' || row.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

const userPipelines = (period) => ({
  snapshot: [{
    $group: {
      _id: { role: '$role', status: '$status', isVerified: '$isVerified' },
      count: { $sum: 1 },
    },
  }],
  inPeriod: [
    { $match: { createdAt: { $gte: period.start, $lt: period.end } } },
    {
      $group: {
        _id: { bucket: dateBucket(period, '$createdAt'), role: '$role' },
        count: { $sum: 1 },
      },
    },
  ],
  beforePeriod: [
    { $match: { createdAt: { $lt: period.start } } },
    { $group: { _id: '$role', count: { $sum: 1 } } },
  ],
  throughPeriodEnd: [
    { $match: { createdAt: { $lt: period.end } } },
    { $group: { _id: '$role', count: { $sum: 1 } } },
  ],
});

const scholarshipPipeline = ({ period, suspendedIds, now }) => {
  const bounds = deadlineBounds(now);
  const [stage1, stage2] = listingStages(suspendedIds);
  const approaching = {
    $and: [
      '$studentFacingAvailable',
      { $gte: ['$deadline', bounds.todayStart] },
      { $lt: ['$deadline', bounds.horizon] },
    ],
  };
  const pastOpen = {
    $and: ['$studentFacingAvailable', { $lt: ['$deadline', bounds.todayStart] }],
  };
  const suspendedApproaching = {
    $and: [
      '$providerSuspended',
      '$openNotRemoved',
      { $gte: ['$deadline', bounds.todayStart] },
      { $lt: ['$deadline', bounds.horizon] },
    ],
  };
  const suspendedPastOpen = {
    $and: ['$providerSuspended', '$openNotRemoved', { $lt: ['$deadline', bounds.todayStart] }],
  };
  return [
    { $addFields: stage1 },
    { $addFields: stage2 },
    {
      $facet: {
        totals: [{
          $group: {
            _id: null,
            totalListings: { $sum: 1 },
            available: sumWhen('$studentFacingAvailable'),
            openNotRemoved: sumWhen('$openNotRemoved'),
            archived: sumWhen({ $eq: ['$isArchived', true] }),
            adminRemoved: sumWhen('$administrativelyRemoved'),
            closedNotArchived: sumWhen('$closedNotArchived'),
            suspendedProviderListings: sumWhen('$providerSuspended'),
            approaching: sumWhen(approaching),
            pastOpen: sumWhen(pastOpen),
            suspendedApproaching: sumWhen(suspendedApproaching),
            suspendedPastOpen: sumWhen(suspendedPastOpen),
          },
        }],
        byCategory: [{
          $group: {
            _id: '$category',
            totalListings: { $sum: 1 },
            available: sumWhen('$studentFacingAvailable'),
            archived: sumWhen({ $eq: ['$isArchived', true] }),
            adminRemoved: sumWhen('$administrativelyRemoved'),
            openNotRemoved: sumWhen('$openNotRemoved'),
            suspendedProviderListings: sumWhen('$providerSuspended'),
          },
        }],
        byGeography: [{
          $group: {
            _id: '$geographicBucket',
            listings: { $sum: 1 },
            available: sumWhen('$studentFacingAvailable'),
          },
        }],
        createdTrend: [
          { $match: { createdAt: { $gte: period.start, $lt: period.end } } },
          { $group: { _id: dateBucket(period, '$createdAt'), count: { $sum: 1 } } },
        ],
      },
    },
  ];
};

const tagPipeline = ({ suspendedIds }) => {
  const [stage1, stage2] = listingStages(suspendedIds);
  return [
    { $addFields: stage1 },
    { $addFields: stage2 },
    { $match: { studentFacingAvailable: true } },
    { $unwind: '$specialTags' },
    { $group: { _id: '$specialTags.tagName', scholarships: { $sum: 1 } } },
  ];
};

const engagementPipeline = ({ period, dateField }) => {
  const linkedFilter = { linked: true };
  return [
    { $match: { [dateField]: { $gte: period.start, $lt: period.end } } },
    {
      $lookup: {
        from: Scholarship.collection.collectionName,
        localField: 'scholarshipId',
        foreignField: '_id',
        as: 'scholarship',
      },
    },
    {
      $addFields: {
        scholarshipDoc: { $arrayElemAt: ['$scholarship', 0] },
        linked: { $gt: [{ $size: '$scholarship' }, 0] },
      },
    },
    { $addFields: { category: categoryExpression('$scholarshipDoc.scholarshipType') } },
    {
      $facet: {
        totals: [{ $count: 'count' }],
        unlinked: [
          { $match: { linked: false } },
          { $count: 'count' },
        ],
        byCategory: [
          { $match: linkedFilter },
          { $group: { _id: '$category', count: { $sum: 1 } } },
        ],
        trend: [
          { $match: linkedFilter },
          { $group: { _id: dateBucket(period, `$${dateField}`), count: { $sum: 1 } } },
        ],
        matching: [
          { $match: linkedFilter },
          { $count: 'count' },
        ],
      },
    },
  ];
};

const savedPipeline = (parsed) => engagementPipeline({
  period: parsed.period,
  dateField: 'dateSaved',
});

const applicationPipeline = (parsed) => engagementPipeline({
  period: parsed.period,
  dateField: 'dateApplied',
});

const profilePipeline = () => [
  {
      $facet: {
        academicLevel: [{ $group: { _id: { $ifNull: ['$academicLevel', 'Unknown'] }, count: { $sum: 1 } } }],
        course: [{ $group: { _id: { $ifNull: ['$course', 'Unknown'] }, count: { $sum: 1 } } }],
        region: [{ $group: { _id: { $ifNull: ['$region', 'Unknown'] }, count: { $sum: 1 } } }],
        total: [{ $count: 'count' }],
      },
    },
  ];

const saverPipeline = ({ period }) => [
  { $match: { dateSaved: { $gte: period.start, $lt: period.end } } },
  { $group: { _id: '$studentProfileId', saves: { $sum: 1 } } },
  {
    $lookup: {
      from: StudentProfile.collection.collectionName,
      localField: '_id',
      foreignField: '_id',
      as: 'profile',
    },
  },
  { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
  {
    $facet: {
      academicLevel: [{
        $group: {
          _id: { $ifNull: ['$profile.academicLevel', 'Unknown'] },
          students: { $sum: 1 },
          saves: { $sum: '$saves' },
        },
      }],
      course: [{
        $group: {
          _id: { $ifNull: ['$profile.course', 'Unknown'] },
          students: { $sum: 1 },
          saves: { $sum: '$saves' },
        },
      }],
      region: [{
        $group: {
          _id: { $ifNull: ['$profile.region', 'Unknown'] },
          students: { $sum: 1 },
          saves: { $sum: '$saves' },
        },
      }],
    },
  },
];

const providerPipeline = ({ period, suspendedIds, page, limit }) => {
  const [stage1, stage2] = listingStages(suspendedIds);
  const skip = (page - 1) * limit;
  return [
    { $addFields: stage1 },
    { $addFields: stage2 },
    {
      $group: {
        _id: '$providerId',
        totalListings: { $sum: 1 },
        availableScholarships: sumWhen('$studentFacingAvailable'),
        archivedListings: sumWhen({ $eq: ['$isArchived', true] }),
        createdInPeriod: sumWhen({
          $and: [
            { $gte: ['$createdAt', period.start] },
            { $lt: ['$createdAt', period.end] },
          ],
        }),
      },
    },
    {
      $lookup: {
        from: Provider.collection.collectionName,
        localField: '_id',
        foreignField: '_id',
        as: 'provider',
      },
    },
    { $addFields: { provider: { $arrayElemAt: ['$provider', 0] } } },
    {
      $lookup: {
        from: User.collection.collectionName,
        localField: 'provider.userId',
        foreignField: '_id',
        as: 'providerUser',
      },
    },
    { $addFields: { providerUser: { $arrayElemAt: ['$providerUser', 0] } } },
    {
      $addFields: {
        institutionName: { $ifNull: ['$provider.institutionName', 'Unknown provider'] },
        verificationStatus: { $ifNull: ['$provider.verificationStatus', 'Unknown'] },
        accountSuspended: { $eq: ['$providerUser.status', 'suspended'] },
      },
    },
    { $sort: { totalListings: -1, institutionName: 1 } },
    {
      $facet: {
        rows: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: 'count' }],
      },
    },
  ];
};

const demandPipelines = (period) => ({
  inPeriod: [
    { $match: { createdAt: { $gte: period.start, $lt: period.end } } },
    {
      $group: {
        _id: { dimension: '$dimension', value: '$value' },
        count: { $sum: 1 },
      },
    },
  ],
  first: [
    { $sort: { createdAt: 1 } },
    { $group: { _id: null, first: { $first: '$createdAt' } } },
  ],
});

const assembleRegistrations = (parsed, facts) => {
  const snapshot = accountSnapshot(facts.snapshot);
  const series = registrationSeries(parsed.period, facts.inPeriod);
  const inPeriod = series.reduce((totals, bucket) => {
    totals.students += bucket.students;
    totals.providers += bucket.providers;
    totals.admins += bucket.admins;
    totals.superadmins += bucket.superadmins;
    totals.other += bucket.other;
    totals.total += bucket.total;
    return totals;
  }, emptyRoles());

  return envelope(parsed, {
    registrations: {
      current: {
        totalRegisteredUsers: snapshot.roles.total,
        totalStudents: snapshot.roles.students,
        totalProviders: snapshot.roles.providers,
        totalAdministrators: snapshot.roles.admins + snapshot.roles.superadmins,
        totalAdmins: snapshot.roles.admins,
        totalSuperadmins: snapshot.roles.superadmins,
        otherRoles: snapshot.roles.other,
        totalActiveAccounts: snapshot.status.active,
        totalSuspendedAccounts: snapshot.status.suspended,
        totalPendingConsentAccounts: snapshot.status.pending_consent,
        email: snapshot.email,
      },
      inPeriod,
      cumulative: {
        beforePeriod: roleTotals(facts.beforePeriod),
        throughPeriodEnd: roleTotals(facts.throughPeriodEnd),
      },
      series,
      roleDistribution: [
        { role: 'student', count: snapshot.roles.students },
        { role: 'provider', count: snapshot.roles.providers },
        { role: 'admin', count: snapshot.roles.admins },
        { role: 'superadmin', count: snapshot.roles.superadmins },
      ],
      accountStatus: [
        { status: 'active', count: snapshot.status.active },
        { status: 'suspended', count: snapshot.status.suspended },
        { status: 'pending_consent', count: snapshot.status.pending_consent },
      ],
      note: 'Role and account-status figures are a current snapshot. The series and inPeriod counts include only registrations in the selected period. Cumulative totals use User.createdAt and are not the same numbers as the period chart.',
    },
  });
};

const assembleScholarships = (parsed, facet) => {
  const totals = scholarshipTotals(firstOf(facet && facet.totals) || {});
  const byCategory = (facet.byCategory || [])
    .map((row) => ({
      category: row._id || 'Unspecified',
      listings: row.totalListings || 0,
      available: row.available || 0,
    }))
    .sort((left, right) => right.listings - left.listings || left.category.localeCompare(right.category));
  const byGeography = (facet.byGeography || [])
    .map((row) => ({
      bucket: row._id || 'Unspecified',
      listings: row.listings || 0,
      available: row.available || 0,
    }))
    .sort((left, right) => right.listings - left.listings || left.bucket.localeCompare(right.bucket));

  return {
    scholarships: {
      ...totals,
      deadlineWindowDays: 14,
      createdSeries: fillSeries(
        parsed.period,
        facet.createdTrend,
        (row) => row._id,
        (row) => row.count || 0
      ),
      byCategory,
      byGeography,
      geographicBucketsAreAdditive: true,
      note: 'Created-over-time includes listings created in the period even if they were later archived. Active open counts are the current student-facing snapshot and are not limited to the period. Geographic buckets assign each listing once.',
    },
  };
};

const searchSections = (eventRows, firstRow) => {
  const sections = { academicLevel: [], region: [], eligibilityTag: [] };
  (eventRows || []).forEach((row) => {
    const dimension = row._id && row._id.dimension;
    if (!sections[dimension]) return;
    sections[dimension].push({
      value: row._id.value,
      events: row.count || 0,
    });
  });
  Object.values(sections).forEach((rows) => {
    rows.sort((left, right) => right.events - left.events || left.value.localeCompare(right.value));
  });
  const first = firstRow && firstRow.first ? new Date(firstRow.first) : null;
  return {
    recordsSearchText: false,
    storesStudentIdentifiers: false,
    retentionDays: 730,
    availableFrom: first && !Number.isNaN(first.getTime()) ? first.toISOString() : null,
    byDimension: sections,
    note: 'Events are recorded only after a student selects an academic level, region, or eligibility tag. Repeated selections by the same signed-in student are ignored for 10 minutes. Keyword text is never stored.',
  };
};

const assembleCategoryDemand = (parsed, facts) => {
  const rows = buildCategoryRows({
    supplyRows: facts.supply,
    saveRows: facts.saves,
    applicationRows: facts.applications,
  });
  const tagSupply = labeledRows(facts.tags, 'scholarships').map((row) => ({
    tag: row.label,
    availableScholarships: row.count,
  }));
  const tagEvents = new Map(
    ((facts.search && facts.search.byDimension && facts.search.byDimension.eligibilityTag) || [])
      .map((row) => [row.value, row.events])
  );
  const tagComparison = [...new Set([
    ...tagSupply.map((row) => row.tag),
    ...tagEvents.keys(),
  ])].sort((left, right) => left.localeCompare(right)).map((tag) => {
    const available = (tagSupply.find((row) => row.tag === tag) || {}).availableScholarships || 0;
    const events = tagEvents.get(tag) || 0;
    return {
      tag,
      availableScholarships: available,
      structuredFilterEvents: events,
      eventsPerAvailableScholarship: ratio(events, available),
    };
  });

  return envelope(parsed, {
    categoryDemand: {
      assignment: DEFINITIONS.categoryAssignment,
      rows,
      categoryRowsAreAdditive: true,
      eligibilityTagSupply: {
        additive: false,
        rows: tagSupply,
        note: 'A scholarship with more than one eligibility tag appears in each of those tag rows. Do not add this column to recreate the scholarship total.',
      },
      eligibilityTagComparison: {
        additive: false,
        rows: tagComparison,
        note: 'Structured filter events count students selecting that eligibility tag. They are not scholarship-type searches and are not added to saved interest.',
      },
      structuredSearch: facts.search,
      savedMatchesInPeriod: facts.savedMatchesInPeriod,
      savedMatchesUnlinked: facts.savedMatchesUnlinked,
      recordedApplicationsInPeriod: facts.recordedApplicationsInPeriod,
      recordedApplicationsUnlinked: facts.recordedApplicationsUnlinked,
    },
  });
};

const assembleStudentInsights = (parsed, facts) => envelope(parsed, {
  studentInsights: {
    profiles: {
      total: countOf(facts.profiles.total),
      academicLevel: labeledRows(facts.profiles.academicLevel),
      course: topGroups(facts.profiles.course, 12),
      region: labeledRows(facts.profiles.region),
      courseNote: 'Courses after the 12 most common are grouped as Other.',
    },
    savedSeries: facts.savedSeries,
    categoriesMostSaved: facts.categoriesMostSaved,
    savers: {
      academicLevel: labeledRows(facts.savers.academicLevel, 'students'),
      course: topGroups(
        (facts.savers.course || []).map((row) => ({ _id: row._id, count: row.students || 0 })),
        12
      ),
      region: labeledRows(facts.savers.region, 'students'),
      note: 'Saver charts count distinct student profiles with at least one saved scholarship in the period. They do not mean the student applied or was awarded a scholarship.',
    },
  },
});

const verificationRows = (rows) => {
  const counts = new Map((rows || []).map((row) => [String(row._id || 'Unknown'), row.count || 0]));
  const labels = new Set(VERIFICATION_STATUSES);
  counts.forEach((_count, label) => labels.add(label));
  return [...labels].map((status) => ({ status, count: counts.get(status) || 0 }));
};

const assembleProviderInsights = (parsed, facts) => {
  const email = facts.email || {};
  const rows = (facts.providers && facts.providers.rows) || [];
  return envelope(parsed, {
    providerInsights: {
      organizationVerification: verificationRows(facts.verification),
      emailVerification: {
        verified: email.providersVerified || 0,
        unverified: email.providersUnverified || 0,
      },
      accountStatus: {
        active: facts.providerStatus?.active || 0,
        suspended: facts.providerStatus?.suspended || 0,
        pending_consent: facts.providerStatus?.pending_consent || 0,
      },
      scholarshipsByProvider: {
        page: parsed.page,
        limit: parsed.limit,
        total: facts.providers.total || 0,
        rows: rows.map((row) => ({
          providerId: row._id == null ? null : String(row._id),
          institutionName: row.institutionName || 'Unknown provider',
          verificationStatus: row.verificationStatus || 'Unknown',
          accountSuspended: row.accountSuspended === true,
          totalListings: row.totalListings || 0,
          availableScholarships: row.availableScholarships || 0,
          archivedListings: row.archivedListings || 0,
          createdInPeriod: row.createdInPeriod || 0,
        })),
      },
      note: 'Organization verification and email verification are both shown because they measure different decisions. The provider table omits representative names, emails, and phone numbers.',
    },
  });
};

const run = async (model, pipeline) => model.aggregate(pipeline);

const loadSuspendedIds = async () => {
  const ids = await suspendedProviderFilter.suspendedProviderIds();
  return Array.isArray(ids) ? ids : [];
};

const buildRegistrations = async (parsed) => {
  const pipelines = userPipelines(parsed.period);
  const [snapshot, inPeriod, beforePeriod, throughPeriodEnd] = await Promise.all([
    run(User, pipelines.snapshot),
    run(User, pipelines.inPeriod),
    run(User, pipelines.beforePeriod),
    run(User, pipelines.throughPeriodEnd),
  ]);
  return assembleRegistrations(parsed, { snapshot, inPeriod, beforePeriod, throughPeriodEnd });
};

const buildScholarshipSection = async (parsed) => {
  const ids = await loadSuspendedIds();
  const [facetRow] = await run(Scholarship, scholarshipPipeline({
    period: parsed.period,
    suspendedIds: ids,
    now: parsed.now,
  }));
  return assembleScholarships(parsed, facetRow || {});
};

const loadSaved = async (parsed) => {
  const [allTime, facetRow] = await Promise.all([
    run(SavedMatch, [{ $count: 'count' }]),
    run(SavedMatch, savedPipeline(parsed)),
  ]);
  const facet = facetRow && facetRow[0] ? facetRow[0] : {};
  return {
    allTime: countOf(allTime),
    inPeriod: countOf(facet.totals),
    matchingFilters: countOf(facet.matching),
    unlinked: countOf(facet.unlinked),
    byCategory: facet.byCategory || [],
    series: fillSeries(parsed.period, facet.trend, (row) => row._id, (row) => row.count || 0),
  };
};

const loadApplications = async (parsed) => {
  const [allTime, facetRow] = await Promise.all([
    run(Application, [{ $count: 'count' }]),
    run(Application, applicationPipeline(parsed)),
  ]);
  const facet = facetRow && facetRow[0] ? facetRow[0] : {};
  return {
    allTime: countOf(allTime),
    inPeriod: countOf(facet.totals),
    matchingFilters: countOf(facet.matching),
    unlinked: countOf(facet.unlinked),
    byCategory: facet.byCategory || [],
  };
};

const loadSearch = async (parsed) => {
  const pipelines = demandPipelines(parsed.period);
  const [inPeriod, first] = await Promise.all([
    run(CategoryDemandEvent, pipelines.inPeriod),
    run(CategoryDemandEvent, pipelines.first),
  ]);
  return searchSections(inPeriod, firstOf(first));
};

const buildOverview = async (parsed) => {
  const [registrations, scholarshipSection, saved, applications, search] = await Promise.all([
    buildRegistrations(parsed),
    buildScholarshipSection(parsed),
    loadSaved(parsed),
    loadApplications(parsed),
    loadSearch(parsed),
  ]);
  const current = registrations.registrations.current;
  const supply = scholarshipSection.scholarships;
  return envelope(parsed, {
    overview: {
      totalRegisteredUsers: current.totalRegisteredUsers,
      totalStudents: current.totalStudents,
      totalProviders: current.totalProviders,
      totalAdministrators: current.totalAdministrators,
      totalActiveAccounts: current.totalActiveAccounts,
      totalSuspendedAccounts: current.totalSuspendedAccounts,
      totalPendingConsentAccounts: current.totalPendingConsentAccounts,
      totalScholarshipListings: supply.totalListings,
      activeOpenScholarships: supply.activeOpenScholarships,
      archivedScholarships: supply.archivedScholarships,
      administrativelyRemovedScholarships: supply.administrativelyRemovedScholarships,
      suspendedProviderListings: supply.suspendedProviderListings,
      totalSavedScholarships: saved.allTime,
      savedScholarshipsInPeriod: saved.matchingFilters,
      totalRecordedApplications: applications.allTime,
      recordedApplicationsInPeriod: applications.matchingFilters,
      structuredSearchEventsInPeriod: search.byDimension.academicLevel
        .concat(search.byDimension.region, search.byDimension.eligibilityTag)
        .reduce((sum, row) => sum + row.events, 0),
      searchTrackingAvailableFrom: search.availableFrom,
      registrationsInPeriod: registrations.registrations.inPeriod,
      email: current.email,
    },
  });
};

const buildScholarships = async (parsed) => envelope(parsed, await buildScholarshipSection(parsed));

const buildCategoryDemand = async (parsed) => {
  const ids = await loadSuspendedIds();
  const [facetRow, tags, saved, applications, search] = await Promise.all([
    run(Scholarship, scholarshipPipeline({
      period: parsed.period,
      suspendedIds: ids,
      now: parsed.now,
    })),
    run(Scholarship, tagPipeline({
      suspendedIds: ids,
    })),
    loadSaved(parsed),
    loadApplications(parsed),
    loadSearch(parsed),
  ]);
  const facet = facetRow && facetRow[0] ? facetRow[0] : {};
  return assembleCategoryDemand(parsed, {
    supply: facet.byCategory || [],
    tags,
    saves: saved.byCategory,
    applications: applications.byCategory,
    savedMatchesInPeriod: saved.matchingFilters,
    savedMatchesUnlinked: saved.unlinked,
    recordedApplicationsInPeriod: applications.matchingFilters,
    recordedApplicationsUnlinked: applications.unlinked,
    search,
  });
};

const buildStudentInsights = async (parsed) => {
  const [profileRow, saverRow, saved] = await Promise.all([
    run(StudentProfile, profilePipeline(parsed)),
    run(SavedMatch, saverPipeline(parsed)),
    loadSaved(parsed),
  ]);
  const profiles = profileRow && profileRow[0] ? profileRow[0] : { academicLevel: [], course: [], region: [], total: [] };
  const savers = saverRow && saverRow[0] ? saverRow[0] : { academicLevel: [], course: [], region: [] };
  const categoriesMostSaved = (saved.byCategory || [])
    .map((row) => ({ category: row._id || 'Unspecified', savedInterest: row.count || 0 }))
    .filter((row) => row.savedInterest > 0)
    .sort((left, right) => right.savedInterest - left.savedInterest || left.category.localeCompare(right.category));
  return assembleStudentInsights(parsed, {
    profiles,
    savers,
    savedSeries: saved.series,
    categoriesMostSaved,
  });
};

const buildProviderInsights = async (parsed) => {
  const ids = await loadSuspendedIds();
  const pipelines = userPipelines(parsed.period);
  const [verification, snapshot, providerRow] = await Promise.all([
    run(Provider, [{ $group: { _id: '$verificationStatus', count: { $sum: 1 } } }]),
    run(User, pipelines.snapshot),
    run(Scholarship, providerPipeline({
      period: parsed.period,
      suspendedIds: ids,
      page: parsed.page,
      limit: parsed.limit,
    })),
  ]);
  const accounts = accountSnapshot(snapshot);
  const providerStatus = { active: 0, suspended: 0, pending_consent: 0 };
  (snapshot || []).forEach((row) => {
    if (!row._id || row._id.role !== 'provider') return;
    if (Object.prototype.hasOwnProperty.call(providerStatus, row._id.status)) {
      providerStatus[row._id.status] += row.count || 0;
    }
  });
  const facet = providerRow && providerRow[0] ? providerRow[0] : { rows: [], total: [] };
  return assembleProviderInsights(parsed, {
    verification,
    email: accounts.email,
    providerStatus,
    providers: {
      rows: facet.rows || [],
      total: countOf(facet.total),
    },
  });
};

const BUILDERS = {
  registrations: buildRegistrations,
  scholarships: buildScholarships,
  'category-demand': buildCategoryDemand,
  'student-insights': buildStudentInsights,
  'provider-insights': buildProviderInsights,
};

const renderReportCsv = (reportName, report, generatedAt = new Date()) => {
  const rows = [
    ...reportStamp(reportName, report.period, generatedAt),
    [],
    ['Limitations'],
    ...(report.limitations || LIMITATIONS).map((item) => [item]),
    [],
  ];

  if (report.overview) {
    rows.push(['Section', 'Metric', 'Value']);
    Object.entries(report.overview).forEach(([key, value]) => {
      if (value && typeof value === 'object') {
        Object.entries(value).forEach(([nested, nestedValue]) => {
          rows.push(['Overview', `${key}.${nested}`, nestedValue ?? '']);
        });
        return;
      }
      rows.push(['Overview', key, value ?? '']);
    });
  }

  if (report.registrations) {
    const current = report.registrations.current;
    rows.push(['Section', 'Metric', 'Value']);
    Object.entries(current).forEach(([key, value]) => {
      if (value && typeof value === 'object') {
        Object.entries(value).forEach(([nested, nestedValue]) => {
          rows.push(['Current accounts', `${key}.${nested}`, nestedValue]);
        });
        return;
      }
      rows.push(['Current accounts', key, value]);
    });
    rows.push(
      [],
      ['Cumulative boundary', 'Students', 'Providers', 'Admins', 'Superadmins', 'Other', 'Total'],
      ['Before period', ...roleCsv(report.registrations.cumulative.beforePeriod)],
      ['Through period end', ...roleCsv(report.registrations.cumulative.throughPeriodEnd)],
      ['Registrations in period', ...roleCsv(report.registrations.inPeriod)],
      [],
      ['Period', 'Students', 'Providers', 'Admins', 'Superadmins', 'Other', 'Total'],
      ...report.registrations.series.map((bucket) => [
        bucket.label,
        bucket.students,
        bucket.providers,
        bucket.admins,
        bucket.superadmins,
        bucket.other,
        bucket.total,
      ]),
      [],
      ['Role', 'Current accounts'],
      ...report.registrations.roleDistribution.map((row) => [row.role, row.count]),
      [],
      ['Account status', 'Current accounts'],
      ...report.registrations.accountStatus.map((row) => [row.status, row.count])
    );
  }

  if (report.scholarships) {
    const supply = report.scholarships;
    rows.push(
      ['Section', 'Metric', 'Value'],
      ['Supply', 'Total listings', supply.totalListings],
      ['Supply', 'Active open scholarships', supply.activeOpenScholarships],
      ['Supply', 'Open listings including suspended providers', supply.openListingsIncludingSuspendedProviders],
      ['Supply', 'Archived scholarships', supply.archivedScholarships],
      ['Supply', 'Administratively removed', supply.administrativelyRemovedScholarships],
      ['Supply', 'Closed and not archived', supply.closedNotArchived],
      ['Supply', 'Suspended-provider listings', supply.suspendedProviderListings],
      ['Deadlines', 'Approaching within 14 days', supply.approachingDeadline],
      ['Deadlines', 'Past deadline and still open', supply.pastDeadlineStillOpen],
      [],
      ['Period', 'Scholarships created'],
      ...supply.createdSeries.map((bucket) => [bucket.label, bucket.count]),
      [],
      ['Category', 'Listings', 'Student-facing available'],
      ...supply.byCategory.map((row) => [row.category, row.listings, row.available]),
      [],
      ['Geographic bucket', 'Listings', 'Student-facing available'],
      ...supply.byGeography.map((row) => [row.bucket, row.listings, row.available])
    );
  }

  if (report.categoryDemand) {
    rows.push(
      ['Category', 'Available scholarships', 'Total listings', 'Archived', 'Administratively removed', 'Suspended-provider listings', 'Saved interest', 'Recorded applications', 'Saved interest per available scholarship', 'Interest without available supply'],
      ...report.categoryDemand.rows.map((row) => [
        row.category,
        row.availableScholarships,
        row.totalListings,
        row.archivedListings,
        row.administrativelyRemoved,
        row.suspendedProviderListings,
        row.savedInterest,
        row.recordedApplications,
        row.savedInterestPerAvailableScholarship ?? '',
        row.interestWithoutAvailableSupply ? 'Yes' : 'No',
      ]),
      [],
      ['Eligibility tag', 'Available scholarships with tag', 'Structured filter events', 'Events per available scholarship'],
      ['Tag rows overlap. Do not add them into a scholarship total.'],
      ...report.categoryDemand.eligibilityTagComparison.rows.map((row) => [
        row.tag,
        row.availableScholarships,
        row.structuredFilterEvents,
        row.eventsPerAvailableScholarship ?? '',
      ])
    );
  }

  if (report.studentInsights) {
    const insights = report.studentInsights;
    rows.push(
      ['Student profiles', insights.profiles.total],
      [],
      ['Academic level', 'Students'],
      ...insights.profiles.academicLevel.map((row) => [row.label, row.count]),
      [],
      ['Course or program', 'Students'],
      ...insights.profiles.course.map((row) => [row.label, row.count]),
      [],
      ['Student region', 'Students'],
      ...insights.profiles.region.map((row) => [row.label, row.count]),
      [],
      ['Period', 'Saved scholarships'],
      ...insights.savedSeries.map((bucket) => [bucket.label, bucket.count]),
      [],
      ['Category', 'Saved interest in period'],
      ...insights.categoriesMostSaved.map((row) => [row.category, row.savedInterest]),
      [],
      ['Saver academic level', 'Distinct students'],
      ...insights.savers.academicLevel.map((row) => [row.label, row.count]),
      [],
      ['Saver course', 'Distinct students'],
      ...insights.savers.course.map((row) => [row.label, row.count]),
      [],
      ['Saver region', 'Distinct students'],
      ...insights.savers.region.map((row) => [row.label, row.count])
    );
  }

  if (report.providerInsights) {
    const insights = report.providerInsights;
    rows.push(
      ['Organization verification status', 'Providers'],
      ...insights.organizationVerification.map((row) => [row.status, row.count]),
      [],
      ['Provider email verification', 'Providers'],
      ['Verified email', insights.emailVerification.verified],
      ['Unverified email', insights.emailVerification.unverified],
      [],
      ['Provider account status', 'Providers'],
      ['Active', insights.accountStatus.active],
      ['Suspended', insights.accountStatus.suspended],
      ['Pending consent', insights.accountStatus.pending_consent],
      [],
      ['Institution', 'Verification status', 'Account suspended', 'Total listings', 'Student-facing available', 'Archived', 'Created in period'],
      ...insights.scholarshipsByProvider.rows.map((row) => [
        row.institutionName,
        row.verificationStatus,
        row.accountSuspended ? 'Yes' : 'No',
        row.totalListings,
        row.availableScholarships,
        row.archivedListings,
        row.createdInPeriod,
      ])
    );
  }

  if (rows.length === 0) {
    rows.push(['No records in the selected period.']);
  }
  return renderCsv(rows);
};

const roleCsv = (counts) => [
  counts.students,
  counts.providers,
  counts.admins,
  counts.superadmins,
  counts.other,
  counts.total,
];

const reportTitle = {
  registrations: 'User registration trends',
  scholarships: 'Scholarship supply and availability',
  'category-demand': 'Scholarship category demand matrix',
  'student-insights': 'Student matching and saved-scholarship insights',
  'provider-insights': 'Provider verification statistics',
};

module.exports = {
  SCHOLARSHIP_CATEGORIES,
  REPORTS,
  DEFINITIONS,
  LIMITATIONS,
  resolveAnalyticsQuery,
  userPipelines,
  scholarshipPipeline,
  tagPipeline,
  savedPipeline,
  applicationPipeline,
  buildOverview,
  buildRegistrations,
  buildScholarships,
  buildCategoryDemand,
  buildStudentInsights,
  buildProviderInsights,
  BUILDERS,
  renderReportCsv,
  reportTitle,
  assembleRegistrations,
  buildCategoryRows,
};
