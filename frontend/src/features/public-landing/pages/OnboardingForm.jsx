import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldAlert, 
  GraduationCap, 
  ArrowRight, 
  Loader2, 
  MailCheck, 
  Mail, 
  Send, 
  AlertCircle,
  FileText,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { REGIONS } from "../../../data/locationData";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function OnboardingForm({ onComplete }) {
  const navigate = useNavigate();
  const { user, token: contextToken, updateUser } = useAuth();

  const [formData, setFormData] = useState({
  dob: '',
  course: '',
  academicLevel: 'College',
  yearLevel: '1st Year',
  gpa: '',
  region: '',
  householdIncome: 'Below ₱10,000 / month',
  guardianName: '',
  guardianEmail: '',
  dpaConsent: false
});;

  const [isMinor, setIsMinor] = useState(false);
  const [calculatedAge, setCalculatedAge] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consentSent, setConsentSent] = useState(false);
  const [error, setError] = useState(null);

  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState(null);

  const handleDobChange = (e) => {
    const dobValue = e.target.value;
    setFormData(prev => ({ ...prev, dob: dobValue }));

    if (dobValue) {
      const birthDate = new Date(dobValue);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      setCalculatedAge(age);
      setIsMinor(age < 18);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const getCleanToken = () => {
    let rawToken = contextToken || localStorage.getItem('token') || localStorage.getItem('accessToken');
    if (rawToken) {
      return rawToken.replace(/^"|"$/g, '').replace('Bearer ', '').trim();
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.dpaConsent) {
      setError('You must consent to the Data Privacy Act (DPA) policy to proceed.');
      return;
    }

    if (isMinor) {
      const studentEmail = user?.email?.trim().toLowerCase();
      const guardianEmail = formData.guardianEmail.trim().toLowerCase();

      if (!guardianEmail) {
        setError('Guardian email is required for students under 18.');
        return;
      }

      if (studentEmail && guardianEmail === studentEmail) {
        setError('Parent/Guardian email cannot be the same as your student account email.');
        return;
      }
    }

    const gwa = parseFloat(formData.gpa);

    if (isNaN(gwa)) {
      setError('Please enter a valid GWA.');
      return;
    }

    let gwaScale;

    if (gwa >= 1 && gwa <= 5) {
      gwaScale = '1.00-5.00';
    } else if (gwa >= 60 && gwa <= 100) {
      gwaScale = '60-100';
    } else {
      setError('GWA must be between 1.00–5.00 or 60–100.');
      return;
    }

    setIsSubmitting(true);
    const token = getCleanToken();

    try {
      const response = await fetch(`${API_BASE_URL}/user/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        credentials: 'include',
        body: JSON.stringify({
          dob: formData.dob,
          course: formData.course,
          academicLevel: formData.academicLevel,
          yearLevel: formData.yearLevel,
          gpa: gwa,
          gwaScale: gwaScale,
          region: formData.region,
          householdIncome: formData.householdIncome,
          guardianName: isMinor ? formData.guardianName : undefined,
          guardianEmail: isMinor ? formData.guardianEmail : undefined,
          isMinor,
          age: calculatedAge
        })
      });

      const contentType = response.headers.get('content-type');
      let data = {};
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const rawText = await response.text();
        console.error('Non-JSON Server Response:', rawText);
        throw new Error(`Server returned non-JSON response (${response.status})`);
      }

      if (!response.ok) {
        throw new Error(data.message || 'Onboarding submission failed.');
      }

      // Update local state in AuthContext with fresh DB user
      if (typeof updateUser === 'function') {
        updateUser(data.user);
      }

      if (isMinor) {
        setConsentSent(true);
      } else {
        if (typeof onComplete === 'function') {
          onComplete(data.user);
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      console.error('Onboarding Submission Error:', err);
      setError(err.message || 'Connection Failed: Could not complete onboarding.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendConsentEmail = async () => {
    setIsResending(true);
    setResendStatus(null);
    const token = getCleanToken();

    try {
      const res = await fetch(`${API_BASE_URL}/user/consent/resend`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        credentials: 'include',
        body: JSON.stringify({ 
          userId: user?.id || user?._id, 
          guardianEmail: formData.guardianEmail || user?.guardianEmail 
        })
      });
      
      const data = await res.json();
      if (res.ok && data.success !== false) {
        setResendStatus({ type: 'success', text: 'Consent email sent successfully! Please check spam folder.' });
      } else {
        setResendStatus({ type: 'error', text: data.message || 'Failed to resend email.' });
      }
    } catch (err) {
      console.error('Resend Error:', err);
      setResendStatus({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setIsResending(false);
    }
  };

  // Screening for Pending Consent Status
  if (user?.isOnboarded && user?.status === 'pending_consent') {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-card-bg border border-app-text/10 rounded-2xl text-center space-y-4 shadow-lg">
        <div className="w-12 h-12 bg-amber-500/10 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <Mail className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-black text-app-text">Parental Approval Needed</h3>
        <p className="text-xs text-text-muted leading-relaxed">
          A verification link was sent to your parent/guardian's email address (<strong>{user?.guardianEmail}</strong>).
        </p>

        {resendStatus && (
          <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            resendStatus.type === 'success' 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}>
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{resendStatus.text}</span>
          </div>
        )}

        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={handleResendConsentEmail}
            disabled={isResending}
            className="w-full py-3 bg-primary text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {isResending ? <Loader2 className="w-4 h-4 animate-spin" /> : (
              <>
                <Send className="w-4 h-4" />
                <span>Resend Consent Email</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate('/auth?mode=signin')}
            className="w-full py-2 text-xs font-semibold text-text-muted hover:text-app-text cursor-pointer"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  if (consentSent) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-card-bg border border-app-text/10 rounded-2xl text-center space-y-4 shadow-lg">
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <MailCheck className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-app-text">Parental Consent Required</h2>
        <p className="text-xs text-text-muted leading-relaxed">
          Because you are under 18, we sent a verification link to <strong className="text-app-text">{formData.guardianEmail}</strong>.
        </p>
        <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-xs font-semibold border border-amber-200">
          🔒 Account Status: <strong>Pending Consent</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto my-10 p-6 sm:p-8 bg-card-bg border border-app-text/10 rounded-2xl shadow-md">
      <div className="mb-6 pb-4 border-b border-app-text/10 space-y-1">
        <h2 className="text-xl font-extrabold text-app-text flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-primary" />
          Complete Your Student Profile
        </h2>
        
        <div className="flex items-start gap-2 p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-blue-900 text-xs">
          <Sparkles className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
          <span>
            <strong>Scholarship Accuracy Notice:</strong> Please enter your accurate age, GPA, and location. Providers use these metrics to match you directly with eligible grant programs.
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-xs font-bold text-app-text">Date of Birth</label>
            {calculatedAge !== null && (
              <span className="text-xs font-bold text-primary">Age: {calculatedAge} years old</span>
            )}
          </div>
          <input
            type="date"
            name="dob"
            value={formData.dob}
            onChange={handleDobChange}
            required
            className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-none"
          />
        </div>

        {isMinor && (
          <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Parent / Guardian Consent Required (Under 18)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-app-text mb-1">Guardian Full Name</label>
                <input
                  type="text"
                  name="guardianName"
                  value={formData.guardianName}
                  onChange={handleChange}
                  required={isMinor}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-app-text mb-1">Guardian Email Address</label>
                <input
                  type="email"
                  name="guardianEmail"
                  value={formData.guardianEmail}
                  onChange={handleChange}
                  required={isMinor}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-app-text mb-1">Course / Major</label>
            <input
              type="text"
              name="course"
              value={formData.course}
              onChange={handleChange}
              required
              className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-none"
            />
          </div>

          <div>
  <label className="block text-xs font-bold text-app-text mb-1">
  Academic Level
</label>

<select
  name="academicLevel"
  value={formData.academicLevel}
  onChange={(e) => {
    const academicLevel = e.target.value;

    setFormData(prev => ({
      ...prev,
      academicLevel,
      yearLevel:
        academicLevel === 'Senior High School'
          ? 'Grade 11'
          : academicLevel === 'College'
            ? '1st Year'
            : 'Masteral'
    }));
  }}
  className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-none cursor-pointer"
>
  <option value="Senior High School">Senior High School</option>
  <option value="College">College</option>
  <option value="Graduate Studies">Post Graduate Studies</option>
</select>
</div>

<div>
  <label className="block text-xs font-bold text-app-text mb-1">
    {formData.academicLevel === 'Senior High School'
      ? 'Grade Level'
      : formData.academicLevel === 'Graduate Studies'
        ? 'Program Level'
        : 'Year Level'}
  </label>

  <select
    name="yearLevel"
    value={formData.yearLevel}
    onChange={handleChange}
    className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-none cursor-pointer"
  >
    {formData.academicLevel === 'Senior High School' ? (
      <>
        <option value="Grade 11">Grade 11</option>
        <option value="Grade 12">Grade 12</option>
      </>
    ) : formData.academicLevel === 'Graduate Studies' ? (
      <>
        <option value="Masteral">Master's</option>
        <option value="Doctoral">Doctoral</option>
      </>
    ) : (
      <>
        <option value="1st Year">1st Year</option>
        <option value="2nd Year">2nd Year</option>
        <option value="3rd Year">3rd Year</option>
        <option value="4th Year">4th Year</option>
      </>
    )}
  </select>
</div>

          <div>
            <label className="block text-xs font-bold text-app-text mb-1">Current GWA / GPA</label>
            <input
              type="number"
              step="0.01"
              min="1"
              max="100"
              name="gpa"
              value={formData.gpa}
              onChange={handleChange}
              required
              placeholder="e.g. 1.75 or 85"
              className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-none"
            />

            <p className="text-[10px] text-slate-500 mt-1">
              Enter your GWA using your school's grading scale (1.00–5.00 or 60–100).
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text mb-1">Region</label>
              <select
                  name="region"
                  value={formData.region}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-none cursor-pointer"
                >
                  <option value="">Select region</option>

                  {REGIONS.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-app-text mb-1">Monthly Household Income</label>
            <select
              name="householdIncome"
              value={formData.householdIncome}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-none cursor-pointer"
            >
              <option>Below ₱10,000 / month</option>
              <option>₱10,001 – ₱21,190 / month</option>
              <option>₱21,191 – ₱43,828 / month</option>
              <option>₱43,829 – ₱76,669 / month</option>
              <option>₱76,670 – ₱131,484 / month</option>
              <option>Above ₱131,484 / month</option>
            </select>
          </div>
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-xl space-y-2">
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="dpaConsent"
              name="dpaConsent"
              checked={formData.dpaConsent}
              onChange={handleChange}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            />
            <label htmlFor="dpaConsent" className="text-xs text-app-text leading-relaxed cursor-pointer">
              <strong className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 inline text-primary" /> Data Privacy Act (DPA) Compliance Notice
              </strong>
              I consent to the collection and processing of my personal data for scholarship matching purposes in compliance with Republic Act No. 10173 (Data Privacy Act of 2012).
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-4 py-3 bg-primary text-white hover:bg-primary/90 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span>{isMinor ? 'Submit & Send Guardian Email' : 'Activate Profile'}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default OnboardingForm;