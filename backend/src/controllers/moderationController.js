const Report = require('../models/Report');
const Scholarship = require('../models/Scholarship');
const {
  administrativelyRemoveScholarship: archiveListing,
} = require('../services/scholarshipArchiveService');
const {
  notifyScholarshipReportDecision,
  notifyScholarshipListingRemoved,
  notifyProviderListingRemoved
} = require('../services/notificationService');
const { recordAuditLog } = require('./auditController');

const rememberAuditFailure = (followUpErrors, audit) => {
  if (audit && audit.ok === false) {
    followUpErrors.push({
      step: 'audit',
      message: audit.message || 'The moderation audit record could not be saved.',
    });
  }
};

const sendModerationResult = (res, { followUpErrors, failureMessage, successMessage, data }) => {
  const blocking = followUpErrors.filter((item) => item.step !== 'audit');
  if (blocking.length > 0) {
    return res.status(500).json({
      success: false,
      message: failureMessage,
      errors: followUpErrors,
      data,
    });
  }

  const warnings = followUpErrors.filter((item) => item.step === 'audit');
  return res.status(200).json({
    success: true,
    message: successMessage,
    data,
    ...(warnings.length > 0 ? { warnings } : {}),
  });
};

const CLOSED_REPORT_STATUSES = [
  'Resolved',
  'Dismissed',
  'Closed',
  'Retained',
  'Removed',
];

const PENDING_REPORT_STATUSES = ['Pending Review', 'Under Investigation'];

const isPendingReport = (report) =>
  Boolean(report)
  && PENDING_REPORT_STATUSES.includes(report.status)
  && !report.resolvedAt;

const adminIdFrom = (user) => user?._id || user?.id;

const loadScholarshipState = async (listingId) => {
  if (!listingId || typeof Scholarship.findById !== 'function') return null;
  const query = Scholarship.findById(listingId);
  if (!query || typeof query.select !== 'function') return query;
  return query.select('name status isArchived providerId adminRemovedAt');
};

const listingAlreadyRemoved = (scholarship) =>
  scholarship?.isArchived === true || Boolean(scholarship?.adminRemovedAt);

const releaseRetainedClaim = async (reportId) => {
  if (typeof Report.findOneAndUpdate !== 'function') return null;
  return Report.findOneAndUpdate(
    {
      _id: reportId,
      status: 'Retained',
      resolution: 'RETAIN_LISTING',
    },
    {
      $set: {
        status: 'Pending Review',
        resolution: 'NONE',
        decisionReason: '',
        adminNotes: '',
      },
      $unset: {
        resolvedAt: 1,
        resolvedBy: 1,
      },
    },
    { returnDocument: 'after' }
  );
};

const explanationFrom = (body = {}) => {
  const raw = Object.prototype.hasOwnProperty.call(body, 'decisionReason')
    ? body.decisionReason
    : body.notes;
  return typeof raw === 'string' ? raw.trim() : '';
};

const targetsSameScholarship = (report, body = {}) => {
  const requested = body.scholarshipId ?? body.listingId;
  if (requested === undefined || requested === null || requested === '') {
    return true;
  }

  return String(requested) === String(report.listingId || '');
};

const getModerationReports = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status && status !== 'All') {
      filter.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const reports = await Report.find(filter)
      .populate('reportedBy', 'name email role')
      .populate({
        path: 'listingId',
        select: 'name providerId status isArchived',
        populate: { path: 'providerId', select: 'institutionName' },
      })
      .populate('resolvedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const totalReports = await Report.countDocuments(filter);

    return res.status(200).json({
      success: true,
      count: reports.length,
      total: totalReports,
      page: Number(page),
      pages: Math.ceil(totalReports / limit),
      data: reports,
    });
  } catch (error) {
    console.error('Error fetching moderation reports:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching moderation reports.',
      error: error.message,
    });
  }
};

const updateModerationReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, action, notes } = req.body || {};
    const explanation = explanationFrom(req.body || {});

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Moderation report not found.',
      });
    }

    if (!targetsSameScholarship(report, req.body || {})) {
      return res.status(400).json({
        success: false,
        message: 'This report cannot be used to modify a different scholarship.',
      });
    }

    const followUpErrors = [];
    const alreadyResolved = Boolean(report.resolvedAt)
      || CLOSED_REPORT_STATUSES.includes(report.status);
    const wantsRetain = action === 'RETAIN_LISTING';
    const wantsExplainedRemoval = action === 'REMOVE_LISTING' && (
      status === 'Removed' ||
      Object.prototype.hasOwnProperty.call(req.body || {}, 'decisionReason')
    );
    const wantsDecision = wantsRetain || wantsExplainedRemoval;

    if (wantsDecision) {
      if (!isPendingReport(report)) {
        return res.status(409).json({
          success: false,
          message: 'This report already has a resolution and cannot be overwritten.',
          data: report,
        });
      }

      if (!explanation) {
        return res.status(400).json({
          success: false,
          message: 'A decision explanation is required.',
        });
      }

      const scholarshipBefore = await loadScholarshipState(report.listingId);
      if (wantsRetain && listingAlreadyRemoved(scholarshipBefore)) {
        return res.status(409).json({
          success: false,
          message: 'This scholarship has already been removed and cannot be retained.',
          data: report,
        });
      }

      const reviewerId = adminIdFrom(req.user);
      const decisionFields = wantsRetain
        ? {
          status: 'Retained',
          resolution: 'RETAIN_LISTING',
          decisionReason: explanation,
          adminNotes: explanation,
          resolvedAt: new Date(),
          resolvedBy: reviewerId,
        }
        : {
          status: 'Removed',
          resolution: 'REMOVE_LISTING',
          decisionReason: explanation,
          adminNotes: explanation,
          resolvedAt: new Date(),
          resolvedBy: reviewerId,
        };

      const claimed = await Report.findOneAndUpdate(
        {
          _id: report._id,
          status: { $in: PENDING_REPORT_STATUSES },
          resolvedAt: null,
        },
        { $set: decisionFields },
        { returnDocument: 'after' }
      );

      if (!claimed) {
        const current = await Report.findById(id);
        return res.status(409).json({
          success: false,
          message: 'This report already has a resolution and cannot be overwritten.',
          data: current || report,
        });
      }

      if (wantsRetain && report.listingId) {
        const scholarshipAfter = await loadScholarshipState(report.listingId);
        if (listingAlreadyRemoved(scholarshipAfter)) {
          await releaseRetainedClaim(claimed._id);
          return res.status(409).json({
            success: false,
            message: 'This scholarship has already been removed and cannot be retained.',
          });
        }
      }

      let removedScholarship = null;
      if (wantsExplainedRemoval && claimed.listingId) {
        removedScholarship = await archiveListing(
          claimed.listingId,
          followUpErrors,
          explanation
        );
      }

      const scholarshipTitle = removedScholarship?.name
        || scholarshipBefore?.name
        || claimed.listingTitle
        || 'Scholarship';

      if (claimed.reportedBy) {
        try {
          await notifyScholarshipReportDecision({
            studentUserId: claimed.reportedBy,
            reportId: claimed._id || id,
            scholarshipId: claimed.listingId,
            scholarshipTitle,
            decision: wantsRetain ? 'Retained' : 'Removed',
            explanation,
          });
        } catch (notifyError) {
          console.error('Scholarship report notification failed:', notifyError.message);
          followUpErrors.push({
            step: 'notification',
            message: 'The student could not be notified of this decision.',
          });
        }
      }

      if (wantsExplainedRemoval && claimed.listingId) {
        const providerId = removedScholarship?.providerId || scholarshipBefore?.providerId;
        try {
          await notifyProviderListingRemoved({
            providerId,
            scholarshipId: claimed.listingId,
            scholarshipTitle,
            explanation,
            removedAt: removedScholarship?.adminRemovedAt,
          });
        } catch (notifyError) {
          console.error('Provider removal notification failed:', notifyError.message);
          followUpErrors.push({
            step: 'providerNotification',
            message: 'The scholarship provider could not be notified of this removal.',
          });
        }

        const reviewedUserId = String(claimed.reportedBy || '');
        const relatedQuery = Report.find({
          listingId: claimed.listingId,
          _id: { $ne: claimed._id },
        });
        const related = typeof relatedQuery?.select === 'function'
          ? await relatedQuery.select('reportedBy')
          : await relatedQuery;
        const notifiedStudents = new Set();

        for (const other of related || []) {
          const otherUserId = String(other?.reportedBy || '');
          if (!otherUserId || otherUserId === reviewedUserId || notifiedStudents.has(otherUserId)) {
            continue;
          }
          notifiedStudents.add(otherUserId);
          try {
            await notifyScholarshipListingRemoved({
              studentUserId: other.reportedBy,
              scholarshipId: claimed.listingId,
              scholarshipTitle,
              explanation,
            });
          } catch (notifyError) {
            console.error('Shared listing removal notification failed:', notifyError.message);
            followUpErrors.push({
              step: 'notification',
              message: 'Another student who reported this scholarship could not be notified of the removal.',
            });
          }
        }
      }

      const adminActor = req.user
        ? `${req.user.firstName || req.user.name || ''} ${req.user.lastName || ''}`.trim() || req.user.email
        : 'Admin User';

      const audit = await recordAuditLog({
        actor: adminActor,
        actorId: req.user && (req.user._id || req.user.id),
        role: (req.user && req.user.role) || 'Admin',
        action: 'MODERATION_REPORT_RESOLVED',
        details: `Moderation report ${id} for scholarship "${claimed.listingTitle || scholarshipTitle || 'Unknown scholarship'}" (ID: ${claimed.listingId || 'unknown'}) resolved with outcome ${claimed.resolution || 'Resolved'}.`,
        ipAddress: req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1',
        severity: 'Info',
      });
      rememberAuditFailure(followUpErrors, audit);

      return sendModerationResult(res, {
        followUpErrors,
        failureMessage: 'The report was updated, but a follow-up step failed.',
        successMessage: 'Report updated successfully.',
        data: claimed,
      });
    }

    if (alreadyResolved) {
      const sameStatus = !status || status === report.status;
      const sameAction = !action || action === report.resolution;
      if (!sameStatus || !sameAction) {
        return res.status(409).json({
          success: false,
          message: 'This report already has a resolution and cannot be overwritten.',
          data: report,
        });
      }
    }

    if (action === 'REMOVE_LISTING' && report.listingId) {
      await archiveListing(report.listingId, followUpErrors);
    }

    if (!alreadyResolved) {
      report.status = status || 'Resolved';
      report.resolution = action || report.resolution;
      report.resolvedAt = new Date();
      report.resolvedBy = req.user?._id || req.user?.id;
      if (notes) report.adminNotes = notes;
      await report.save();
    }

    const adminActor = req.user
      ? `${req.user.firstName || req.user.name || ''} ${req.user.lastName || ''}`.trim() || req.user.email
      : 'Admin User';

    const audit = await recordAuditLog({
      actor: adminActor,
      actorId: req.user && (req.user._id || req.user.id),
      role: (req.user && req.user.role) || 'Admin',
      action: alreadyResolved ? 'MODERATION_REPORT_RETRY' : 'MODERATION_REPORT_RESOLVED',
      details: alreadyResolved
        ? `Moderation report ${id} for scholarship "${report.listingTitle || 'Unknown scholarship'}" (ID: ${report.listingId || 'unknown'}) kept outcome ${report.resolution || action || 'Resolved'}.`
        : `Moderation report ${id} for scholarship "${report.listingTitle || 'Unknown scholarship'}" (ID: ${report.listingId || 'unknown'}) resolved with outcome ${action || report.resolution || 'Resolved'}.`,
      ipAddress: req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1',
      severity: 'Info'
    });
    rememberAuditFailure(followUpErrors, audit);

    return sendModerationResult(res, {
      followUpErrors,
      failureMessage: alreadyResolved
        ? 'The saved resolution was kept, but a follow-up step failed.'
        : 'The report was updated, but a follow-up step failed.',
      successMessage: alreadyResolved
        ? 'The existing resolution was kept.'
        : 'Report updated successfully.',
      data: report,
    });
  } catch (error) {
    console.error('Error updating moderation report:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while resolving moderation report.',
      error: error.message,
    });
  }
};

module.exports = {
  getModerationReports,
  updateModerationReport,
};
