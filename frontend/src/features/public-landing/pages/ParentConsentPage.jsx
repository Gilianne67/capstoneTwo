// src/features/public-landing/pages/ParentConsentPage.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ShieldCheck, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export default function ParentConsentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [studentInfo, setStudentInfo] = useState(null);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid approval link. Consent token is missing.');
      setLoading(false);
      return;
    }

    // Verify token validity and retrieve student profile preview
    fetch(`/api/v1/consent/verify?token=${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.success) {
          setStudentInfo(data.student);
        } else {
          setError(data.message || 'Invalid or expired consent link.');
        }
      })
      .catch(() => setError('Failed to communicate with server.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleApprove = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/consent/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setApproved(true);
      } else {
        setError(data.message || 'Approval failed. Please try again.');
      }
    } catch {
      setError('Network error processing authorization.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-card-bg border border-app-text/10 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-app-text/10 pb-4">
          <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0" />
          <div>
            <h1 className="text-lg font-black text-app-text">Parental Consent Authorization</h1>
            <p className="text-xs text-text-muted">RA 10173 Data Privacy Act Compliance</p>
          </div>
        </div>

        {/* Error View */}
        {error ? (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : approved ? (
          /* Success View */
          <div className="text-center space-y-3 py-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h2 className="text-base font-bold text-app-text">Account Authorized!</h2>
            <p className="text-xs text-text-muted">
              Thank you for approving <strong>{studentInfo?.name}</strong>'s IskolarMatch profile. Their account is now active and ready for scholarship applications.
            </p>
            <button
              onClick={() => navigate('/auth?mode=signin')}
              className="mt-2 py-2.5 px-5 bg-primary text-white text-xs font-bold rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
            >
              Go to Portal Login
            </button>
          </div>
        ) : (
          /* Confirmation Form View */
          <div className="space-y-4">
            <p className="text-xs text-app-text leading-relaxed">
              Your dependent, <strong className="text-primary">{studentInfo?.name}</strong> ({studentInfo?.email}), is requesting permission to activate their student account on IskolarMatch.
            </p>

            <div className="p-3 bg-app-bg border border-app-text/10 rounded-xl space-y-1 text-xs">
              <div className="text-text-muted">Academic Summary:</div>
              <div className="font-semibold text-app-text">
                {studentInfo?.course || 'N/A'} — {studentInfo?.yearLevel || 'N/A'}
              </div>
              <div className="text-text-muted">Region: {studentInfo?.region || 'N/A'}</div>
            </div>

            <div className="p-3 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-[11px] leading-normal">
              By authorizing, you confirm consent for IskolarMatch to process academic and demographic profile data strictly for scholarship matching purposes.
            </div>

            <button
              onClick={handleApprove}
              className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
            >
              I Authorize & Approve Account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}