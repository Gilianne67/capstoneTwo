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
  ShieldCheck,
  Zap
} from 'lucide-react';

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [isSignUp, setIsSignUp] = useState(false);
  const [signupRole, setSignupRole] = useState('student');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [formData, setFormData] = useState({
    fullName: '',
    organizationName: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    const mode = searchParams.get('mode');
    const roleParam = searchParams.get('role');

    if (mode === 'signup') setIsSignUp(true);
    if (mode === 'signin') setIsSignUp(false);

    if (roleParam === 'provider' || roleParam === 'student') {
      setSignupRole(roleParam);
    }
  }, [searchParams]);

  const handleChange = (e) => {
    setErrorMessage('');
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const loginWithDemoAccount = async (email, password, role) => {
    setIsLoading(true);
    setErrorMessage('');
    setIsSignUp(false);

    setFormData({ fullName: '', organizationName: '', email, password });

    await new Promise((resolve) => setTimeout(resolve, 300));

    const mockSession = {
      email,
      role,
      name: role === 'admin' ? 'System Administrator' : role === 'provider' ? 'DOST Scholarship Office' : 'Juan Dela Cruz',
      token: 'mock-jwt-token-xyz-123'
    };
    
    localStorage.setItem('iskolar_session', JSON.stringify(mockSession));
    setIsLoading(false);
    navigate(`/dashboard/${role}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const emailLower = formData.email.trim().toLowerCase();
      const password = formData.password.trim();

      let userRole = signupRole;

      if (!isSignUp) {
        if (emailLower.includes('admin') || password === 'pass123') {
          userRole = 'admin';
        } else if (emailLower.includes('provider') || emailLower.includes('sponsor')) {
          userRole = 'provider';
        } else {
          userRole = 'student';
        }
      }

      const mockSession = {
        email: emailLower,
        role: userRole,
        name: isSignUp 
          ? (signupRole === 'provider' ? formData.organizationName : formData.fullName)
          : emailLower.split('@')[0],
        token: 'mock-jwt-token-xyz-123'
      };
      
      localStorage.setItem('iskolar_session', JSON.stringify(mockSession));
      navigate(`/dashboard/${userRole}`);

    } catch (err) {
      setErrorMessage('Invalid credentials. Please check your email and password.');
    } finally {
      setIsLoading(false);
    }
  };

  const isProvider = isSignUp && signupRole === 'provider';

  return (
    <div className="min-h-screen bg-app-bg text-app-text flex flex-col justify-between relative overflow-hidden pt-20">
      {/* Top Accent Line */}
      <div className={`h-1.5 w-full transition-colors duration-300 ${isProvider ? 'bg-emerald-900' : 'bg-primary'}`} />

      {/* Main Content Container */}
      <div className="max-w-6xl w-full mx-auto px-4 py-8 sm:px-6 lg:px-8 flex-1 flex items-center justify-center relative z-10">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-0 items-stretch bg-card-bg border border-app-text/10 rounded-3xl shadow-2xl overflow-hidden">
          
          {/* Left Hero Panel */}
          <div className={`lg:col-span-5 ${isProvider ? 'bg-emerald-900' : 'bg-primary'} text-white p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden transition-colors duration-500`}>
            
            {/* Geometric Rotated Card Accent */}
            <div className="absolute -right-10 -bottom-10 w-64 h-64 border border-white/10 rounded-3xl rotate-12 bg-white/[0.04] pointer-events-none" />
            
            {/* Geometric Dotted Background Overlay */}
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
                  {isSignUp 
                    ? (signupRole === 'provider' ? 'Partner with Us to Support Students' : 'Unlock Your Ideal Scholarships') 
                    : 'One Portal. Unlimited Opportunities.'}
                </h2>
                <p className="text-white/80 text-xs sm:text-sm leading-relaxed">
                  {isSignUp 
                    ? (signupRole === 'provider' 
                        ? 'Register your organization to post listings, review applicants, and connect with deserving scholars.' 
                        : 'Create your account to match with verified scholarships based on your academic profile.') 
                    : 'Sign in to access your personalized dashboard—whether you are a student, scholarship sponsor, or platform administrator.'}
                </p>
              </div>
            </div>

            {/* Feature Highlights */}
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
              
              {/* Form Title & Switcher */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-app-text">
                    {isSignUp ? 'Create an Account' : 'Welcome Back'}
                  </h3>
                  <p className="text-xs text-text-muted mt-1">
                    {isSignUp 
                      ? 'Choose your account type and fill in your details.' 
                      : 'Sign in with your email to access your workspace.'}
                  </p>
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setErrorMessage('');
                  }}
                  className="text-xs font-bold text-primary hover:underline focus:outline-none"
                >
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </button>
              </div>

              {/* Quick Test Logins Bar */}
              {!isSignUp && (
                <div className="p-3.5 bg-app-bg border border-app-text/10 rounded-2xl space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-text-muted uppercase tracking-wider">
                    <Zap className="h-3.5 w-3.5 text-accent" />
                    <span>Quick Test Accounts</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => loginWithDemoAccount('student@iskolar.ph', 'user123', 'student')}
                      className="py-1.5 px-2 bg-card-bg border border-app-text/10 rounded-xl text-xs font-bold text-app-text hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-1 shadow-sm"
                    >
                      <GraduationCap className="h-3.5 w-3.5 text-primary" />
                      <span>Student</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => loginWithDemoAccount('provider@iskolar.ph', 'provider123', 'provider')}
                      className="py-1.5 px-2 bg-card-bg border border-app-text/10 rounded-xl text-xs font-bold text-app-text hover:border-emerald-900 hover:text-emerald-900 transition-all flex items-center justify-center gap-1 shadow-sm"
                    >
                      <Building2 className="h-3.5 w-3.5 text-emerald-900" />
                      <span>Provider</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => loginWithDemoAccount('admin@iskolar.ph', 'pass123', 'admin')}
                      className="py-1.5 px-2 bg-card-bg border border-app-text/10 rounded-xl text-xs font-bold text-app-text hover:border-accent hover:text-accent transition-all flex items-center justify-center gap-1 shadow-sm"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                      <span>Admin</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Account Type Selector (Sign Up Mode Only) */}
              {isSignUp && (
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

              {/* Error Message Alert */}
              {errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2.5 text-xs text-rose-600">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Form Fields */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
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

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-app-text">
                      Password
                    </label>
                    {!isSignUp && (
                      <a href="#forgot" className="text-xs font-medium text-primary hover:underline">
                        Forgot password?
                      </a>
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
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-app-text"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

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
                      <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Mode Switch Footer */}
              <div className="text-center pt-2">
                <p className="text-xs text-text-muted">
                  {isSignUp ? 'Already have an account?' : "Don't have an account yet?"}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(!isSignUp);
                      setErrorMessage('');
                    }}
                    className="font-bold text-primary hover:underline"
                  >
                    {isSignUp ? 'Sign In' : 'Register now'}
                  </button>
                </p>
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