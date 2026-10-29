const mongoose = require('mongoose');
const Scholarship = require('../models/Scholarship');
const Provider = require('../models/Provider');
const Report = require('../models/Report');
const { isAdminRole } = require('../middleware/auth');

const LIST_STATUSES = ['All', 'Open', 'Closed', 'Archived'];
const REPORT_STATUSES = ['All', 'Reported', 'Unreported'];
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const providerNameFrom = (providerId) => {
  if (providerId && typeof providerId === 'object') {
    return providerId.institutionName || 'Unknown provider';
  }
  return 'Unknown provider';
};

const providerIdFrom = (providerId) => {
  if (providerId && typeof providerId === 'object') {
    return providerId._id || providerId.id || null;
  }
  return providerId || null;
};

const isArchivedListing = (scholarship) =>
  scholarship?.isArchived === true || Boolean(scholarship?.adminRemovedAt);

const parsePositiveInt = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
};

const parseListQuery = (query = {}) => {
  const status = query.status === undefined || query.status === '' ? 'All' : String(query.status);
  const reportStatus = query.reportStatus === undefined || query.reportStatus === ''
    ? 'All'
    : String(query.reportStatus);
  const page = parsePositiveInt(query.page, 1);
  const limit = parsePositiveInt(query.limit, DEFAULT_LIMIT);

  if (!LIST_STATUSES.includes(status)) {
    return { ok: false, message: 'Status filter must be All, Open, Closed, or Archived.' };
  }

  if (!REPORT_STATUSES.includes(reportStatus)) {
    return { ok: false, message: 'Report filter must be All, Reported, or Unreported.' };
  }

  if (page === null) {
    return { ok: false, message: 'Page must be a positive integer.' };
  }

  if (limit === null) {
    return { ok: false, message: 'Limit must be a positive integer.' };
  }

  return {
    ok: true,
    status,
    reportStatus,
    page,
    limit: Math.min(limit, MAX_LIMIT),
    search: typeof query.search === 'string' ? query.search.trim() : '',
  };
};

const statusClause = (status) => {
  if (status === 'Open' || status === 'Closed') {
    return {
      status,
      isArchived: false,
      adminRemovedAt: null,
    };
  }

  if (status === 'Archived') {
    return {
      $or: [
        { isArchived: true },
        { adminRemovedAt: { $ne: null } },
      ],
    };
  }

  return null;
};

const buildListFilter = async ({ status, reportStatus, search }) => {
  const clauses = [];
  const statusFilter = statusClause(status);

  if (statusFilter) clauses.push(statusFilter);

  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    const providers = await Provider.find({ institutionName: regex }).select('_id').lean();
    const providerIds = (providers || []).map((provider) => provider._id).filter(Boolean);
    clauses.push({
      $or: [
        { name: regex },
        { providerId: { $in: providerIds } },
      ],
    });
  }

  if (reportStatus === 'Reported' || reportStatus === 'Unreported') {
    const reportedIds = await Report.distinct('listingId', { listingId: { $ne: null } });
    const ids = (reportedIds || []).filter(Boolean);
    clauses.push(
      reportStatus === 'Reported'
        ? { _id: { $in: ids } }
        : { _id: { $nin: ids } }
    );
  }

  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { $and: clauses };
};

const reportSummaryFor = async (scholarships) => {
  const ids = (scholarships || []).map((scholarship) => scholarship._id).filter(Boolean);
  const summary = new Map();

  if (ids.length === 0) return summary;

  const reports = await Report.find({ listingId: { $in: ids } }).select('listingId status').lean();

  for (const report of reports || []) {
    const key = String(report.listingId);
    const current = summary.get(key) || { reportCount: 0, openReportCount: 0 };
    current.reportCount += 1;
    if (report.status === 'Pending Review' || report.status === 'Under Investigation') {
      current.openReportCount += 1;
    }
    summary.set(key, current);
  }

  return summary;
};

const presentScholarship = (scholarship, reportsById) => {
  const archived = isArchivedListing(scholarship);
  const reportInfo = reportsById.get(String(scholarship._id)) || {
    reportCount: 0,
    openReportCount: 0,
  };

  return {
    _id: scholarship._id,
    name: scholarship.name,
    providerId: providerIdFrom(scholarship.providerId),
    providerName: providerNameFrom(scholarship.providerId),
    status: scholarship.status,
    deadline: scholarship.deadline,
    isArchived: scholarship.isArchived === true,
    adminRemovedAt: scholarship.adminRemovedAt || null,
    adminRemovalReason: scholarship.adminRemovalReason || '',
    listingState: archived ? 'Archived' : 'Active',
    reportCount: reportInfo.reportCount,
    openReportCount: reportInfo.openReportCount,
    reportStatus: reportInfo.reportCount > 0 ? 'Reported' : 'Unreported',
    canArchive: !archived,
  };
};

const getAdminScholarships = async (req, res) => {
  try {
    if (!isAdminRole(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }

    const parsed = parseListQuery(req.query || {});
    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        message: parsed.message,
      });
    }

    const filter = await buildListFilter(parsed);
    const skip = (parsed.page - 1) * parsed.limit;
    const [scholarships, total] = await Promise.all([
      Scholarship.find(filter)
        .select('name providerId status deadline isArchived adminRemovedAt adminRemovalReason updatedAt createdAt')
        .populate({ path: 'providerId', select: 'institutionName' })
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(parsed.limit)
        .lean(),
      Scholarship.countDocuments(filter),
    ]);
    const reportsById = await reportSummaryFor(scholarships);
    const data = (scholarships || []).map((scholarship) => presentScholarship(scholarship, reportsById));

    return res.status(200).json({
      success: true,
      count: data.length,
      total,
      page: parsed.page,
      pages: Math.ceil(total / parsed.limit) || 0,
      data,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid scholarship filter.',
      });
    }

    console.error('Admin scholarship list error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to load scholarships. Please try again.',
    });
  }
};

module.exports = {
  getAdminScholarships,
};
