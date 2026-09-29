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
  Search,
  Eye,
  Globe,
  Phone,
  User,
  Briefcase,
  Mail,
  FileType,
  AlertTriangle
} from 'lucide-react';

import PageHeader from '../../../components/common/PageHeader';
import StatusBadge from '../../../components/common/StatusBadge';
import ProtectedDocumentViewer from '../../../components/common/ProtectedDocumentViewer';

const COMMON_REJECTION_REASONS = [
  'Incomplete or unclear documentation submitted.',
  'Tax ID / SEC registration number could not be verified.',
  'Representative is not authorized by the institution.',
  'Official website or organizational contact details invalid.',
  'Documents submitted are expired or illegible.'
];

const getFullDocumentUrl = (rawPath) => {
  if (!rawPath || rawPath === '#') return '#';
  if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) {
    return rawPath;
  }
  
  const backendBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const cleanPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  
  return `${backendBase}${cleanPath}`;
};

export default function VerificationQueue() {
  const [verifications, setVerifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusFilter, setStatusFilter] = useState('Pending Review');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionError, setActionError] = useState(null);
  const [selectedDocViewer, setSelectedDocViewer] = useState(null);

  const fetchVerifications = async (isMounted = true) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch('/api/v1/admin/verifications', { headers });

      if (res.ok) {
        const data = await res.json();
        if (isMounted) {
          const list = Array.isArray(data) ? data : (data.data || data.verifications || []);
          setVerifications(list);
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

  useEffect(() => {
    let isMounted = true;
    fetchVerifications(isMounted);
    return () => {
      isMounted = false;
    };
  }, []);

  const handleConfirmAction = async () => {
    if (!selectedAction) return;

    const { id, type } = selectedAction;
    const isReject = type === 'reject';

    if (isReject && !rejectionReason.trim()) {
      setActionError('Please select or write a reason for rejecting this verification request.');
      return;
    }

    setIsProcessing(true);
    setActionError(null);

    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
      };

      const res = await fetch(`/api/v1/admin/providers/${id}/verification`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: isReject ? 'REJECTED' : 'APPROVED',
          rejectionReason: isReject ? rejectionReason.trim() : undefined,
          reason: isReject ? rejectionReason.trim() : undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Verification update failed on server');
      }

      const updatedStatusLabel = isReject ? 'Rejected' : 'Verified';

      setVerifications((prev) =>
        prev.map((v) =>
          String(v._id || v.id) === String(id)
            ? {
                ...v,
                status: updatedStatusLabel,
                verificationStatus: updatedStatusLabel,
                rejectionReason: isReject ? rejectionReason.trim() : undefined
              }
            : v
        )
      );

      setStatusFilter(updatedStatusLabel);
      setSelectedAction(null);
      setRejectionReason('');
    } catch (err) {
      console.error('API Error:', err);
      setActionError(err.message || 'Failed to complete action');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenDocument = (doc) => {
    const rawUrl = typeof doc === 'string' ? doc : (doc.fileUrl || doc.url || doc.path || '#');
    const fullUrl = getFullDocumentUrl(rawUrl);
    
    if (fullUrl !== '#') {
      window.open(fullUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const filteredVerifications = verifications.filter((v) => {
    const rep = v.representative || v.user || v.provider || {};
    const orgName = (v.organizationName || v.institutionName || '').toLowerCase();
    const type = (v.institutionType || '').toLowerCase();
    
    const repName = (
      rep.name || rep.fullName || (rep.firstName ? `${rep.firstName} ${rep.lastName || ''}` : '') ||
      v.repName || v.contactPerson || ''
    ).toLowerCase();
    
    const repEmail = (
      v.contactEmail || rep.workEmail || rep.email || ''
    ).toLowerCase();

    const rawStatus = String(v.verificationStatus || v.status || 'Pending Review').toUpperCase();
    const query = searchQuery.toLowerCase();

    const matchesSearch = 
      orgName.includes(query) || 
      type.includes(query) || 
      repName.includes(query) || 
      repEmail.includes(query);

    let matchesStatus = false;
    if (statusFilter === 'All') {
      matchesStatus = true;
    } else if (statusFilter === 'Pending Review') {
      matchesStatus = ['PENDING REVIEW', 'PENDING', 'SUBMITTED'].includes(rawStatus);
    } else if (statusFilter === 'Verified') {
      matchesStatus = ['VERIFIED', 'APPROVED'].includes(rawStatus);
    } else if (statusFilter === 'Rejected') {
      matchesStatus = ['REJECTED', 'DECLINED'].includes(rawStatus);
    }

    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <PageHeader 
          title="Organization Verification Queue" 
          subtitle="Review official documentation and approve provider partner onboarding submissions."
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
        subtitle="Review official documentation and approve provider partner onboarding submissions."
      />

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center gap-3 text-xs font-medium">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
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

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input 
              type="text"
              placeholder="Search institution, rep, or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="space-y-4 pt-2">
          {filteredVerifications.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No verification requests found for "{statusFilter}".</p>
          ) : (
            filteredVerifications.map((item) => {
              const status = item.verificationStatus || item.status || 'Pending Review';
              const institutionName = item.organizationName || item.institutionName || 'Unnamed Institution';

              const rep = (typeof item.representative === 'object' ? item.representative : null) || 
                          (typeof item.user === 'object' ? item.user : null) || {};

              const repName = rep.name || rep.fullName || item.repName || item.contactPerson || 'Not Provided';
              const repTitle = rep.title || rep.jobTitle || item.repTitle || 'Not Provided';
              const repEmail = item.contactEmail || rep.workEmail || rep.email || 'Not Provided';
              const docs = item.documents || item.verificationDocuments || [];

              return (
                <div key={item._id || item.id} className="border border-slate-200/80 rounded-2xl p-5 space-y-4 bg-white shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Building2 className="w-4.5 h-4.5 text-emerald-800 shrink-0" />
                        <h4 className="text-base font-bold text-slate-900">{institutionName}</h4>
                        
                        {item.institutionType && (
                          <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200/60 text-[11px] font-bold rounded-lg">
                            {item.institutionType}
                          </span>
                        )}

                        <StatusBadge status={status} />
                      </div>

                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500 pt-0.5">
                        {item.website ? (
                          <a 
                            href={item.website.startsWith('http') ? item.website : `https://${item.website}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-emerald-800 hover:underline font-medium"
                          >
                            <Globe className="w-3.5 h-3.5" />
                            <span>{item.website}</span>
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-slate-400">
                            <Globe className="w-3.5 h-3.5" /> Website: N/A
                          </span>
                        )}

                        {item.contactNumber ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{item.contactNumber}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-slate-400">
                            <Phone className="w-3.5 h-3.5" /> Phone: N/A
                          </span>
                        )}
                      </div>
                    </div>

                    {(item.submittedAt || item.createdAt) && (
                      <span className="text-[11px] text-slate-400 font-medium self-start sm:self-center">
                        Submitted: {item.submittedAt || new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                      Authorized Representative
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/60 text-xs">
                      <div className="flex items-center gap-2.5">
                        <User className="w-4 h-4 text-slate-400 shrink-0" />
                        <div>
                          <span className="text-[11px] text-slate-400 block font-medium">Full Name</span>
                          <strong className="text-slate-800 font-semibold">{repName}</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
                        <div>
                          <span className="text-[11px] text-slate-400 block font-medium">Job Title</span>
                          <strong className="text-slate-800 font-semibold">{repTitle}</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                        <div>
                          <span className="text-[11px] text-slate-400 block font-medium">Work Email</span>
                          <strong className="text-slate-800 font-semibold">{repEmail}</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {item.rejectionReason && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs space-y-1">
                      <span className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Rejection Reason:
                      </span>
                      <p className="text-rose-700">{item.rejectionReason}</p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5 mr-1">
                        <ShieldCheck className="w-4 h-4 text-emerald-800" />
                        Verification Documents:
                      </span>

                      {docs.length > 0 ? (
                        docs.map((doc, idx) => {
                          const docName = doc.name || doc.filename || doc.originalName || doc.documentType || `Document ${idx + 1}`;
                          const rawPath = typeof doc === 'string' ? doc : (doc.fileUrl || doc.url || doc.path);
                          const sanitizedDoc = {
                            ...doc,
                            fileUrl: getFullDocumentUrl(rawPath),
                            name: docName
                          };

                          return (
                            <div key={idx} className="inline-flex items-center gap-1.5">
                              {(doc.name || doc.documentType) && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 text-[11px] font-semibold rounded-lg border border-slate-200">
                                  <FileType className="w-3 h-3 text-slate-500" />
                                  {doc.name || doc.documentType}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedDocViewer(sanitizedDoc)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:text-emerald-800 hover:border-emerald-300 transition-colors cursor-pointer shadow-2xs"
                              >
                                <FileText className="w-3.5 h-3.5 text-emerald-800" />
                                <span>{docName}</span>
                                <Eye className="w-3 h-3 text-slate-400 ml-0.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenDocument(doc)}
                                className="p-1 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-emerald-800 hover:border-emerald-300 transition-colors cursor-pointer"
                                title="Open in new tab"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })
                      ) : (
                        <span className="text-xs text-slate-400 italic">No document file uploaded</span>
                      )}
                    </div>

                    {['PENDING REVIEW', 'PENDING', 'SUBMITTED'].includes(String(status).toUpperCase()) && (
                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setActionError(null);
                            setRejectionReason('');
                            setSelectedAction({ id: item._id || item.id, type: 'reject' });
                          }}
                          className="px-3.5 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActionError(null);
                            setRejectionReason('');
                            setSelectedAction({ id: item._id || item.id, type: 'approve' });
                          }}
                          className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve & Verify
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Embedded Action Dialog Modal */}
      {selectedAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900">
              {selectedAction.type === 'approve' ? 'Grant Verification Status' : 'Reject Verification Request'}
            </h3>

            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              {selectedAction.type === 'approve' 
                ? 'Are you sure you want to approve and verify this provider organization? An email notification with portal login details will be dispatched automatically.' 
                : 'Are you sure you want to reject this verification request? An email containing your feedback will be sent to the contact person.'}
            </p>

            {selectedAction.type === 'reject' && (
              <div className="space-y-3 pt-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Select Quick Reason or Write Feedback:
                </span>
                
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_REJECTION_REASONS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRejectionReason(preset)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors text-left font-medium cursor-pointer ${
                        rejectionReason === preset
                          ? 'bg-rose-100 border-rose-300 text-rose-800 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter custom rejection reason to send via email..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-rose-500"
                />
              </div>
            )}

            {actionError && (
              <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                {actionError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setSelectedAction(null);
                  setActionError(null);
                  setRejectionReason('');
                }}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={isProcessing}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition-colors cursor-pointer flex items-center gap-2 ${
                  selectedAction.type === 'approve'
                    ? 'bg-emerald-800 hover:bg-emerald-900'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{selectedAction.type === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedDocViewer && (
        <ProtectedDocumentViewer
          document={selectedDocViewer}
          onClose={() => setSelectedDocViewer(null)}
        />
      )}
    </div>
  );
}