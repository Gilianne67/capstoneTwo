const mongoose = require('mongoose');
const Report = require('../models/Report');
const Scholarship = require('../models/Scholarship');
const { isProviderAccountSuspended } = require('../services/suspendedProviderFilter');
const Provider = require('../models/Provider');
const { recordAuditLog, withAuditWarning } = require('./auditController');

const REPORT_CATEGORIES = [
  'Incorrect or misleading information',
  'Expired or closed scholarship',
  'Suspicious or potentially fraudulent listing',
  'Incorrect eligibility requirements',
  'Other concern',
];

const ACTIVE_REPORT_STATUSES = ['Pending Review', 'Under Investigation'];

const isValidObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value) &&
  String(new mongoose.Types.ObjectId(value)) === String(value);

const isDuplicateKeyError = (error) =>
  Boolean(error) && (error.code === 11000 || error.code === 11001);

const authenticatedUserId = (user) => {
  if (!user) return '';
  return String(user._id || user.id || '');
};

const createScholarshipReport = async (req, res) => {
  try {
    const scholarshipId = req.params.scholarshipId;
    const reporterId = authenticatedUserId(req.user);

    if (!reporterId) {
      return res.status(401).json({
        success: false,
        message: 'Please log in to continue.',
      });
    }

    if (
      Object.prototype.hasOwnProperty.call(req.body || {}, 'reportedBy') &&
      String(req.body.reportedBy) !== reporterId
    ) {
      return res.status(403).json({
        success: false,
        message: 'You can only submit a report for your own account.',
      });
    }

    if (
      req.body?.scholarshipId !== undefined &&
      req.body?.scholarshipId !== null &&
      String(req.body.scholarshipId) !== String(scholarshipId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'The report scholarship does not match this listing.',
      });
    }

    if (!isValidObjectId(scholarshipId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid scholarship is required.',
      });
    }

    const category = typeof req.body?.category === 'string'
      ? req.body.category.trim()
      : '';

    if (!REPORT_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Select a valid reason category.',
      });
    }

    if (
      req.body?.details !== undefined &&
      req.body?.details !== null &&
      typeof req.body.details !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Additional details must be text.',
      });
    }

    const details = typeof req.body?.details === 'string'
      ? req.body.details.trim()
      : '';

    if (details.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Additional details cannot exceed 1000 characters.',
      });
    }

    const scholarship = await Scholarship.findById(scholarshipId)
      .select('name providerId status isArchived');

    if (!scholarship) {
      return res.status(404).json({
        success: false,
        message: 'Scholarship not found.',
      });
    }

    if (await isProviderAccountSuspended(scholarship.providerId)) {
      return res.status(404).json({
        success: false,
        message: 'Scholarship not found.',
      });
    }

    if (scholarship.isArchived === true) {
      return res.status(400).json({
        success: false,
        message: 'This scholarship has been removed and cannot be reported.',
      });
    }

    const existing = await Report.findOne({
      reportedBy: reporterId,
      listingId: scholarship._id,
      status: { $in: ACTIVE_REPORT_STATUSES },
    }).select('_id');

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'You already have an active report for this scholarship.',
      });
    }

    let providerName = '';
    if (scholarship.providerId) {
      const provider = await Provider.findById(scholarship.providerId)
        .select('institutionName');
      providerName = provider?.institutionName || '';
    }

    const report = await Report.create({
      reportedBy: reporterId,
      listingId: scholarship._id,
      listingTitle: scholarship.name,
      providerName,
      category,
      reason: category,
      details,
      status: 'Pending Review',
      resolution: 'NONE',
    });

    const audit = await recordAuditLog({
      actor: req.user?.name || req.user?.email || reporterId,
      actorId: reporterId,
      role: 'Student',
      action: 'SCHOLARSHIP_REPORTED',
      details: `Student ${reporterId} reported scholarship ${scholarship._id} (report ${report._id}). Category: ${category}.`,
      ipAddress: req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1',
      severity: 'Warning',
    });

    return res.status(201).json(withAuditWarning({
      success: true,
      message: 'Scholarship report submitted.',
      data: report,
    }, audit));
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res.status(409).json({
        success: false,
        message: 'You already have an active report for this scholarship.',
      });
    }

    if (error?.name === 'ValidationError') {
      const message = Object.values(error.errors || {})
        .map((item) => item?.message)
        .filter(Boolean)
        .join(' ');

      return res.status(400).json({
        success: false,
        message: message || 'The report could not be saved.',
      });
    }

    console.error('Error creating scholarship report:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while submitting the scholarship report.',
    });
  }
};

module.exports = {
  REPORT_CATEGORIES,
  ACTIVE_REPORT_STATUSES,
  createScholarshipReport,
};
