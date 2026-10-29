const analytics = require('../services/adminAnalyticsService');
const auditController = require('./auditController');
const { withAuditWarning } = auditController;

const calculate = (builder, options = {}) => async (req, res) => {
  const parsed = analytics.resolveAnalyticsQuery(req.query, new Date(), options);
  if (!parsed.ok) {
    return res.status(400).json({ success: false, message: parsed.message });
  }

  try {
    const report = await builder(parsed);
    return res.status(200).json({ success: true, ...report });
  } catch (error) {
    console.error('Admin analytics failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to calculate analytics.' });
  }
};

exports.getOverview = calculate(analytics.buildOverview);
exports.getRegistrations = calculate(analytics.buildRegistrations);
exports.getScholarships = calculate(analytics.buildScholarships);
exports.getCategoryDemand = calculate(analytics.buildCategoryDemand);
exports.getStudentInsights = calculate(analytics.buildStudentInsights);
exports.getProviderInsights = calculate(analytics.buildProviderInsights, { paginate: true });

exports.exportReport = async (req, res) => {
  const reportName = typeof req.query.report === 'string' ? req.query.report : '';
  if (!analytics.REPORTS.includes(reportName)) {
    return res.status(400).json({
      success: false,
      message: 'report must be registrations, scholarships, category-demand, student-insights, or provider-insights.',
    });
  }

  const parsed = analytics.resolveAnalyticsQuery(req.query, new Date(), {
    paginate: reportName === 'provider-insights',
  });
  if (!parsed.ok) {
    return res.status(400).json({ success: false, message: parsed.message });
  }

  try {
    const report = await analytics.BUILDERS[reportName](parsed);
    const generatedAt = new Date();
    const csv = analytics.renderReportCsv(analytics.reportTitle[reportName], report, generatedAt);
    const actor = String((req.user && (req.user.name || req.user._id)) || 'Admin');
    const audit = await auditController.recordAuditLog({
      actor,
      actorId: req.user && (req.user._id || req.user.id),
      role: (req.user && req.user.role) || 'Admin',
      action: 'ANALYTICS_REPORT_EXPORT',
      details: `Exported ${reportName} analytics for ${report.period.from} to ${report.period.to} (${report.period.timeZone}).`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      severity: 'Info',
    });
    if (audit && audit.ok === false) {
      return res.status(500).json(withAuditWarning({
        success: false,
        message: 'The analytics report was not sent because the export could not be recorded in the audit log.',
      }, audit));
    }
    const filename = `iskolarmatch-${reportName}-${report.period.from}-to-${report.period.to}.csv`;
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (error) {
    console.error('Admin analytics export failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to export the analytics report.' });
  }
};
