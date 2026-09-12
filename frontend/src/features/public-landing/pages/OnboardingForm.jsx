import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, GraduationCap, ArrowRight, Loader2, MailCheck, Info } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext'; // Adjust import path if needed

export function OnboardingForm({ onComplete }) {
  const navigate = useNavigate();
  const { user, token: contextToken } = useAuth(); // Retrieve token directly from Auth Context

  const [formData, setFormData] = useState({
    dob: '',
    course: '',
    yearLevel: '1st Year',
    gpa: '',
    region: '',
    householdIncome: 'Below ₱10,000 / month',
    guardianName: '',
    guardianEmail: ''
  });

  const [isMinor, setIsMinor] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consentSent, setConsentSent] = useState(false);
  const [error, setError] = useState(null);

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

      setIsMinor(age < 18);
    }
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // Retrieve token from context or fallback to localStorage keys
    let token = contextToken || localStorage.getItem('token') || localStorage.getItem('accessToken');
    
    if (token) {
      token = token.replace(/^"|"$/g, '').replace('Bearer ', '').trim();
    }

    if (!token) {
      setError('No active session found. Please log in again.');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/v1/user/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ ...formData, isMinor }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Onboarding submission failed.');
      }

      console.log('Onboarding success:', data);

      if (isMinor) {
        setConsentSent(true);
      } else {
        if (onComplete) onComplete(data.user);
        navigate('/dashboard/student', { replace: true });
      }
    } catch (err) {
      console.error('Onboarding submission failed:', err.message);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (consentSent) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-card-bg border border-app-text/10 rounded-2xl text-center space-y-4 shadow-lg">
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <MailCheck className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-app-text">Parental Consent Email Sent</h2>
        <p className="text-xs text-text-muted leading-relaxed">
          In compliance with RA 10173 (Data Privacy Act of 2012), we sent an authorization link to <strong className="text-app-text">{formData.guardianEmail}</strong>.
        </p>
        <div className="p-3.5 bg-amber-50 text-amber-900 rounded-xl text-xs font-semibold border border-amber-200 text-left space-y-1">
          <div className="font-extrabold flex items-center gap-1.5">
            <span>🔒 Status: Pending Parental Consent</span>
          </div>
          <p className="text-[11px] text-amber-800">
            Once your parent/guardian clicks <strong>"Approve Consent"</strong> in the email, your account will activate and instantly perform profile match calculations!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto my-10 p-6 sm:p-8 bg-card-bg border border-app-text/10 rounded-2xl shadow-md">
      <div className="mb-6 pb-4 border-b border-app-text/10">
        <h2 className="text-xl font-extrabold text-app-text flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-primary" />
          Complete Your Student Profile
        </h2>
        <p className="text-xs text-text-muted mt-1">
          Providing true information ensures accurate algorithm matching with eligible scholarships.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-bold text-app-text mb-1">Date of Birth</label>
          <input
            type="date"
            name="dob"
            value={formData.dob}
            onChange={handleDobChange}
            required
            className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-hidden"
          />
          <div className="flex items-start gap-1.5 mt-1.5 text-[11px] text-text-muted">
            <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <span>
              Accurate age information ensures you match with scholarships that have strict age brackets.
            </span>
          </div>
        </div>

        {isMinor && (
          <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Parent / Guardian Consent Required (RA 10173 DPA Compliance)</span>
            </div>
            <p className="text-[11px] text-amber-700 leading-normal">
              Students under 18 require parental approval before storing sensitive educational records.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-app-text mb-1">Guardian Full Name</label>
                <input
                  type="text"
                  name="guardianName"
                  value={formData.guardianName}
                  onChange={handleChange}
                  placeholder="e.g. Maria Dela Cruz"
                  required={isMinor}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-app-text mb-1">Guardian Email Address</label>
                <input
                  type="email"
                  name="guardianEmail"
                  value={formData.guardianEmail}
                  onChange={handleChange}
                  placeholder="guardian@example.com"
                  required={isMinor}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-hidden"
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
              placeholder="BS Information Technology"
              required
              className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text mb-1">Year Level</label>
            <select
              name="yearLevel"
              value={formData.yearLevel}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-hidden cursor-pointer"
            >
              <option>1st Year</option>
              <option>2nd Year</option>
              <option>3rd Year</option>
              <option>4th Year</option>
              <option>Postgraduate</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text mb-1">Current GWA / GPA</label>
            <input
              type="text"
              name="gpa"
              value={formData.gpa}
              onChange={handleChange}
              placeholder="e.g. 1.50"
              required
              className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text mb-1">Region</label>
            <input
              type="text"
              name="region"
              value={formData.region}
              onChange={handleChange}
              placeholder="e.g. Region V"
              required
              className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-hidden"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-app-text mb-1">
              Monthly Household Income
            </label>
            <select
              name="householdIncome"
              value={formData.householdIncome}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-hidden cursor-pointer"
            >
              <option>Below ₱10,000 / month</option>
              <option>₱10,001 – ₱21,190 / month (Low income)</option>
              <option>₱21,191 – ₱43,828 / month (Lower middle)</option>
              <option>₱43,829 – ₱76,669 / month (Middle class)</option>
              <option>₱76,670 – ₱131,484 / month (Upper middle)</option>
              <option>Above ₱131,484 / month</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-4 py-3 bg-primary text-white hover:bg-primary/90 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span>{isMinor ? 'Send Guardian Consent Link' : 'Activate Profile & View Matches'}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default OnboardingForm;