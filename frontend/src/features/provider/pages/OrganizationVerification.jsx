import { useCallback, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Globe,
  Phone,
  Mail,
  User,
  Briefcase,
  MapPin,
  FileText,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';

import PageHeader from '../../../components/common/PageHeader';
import StatusBadge from '../../../components/common/StatusBadge';
import ProtectedDocumentViewer from '../../../components/common/ProtectedDocumentViewer';
import { API_BASE_URL, API_ORIGIN } from '../../../config/api';
import {
  hasText,
  mapProviderProfile,
  organizationInitials,
  websiteHref
} from '../organizationProfile';

function getAuthToken() {
  const raw = localStorage.getItem('token');
  if (!raw) return null;
  const token = raw.replace(/^"|"$/g, '').replace(/^Bearer\s+/i, '').trim();
  return token || null;
}

function resolveDocumentUrl(raw) {
  if (!raw || raw === '#') return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return `${API_ORIGIN}${raw.startsWith('/') ? raw : `/${raw}`}`;
}

function errorMessageForStatus(status, serverMessage) {
  if (status === 401) {
    return 'You need to sign in to view your organization profile.';
  }
  if (status === 403) {
    return 'This account is not authorized to view provider organization details.';
  }
  if (status === 404) {
    return serverMessage || 'No provider record was found for this account.';
  }
  return serverMessage || 'Unable to load your organization profile. Please try again.';
}

function ProfileField({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <div className="mt-0.5 p-1.5 rounded-lg bg-slate-50 text-slate-400 shrink-0">
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
        <div className="text-xs sm:text-sm font-semibold text-slate-800 mt-0.5 break-words">
          {children}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
      <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function StatusMessage({ status, rejectionReason, isFinalRejection }) {
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
      <div className="bg-rose-50/80 border border-rose-200/80 rounded-xl p-4 flex items-start gap-3 text-xs text-rose-900 font-medium">
        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        <span>
          {isFinalRejection
            ? 'Your organization verification was declined and this decision is final.'
            : 'Your organization verification was declined. You can update your documents and resubmit for review.'}
          {rejectionReason ? ` ${rejectionReason}` : ''}
        </span>
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
  const [errorStatus, setErrorStatus] = useState(null);
  const [profile, setProfile] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setErrorStatus(null);

    try {
      const token = getAuthToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/providers/profile`, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || data?.success === false) {
        throw Object.assign(new Error(errorMessageForStatus(res.status, data?.message)), {
          status: res.status
        });
      }

      if (!data?.provider) {
        throw Object.assign(new Error('Provider record is missing from the profile response.'), {
          status: 404
        });
      }

      setProfile(mapProviderProfile(data.provider));
    } catch (err) {
      setProfile(null);
      setError(err.message || 'Unable to load your organization profile. Please try again.');
      setErrorStatus(err.status || null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const organizationFields = profile
    ? [
        hasText(profile.institutionName),
        hasText(profile.institutionType),
        hasText(profile.website),
        hasText(profile.contactNumber),
        hasText(profile.address)
      ].some(Boolean)
    : false;

  const representativeFields = profile
    ? [
        hasText(profile.representativeName),
        hasText(profile.representativeTitle),
        hasText(profile.representativeEmail)
      ].some(Boolean)
    : false;

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        <PageHeader
          title="Organization Verification"
          description="View your organization's submitted profile and current verification status."
          role="provider"
        />
        <div className="min-h-[300px] flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200/80 p-6">
          <Loader2 className="h-7 w-7 text-emerald-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading your organization profile...</p>
        </div>
      </div>
    );
  }

  const isEmptyProfile = errorStatus === 404;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <PageHeader
        title="Organization Verification"
        description="View your organization's submitted profile and current verification status."
        role="provider"
      />

      {error && !isEmptyProfile && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3 text-xs font-medium">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchProfile}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-rose-200 rounded-lg text-[11px] font-bold text-rose-800 hover:border-rose-300 cursor-pointer shrink-0 self-start sm:self-auto sm:ml-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {isEmptyProfile && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">No organization profile on file</h3>
          <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
            This account does not have a saved provider profile yet. Complete organization
            onboarding to submit your details for verification.
          </p>
          <Link
            to="/provider/onboarding"
            className="inline-flex items-center justify-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
          >
            Go to organization onboarding
          </Link>
        </div>
      )}

      {profile && (
        <>
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-emerald-700 text-white flex items-center justify-center text-lg font-black shadow-xs shrink-0">
                  {organizationInitials(profile.institutionName)}
                </div>
                <div className="min-w-0 space-y-1">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                    {hasText(profile.institutionName)
                      ? profile.institutionName
                      : 'Organization name is not on file'}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    {hasText(profile.institutionType) ? (
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200/60 text-[11px] font-bold rounded-lg">
                        {profile.institutionType}
                      </span>
                    ) : null}
                    {hasText(profile.verificationStatus) ? (
                      <StatusBadge status={profile.verificationStatus} />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <StatusMessage
              status={profile.verificationStatus}
              rejectionReason={profile.rejectionReason}
              isFinalRejection={profile.isFinalRejection}
            />
            {profile.verificationStatus === 'Rejected' && !profile.isFinalRejection ? (
              <Link
                to="/provider/onboarding"
                className="inline-flex items-center justify-center px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold"
              >
                Update documents and resubmit
              </Link>
            ) : null}
          </div>

          {organizationFields ? (
            <SectionCard title="Organization Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {hasText(profile.institutionName) ? (
                  <ProfileField icon={Building2} label="Registered name">
                    {profile.institutionName}
                  </ProfileField>
                ) : null}
                {hasText(profile.institutionType) ? (
                  <ProfileField icon={ShieldCheck} label="Organization type">
                    {profile.institutionType}
                  </ProfileField>
                ) : null}
                {hasText(profile.website) ? (
                  <ProfileField icon={Globe} label="Website">
                    <a
                      href={websiteHref(profile.website)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 hover:underline"
                    >
                      {profile.website}
                    </a>
                  </ProfileField>
                ) : null}
                {hasText(profile.contactNumber) ? (
                  <ProfileField icon={Phone} label="Contact number">
                    {profile.contactNumber}
                  </ProfileField>
                ) : null}
                {hasText(profile.address) ? (
                  <div className="sm:col-span-2">
                    <ProfileField icon={MapPin} label="Address">
                      {profile.address}
                    </ProfileField>
                  </div>
                ) : null}
              </div>
            </SectionCard>
          ) : null}

          {representativeFields ? (
            <SectionCard title="Provider Contact Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {hasText(profile.representativeName) ? (
                  <ProfileField icon={User} label="Representative name">
                    {profile.representativeName}
                  </ProfileField>
                ) : null}
                {hasText(profile.representativeTitle) ? (
                  <ProfileField icon={Briefcase} label="Role / position">
                    {profile.representativeTitle}
                  </ProfileField>
                ) : null}
                {hasText(profile.representativeEmail) ? (
                  <ProfileField icon={Mail} label="Work email">
                    <a
                      href={`mailto:${profile.representativeEmail}`}
                      className="text-emerald-700 hover:underline"
                    >
                      {profile.representativeEmail}
                    </a>
                  </ProfileField>
                ) : null}
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title="Verification Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {hasText(profile.verificationStatus) ? (
                <ProfileField icon={ShieldCheck} label="Verification status">
                  <StatusBadge status={profile.verificationStatus} />
                </ProfileField>
              ) : null}
              {hasText(profile.submittedAt) ? (
                <ProfileField icon={Clock} label="Submitted">
                  {profile.submittedAt}
                </ProfileField>
              ) : null}
              {hasText(profile.verifiedAt) ? (
                <ProfileField icon={CheckCircle2} label="Verified">
                  {profile.verifiedAt}
                </ProfileField>
              ) : null}
              {hasText(profile.rejectionReason) ? (
                <div className="sm:col-span-2">
                  <ProfileField icon={AlertCircle} label="Admin feedback">
                    {profile.rejectionReason}
                  </ProfileField>
                </div>
              ) : null}
            </div>

            <div className="space-y-2 pt-1">
              <h4 className="text-xs font-bold text-slate-700">Submitted documents</h4>
              {profile.documents.length === 0 ? (
                <p className="text-xs text-slate-500 font-medium py-2">
                  No verification documents submitted.
                </p>
              ) : (
                <div className="space-y-2">
                  {profile.documents.map((doc, idx) => {
                    const url = resolveDocumentUrl(doc.fileUrl);
                    return (
                      <div
                        key={doc.id || `${doc.label}-${idx}`}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 truncate">{doc.label}</p>
                            <p className="text-[11px] text-slate-400 font-medium">
                              {[doc.documentType, doc.uploadedAt].filter(Boolean).join(' • ')}
                            </p>
                          </div>
                        </div>
                        {url ? (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedDocument({
                                fileUrl: url,
                                originalName: doc.label,
                                name: doc.label
                              })
                            }
                            className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-emerald-800 hover:border-emerald-300 cursor-pointer shrink-0"
                          >
                            View
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </SectionCard>
        </>
      )}

      {selectedDocument && (
        <ProtectedDocumentViewer
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
        />
      )}
    </div>
  );
}
