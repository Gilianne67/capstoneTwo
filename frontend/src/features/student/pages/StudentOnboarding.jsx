import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  GraduationCap,
  Wallet,
  MapPin,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

import { useAuth } from '../../../context/AuthContext';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api/v1';

const initialForm = {
  personal: {
    firstName: '',
    lastName: '',
    phone: '',
    dateOfBirth: '',
  },

  academic: {
    university: '',
    course: '',
    academicLevel: '',
    gwa: '',
    gwaScale: '1.00-5.00',
  },

  financial: {
    incomeBracket: '',
    monthlyFamilyIncome: '',
  },

  location: {
    municipality: '',
    province: '',
    region: '',
  },

  eligibilityFlags: {
    isIP: false,
    isPWD: false,
    isSoloParentDependent: false,
    isOrphan: false,
    isFarmerFisherfolkChild: false,
    isDisasterAffected: false,
    isWorkingStudent: false,
    is4PsBeneficiary: false,
  },
};

const steps = [
  {
    id: 0,
    title: 'Personal',
    icon: User,
  },
  {
    id: 1,
    title: 'Academic',
    icon: GraduationCap,
  },
  {
    id: 2,
    title: 'Financial',
    icon: Wallet,
  },
  {
    id: 3,
    title: 'Location',
    icon: MapPin,
  },
  {
    id: 4,
    title: 'Eligibility',
    icon: ShieldCheck,
  },
];

export default function StudentOnboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState(initialForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const updateField = (section, field, value) => {
    setError('');

    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const updateEligibility = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      eligibilityFlags: {
        ...prev.eligibilityFlags,
        [field]: value,
      },
    }));
  };

  const validateStep = () => {
    if (step === 0) {
      const { firstName, lastName, dateOfBirth } =
        formData.personal;

      if (!firstName || !lastName || !dateOfBirth) {
        setError(
          'Please complete your personal information.'
        );
        return false;
      }
    }

    if (step === 1) {
      const {
        university,
        course,
        academicLevel,
        gwa,
      } = formData.academic;

      if (
        !university ||
        !course ||
        !academicLevel ||
        !gwa
      ) {
        setError(
          'Please complete your academic information.'
        );
        return false;
      }

      const gwaNumber = Number(gwa);

      if (Number.isNaN(gwaNumber)) {
        setError('GWA must be a valid number.');
        return false;
      }
    }

    if (step === 2) {
      if (!formData.financial.incomeBracket) {
        setError(
          'Please select your family income bracket.'
        );
        return false;
      }
    }

    if (step === 3) {
      const {
        municipality,
        province,
        region,
      } = formData.location;

      if (!municipality || !province || !region) {
        setError(
          'Please complete your location information.'
        );
        return false;
      }
    }

    return true;
  };

  const nextStep = () => {
    if (!validateStep()) return;

    setError('');

    if (step < steps.length - 1) {
      setStep((current) => current + 1);
    }
  };

  const previousStep = () => {
    setError('');

    if (step > 0) {
      setStep((current) => current - 1);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateStep()) return;

    setSaving(true);
    setError('');

    try {
      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error(
          'Your session has expired. Please login again.'
        );
      }

      const payload = {
        ...formData,

        academic: {
          ...formData.academic,
          gwa: Number(formData.academic.gwa),
        },

        financial: {
          ...formData.financial,
          monthlyFamilyIncome: Number(
            formData.financial.monthlyFamilyIncome || 0
          ),
        },
      };

      const response = await fetch(
        `${API_BASE_URL}/students/profile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            'Unable to save your student profile.'
        );
      }

      navigate('/dashboard/student');
    } catch (err) {
      setError(
        err.message ||
          'Something went wrong while saving your profile.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <p className="text-sm font-bold text-blue-600">
            Welcome to ISKOLARMATCH
          </p>

          <h1 className="text-3xl font-black text-slate-900 mt-1">
            Complete Your Student Profile
          </h1>

          <p className="text-sm text-slate-500 mt-2">
            Hi {user?.name?.split(' ')[0] || 'Student'}!
            Tell us about yourself so we can find
            scholarships that match your profile.
          </p>
        </div>

        {/* Progress */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
          <div className="flex items-center justify-between gap-2">
            {steps.map((item, index) => {
              const Icon = item.icon;

              const active = index === step;
              const completed = index < step;

              return (
                <React.Fragment key={item.id}>
                  <div className="flex flex-col items-center gap-2 min-w-0">
                    <div
                      className={`
                        w-10 h-10 rounded-full
                        flex items-center justify-center
                        font-bold
                        ${
                          active
                            ? 'bg-blue-600 text-white'
                            : completed
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-400'
                        }
                      `}
                    >
                      {completed ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>

                    <span
                      className={`
                        text-[11px] font-bold
                        ${
                          active
                            ? 'text-blue-600'
                            : 'text-slate-500'
                        }
                      `}
                    >
                      {item.title}
                    </span>
                  </div>

                  {index < steps.length - 1 && (
                    <div className="h-px bg-slate-200 flex-1 mb-6" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 md:p-8"
        >
          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          {/* PERSONAL */}
          {step === 0 && (
            <section>
              <h2 className="text-xl font-black text-slate-900">
                Personal Information
              </h2>

              <p className="text-sm text-slate-500 mb-6">
                Tell us some basic information about yourself.
              </p>

              <div className="grid md:grid-cols-2 gap-5">

                <Field
                  label="First Name"
                  value={formData.personal.firstName}
                  onChange={(value) =>
                    updateField(
                      'personal',
                      'firstName',
                      value
                    )
                  }
                  required
                />

                <Field
                  label="Last Name"
                  value={formData.personal.lastName}
                  onChange={(value) =>
                    updateField(
                      'personal',
                      'lastName',
                      value
                    )
                  }
                  required
                />

                <Field
                  label="Contact Number"
                  value={formData.personal.phone}
                  onChange={(value) =>
                    updateField(
                      'personal',
                      'phone',
                      value
                    )
                  }
                  placeholder="09XXXXXXXXX"
                />

                <Field
                  label="Date of Birth"
                  type="date"
                  value={formData.personal.dateOfBirth}
                  onChange={(value) =>
                    updateField(
                      'personal',
                      'dateOfBirth',
                      value
                    )
                  }
                  required
                />
              </div>
            </section>
          )}

          {/* ACADEMIC */}
          {step === 1 && (
            <section>
              <h2 className="text-xl font-black text-slate-900">
                Academic Information
              </h2>

              <p className="text-sm text-slate-500 mb-6">
                This information helps us match you with
                academic scholarships.
              </p>

              <div className="grid md:grid-cols-2 gap-5">

                <Field
                  label="University / School"
                  value={formData.academic.university}
                  onChange={(value) =>
                    updateField(
                      'academic',
                      'university',
                      value
                    )
                  }
                  required
                />

                <Field
                  label="Course / Program"
                  value={formData.academic.course}
                  onChange={(value) =>
                    updateField(
                      'academic',
                      'course',
                      value
                    )
                  }
                  required
                />

                <SelectField
                  label="Academic Level"
                  value={formData.academic.academicLevel}
                  onChange={(value) =>
                    updateField(
                      'academic',
                      'academicLevel',
                      value
                    )
                  }
                  options={[
                    'Senior High School',
                    '1st Year College',
                    '2nd Year College',
                    '3rd Year College',
                    '4th Year College',
                    'Graduate School',
                  ]}
                  required
                />

                <SelectField
                  label="GWA Scale"
                  value={formData.academic.gwaScale}
                  onChange={(value) =>
                    updateField(
                      'academic',
                      'gwaScale',
                      value
                    )
                  }
                  options={[
                    '1.00-5.00',
                    '60-100',
                  ]}
                />

                <Field
                  label="Current GWA"
                  type="number"
                  step="0.01"
                  value={formData.academic.gwa}
                  onChange={(value) =>
                    updateField(
                      'academic',
                      'gwa',
                      value
                    )
                  }
                  required
                />
              </div>
            </section>
          )}

          {/* FINANCIAL */}
          {step === 2 && (
            <section>
              <h2 className="text-xl font-black text-slate-900">
                Financial Information
              </h2>

              <p className="text-sm text-slate-500 mb-6">
                Your financial information helps determine
                eligibility for need-based scholarships.
              </p>

              <div className="grid md:grid-cols-2 gap-5">

                <SelectField
                  label="Monthly Family Income"
                  value={formData.financial.incomeBracket}
                  onChange={(value) =>
                    updateField(
                      'financial',
                      'incomeBracket',
                      value
                    )
                  }
                  options={[
                    'Below ₱10,000',
                    '₱10,001 - ₱20,000',
                    '₱20,001 - ₱40,000',
                    'Above ₱40,000',
                  ]}
                  required
                />

                <Field
                  label="Estimated Monthly Family Income"
                  type="number"
                  value={
                    formData.financial
                      .monthlyFamilyIncome
                  }
                  onChange={(value) =>
                    updateField(
                      'financial',
                      'monthlyFamilyIncome',
                      value
                    )
                  }
                  placeholder="Optional"
                />
              </div>
            </section>
          )}

          {/* LOCATION */}
          {step === 3 && (
            <section>
              <h2 className="text-xl font-black text-slate-900">
                Location
              </h2>

              <p className="text-sm text-slate-500 mb-6">
                Location is used for scholarships with
                regional, provincial, or city-based
                eligibility.
              </p>

              <div className="grid md:grid-cols-2 gap-5">

                <Field
                  label="Municipality / City"
                  value={
                    formData.location.municipality
                  }
                  onChange={(value) =>
                    updateField(
                      'location',
                      'municipality',
                      value
                    )
                  }
                  required
                />

                <Field
                  label="Province"
                  value={formData.location.province}
                  onChange={(value) =>
                    updateField(
                      'location',
                      'province',
                      value
                    )
                  }
                  required
                />

                <Field
                  label="Region"
                  value={formData.location.region}
                  onChange={(value) =>
                    updateField(
                      'location',
                      'region',
                      value
                    )
                  }
                  required
                />
              </div>
            </section>
          )}

          {/* ELIGIBILITY */}
          {step === 4 && (
            <section>
              <h2 className="text-xl font-black text-slate-900">
                Eligibility & Special Circumstances
              </h2>

              <p className="text-sm text-slate-500 mb-6">
                Select all that apply to you. These
                details help us identify scholarships with
                specific eligibility requirements.
              </p>

              <div className="grid md:grid-cols-2 gap-4">

                <Eligibility
                  label="Indigenous Peoples (IP)"
                  checked={formData.eligibilityFlags.isIP}
                  onChange={(value) =>
                    updateEligibility('isIP', value)
                  }
                />

                <Eligibility
                  label="Person with Disability (PWD)"
                  checked={formData.eligibilityFlags.isPWD}
                  onChange={(value) =>
                    updateEligibility('isPWD', value)
                  }
                />

                <Eligibility
                  label="Solo Parent Dependent"
                  checked={
                    formData.eligibilityFlags
                      .isSoloParentDependent
                  }
                  onChange={(value) =>
                    updateEligibility(
                      'isSoloParentDependent',
                      value
                    )
                  }
                />

                <Eligibility
                  label="Orphan"
                  checked={
                    formData.eligibilityFlags.isOrphan
                  }
                  onChange={(value) =>
                    updateEligibility(
                      'isOrphan',
                      value
                    )
                  }
                />

                <Eligibility
                  label="Child of Farmer / Fisherfolk"
                  checked={
                    formData.eligibilityFlags
                      .isFarmerFisherfolkChild
                  }
                  onChange={(value) =>
                    updateEligibility(
                      'isFarmerFisherfolkChild',
                      value
                    )
                  }
                />

                <Eligibility
                  label="Disaster-Affected Family"
                  checked={
                    formData.eligibilityFlags
                      .isDisasterAffected
                  }
                  onChange={(value) =>
                    updateEligibility(
                      'isDisasterAffected',
                      value
                    )
                  }
                />

                <Eligibility
                  label="Working Student"
                  checked={
                    formData.eligibilityFlags
                      .isWorkingStudent
                  }
                  onChange={(value) =>
                    updateEligibility(
                      'isWorkingStudent',
                      value
                    )
                  }
                />

                <Eligibility
                  label="4Ps Beneficiary"
                  checked={
                    formData.eligibilityFlags
                      .is4PsBeneficiary
                  }
                  onChange={(value) =>
                    updateEligibility(
                      'is4PsBeneficiary',
                      value
                    )
                  }
                />
              </div>
            </section>
          )}

          {/* Buttons */}
          <div className="flex justify-between mt-10 pt-6 border-t border-slate-200">

            <button
              type="button"
              onClick={previousStep}
              disabled={step === 0 || saving}
              className="px-5 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 disabled:opacity-40"
            >
              <span className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back
              </span>
            </button>

            {step < steps.length - 1 ? (
              <button
                type="button"
                onClick={nextStep}
                className="px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700"
              >
                <span className="flex items-center gap-2">
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Complete Profile
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  required = false,
  step,
}) {
  return (
    <div>
      <label className="block text-sm font-bold text-slate-700 mb-2">
        {label}
        {required && (
          <span className="text-red-500 ml-1">*</span>
        )}
      </label>

      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        step={step}
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required = false,
}) {
  return (
    <div>
      <label className="block text-sm font-bold text-slate-700 mb-2">
        {label}
        {required && (
          <span className="text-red-500 ml-1">*</span>
        )}
      </label>

      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        <option value="">Select...</option>

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function Eligibility({
  label,
  checked,
  onChange,
}) {
  return (
    <label
      className={`
        flex items-center gap-3 p-4 rounded-xl
        border cursor-pointer transition
        ${
          checked
            ? 'border-blue-400 bg-blue-50'
            : 'border-slate-200 bg-white hover:bg-slate-50'
        }
      `}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) =>
          onChange(e.target.checked)
        }
        className="w-5 h-5 accent-blue-600"
      />

      <span className="text-sm font-bold text-slate-700">
        {label}
      </span>
    </label>
  );
}