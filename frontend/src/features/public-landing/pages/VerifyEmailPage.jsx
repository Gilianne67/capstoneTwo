import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, ArrowRight, GraduationCap, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';

export default function VerifyEmailPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { fetchCurrentUser } = useAuth();

  // Verification States: 'verifying' | 'success' | 'error'
  const [status, setStatus] = useState('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Use a ref to prevent duplicate requests in React Strict Mode (Development)
  const isVerifyingRef = useRef(false);

  useEffect(() => {
    if (!token || isVerifyingRef.current) return;
    isVerifyingRef.current = true;

    const verifyToken = async () => {
      try {
        const response = await axios.get(`/api/v1/auth/verify-email/${token}`);

        if (response.data.success) {
          setStatus('success');
          
          // Refresh user session in AuthContext if a session cookie exists
          if (typeof fetchCurrentUser === 'function') {
            try {
              await fetchCurrentUser();
            } catch (err) {
              // Ignore unauthenticated session errors
            }
          }
        } else {
          setStatus('error');
          setErrorMessage(response.data.message || 'Email verification failed.');
        }
      } catch (err) {
        setStatus('error');
        setErrorMessage(
          err?.response?.data?.message || 
          'Verification link is invalid or has expired. Please request a new link.'
        );
      }
    };

    verifyToken();
  }, [token, fetchCurrentUser]);

  return (
    <div className="min-h-screen bg-app-bg text-app-text flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Accent Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-card-bg border border-app-text/10 rounded-3xl p-8 shadow-2xl space-y-6 text-center relative z-10">
        
        {/* Brand Logo Header */}
        <Link to="/" className="inline-flex items-center gap-2 group mb-2">
          <GraduationCap className="h-7 w-7 text-primary transition-transform duration-300 group-hover:scale-110" />
          <span className="font-extrabold text-xl tracking-tight text-app-text">
            ISKOLAR<span className="text-primary">MATCH</span>
          </span>
        </Link>

        {/* STATE 1: VERIFYING (LOADING) */}
        {status === 'verifying' && (
          <div className="space-y-4 py-4">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto shadow-inner">
              <RefreshCw className="h-8 w-8 animate-spin" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-app-text">Verifying Your Email</h2>
              <p className="text-xs text-text-muted leading-relaxed">
                Please wait while we validate your email verification token...
              </p>
            </div>
          </div>
        )}

        {/* STATE 2: SUCCESS */}
        {status === 'success' && (
          <div className="space-y-6 py-2">
            <div className="w-16 h-16 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-app-text tracking-tight">Email Verified!</h2>
              <p className="text-xs text-text-muted leading-relaxed">
                Your account is now fully active. You can sign in and begin exploring verified scholarship opportunities.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/auth?mode=signin', { replace: true })}
              className="w-full py-3.5 px-6 bg-primary text-white font-bold text-xs rounded-xl shadow-lg hover:opacity-90 transition-all flex items-center justify-center gap-2"
            >
              <span>Proceed to Sign In</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* STATE 3: ERROR / EXPIRED TOKEN */}
        {status === 'error' && (
          <div className="space-y-6 py-2">
            <div className="w-16 h-16 bg-rose-500/15 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <XCircle className="h-10 w-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-app-text tracking-tight">Verification Failed</h2>
              <p className="text-xs text-rose-600 font-medium bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl leading-relaxed">
                {errorMessage}
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <Link
                to="/verify-holding"
                className="w-full py-3.5 px-6 bg-primary text-white font-bold text-xs rounded-xl shadow-lg hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                <span>Request a New Link</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              <div>
                <Link
                  to="/auth?mode=signin"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-app-text transition-colors"
                >
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </div>
          </div>
        )}

      </div>

      <div className="text-center py-4 text-xs text-text-muted relative z-10">
        © {new Date().getFullYear()} IskolarMatch. All rights reserved.
      </div>
    </div>
  );
}