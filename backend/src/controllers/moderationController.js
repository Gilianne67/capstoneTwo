const Report = require('../models/Report');
const Scholarship = require('../models/Scholarship');
const searchSync = require('../services/scholarshipSearchSync');
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

    if (action === 'REMOVE_LISTING' && report.listingId) {
      const scholarship = await Scholarship.findByIdAndUpdate(
        report.listingId,
        {
          status: 'Closed',
          isArchived: true,
        },
        { new: true }
      );

      if (scholarship && typeof searchSync?.syncScholarshipSearch === 'function') {
        await searchSync.syncScholarshipSearch(scholarship);
      }
    }

    report.status = status || 'Resolved';
    report.resolution = action || report.resolution;
    report.resolvedAt = new Date();
    report.resolvedBy = req.user?._id;
    if (notes) report.adminNotes = notes;

    await report.save();

    // 📝 AUDIT LOG: Moderation Action Recorded
    try {
      const adminActor = req.user 
        ? `${req.user.firstName || req.user.name || ''} ${req.user.lastName || ''}`.trim() || req.user.email 
        : 'Admin User';

      await recordAuditLog({
        actor: adminActor,
        role: 'Admin',
        action: 'MODERATION_REPORT_RESOLVED',
        details: `Moderation report ${id} resolved with action: ${action || 'Resolved'}.`,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
        severity: 'Info'
      });
    } catch (auditErr) {
      console.warn('Audit logging skipped:', auditErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Report updated successfully.',
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