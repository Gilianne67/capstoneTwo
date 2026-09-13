import React, { useState } from 'react';
import { ShieldAlert, GraduationCap, ArrowRight, Loader2, MailCheck } from 'lucide-react';

export function OnboardingForm({ user, onComplete }) {
  const [formData, setFormData] = useState({
    dob: '',
    course: '',
    yearLevel: '1st Year',
    gpa: '',
    region: '',
    guardianName: '',
    guardianEmail: ''
  });

  const [isMinor, setIsMinor] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consentSent, setConsentSent] = useState(false);
  const [error, setError] = useState(null);

  // Evaluate age whenever Date of Birth changes
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
    setIsSubmitting(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          isMinor
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to complete profile.');

      if (isMinor) {
        // Trigger Pending Consent view
        setConsentSent(true);
      } else {
        // Adult student - proceed directly
        onComplete(data.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // If the account is frozen under Pending Consent
  if (consentSent) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-card-bg border border-app-text/10 rounded-2xl text-center space-y-4 shadow-lg">
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <MailCheck className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-app-text">Parental Consent Required</h2>
        <p className="text-xs text-text-muted leading-relaxed">
          Because you are under 18 years old, Republic Act No. 10173 (Data Privacy Act) requires parental approval. 
          We have sent a verification link to <strong className="text-app-text">{formData.guardianEmail}</strong>.
        </p>
        <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-xs font-semibold border border-amber-200">
          🔒 Account Status: <strong>Pending Consent</strong>
          <br />
          Your matching profile is temporarily frozen until your guardian clicks the link.
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
          Provide your details to build your profile and activate scholarship matching.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Date of Birth & Age Verification */}
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
        </div>

        {/* Dynamic Minor Notice & Guardian Input */}
        {isMinor && (
          <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Parent / Guardian Consent Required (Under 18)</span>
            </div>
            <p className="text-[11px] text-amber-700 leading-normal">
              An automated verification link will be emailed to your parent or legal guardian to approve your account creation.
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

        {/* Academic Profile Details */}
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