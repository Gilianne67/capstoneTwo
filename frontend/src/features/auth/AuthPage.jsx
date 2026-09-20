import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  GraduationCap, 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  Building2, 
  CheckCircle2,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowLeft,
  KeyRound,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, register, resetPassword } = useAuth();

  // Mode management: 'signin' | 'signup' | 'forgot'
  const [authMode, setAuthMode] = useState('signin');
  const [signupRole, setSignupRole] = useState('student');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingConsentError, setPendingConsentError] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    organizationName: '',
    email: '',
    password: '',
  });

  // Sync state with URL Search Parameters
  useEffect(() => {
    const mode = searchParams.get('mode');
    const roleParam = searchParams.get('role');

    if (mode === 'signup') setAuthMode('signup');
    if (mode === 'signin') setAuthMode('signin');
    if (mode === 'forgot') setAuthMode('forgot');

    if (roleParam === 'provider' || roleParam === 'student') {
      setSignupRole(roleParam);
    }
  }, [searchParams]);

  // Handle Input Changes
  const handleChange = (e) => {
    if (errorMessage) setErrorMessage('');
    if (pendingConsentError) setPendingConsentError(false);
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Switch modes cleanly
  const switchMode = (mode) => {
    setAuthMode(mode);
    setErrorMessage('');
    setPendingConsentError(false);
    setResetSuccess(false);
    setFormData({
      fullName: '',
      organizationName: '',
      email: '',
      password: '',
    });
  };

  // Dev Quick-Login Helper
  const loginWithDemoAccount = async (email, password) => {
    setIsLoading(true);
    setErrorMessage('');
    setPendingConsentError(false);
    try {
      const authenticatedUser = await login(email, password);
      const targetRole = authenticatedUser?.role || 'student';
      
      setTimeout(() => {
        navigate(`/dashboard/${targetRole}`, { replace: true });
      }, 50);
    } catch (err) {
      setErrorMessage(err?.message || 'Demo login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Password Reset Request
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    const emailTrimmed = formData.email.trim().toLowerCase();

    if (!emailTrimmed) {
      setErrorMessage('Please enter your email address.');
      setIsLoading(false);
      return;
    }

    try {
      if (resetPassword) {
        await resetPassword(emailTrimmed);
      }
      setResetSuccess(true);
    } catch (err) {
      setErrorMessage(err?.message || 'Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Form Submission for Sign In and Sign Up
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (authMode === 'forgot') {
      return handleForgotPassword(e);
    }

    setIsLoading(true);
    setErrorMessage('');
    setPendingConsentError(false);

    const emailTrimmed = formData.email.trim().toLowerCase();
    const passwordTrimmed = formData.password.trim();

    try {
      let authenticatedUser;

      if (authMode === 'signup') {
        const name = signupRole === 'provider' 
          ? formData.organizationName.trim() 
          : formData.fullName.trim();

        if (!name) {
          throw new Error('Please enter your name or organization name.');
        }

        const payload = {
          email: emailTrimmed,
          password: passwordTrimmed,
          role: signupRole,
          name,
          ...(signupRole === 'provider' && { organization: name }),
        };

        authenticatedUser = await register(payload);

        if (signupRole === 'student') {
          navigate('/onboarding', { replace: true });
        } else {
          navigate('/dashboard/provider', { replace: true });
        }
      } else {
        authenticatedUser = await login(emailTrimmed, passwordTrimmed);

        const targetRole = authenticatedUser?.user?.role || authenticatedUser?.role || 'student';
        navigate(`/dashboard/${targetRole}`, { replace: true });
      }
    } catch (err) {
      // Check for parental consent block status (403 status or specific backend flags)
      const isConsentPending = 
        err?.response?.status === 403 ||
        err?.requiresConsent || 
        err?.message?.toLowerCase().includes('parental consent') ||
        err?.message?.toLowerCase().includes('pending_consent');

      if (isConsentPending) {
        setPendingConsentError(true);
        setErrorMessage(
          err?.message || 'Your account is pending parental consent. Please ask your parent/guardian to approve the verification email.'
        );
      } else {
        setErrorMessage(err?.message || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isProvider = authMode === 'signup' && signupRole === 'provider';

  return (
    <div className="min-h-screen bg-app-bg text-app-text flex flex-col justify-between relative overflow-hidden pt-20">
      {/* Top Accent Bar */}
      <div className={`h-1.5 w-full transition-colors duration-300 ${isProvider ? 'bg-emerald-900' : 'bg-primary'}`} />

      {/* Main Container */}
      <div className="max-w-6xl w-full mx-auto px-4 py-8 sm:px-6 lg:px-8 flex-1 flex items-center justify-center relative z-10">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-0 items-stretch bg-card-bg border border-app-text/10 rounded-3xl shadow-2xl overflow-hidden">
          
          {/* Left Hero Panel */}
          <div className={`lg:col-span-5 ${isProvider ? 'bg-emerald-900' : 'bg-primary'} text-white p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden transition-colors duration-500`}>
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
                  {authMode === 'forgot'
                    ? 'Account Recovery'
                    : authMode === 'signup' 
                    ? (signupRole === 'provider' ? 'Partner with Us to Support Students' : 'Unlock Your Ideal Scholarships') 
                    : 'One Portal. Unlimited Opportunities.'}
                </h2>
                <p className="text-white/80 text-xs sm:text-sm leading-relaxed">
                  {authMode === 'forgot'
                    ? 'Don’t worry! Enter your email address and we will help you reset your password to regain access.'
                    : authMode === 'signup' 
                    ? (signupRole === 'provider' 
                        ? 'Register your organization to post listings, review applicants, and connect with deserving scholars.' 
                        : 'Create your account to match with verified scholarships based on your academic profile.') 
                    : 'Sign in to access your personalized dashboard—whether you are a student, scholarship sponsor, or platform administrator.'}
                </p>
              </div>
            </div>

            {/* Features List */}
            <div className="relative z-10 space-y-3 my-8">
              {[
                'Transparent Eligibility Matching Engine',
                'Verified Partner Scholarship Directory',
                'Direct External Links & Application Guides'
              ].map((feat, idx) => (
                <div key={idx} className="flex items-center gap-2.5 text-xs sm:text-sm text-white/90 font-medium">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>

            <div className="relative z-10 pt-6 border-t border-white/15 text-xs text-white/70">
              Built with ❤️ for Iskolar ng Bayan
            </div>
          </div>

          {/* Right Form Panel */}
          <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-center">
            <div className="max-w-md mx-auto w-full space-y-6">
              
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-app-text">
                    {authMode === 'forgot'
                      ? 'Reset Password'
                      : authMode === 'signup' 
                      ? 'Create an Account' 
                      : 'Welcome Back'}
                  </h3>
                  <p className="text-xs text-text-muted mt-1">
                    {authMode === 'forgot'
                      ? 'Enter your registered email to receive reset instructions.'
                      : authMode === 'signup' 
                      ? 'Choose your account type and fill in your details.' 
                      : 'Sign in with your email to access your workspace.'}
                  </p>
                </div>
                
                {authMode !== 'forgot' && (
                  <button
                    type="button"
                    onClick={() => switchMode(authMode === 'signup' ? 'signin' : 'signup')}
                    className="text-xs font-bold text-primary hover:underline focus:outline-none"
                  >
                    {authMode === 'signup' ? 'Sign In' : 'Sign Up'}
                  </button>
                )}
              </div>

              {/* Role Toggle for Sign Up */}
              {authMode === 'signup' && (
                <div className="grid grid-cols-2 gap-2 p-1 bg-app-bg rounded-2xl border border-app-text/10">
                  <button
                    type="button"
                    onClick={() => setSignupRole('student')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                      signupRole === 'student'
                        ? 'bg-primary text-white shadow-md'
                        : 'text-text-muted hover:text-app-text'
                    }`}
                  >
                    <GraduationCap className="h-4 w-4" />
                    <span>Student</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignupRole('provider')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                      signupRole === 'provider'
                        ? 'bg-emerald-900 text-white shadow-md'
                        : 'text-text-muted hover:text-app-text'
                    }`}
                  >
                    <Building2 className="h-4 w-4" />
                    <span>Sponsor / Provider</span>
                  </button>
                </div>
              )}

              {/* Pending Consent Warning Banner */}
              {pendingConsentError ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
                    <span>Parental Authorization Required</span>
                  </div>
                  <p className="leading-relaxed">
                    {errorMessage}
                  </p>
                  <div className="text-[11px] text-amber-700 font-medium border-t border-amber-500/15 pt-2">
                    Tip: Ask your guardian to check their email inbox (and spam folder) for the authorization link.
                  </div>
                </div>
              ) : (
                /* Standard Error Alert */
                errorMessage && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2.5 text-xs text-rose-600">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )
              )}

              {/* Password Reset Confirmation Screen */}
              {authMode === 'forgot' && resetSuccess ? (
                <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center space-y-4">
                  <div className="w-12 h-12 bg-emerald-500/20 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <KeyRound className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-app-text text-base">Check your inbox</h4>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">
                      We sent a password reset link to <span className="font-semibold text-app-text">{formData.email}</span>. Please check your email to continue.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="w-full py-2.5 px-4 bg-primary text-white rounded-xl font-bold text-xs shadow-md hover:opacity-90 transition-all inline-flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Return to Sign In</span>
                  </button>
                </div>
              ) : (
                /* Main Form Body */
                <form onSubmit={handleSubmit} className="space-y-4">
                  {authMode === 'signup' && (
                    <div>
                      <label className="block text-xs font-bold text-app-text mb-1.5">
                        {signupRole === 'provider' ? 'Organization / Agency Name' : 'Full Name'}
                      </label>
                      <div className="relative">
                        {signupRole === 'provider' ? (
                          <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                        ) : (
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                        )}
                        <input
                          type="text"
                          name={signupRole === 'provider' ? 'organizationName' : 'fullName'}
                          required
                          value={signupRole === 'provider' ? formData.organizationName : formData.fullName}
                          onChange={handleChange}
                          placeholder={signupRole === 'provider' ? 'e.g., CHED / DOST Foundation' : 'e.g., Juan Dela Cruz'}
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-app-bg border border-app-text/10 text-sm text-app-text focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-app-text mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                      <input
                        type="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="name@example.com"
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-app-bg border border-app-text/10 text-sm text-app-text focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  </div>

                  {authMode !== 'forgot' && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-app-text">
                          Password
                        </label>
                        {authMode === 'signin' && (
                          <button
                            type="button"
                            onClick={() => switchMode('forgot')}
                            className="text-xs font-medium text-primary hover:underline focus:outline-none"
                          >
                            Forgot password?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          name="password"
                          required
                          value={formData.password}
                          onChange={handleChange}
                          placeholder="••••••••"
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
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full py-3.5 px-6 rounded-xl text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-70 disabled:cursor-not-allowed ${
                      isProvider
                        ? 'bg-emerald-900 hover:bg-emerald-950 shadow-emerald-900/20'
                        : 'bg-primary hover:opacity-90 shadow-primary/20'
                    }`}
                  >
                    {isLoading ? (
                      <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <span>
                          {authMode === 'forgot'
                            ? 'Send Reset Link'
                            : authMode === 'signup'
                            ? 'Create Account'
                            : 'Sign In'}
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Mode Switch Footer */}
              <div className="text-center pt-2">
                {authMode === 'forgot' ? (
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back to Sign In</span>
                  </button>
                ) : (
                  <p className="text-xs text-text-muted">
                    {authMode === 'signup' ? 'Already have an account?' : "Don't have an account yet?"}{' '}
                    <button
                      type="button"
                      onClick={() => switchMode(authMode === 'signup' ? 'signin' : 'signup')}
                      className="font-bold text-primary hover:underline"
                    >
                      {authMode === 'signup' ? 'Sign In' : 'Register now'}
                    </button>
                  </p>
                )}
              </div>

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