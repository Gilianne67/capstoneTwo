export const REPORT_DECISIONS = {
  remove: {
    status: 'Removed',
    action: 'REMOVE_LISTING',
    successMessage: 'The scholarship was removed and is no longer publicly available.'
  },
  retain: {
    status: 'Retained',
    action: 'RETAIN_LISTING',
    successMessage: 'The scholarship was retained and remains available.'
  }
};

export function buildModerationDecision(type, explanation) {
  const decision = REPORT_DECISIONS[type];
  if (!decision) {
    return { ok: false, error: 'Choose Remove or Retain.' };
  }

  const decisionReason = String(explanation ?? '').trim();
  if (!decisionReason) {
    return { ok: false, error: 'A decision explanation is required.' };
  }

  return {
    ok: true,
    type,
    status: decision.status,
    action: decision.action,
    decisionReason,
    successMessage: decision.successMessage,
    body: {
      status: decision.status,
      action: decision.action,
      decisionReason
    }
  };
}

export function canStartReportDecision(processingReportId) {
  return !processingReportId;
}

export function applyReportDecision(reports, reportId, savedReport) {
  const saved = savedReport || {};
  return reports.map((report) => {
    if (String(report._id) !== String(reportId)) return report;
    return {
      ...report,
      status: saved.status || report.status,
      resolution: saved.resolution || report.resolution,
      decisionReason: Object.prototype.hasOwnProperty.call(saved, 'decisionReason')
        ? saved.decisionReason
        : report.decisionReason,
      resolvedAt: saved.resolvedAt ?? report.resolvedAt,
      resolvedBy: saved.resolvedBy ?? report.resolvedBy
    };
  });
}

export function visibleReportQueue(reports, statusFilter) {
  if (!statusFilter || statusFilter === 'All') return reports;
  return reports.filter((report) => report.status === statusFilter);
}

const persistedDecision = (data) => (
  data && (data.status === 'Removed' || data.status === 'Retained')
    ? {
      status: data.status,
      resolution: data.resolution,
      decisionReason: data.decisionReason,
      resolvedAt: data.resolvedAt,
      resolvedBy: data.resolvedBy
    }
    : null
);

export function readDecisionResult(response, fallbackMessage) {
  const body = response?.body || {};
  const message = body.message || body.error || fallbackMessage || 'Failed to resolve report.';

  if (!response?.ok) {
    return {
      ok: false,
      message,
      savedReport: persistedDecision(body.data)
    };
  }

  return {
    ok: true,
    message: body.message || 'Report updated successfully.',
    savedReport: persistedDecision(body.data)
  };
}

export function commitReportDecision(reports, reportId, decision, response) {
  const result = readDecisionResult(response, 'Failed to resolve report.');
  const savedReport = result.savedReport || (result.ok
    ? {
      status: decision.status,
      resolution: decision.action,
      decisionReason: decision.decisionReason
    }
    : null);

  return {
    reports: savedReport ? applyReportDecision(reports, reportId, savedReport) : reports,
    feedback: result.ok
      ? { type: 'success', message: decision.successMessage }
      : { type: 'error', message: result.message },
    persisted: Boolean(savedReport)
  };
}
