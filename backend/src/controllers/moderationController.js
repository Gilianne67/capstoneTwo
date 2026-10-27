const Report = require('../models/Report');
const Scholarship = require('../models/Scholarship');
const searchSync = require('../services/scholarshipSearchSync');
const matchCache = require('../services/matchCache');
const { recordAuditLog } = require('./auditController');

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
      .populate('listingId', 'name providerId status')
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
    const { status, action, notes } = req.body;

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Moderation report not found.',
      });
    }

    const followUpErrors = [];
    const alreadyResolved = Boolean(report.resolvedAt)
      || ['Resolved', 'Dismissed', 'Closed'].includes(report.status);

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
      const scholarship = await Scholarship.findByIdAndUpdate(
        report.listingId,
        {
          status: 'Closed',
          isArchived: true,
        },
        { new: true }
      );

      if (scholarship) {
        if (typeof searchSync?.syncScholarshipSearch === 'function') {
          try {
            const syncResult = await searchSync.syncScholarshipSearch(scholarship);
            if (syncResult && syncResult.synchronized === false && syncResult.reason === 'failed') {
              followUpErrors.push({
                step: 'searchSync',
                message: 'Scholarship search synchronization failed.',
              });
            }
          } catch (syncError) {
            console.error('Scholarship search sync failed during moderation:', syncError.message);
            followUpErrors.push({
              step: 'searchSync',
              message: 'Scholarship search synchronization failed.',
            });
          }
        }

        try {
          const cacheResult = await matchCache.invalidateMatchCache();
          if (cacheResult && cacheResult.ok === false && cacheResult.reason === 'redis_write_failed') {
            followUpErrors.push({
              step: 'matchCache',
              message: 'Match cache invalidation failed.',
            });
          }
        } catch (cacheError) {
          console.error('Match cache invalidation failed during moderation:', cacheError.message);
          followUpErrors.push({
            step: 'matchCache',
            message: 'Match cache invalidation failed.',
          });
        }
      }
    }

    if (!alreadyResolved) {
      report.status = status || 'Resolved';
      report.resolution = action || report.resolution;
      report.resolvedAt = new Date();
      report.resolvedBy = req.user?._id;
      if (notes) report.adminNotes = notes;
      await report.save();
    }

    // 📝 AUDIT LOG: Moderation Action Recorded
    try {
      const adminActor = req.user 
        ? `${req.user.firstName || req.user.name || ''} ${req.user.lastName || ''}`.trim() || req.user.email 
        : 'Admin User';

      await recordAuditLog({
        actor: adminActor,
        role: 'Admin',
        action: alreadyResolved ? 'MODERATION_REPORT_RETRY' : 'MODERATION_REPORT_RESOLVED',
        details: alreadyResolved
          ? `Moderation report ${id} retry repeated action ${report.resolution || action || 'Resolved'} without changing the saved resolution.`
          : `Moderation report ${id} resolved with action: ${action || 'Resolved'}.`,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
        severity: 'Info'
      });
    } catch (auditErr) {
      console.error('Moderation audit logging failed:', auditErr.message);
      followUpErrors.push({
        step: 'audit',
        message: 'The moderation audit record could not be saved.',
      });
    }

    if (followUpErrors.length > 0) {
      return res.status(500).json({
        success: false,
        message: alreadyResolved
          ? 'The saved resolution was kept, but a follow-up step failed.'
          : 'The report was updated, but a follow-up step failed.',
        errors: followUpErrors,
        data: report,
      });
    }

    return res.status(200).json({
      success: true,
      message: alreadyResolved
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
