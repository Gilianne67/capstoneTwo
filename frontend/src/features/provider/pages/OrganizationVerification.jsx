import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  FileText,
  Clock,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from 'lucide-react';

import PageHeader from '../../../components/common/PageHeader';
import StatusBadge from '../../../components/common/StatusBadge';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

function getAuthToken() {
  const raw = localStorage.getItem('token');
  if (!raw) return null;
  const token = raw.replace(/^"|"$/g, '').replace(/^Bearer\s+/i, '').trim();
  return token || null;
}

function readDocuments(provider) {
  if (!Array.isArray(provider?.documents)) return [];
  return provider.documents.filter((doc) => doc && (doc.name || doc.filename || doc.originalName));
}

function mapProviderVerification(provider) {
  return {
    organizationName: provider.institutionName?.trim() || '',
    organizationType: provider.institutionType?.trim() || '',
    verificationStatus: provider.verificationStatus || '',
    documents: readDocuments(provider),
  };
}

function errorMessageForStatus(status, serverMessage) {
  if (status === 401) {
    return 'You need to sign in to view organization verification.';
  }
  if (status === 403) {
    return 'This account is not authorized to view provider verification.';
  }
  if (status === 404) {
    return serverMessage || 'No provider record was found for this account.';
  }
  return serverMessage || 'Unable to load verification information. Please try again.';
}

function StatusMessage({ status }) {
  if (status === 'Verified') {
    return (
      <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-4 flex items-center gap-3 text-xs text-emerald-900 font-medium">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
        <span>Your organization is verified.</span>
      </div>
    );
  }

  if (status === 'Approved') {
    return (
      <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-4 flex items-center gap-3 text-xs text-emerald-900 font-medium">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
        <span>Your organization verification is approved.</span>
      </div>
    );
  }

  if (status === 'Pending' || status === 'Pending Review') {
    return (
      <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-4 flex items-center gap-3 text-xs text-amber-900 font-medium">
        <Clock className="w-5 h-5 text-amber-600 shrink-0" />
        <span>Your organization verification is currently under review.</span>
      </div>
    );
  }

  if (status === 'Submitted') {
    return (
      <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-4 flex items-center gap-3 text-xs text-amber-900 font-medium">
        <Clock className="w-5 h-5 text-amber-600 shrink-0" />
        <span>Your organization verification has been submitted.</span>
      </div>
    );
  }

  if (status === 'Rejected') {
    return (
      <div className="bg-rose-50/80 border border-rose-200/80 rounded-xl p-4 flex items-center gap-3 text-xs text-rose-900 font-medium">
        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
        <span>Your organization verification was rejected. Please contact support.</span>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3 text-xs text-slate-700 font-medium">
        <AlertCircle className="w-5 h-5 text-slate-500 shrink-0" />
        <span>Verification status is not available for this account.</span>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3 text-xs text-slate-700 font-medium">
      <AlertCircle className="w-5 h-5 text-slate-500 shrink-0" />
      <span>Your organization verification status is {status}.</span>
    </div>
  );
}

export default function OrganizationVerification() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [verification, setVerification] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchVerification = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const token = getAuthToken();
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(`${API_BASE_URL}/providers/profile`, {
          method: 'GET',
          headers,
          credentials: 'include',
        });

        let data = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }

        if (!res.ok || data?.success === false) {
          throw Object.assign(new Error(errorMessageForStatus(res.status, data?.message)), {
            status: res.status,
          });
        }

        if (!data?.provider) {
          throw Object.assign(new Error('Provider record is missing from the verification response.'), {
            status: 404,
          });
        }

        if (isMounted) {
          setVerification(mapProviderVerification(data.provider));
        }
      } catch (err) {
        if (isMounted) {
          setVerification(null);
          setError(err.message || 'Unable to load verification information. Please try again.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchVerification();

    return () => {
      isMounted = false;
    };
  }, []);

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

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl flex items-center gap-2 text-xs font-medium">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {verification && (
        <>
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {verification.organizationName || 'Organization name is not on file'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Organization type: {verification.organizationType || 'Not on file'}
                  </p>
                </div>
              </div>
              {verification.verificationStatus ? (
                <StatusBadge status={verification.verificationStatus} />
              ) : null}
            </div>

            <StatusMessage status={verification.verificationStatus} />
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Verification Documents on File
            </h3>
            {verification.documents.length === 0 ? (
              <p className="text-xs text-slate-500 font-medium py-2">
                No verification documents submitted.
              </p>
            ) : (
              <div className="space-y-2">
                {verification.documents.map((doc, idx) => (
                  <div key={doc._id || doc.id || `${doc.name || doc.filename}-${idx}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs">
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      <div>
                        <p className="font-bold text-slate-800">{doc.name || doc.filename || doc.originalName}</p>
                        {doc.size ? (
                          <p className="text-[11px] text-slate-400 font-medium">{doc.size}</p>
                        ) : null}
                      </div>
                    </div>
                    {doc.status ? <StatusBadge status={doc.status} /> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
