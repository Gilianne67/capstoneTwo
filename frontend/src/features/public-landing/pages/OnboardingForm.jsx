import { useState, useMemo } from 'react';
import { 
  ShieldAlert, 
  GraduationCap, 
  ArrowRight, 
  Loader2, 
  FileText,
  Sparkles
} from 'lucide-react';
import { REGIONS, PROVINCES, MUNICIPALITIES } from "../../../data/locationData";

export function OnboardingForm({ onSubmit, isSubmitting = false, registeredEmail = '' }) {
  const [formData, setFormData] = useState({
    dob: '',
    course: '',
    academicLevel: 'College',
    yearLevel: '1st Year',
    gpa: '',
    region: '',
    province: '',
    municipality: '',
    householdIncome: 'Below ₱10,000 / month',
    guardianName: '',
    guardianEmail: '',
    dpaConsent: false
  });

  const [isMinor, setIsMinor] = useState(false);
  const [calculatedAge, setCalculatedAge] = useState(null);
  const [error, setError] = useState(null);

  // Cascading location options derived from data
  const availableProvinces = useMemo(() => {
    if (!formData.region || !PROVINCES) return [];
    return PROVINCES[formData.region] || [];
  }, [formData.region]);

  const availableMunicipalities = useMemo(() => {
    if (!formData.province || !MUNICIPALITIES) return [];
    return MUNICIPALITIES[formData.province] || [];
  }, [formData.province]);

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
    setFormData(prev => {
      const updated = { 
        ...prev, 
        [name]: type === 'checkbox' ? checked : value 
      };

      // Reset dependent location fields on parent change
      if (name === 'region') {
        updated.province = '';
        updated.municipality = '';
      } else if (name === 'province') {
        updated.municipality = '';
      }

      return updated;
    });
  };

  const handleSubmitForm = (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.dpaConsent) {
      setError('You must consent to the Data Privacy Act (DPA) policy to proceed.');
      return;
    }

    if (isMinor) {
      const guardianEmail = formData.guardianEmail.trim().toLowerCase();

      if (!guardianEmail) {
        setError('Guardian email is required for students under 18.');
        return;
      }

      if (registeredEmail && guardianEmail === registeredEmail.trim().toLowerCase()) {
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

    // Pass packaged data up to the parent component / backend submission handler
    if (typeof onSubmit === 'function') {
      onSubmit({
        ...formData,
        gpa: gwa,
        gwaScale,
        isMinor,
        age: calculatedAge
      });
    } else {
      console.error('onSubmit prop is missing or not a function');
      setError('Submission handler is not connected.');
    }
  };

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

      <form onSubmit={handleSubmitForm} className="space-y-5">
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
            <label className="block text-xs font-bold text-app-text mb-1">Academic Level</label>
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
              {formData.academicLevel === 'Senior High School' ? 'Grade Level' : formData.academicLevel === 'Graduate Studies' ? 'Program Level' : 'Year Level'}
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
              <option value="">Select Region</option>
              {REGIONS.map((region) => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text mb-1">Province</label>
            <select
              name="province"
              value={formData.province}
              onChange={handleChange}
              required
              disabled={!formData.region}
              className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-none cursor-pointer disabled:opacity-50"
            >
              <option value="">Select Province</option>
              {availableProvinces.map((prov) => (
                <option key={prov} value={prov}>{prov}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-app-text mb-1">Municipality / City</label>
            <select
              name="municipality"
              value={formData.municipality}
              onChange={handleChange}
              required
              disabled={!formData.province}
              className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-none cursor-pointer disabled:opacity-50"
            >
              <option value="">Select Municipality / City</option>
              {availableMunicipalities.map((mun) => (
                <option key={mun} value={mun}>{mun}</option>
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
          disabled={Boolean(isSubmitting)}
          className="w-full mt-4 py-3 bg-primary text-white hover:bg-primary/90 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span>{isMinor ? 'Submit & Send Guardian Email' : 'Activate Profile & Verify Email'}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default OnboardingForm;