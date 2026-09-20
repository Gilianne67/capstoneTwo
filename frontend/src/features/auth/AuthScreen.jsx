import React, { useEffect, useState } from 'react';
import { ArrowRight, Building2, GraduationCap, Loader2, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const initialForm = {
  name: '',
  email: '',
  password: '',
  organization: '',
};

export default function AuthScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, register } = useAuth();
  const [mode, setMode] = useState(searchParams.get('mode') === 'signup' ? 'signup' : 'signin');
  const [role, setRole] = useState('student');
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMode(searchParams.get('mode') === 'signup' ? 'signup' : 'signin');
  }, [searchParams]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
  };

  const validate = () => {
    if (mode === 'signup' && !form.name.trim()) return 'Please enter your full name.';
    if (!form.email.trim() || !form.email.includes('@')) return 'Please enter a valid email address.';
    if (form.password.length < 6) return 'Password must be at least 6 characters.';
    if (mode === 'signup' && role === 'provider' && !form.organization.trim()) {
      return 'Please enter your organization name.';
    }
    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      if (mode === 'signin') {
        await login(form.email, form.password);
      } else {
        await register({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          role,
          ...(role === 'provider' ? { organization: form.organization.trim() } : {}),
        });
      }
      navigate('/dashboard', { replace: true });
    } catch (submitError) {
      setError(submitError.message || 'Unable to complete your request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSignup = mode === 'signup';

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-10">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl lg:grid-cols-[0.9fr_1.1fr]">
        <section className="bg-slate-900 p-8 text-white md:p-12">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">ISKOLARMATCH</p>
          <h1 className="mt-8 text-4xl font-black leading-tight">Your next opportunity starts here.</h1>
          <p className="mt-5 max-w-sm text-sm leading-7 text-slate-300">
            Build one profile, discover scholarships that fit, and keep every application in one place.
          </p>
          <div className="mt-12 space-y-5 text-sm text-slate-200">
            <p className="flex items-center gap-3"><GraduationCap className="h-5 w-5 text-emerald-300" /> Student-first scholarship matching</p>
            <p className="flex items-center gap-3"><LockKeyhole className="h-5 w-5 text-emerald-300" /> Your profile stays in your account</p>
          </div>
        </section>

        <section className="p-6 md:p-12">
          <div className="mb-8 flex gap-2 rounded-xl bg-slate-100 p-1">
            {['signin', 'signup'].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => { setMode(option); setError(''); }}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition ${mode === option ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                {option === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <div className="mb-7">
            <h2 className="text-2xl font-black text-slate-900">{isSignup ? 'Create your account' : 'Welcome back'}</h2>
            <p className="mt-2 text-sm text-slate-500">{isSignup ? 'Start with your account details, then complete your student profile.' : 'Sign in to continue to your scholarship workspace.'}</p>
          </div>

          {isSignup && (
            <div className="mb-5 grid grid-cols-2 gap-3">
              {[['student', GraduationCap, 'Student'], ['provider', Building2, 'Provider']].map(([value, Icon, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRole(value)}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold ${role === value ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-500'}`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
          )}

          {error && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && <Input icon={UserRound} label="Full name" value={form.name} onChange={(value) => updateField('name', value)} />}
            <Input icon={Mail} label="Email address" type="email" value={form.email} onChange={(value) => updateField('email', value)} />
            <Input icon={LockKeyhole} label="Password" type="password" value={form.password} onChange={(value) => updateField('password', value)} />
            {isSignup && role === 'provider' && <Input icon={Building2} label="Organization name" value={form.organization} onChange={(value) => updateField('organization', value)} />}
            <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function Input({ icon: Icon, label, value, onChange, type = 'text' }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-700">{label}</span>
      <span className="relative block">
        <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input required type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
      </span>
    </label>
  );
}
