import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { API_BASE_URL } from '../../../config/api';
import { MIN_PASSWORD_LENGTH } from '../../../config/passwordPolicy';
import { 
  GraduationCap, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Check, 
  X, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck,
  KeyRound
} from 'lucide-react';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [status, setStatus] = useState({ loading: false, error: '', success: false });

  // Real-time validations
  const isPasswordValid = password.length >= MIN_PASSWORD_LENGTH;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password.length < MIN_PASSWORD_LENGTH) {
      return setStatus({
        loading: false,
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
        success: false
      });
    }

    if (!passwordsMatch) {
      return setStatus({
        loading: false,
        error: 'Passwords do not match. Please re-check both fields.',
        success: false
      });
    }

    setStatus({ loading: true, error: '', success: false });

    try {
      const res = await fetch(`${API_BASE_URL}/auth/resetpassword/${encodeURIComponent(token)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus({ loading: false, error: '', success: true });
        setTimeout(() => navigate('/auth?mode=signin'), 2500);
      } else {
        setStatus({
          loading: false,
          error: data.error || data.message || 'Password reset link is invalid or has expired. Please request a new link.',
          success: false
        });
      }
    } catch (err) {
      setStatus({
        loading: false,
        error: 'Network connection error. Please try again.',
        success: false
      });
    }
  };

  return (
    <div className="min-h-screen bg-app-bg text-app-text flex flex-col justify-between relative overflow-hidden pt-20">
      {/* Top Accent Bar */}
      <div className="h-1.5 w-full bg-primary transition-colors duration-300" />

      {/* Main Container */}
      <div className="max-w-5xl w-full mx-auto px-4 py-8 sm:px-6 lg:px-8 flex-1 flex items-center justify-center relative z-10">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-0 items-stretch bg-card-bg border border-app-text/10 rounded-3xl shadow-2xl overflow-hidden">
          
          {/* Left Hero Banner */}
          <div className="lg:col-span-5 bg-primary text-white p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-64 h-64 border border-white/10 rounded-3xl rotate-12 bg-white/[0.04] pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.15)_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />

            <div className="relative z-10 space-y-6">
              <Link to="/" className="inline-flex items-center gap-2.5 group">
                <GraduationCap className="h-8 w-8 text-accent transition-transform duration-300 group-hover:scale-110" />
                <span className="font-extrabold text-2xl tracking-tight text-white">
                  ISKOLAR<span className="text-accent">MATCH</span>
                </span>
              </Link>

              <div className="space-y-3 pt-4">
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                  Secure Your Account
                </h2>
                <p className="text-white/80 text-xs sm:text-sm leading-relaxed">
                  Choose a new strong password containing at least {MIN_PASSWORD_LENGTH} characters to restore full access to your personalized portal.
                </p>
              </div>
            </div>

            {/* Security Callouts */}
            <div className="relative z-10 space-y-3 my-8">
              {[
                'Encrypted Account Recovery',
                `${MIN_PASSWORD_LENGTH}+ Character Security Requirement`,
                'Instant Dashboard Access Upon Reset'
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-2.5 text-xs sm:text-sm text-white/90 font-medium">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="relative z-10 pt-6 border-t border-white/15 text-xs text-white/70">
              Built with ❤️ for Iskolar ng Bayan
            </div>
          </div>

          {/* Right Form Container */}
          <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-center">
            <div className="max-w-md mx-auto w-full space-y-6">
              
              {/* Header */}
              <div>
                <h3 className="text-2xl font-black text-app-text flex items-center gap-2">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                  <span>Set New Password</span>
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  Enter and confirm your new account credentials below.
                </p>
              </div>

              {/* Status Alerts */}
              {status.error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2.5 text-xs text-rose-600">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{status.error}</span>
                </div>
              )}

              {status.success ? (
                <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center space-y-4">
                  <div className="w-12 h-12 bg-emerald-500/20 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <KeyRound className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-app-text text-base">Password Reset Complete!</h4>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">
                      Your password has been successfully updated. Redirecting you to the Sign In page now...
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* New Password Field */}
                  <div>
                    <label className="block text-xs font-bold text-app-text mb-1.5">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => {
                          if (status.error) setStatus(p => ({ ...p, error: '' }));
                          setPassword(e.target.value);
                        }}
                        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters long`}
                        className="w-full pl-10 pr-10 py-3 rounded-xl bg-app-bg border border-app-text/10 text-sm text-app-text focus:outline-none focus:border-primary transition-colors"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-app-text"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {/* Minimum Length Indicator */}
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className={`inline-flex items-center gap-1 font-medium ${isPasswordValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-text-muted'}`}>
                        {isPasswordValid ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0" />}
                        Password must be at least {MIN_PASSWORD_LENGTH} characters long
                      </span>
                      <span className="font-mono text-text-muted">
                        {password.length}/{MIN_PASSWORD_LENGTH}
                      </span>
                    </div>
                  </div>

                  {/* Confirm Password Field */}
                  <div>
                    <label className="block text-xs font-bold text-app-text mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => {
                          if (status.error) setStatus(p => ({ ...p, error: '' }));
                          setConfirmPassword(e.target.value);
                        }}
                        placeholder="Re-enter new password"
                        className="w-full pl-10 pr-10 py-3 rounded-xl bg-app-bg border border-app-text/10 text-sm text-app-text focus:outline-none focus:border-primary transition-colors"
                      />
                      <button
                        type="button"
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-app-text"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {/* Match Validation Indicator */}
                    {confirmPassword.length > 0 && (
                      <div className="mt-1.5 text-[11px] font-medium flex items-center gap-1">
                        {passwordsMatch ? (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Check className="h-3.5 w-3.5" /> Passwords match
                          </span>
                        ) : (
                          <span className="text-rose-500 flex items-center gap-1">
                            <X className="h-3.5 w-3.5" /> Passwords do not match
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={status.loading || !isPasswordValid || !passwordsMatch}
                    className="w-full py-3.5 px-6 rounded-xl text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 mt-4 bg-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-primary/20"
                  >
                    {status.loading ? (
                      <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <span>Reset Password</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

            </div>
          </div>

        </div>
      </div>

      <div className="text-center py-4 text-xs text-text-muted border-t border-app-text/10 relative z-10">
        © {new Date().getFullYear()} IskolarMatch. All rights reserved.
      </div>
    </div>
  );
}