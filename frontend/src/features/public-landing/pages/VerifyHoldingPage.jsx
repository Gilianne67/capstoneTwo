import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Mail, RefreshCw, Edit3, ArrowLeft, CheckCircle, AlertCircle, Loader2, Lock, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';

export default function VerifyHoldingPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [email, setEmail] = useState(searchParams.get('email') || user?.email || '');
  const [isEditing, setIsEditing] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // 👁️ Password visibility toggle state
  
  const [resendCooldown, setResendCooldown] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Ref to prevent duplicate automatic dispatches on fast re-renders
  const hasTriggeredInitialSend = useRef(false);

  // 60-second rate-limiter timer effect
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handle Resend Verification Request (Dispatched via Nodemailer/Resend on backend)
  const handleResend = async () => {
    if (resendCooldown > 0 || isLoading || !email) return;
    setIsLoading(true);
    setMessage('');
    setError('');

    try {
      await axios.post('/api/v1/auth/resend-verification', { email }, { withCredentials: true });
      setMessage('A verification link has been dispatched to your email.');
      setResendCooldown(60); // 60s cooldown
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to dispatch verification link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Automatically trigger dispatch once when arriving on the holding page
  useEffect(() => {
    if (email && !hasTriggeredInitialSend.current) {
      hasTriggeredInitialSend.current = true;
      handleResend();
    }
  }, [email]);

  // Handle Email Typo Correction with Password Re-Verification (Fix 1.4)
  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    const emailTrimmed = newEmail.trim().toLowerCase();
    
    if (!emailTrimmed || emailTrimmed === email.toLowerCase()) {
      setIsEditing(false);
      setPassword('');
      setShowPassword(false);
      return;
    }

    if (!password) {
      setError('Please enter your password to confirm email change.');
      return;
    }

    setIsLoading(true);
    setMessage('');
    setError('');

    try {
      const res = await axios.put(
        '/api/v1/auth/update-unverified-email', 
        { oldEmail: email, newEmail: emailTrimmed, password },
        { withCredentials: true }
      );
      
      setEmail(res.data.email);
      setIsEditing(false);
      setPassword('');
      setShowPassword(false);
      setMessage('Email address updated! A new verification link has been sent.');
      setResendCooldown(60);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update email address.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-bg text-app-text flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow Effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-card-bg border border-app-text/10 rounded-3xl p-8 shadow-2xl space-y-6 text-center relative z-10">
        
        {/* Header Icon */}
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto shadow-inner">
          <Mail className="h-8 w-8" />
        </div>

        {/* Title and Email Display */}
        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tight">Check Your Inbox</h2>
          <p className="text-xs text-text-muted leading-relaxed">
            We have dispatched a verification link to your email address. Please click the link to activate your account.
          </p>

          <div className="inline-flex items-center gap-2 bg-app-bg px-3.5 py-2 rounded-2xl border border-app-text/10 font-bold text-sm text-app-text my-2 shadow-sm">
            <span className="truncate max-w-[220px]">{email || 'your-email@example.com'}</span>
            <button
              type="button"
              onClick={() => {
                setNewEmail(email);
                setPassword('');
                setShowPassword(false);
                setIsEditing(true);
              }}
              className="text-primary hover:underline text-xs flex items-center gap-1 ml-1 font-semibold focus:outline-none cursor-pointer shrink-0"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Edit</span>
            </button>
          </div>
        </div>

        {/* Status Message Banners */}
        {message && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-medium flex items-center justify-center gap-2">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs font-medium flex items-center justify-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || isLoading}
            className="w-full py-3.5 px-4 bg-primary text-white font-bold text-xs rounded-xl shadow-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span>
              {resendCooldown > 0
                ? `Resend available in ${resendCooldown}s`
                : 'Resend Verification Email'}
            </span>
          </button>

          <div>
            <Link
              to="/auth?mode=signin"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-app-text transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Return to Sign In</span>
            </Link>
          </div>
        </div>

      </div>

      {/* Edit Email Modal Overlay */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-card-bg border border-app-text/10 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <h3 className="font-bold text-lg text-app-text">Update Email Address</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              If you made a typo during registration, enter your correct email address and current password below to confirm.
            </p>
            <form onSubmit={handleUpdateEmail} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-app-text mb-1">New Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="new.email@example.com"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-app-bg border border-app-text/10 text-xs text-app-text focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-app-text mb-1">Current Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-app-bg border border-app-text/10 text-xs text-app-text focus:outline-none focus:border-primary transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-app-text focus:outline-none cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setPassword('');
                    setShowPassword(false);
                  }}
                  className="w-1/2 py-2.5 bg-app-bg border border-app-text/10 text-app-text rounded-xl text-xs font-bold hover:bg-app-text/5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-1/2 py-2.5 bg-primary text-white rounded-xl text-xs font-bold shadow-md hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save & Resend'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}