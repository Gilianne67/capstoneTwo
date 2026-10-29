import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Trash2, 
  Eye, 
  Search, 
  AlertCircle, 
  Loader2
} from 'lucide-react';

import PageHeader from '../../../components/common/PageHeader';
import StatusBadge from '../../../components/common/StatusBadge';
import {
  buildModerationDecision,
  canStartReportDecision,
  commitReportDecision,
  MODERATION_STATUS_FILTERS,
  moderationStatusFromSearch,
  reportMatchesModerationStatus,
} from '../scholarshipReportQueue';

export default function ContentModeration() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = moderationStatusFromSearch(searchParams.get('status'));
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [processingAction, setProcessingAction] = useState(null);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [explanations, setExplanations] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [cardError, setCardError] = useState(null);
  const inFlightRef = useRef(false);

  // Fetch Moderation Reports on Mount
  useEffect(() => {
    let isMounted = true;

    const fetchModerationReports = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await fetch('/api/v1/admin/moderation/reports', { headers });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || 'Failed to fetch moderation reports.');
        }

        const data = await res.json();
        const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        
        if (isMounted) {
          setReports(list);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Content moderation fetch error:', err);
          setError(err.message || 'Error loading moderation reports.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchModerationReports();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDecision = async (report, type) => {
    if (!canStartReportDecision(inFlightRef.current)) return;

    const decision = buildModerationDecision(type, explanations[report._id]);
    if (!decision.ok) {
      setFeedback({ type: 'error', message: decision.error });
      setCardError({ id: report._id, message: decision.error });
      return;
    }

    inFlightRef.current = true;
    setProcessingId(report._id);
    setProcessingAction(type);
    setFeedback(null);
    setCardError(null);

    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
      };

      const res = await fetch(`/api/v1/admin/moderation/reports/${report._id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(decision.body)
      });
      const payload = await res.json().catch(() => ({}));
      const response = { ok: res.ok, body: payload };
      const outcome = commitReportDecision(reports, report._id, decision, response);

      setReports((current) => commitReportDecision(current, report._id, decision, response).reports);
      setFeedback(outcome.feedback);
      setCardError(outcome.feedback.type === 'error'
        ? { id: report._id, message: outcome.feedback.message }
        : null);

      if (outcome.persisted) {
        setExplanations((current) => {
          if (!current[report._id]) return current;
          const next = { ...current };
          delete next[report._id];
          return next;
        });
      }
    } catch (err) {
      console.error('Moderation resolution error:', err);
      const message = err.message || 'Failed to execute action. Please try again.';
      setFeedback({ type: 'error', message });
      setCardError({ id: report._id, message });
    } finally {
      inFlightRef.current = false;
      setProcessingId(null);
      setProcessingAction(null);
    }
  };

  // Filter Reports by Status and Search Query
  const filteredReports = reports.filter((r) => {
    const title = r.listingTitle || r.postTitle || r.listingId?.title || '';
    const provider = r.providerName || r.authorName || r.postedBy?.name || '';
    const reporter = r.reporterName || r.reportedBy?.name || r.studentId?.name || '';

    const matchesSearch = 
      title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reporter.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = reportMatchesModerationStatus(r, statusFilter);
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <PageHeader 
          title="Content Moderation" 
          subtitle="Review user reports, take down flagged scam listings, and enforce platform standards."
        />
        <div className="min-h-[300px] flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200/80 p-6">
          <Loader2 className="h-7 w-7 text-emerald-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading moderation reports queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader 
        title="Content Moderation" 
        subtitle="Review user reports, take down flagged scam listings, and enforce platform standards."
      />

      <p className="text-xs text-slate-500 font-medium -mt-2">
        Student reports stay in this queue. To archive any listing, including scholarships that have not been reported, open{' '}
        <Link to="/dashboard/admin/scholarships" className="font-bold text-amber-700 hover:underline">
          All Scholarships
        </Link>
        .
      </p>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-800 p-3.5 rounded-xl flex items-center gap-2 text-xs font-medium">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {feedback && (
        <div
          role="status"
          className={`p-3.5 rounded-xl flex items-center gap-2 text-xs font-medium ${
            feedback.type === 'error'
              ? 'bg-rose-500/10 border border-rose-500/20 text-rose-800'
              : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-800'
          }`}
        >
          {feedback.type === 'error' ? (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
        {/* Controls Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {MODERATION_STATUS_FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  if (status === 'Unresolved') next.delete('status');
                  else next.set('status', status);
                  setSearchParams(next, { replace: true });
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                  statusFilter === status
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input 
              type="text"
              placeholder="Search listing, student, or author..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Flagged Queue */}
        <div className="space-y-3 pt-2">
          {filteredReports.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No content moderation flags found.</p>
          ) : (
            filteredReports.map((report) => {
              const itemTitle = report.listingTitle || report.listingId?.name || report.postTitle || 'Flagged Content';
              const authorName = report.providerName
                || report.listingId?.providerId?.institutionName
                || report.authorName
                || 'Unknown provider';
              const reporterName = report.reportedBy?.name || report.reporterName || 'Student';
              const flaggedDate = report.createdAt ? new Date(report.createdAt).toLocaleDateString() : 'N/A';
              const listingRef = report.listingId;
              const targetId = listingRef && typeof listingRef === 'object'
                ? listingRef._id
                : listingRef;
              const listingId = targetId ? String(targetId) : '';
              const reasonCategory = report.category || 'Other concern';
              const extraDetails = report.details
                || (report.reason && report.reason !== report.category ? report.reason : '');
              const canReview = report.status === 'Pending Review' || report.status === 'Under Investigation';

              return (
                <div key={report._id} className="border border-slate-200/80 rounded-xl p-4 space-y-3 bg-slate-50/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900">{itemTitle}</h4>
                        <StatusBadge status={report.status} />
                        {report.severity && (
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase ${
                            report.severity === 'High' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {report.severity} Severity
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Provider: <strong className="text-slate-700">{authorName}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {listingId && (
                        <Link
                          to={`/dashboard/admin/scholarships/${listingId}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Listing
                        </Link>
                      )}
                      <span className="text-[11px] text-slate-400 font-medium">Flagged: {flaggedDate}</span>
                    </div>
                  </div>

                  {/* Report Reason Box */}
                  <div className="bg-rose-50/60 border border-rose-200/60 rounded-xl p-3 text-xs text-rose-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Reason: {reasonCategory}</p>
                      <p className="mt-0.5 text-slate-600">Reported by {reporterName}</p>
                      {extraDetails ? (
                        <p className="mt-1 text-slate-700">{extraDetails}</p>
                      ) : (
                        <p className="mt-1 text-slate-500">No additional details.</p>
                      )}
                      {report.decisionReason ? (
                        <p className="mt-2 text-slate-700">
                          <span className="font-bold">Decision explanation: </span>
                          {report.decisionReason}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {canReview && (
                    <div className="space-y-3 pt-2 border-t border-slate-200/40">
                      <label className="block text-xs font-bold text-slate-700">
                        Decision explanation
                        <textarea
                          required
                          rows={3}
                          value={explanations[report._id] || ''}
                          disabled={Boolean(processingId)}
                          onChange={(event) => {
                            const value = event.target.value;
                            setExplanations((current) => ({ ...current, [report._id]: value }));
                            if (cardError?.id === report._id) setCardError(null);
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 disabled:opacity-60"
                        />
                      </label>
                      {cardError?.id === report._id ? (
                        <p className="text-xs font-medium text-rose-700">{cardError.message}</p>
                      ) : null}
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleDecision(report, 'retain')}
                          disabled={!canStartReportDecision(processingId)}
                          className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                          {processingId === report._id && processingAction === 'retain' ? 'Saving...' : 'Retain'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDecision(report, 'remove')}
                          disabled={!canStartReportDecision(processingId)}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {processingId === report._id && processingAction === 'remove' ? 'Saving...' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}