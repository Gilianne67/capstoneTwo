import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, AlertCircle, CheckCircle2, Loader2, MailCheck, Clock } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { API_BASE_URL } from '../../../config/api';

export default function ParentConsentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const token = searchParams.get('token');

  const queryEmail = searchParams.get('email');
  const guardianEmailParam = queryEmail || location.state?.guardianEmail || user?.guardianEmail || 'your guardian email address';

  const [loading, setLoading] = useState(!token);
  const [studentInfo, setStudentInfo] = useState(null);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState(null);
  
  // Real-time tracking state for View 1 when waiting on status change
  const [isConsentApprovedRealtime, setIsConsentApprovedRealtime] = useState(false);
  const [pollNotice, setPollNotice] = useState('');

  // 1. If token is present, verify it for the Parent Approval Form (View 2)
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    fetch(`${API_BASE_URL}/consent/verify?token=${token}`)
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

  // 2. Poll the student waiting screen until consent is approved.
  // A 4-second interval burned the shared API limit by itself (about 150 calls in 10 minutes).
  useEffect(() => {
    if (token) return undefined;

    const FIRST_POLL_MS = 3000;
    const CONSENT_POLL_MS = 15000;
    let cancelled = false;
    let timerId;

    const schedule = (delay) => {
      timerId = window.setTimeout(run, delay);
    };

    const run = async () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.hidden) {
        schedule(CONSENT_POLL_MS);
        return;
      }

      const activeToken = localStorage.getItem('token')?.replace(/^"|"$/g, '').trim();
      if (!activeToken) {
        schedule(CONSENT_POLL_MS);
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${activeToken}` }
        });

        if (cancelled) return;

        if (res.status === 429) {
          const retryAfter = Number(res.headers.get('Retry-After'));
          const pauseMs = Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 15 * 60 * 1000)
            : 60 * 1000;
          setPollNotice('Consent status checks are paused because the server asked us to slow down. This page will try again automatically.');
          schedule(pauseMs);
          return;
        }

        const data = await res.json();
        if (res.ok && (data.data?.status === 'active' || data.user?.status === 'active')) {
          setPollNotice('');
          setIsConsentApprovedRealtime(true);
          return;
        }
      } catch {
        // A brief network flicker should not look like a failed approval.
      }

      if (!cancelled) schedule(CONSENT_POLL_MS);
    };

    schedule(FIRST_POLL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [token]);

  const handleApprove = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/consent/approve`, {
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

  // ==========================================
  // VIEW 1: STUDENT WAITING SCREEN (No token)
  // ==========================================
  if (!token) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card-bg border border-app-text/10 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6 text-center">
          
          {isConsentApprovedRealtime ? (
            /* Real-time Success State */
            <>
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-lg font-black text-app-text">Parental Consent Approved!</h1>
              <p className="text-xs text-text-muted leading-relaxed">
                Your parent or guardian has authorized your account. Please sign in now to request and receive your email verification link to activate your account.              </p>
            </div>

            

            <button
              onClick={() => navigate('/auth?mode=signin')}
              className="w-full py-3 bg-primary text-white text-xs font-bold rounded-xl cursor-pointer hover:opacity-90 transition-opacity shadow-md"
            >
              Return to Sign In
            </button>
          </>
          ) : (
            /* Standard Pending Waiting State */
            <>
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto text-primary">
                <MailCheck className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h1 className="text-lg font-black text-app-text">Parental Consent Email Sent</h1>
                <p className="text-xs text-text-muted leading-relaxed">
                  In compliance with <strong>RA 10173 (Data Privacy Act of 2012)</strong>, we sent an authorization link to <span className="font-semibold text-app-text">{guardianEmailParam}</span>.
                </p>
              </div>

              <div className="p-4 bg-app-bg border border-app-text/10 rounded-xl space-y-2 text-left">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-600">
                  <Clock className="w-4 h-4 shrink-0 animate-pulse" />
                  <span>Status: Pending Parental Consent</span>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Once your parent/guardian clicks &quot;Approve Consent&quot; in the email, this screen will update automatically.
                </p>
                {pollNotice && (
                  <p className="text-[11px] text-amber-800 leading-relaxed">{pollNotice}</p>
                )}
              </div>

              <button
                onClick={() => navigate('/auth?mode=signin')}
                className="w-full py-3 bg-primary text-white text-xs font-bold rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
              >
                Return to Sign In
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: PARENT APPROVAL SCREEN (With token)
  // ==========================================
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
              Thank you for approving <strong>{studentInfo?.name}</strong>&apos;s IskolarMatch profile. Their account is now active and ready for scholarship applications.
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