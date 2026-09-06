import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  Trash2, 
  Eye, 
  Search, 
  AlertCircle, 
  Loader2,
  X,
  ExternalLink
} from 'lucide-react';

import PageHeader from '../../../components/common/PageHeader';
import StatusBadge from '../../../components/common/StatusBadge';
import ConfirmModal from '../../../components/common/ConfirmModal';

// Fallback Mock Flagged Data
const MOCK_FLAGGED_CONTENT = [
  {
    _id: 'flag-01',
    listingId: 'sch-101',
    listingTitle: 'Guaranteed Overseas Student Grant 2026',
    providerName: 'Unverified Global Study Corp',
    reason: 'Suspicious processing fee requested prior to application.',
    reporterRole: 'Student',
    status: 'Pending Review',
    flaggedAt: '2026-07-28',
    severity: 'High'
  },
  {
    _id: 'flag-02',
    listingId: 'sch-102',
    listingTitle: 'National Tech Scholars Allowance',
    providerName: 'Apex Student Educational Trust',
    reason: 'Expired application link and inaccurate grant value listed.',
    reporterRole: 'Student',
    status: 'Pending Review',
    flaggedAt: '2026-07-26',
    severity: 'Medium'
  },
  {
    _id: 'flag-03',
    listingId: 'sch-103',
    listingTitle: 'LGU Provincial Excellence Assistance',
    providerName: 'Provincial LGU Board',
    reason: 'Duplicate listing entry in catalog.',
    reporterRole: 'Provider',
    status: 'Resolved',
    flaggedAt: '2026-07-21',
    severity: 'Low'
  }
];

export default function ContentModeration() {
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [statusFilter, setStatusFilter] = useState('Pending Review');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState(null); // { id, type: 'dismiss' | 'remove' }
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchModerationReports = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await fetch('/api/v1/admin/moderation/reports', { headers });

        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setReports(Array.isArray(data) ? data : MOCK_FLAGGED_CONTENT);
            setIsUsingFallback(false);
          }
        } else {
          throw new Error('Content Moderation API error');
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Backend server offline. Displaying fallback flagged reports:', err);
          setReports(MOCK_FLAGGED_CONTENT);
          setIsUsingFallback(true);
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

  // Handle Moderation Resolution safely
  const handleConfirmAction = async () => {
    if (!selectedAction) return;

    setIsProcessing(true);
    setActionError(null);
    const { id, type } = selectedAction;
    const newStatus = 'Resolved';
    const resolutionAction = type === 'remove' ? 'REMOVE_LISTING' : 'DISMISS_REPORT';

    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
      };

      const res = await fetch(`/api/v1/admin/moderation/reports/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ 
          status: newStatus, 
          action: resolutionAction,
          resolvedAt: new Date().toISOString()
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Moderation action failed on server');
      }

      // Safe State Update only after 2xx HTTP response
      setReports(prev => prev.map(r => r._id === id ? { ...r, status: newStatus, resolution: resolutionAction } : r));
      setSelectedAction(null);
    } catch (err) {
      console.error('Moderation API Error:', err);
      setActionError(err.message);

      // Fallback update path for offline demonstration mode
      if (isUsingFallback) {
        setReports(prev => prev.map(r => r._id === id ? { ...r, status: newStatus } : r));
        setSelectedAction(null);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredReports = reports.filter((r) => {
    const matchesSearch = r.listingTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.providerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
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

      {isUsingFallback && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 p-3.5 rounded-xl flex items-center justify-between text-xs font-medium">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            Backend API unreachable. Displaying local fallback moderation queue.
          </span>
        </div>
      )}

      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
        {/* Controls Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-2">
            {['Pending Review', 'Resolved', 'All'].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
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
              placeholder="Search listing or provider..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Flagged Listings Queue */}
        <div className="space-y-3 pt-2">
          {filteredReports.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No content moderation flags found.</p>
          ) : (
            filteredReports.map((report) => (
              <div key={report._id} className="border border-slate-200/80 rounded-xl p-4 space-y-3 bg-slate-50/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{report.listingTitle}</h4>
                      <StatusBadge status={report.status} />
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase ${
                        report.severity === 'High' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {report.severity} Severity
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Posted by: <strong className="text-slate-700">{report.providerName}</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <a 
                      href={`/scholarships/${report.listingId}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700"
                    >
                      <Eye className="w-3.5 h-3.5" /> View Listing
                    </a>
                    <span className="text-[11px] text-slate-400 font-medium">Flagged: {report.flaggedAt}</span>
                  </div>
                </div>

                {/* Report Reason Box */}
                <div className="bg-rose-50/60 border border-rose-200/60 rounded-xl p-3 text-xs text-rose-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Reported Reason ({report.reporterRole}):</p>
                    <p className="mt-0.5 text-slate-700">{report.reason}</p>
                  </div>
                </div>

                {/* Action Buttons */}
                {report.status === 'Pending Review' && (
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/40">
                    <button
                      type="button"
                      onClick={() => {
                        setActionError(null);
                        setSelectedAction({ id: report._id, type: 'dismiss' });
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" /> Dismiss Report
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActionError(null);
                        setSelectedAction({ id: report._id, type: 'remove' });
                      }}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove Listing
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(selectedAction)}
        onClose={() => {
          setSelectedAction(null);
          setActionError(null);
        }}
        onConfirm={handleConfirmAction}
        isLoading={isProcessing}
        title={selectedAction?.type === 'remove' ? 'Remove Flagged Listing' : 'Dismiss Flag Report'}
        message={
          actionError 
            ? `Server Error: ${actionError}`
            : `Are you sure you want to ${selectedAction?.type === 'remove' ? 'take down this scholarship listing from the public feed' : 'dismiss this report'}?`
        }
      />
    </div>
  );
}