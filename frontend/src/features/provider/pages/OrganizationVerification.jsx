import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  CheckCircle2, 
  UploadCloud, 
  FileText, 
  Clock, 
  ShieldCheck, 
  AlertCircle, 
  Loader2, 
  X 
} from 'lucide-react';

import PageHeader from '../../../components/common/PageHeader';
import StatusBadge from '../../../components/common/StatusBadge';

export default function OrganizationVerification() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Verification Data state populated from API
  const [verData, setVerData] = useState({
    status: 'Unverified',
    organizationName: '',
    taxId: '',
    submittedAt: null,
    documents: []
  });

  // Form inputs
  const [orgName, setOrgName] = useState('');
  const [taxId, setTaxId] = useState('');
  
  // Store actual File objects for binary upload
  const [selectedFiles, setSelectedFiles] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const fetchVerificationStatus = async () => {
      setIsLoading(true);
      setErrorMsg('');
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await fetch('/api/v1/provider/verification', { headers });

        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setVerData(data);
            setOrgName(data.organizationName || '');
            setTaxId(data.taxId || '');
          }
        } else {
          throw new Error('Failed to fetch verification details.');
        }
      } catch (err) {
        if (isMounted) {
          console.error('API Error:', err);
          setErrorMsg('Unable to retrieve verification status. Please refresh or try again later.');
        }
      } finally { 
        if (isMounted) setIsLoading(false);
      }
    };

    fetchVerificationStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleFileSelect = (e) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmitVerification = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    const formData = new FormData();
    formData.append('organizationName', orgName);
    formData.append('taxId', taxId);

    selectedFiles.forEach((file) => {
      formData.append('documents', file);
    });

    try {
      const token = localStorage.getItem('token');
      const headers = {
        ...(token && { Authorization: `Bearer ${token}` })
      };

      const res = await fetch('/api/v1/provider/verification', {
        method: 'POST',
        headers,
        body: formData
      });

      if (res.ok) {
        const updated = await res.json();
        setVerData(updated);
        setSelectedFiles([]);
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Verification submission failed');
      }
    } catch (err) {
      console.error('Submission Error:', err);
      setErrorMsg(err.message || 'Failed to submit verification details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-12">
        <PageHeader 
          title="Organization Verification" 
          subtitle="Submit official credentials to earn verified partner status and boost student trust."
        />
        <div className="min-h-[300px] flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200/80 p-6">
          <Loader2 className="h-7 w-7 text-emerald-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Checking verification status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <PageHeader 
        title="Organization Verification" 
        subtitle="Submit official credentials to earn verified partner status and boost student trust."
      />

      {/* Error Message */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center gap-3 text-xs font-medium">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Verification Status Overview Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{verData.organizationName || 'Unregistered Provider'}</h3>
              <p className="text-xs text-slate-500 font-medium">TIN / Reg No: {verData.taxId || 'Not specified'}</p>
            </div>
          </div>
          <StatusBadge status={verData.status || 'Unverified'} />
        </div>

        {verData.status === 'Verified' && (
          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-4 flex items-center gap-3 text-xs text-emerald-900 font-medium">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              Your organization is a <strong>Verified Scholarship Partner</strong>. Your posted offerings receive priority student algorithm matching and verified badges.
            </span>
          </div>
        )}

        {verData.status === 'Pending Review' && (
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-4 flex items-center gap-3 text-xs text-amber-900 font-medium">
            <Clock className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              Your verification documents submitted on <strong>{verData.submittedAt}</strong> are currently under manual review. This usually takes 1-2 business days.
            </span>
          </div>
        )}
      </div>

      {/* Upload & Form Section */}
      {(verData.status === 'Unverified' || verData.status === 'Rejected') && (
        <form onSubmit={handleSubmitVerification} className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">1. Organization Credentials</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 mb-1">Official Organization Name *</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Commission on Higher Education"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Tax Identification Number (TIN) / SEC Reg *</label>
                <input 
                  type="text"
                  required
                  placeholder="000-000-000-000"
                  value={taxId}
                  onChange={e => setTaxId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">2. Upload Proof of Mandate</h3>
            <p className="text-xs text-slate-500">Please upload SEC Registration, CHED/TESDA Accreditation, or Official Government Issuance (PDF/PNG).</p>

            <label className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer block text-center">
              <UploadCloud className="w-8 h-8 text-slate-400" />
              <p className="text-xs font-bold text-slate-700">Click to upload verification files</p>
              <p className="text-[11px] text-slate-400">PDF, PNG, JPG up to 10MB</p>
              <input 
                type="file" 
                multiple 
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileSelect}
                className="hidden" 
              />
            </label>

            {/* Selected File List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2 pt-2">
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      <span className="text-slate-800 font-bold">{file.name}</span>
                      <span className="text-slate-400">({(file.size / (1024 * 1024)).toFixed(1)} MB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || selectedFiles.length === 0}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Documents...</span>
                </>
              ) : (
                <span>Submit for Verification</span>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Submitted Documents History */}
      {verData.documents && verData.documents.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Verification Documents on File</h3>
          <div className="space-y-2">
            {verData.documents.map((doc, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <div>
                    <p className="font-bold text-slate-800">{doc.name || doc.filename}</p>
                    {doc.size && <p className="text-[11px] text-slate-400 font-medium">{doc.size}</p>}
                  </div>
                </div>
                <StatusBadge status={doc.status || 'Under Review'} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}