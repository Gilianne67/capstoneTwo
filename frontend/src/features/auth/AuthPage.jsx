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
  EyeOff
} from 'lucide-react';

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState('student'); // 'student' | 'provider'
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // Read URL query parameters: ?mode=signup&role=provider
  useEffect(() => {
    const mode = searchParams.get('mode');
    const roleParam = searchParams.get('role');

    if (mode === 'signup') {
      setIsSignUp(true);
    } else if (mode === 'signin') {
      setIsSignUp(false);
    }

    if (roleParam === 'provider' || roleParam === 'student') {
      setRole(roleParam);
    }
  }, [searchParams]);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    organizationName: '',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log(isSignUp ? 'Signing Up:' : 'Signing In:', { role, ...formData });
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-app-bg text-app-text flex flex-col justify-between relative overflow-hidden pt-20">
      {/* Top Accent Line */}
      <div className="h-1.5 w-full bg-gradient-to-r from-primary via-secondary to-accent" />

      {/* Background Decorative Blur Orbs */}
      <div className="absolute -top-20 -left-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-secondary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-6xl w-full mx-auto px-4 py-8 sm:px-6 lg:px-8 flex-1 flex items-center justify-center relative z-10">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-card-bg border border-slate-200/80 rounded-3xl shadow-xl overflow-hidden">
          
          {/* Left Side - Brand Showcase Panel */}
          <div className="lg:col-span-5 bg-gradient-to-br from-primary via-blue-600 to-blue-800 text-white p-8 sm:p-12 h-full flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-64 h-64 border border-white/10 rounded-3xl rotate-12 bg-white/[0.03] pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.1)_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />

            <div className="relative z-10 space-y-6">
              <Link to="/" className="inline-flex items-center gap-2.5 group">
                <GraduationCap className="h-8 w-8 text-accent transition-transform duration-300 group-hover:scale-110" />
                <span className="font-bold text-2xl tracking-tight text-white">
                  Iskolar<span className="text-accent">Match</span>
                </span>
              </Link>

              <div className="space-y-3 pt-4">
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
                  {isSignUp 
                    ? (role === 'provider' ? 'List Your Scholarships' : 'Discover Matching Scholarships') 
                    : 'Welcome Back!'}
                </h2>
                <p className="text-blue-100 text-sm leading-relaxed">
                  {isSignUp 
                    ? (role === 'provider' 
                        ? 'Create an account to post your scholarship listings and help deserving students find you.' 
                        : 'Fill out your profile details to see ranked scholarship matches with step-by-step application instructions.') 
                    : 'Log in to view your saved and matched scholarship opportunities.'}
                </p>
              </div>
            </div>

            {/* Feature Bullets */}
            <div className="relative z-10 space-y-3 my-8">
              {[
                'Transparent Mathematical Weighted Scoring',
                'Verified Scholarship Directory',
                'Direct External Links & Application Guides'
              ].map((feat, idx) => (
                <div key={idx} className="flex items-center gap-2.5 text-xs sm:text-sm text-blue-50 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>

            <div className="relative z-10 pt-6 border-t border-white/15 text-xs text-blue-200">
              Built with ❤️ for Iskolar ng Bayan
            </div>
          </div>

          {/* Right Side - Auth Form */}
          <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12">
            <div className="max-w-md mx-auto space-y-6">
              
              {/* Form Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-app-text">
                    {isSignUp ? 'Create an Account' : 'Sign In'}
                  </h3>
                  <p className="text-xs text-text-muted mt-1">
                    {isSignUp ? 'Fill in your details below to get started.' : 'Enter your credentials to access your account.'}
                  </p>
                </div>
                
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  {isSignUp ? 'Already have an account?' : 'Need an account?'}
                </button>
              </div>

              {/* Role Selector (Sign Up Only) */}
              {isSignUp && (
                <div className="grid grid-cols-2 gap-3 p-1 bg-app-bg rounded-2xl border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setRole('student')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                      role === 'student'
                        ? 'bg-primary text-white shadow-md'
                        : 'text-text-muted hover:text-app-text'
                    }`}
                  >
                    <GraduationCap className="h-4 w-4" />
                    <span>Student</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('provider')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                      role === 'provider'
                        ? 'bg-primary text-white shadow-md'
                        : 'text-text-muted hover:text-app-text'
                    }`}
                  >
                    <Building2 className="h-4 w-4" />
                    <span>Provider</span>
                  </button>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <div>
                    <label className="block text-xs font-bold text-app-text mb-1.5">
                      {role === 'provider' ? 'Organization / Agency Name' : 'Full Name'}
                    </label>
                    <div className="relative">
                      {role === 'provider' ? (
                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                      ) : (
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                      )}
                      <input
                        type="text"
                        name={role === 'provider' ? 'organizationName' : 'fullName'}
                        required
                        value={role === 'provider' ? formData.organizationName : formData.fullName}
                        onChange={handleChange}
                        placeholder={role === 'provider' ? 'e.g., CHED / DOST Foundation' : 'e.g., Juan Dela Cruz'}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-app-bg border border-slate-200 text-sm text-app-text focus:outline-none focus:border-primary transition-colors"
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
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-app-bg border border-slate-200 text-sm text-app-text focus:outline-none focus:border-primary transition-colors"
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
                      className="w-full pl-10 pr-10 py-3 rounded-xl bg-app-bg border border-slate-200 text-sm text-app-text focus:outline-none focus:border-primary transition-colors"
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
                  className="w-full py-3.5 px-6 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/25 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 mt-2"
                >
                  <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <div className="text-center pt-2">
                <p className="text-xs text-text-muted">
                  {isSignUp ? 'Already registered?' : "Don't have an account?"}{' '}
                  <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="font-bold text-primary hover:underline"
                  >
                    {isSignUp ? 'Sign In instead' : 'Create an Account'}
                  </button>
                </p>
              </div>

            </div>
          </div>

        </div>
      </div>

      <div className="text-center py-4 text-xs text-text-muted border-t border-slate-200/60 relative z-10">
        © {new Date().getFullYear()} IskolarMatch. All rights reserved.
      </div>
    </div>
  );
}