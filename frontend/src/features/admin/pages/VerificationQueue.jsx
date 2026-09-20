import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  FileText, 
  Check, 
  X, 
  ExternalLink, 
  AlertCircle, 
  Loader2,
  Search
} from 'lucide-react';

import PageHeader from '../../../components/common/PageHeader';
import StatusBadge from '../../../components/common/StatusBadge';
import ConfirmModal from '../../../components/common/ConfirmModal';
import ProtectedDocumentViewer from '../../../components/common/ProtectedDocumentViewer';

export default function VerificationQueue() {
  const [verifications, setVerifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusFilter, setStatusFilter] = useState('Pending Review');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState(null); // { id, type: 'approve'|'reject' }
  const [actionError, setActionError] = useState(null);
  const [selectedDocViewer, setSelectedDocViewer] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchVerifications = async () => {
      setIsLoading(true);
      setErrorMsg('');
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await fetch('/api/v1/admin/verifications', { headers });

        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setVerifications(Array.isArray(data) ? data : []);
          }
        } else {
          throw new Error('Failed to load verification queue from server.');
        }
      } catch (err) {
        if (isMounted) {
          console.error('API Fetch Error:', err);
          setErrorMsg('Unable to fetch verification requests. Please check your network or try again.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchVerifications();

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle Verification Decision
  const handleConfirmAction = async () => {
    if (!selectedAction) return;

    setIsProcessing(true);
    setActionError(null);
    const { id, type } = selectedAction;
    const newStatus = type === 'approve' ? 'Verified' : 'Rejected';

    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
      };

      const res = await fetch(`/api/v1/admin/verifications/${id}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Verification update failed on server');
      }

      setVerifications(prev => prev.map(v => v._id === id ? { ...v, status: newStatus } : v));
      setSelectedAction(null);
    } catch (err) {
      console.error('API Error:', err);
      setActionError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredVerifications = verifications.filter((v) => {
    const org = v.organizationName ? v.organizationName.toLowerCase() : '';
    const tax = v.taxId ? v.taxId.toLowerCase() : '';
    const query = searchQuery.toLowerCase();

    const matchesSearch = org.includes(query) || tax.includes(query);
    const matchesStatus = statusFilter === 'All' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <PageHeader 
          title="Organization Verification Queue" 
          subtitle="Review official documentation, SEC certificates, and approve provider partner statuses."
        />
        <div className="min-h-[300px] flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200/80 p-6">
          <Loader2 className="h-7 w-7 text-emerald-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Fetching provider verification requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader 
        title="Organization Verification Queue" 
        subtitle="Review official documentation, SEC certificates, and approve provider partner statuses."
      />

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center gap-3 text-xs font-medium">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
        {/* Controls Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {['Pending Review', 'Verified', 'Rejected', 'All'].map((status) => (
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
              placeholder="Search provider or TIN..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Verification Items List */}
        <div className="space-y-3 pt-2">
          {filteredVerifications.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No verification requests found.</p>
          ) : (
            filteredVerifications.map((item) => (
              <div key={item._id} className="border border-slate-200/80 rounded-xl p-4 space-y-3 bg-slate-50/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{item.organizationName || 'Unnamed Provider'}</h4>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      TIN / Reg No: <strong className="text-slate-700">{item.taxId || 'N/A'}</strong> • Email: <strong className="text-slate-700">{item.contactEmail || 'N/A'}</strong>
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {item.submittedAt ? `Submitted: ${item.submittedAt}` : ''}
                  </span>
                </div>

                {/* Submitted Files */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Proof Documents:</span>
                  {item.documents && item.documents.length > 0 ? (
                    item.documents.map((doc, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedDocViewer(doc)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:text-emerald-600 hover:border-emerald-300 transition-colors cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{doc.name || doc.filename || `Document ${idx + 1}`}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </button>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 font-normal">No files uploaded</span>
                  )}
                </div>

                {/* Action Buttons for Pending Requests */}
                {item.status === 'Pending Review' && (
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/40">
                    <button
                      type="button"
                      onClick={() => {
                        setActionError(null);
                        setSelectedAction({ id: item._id, type: 'reject' });
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" /> Reject Application
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActionError(null);
                        setSelectedAction({ id: item._id, type: 'approve' });
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" /> Grant Verification
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
        title={selectedAction?.type === 'approve' ? 'Grant Verification Status' : 'Reject Verification Request'}
        message={
          actionError 
            ? `Server Error: ${actionError}` 
            : `Are you sure you want to ${selectedAction?.type} this organization's verification submission?`
        }
      />

      {/* Protected Document Viewer Modal */}
      {selectedDocViewer && (
        <ProtectedDocumentViewer
          document={selectedDocViewer}
          onClose={() => setSelectedDocViewer(null)}
        />
      )}
    </div>
  );
}