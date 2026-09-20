import React, { useEffect, useMemo, useState } from 'react';
import {
  User,
  BookOpen,
  Wallet,
  MapPin,
  ShieldCheck,
  Save,
  Pencil,
  CheckCircle2,
  AlertCircle,
  Mail,
  Phone,
  GraduationCap,
  Loader2,
  MapPinned,
  HeartHandshake,
  X,
} from 'lucide-react';

import { useAuth } from "../../context/AuthContext";

/*
|--------------------------------------------------------------------------
| Local Storage
|--------------------------------------------------------------------------
| This allows the profile UI to work even while the student profile API
| is still being developed.
*/
const PROFILE_STORAGE_KEY = 'iskolar_student_profile';

/*
|--------------------------------------------------------------------------
| Default Student Profile
|--------------------------------------------------------------------------
*/
const DEFAULT_PROFILE = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',

  academic: {
    university: '',
    course: '',
    yearLevel: '',
    gwa: '',
    academicStatus: 'Regular Student',
  },

  financial: {
    incomeBracket: '',
    householdIncome: '',
  },

  location: {
    region: '',
    province: '',
    municipality: '',
  },

  eligibility: {
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

/*
|--------------------------------------------------------------------------
| Test Data
|--------------------------------------------------------------------------
| Used only when there is no saved profile yet.
*/
const TEST_PROFILE = {
  firstName: 'Juan',
  lastName: 'Dela Cruz',
  email: 'juan.delacruz@camsur.edu.ph',
  phone: '09171234567',

  academic: {
    university: 'Mapúa Malayan Digital College',
    course: 'BS Information Technology',
    yearLevel: '3rd Year',
    gwa: '1.25',
    academicStatus: 'Regular Student',
  },

  financial: {
    incomeBracket: '₱10,001 - ₱20,000',
    householdIncome: '15000',
  },

  location: {
    region: 'Region V - Bicol Region',
    province: 'Camarines Sur',
    municipality: 'Pili',
  },

  eligibility: {
    isIP: false,
    isPWD: false,
    isSoloParentDependent: false,
    isOrphan: false,
    isFarmerFisherfolkChild: true,
    isDisasterAffected: true,
    isWorkingStudent: false,
    is4PsBeneficiary: true,
  },
};

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function mergeProfile(base, incoming = {}) {
  return {
    ...base,
    ...incoming,

    academic: {
      ...base.academic,
      ...(incoming.academic || {}),
    },

    financial: {
      ...base.financial,
      ...(incoming.financial || {}),
    },

    location: {
      ...base.location,
      ...(incoming.location || {}),
    },

    eligibility: {
      ...base.eligibility,
      ...(incoming.eligibility || {}),
    },
  };
}

function getInitials(profile) {
  const first = profile?.firstName?.trim()?.[0] || '';
  const last = profile?.lastName?.trim()?.[0] || '';

  return `${first}${last}`.toUpperCase() || 'ST';
}

function calculateProfileCompletion(profile) {
  const fields = [
    profile.firstName,
    profile.lastName,
    profile.email,
    profile.phone,

    profile.academic?.university,
    profile.academic?.course,
    profile.academic?.yearLevel,
    profile.academic?.gwa,

    profile.financial?.incomeBracket,

    profile.location?.region,
    profile.location?.province,
    profile.location?.municipality,
  ];

  const completed = fields.filter(
    (field) => field !== undefined && field !== null && String(field).trim() !== ''
  ).length;

  return Math.round((completed / fields.length) * 100);
}

/*
|--------------------------------------------------------------------------
| Component
|--------------------------------------------------------------------------
*/

export default function StudentProfile() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('personal');

  const [profile, setProfile] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isUsingLocalStorage, setIsUsingLocalStorage] = useState(false);

  /*
  |--------------------------------------------------------------------------
  | Load Student Profile
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      setIsLoading(true);

      try {
        /*
        |--------------------------------------------------------------------------
        | 1. Try local profile first
        |--------------------------------------------------------------------------
        */

        const savedProfile = localStorage.getItem(PROFILE_STORAGE_KEY);

        if (savedProfile) {
          const parsedProfile = JSON.parse(savedProfile);

          if (mounted) {
            setProfile(mergeProfile(DEFAULT_PROFILE, parsedProfile));
            setIsUsingLocalStorage(true);
            setIsLoading(false);
          }

          return;
        }

        /*
        |--------------------------------------------------------------------------
        | 2. Build profile from logged-in account
        |--------------------------------------------------------------------------
        */

        const accountProfile = mergeProfile(TEST_PROFILE, {
          email: user?.email || TEST_PROFILE.email,
        });

        /*
        |--------------------------------------------------------------------------
        | 3. Try backend API
        |--------------------------------------------------------------------------
        */

        const token = localStorage.getItem('token');

        if (token) {
          try {
            const response = await fetch('/api/v1/students/profile', {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (response.ok) {
              const data = await response.json();

              const backendProfile = data?.profile || data?.data || data;

              if (
                backendProfile &&
                typeof backendProfile === 'object' &&
                !Array.isArray(backendProfile)
              ) {
                if (mounted) {
                  setProfile(
                    mergeProfile(accountProfile, backendProfile)
                  );
                  setIsUsingLocalStorage(false);
                  setIsLoading(false);
                }

                return;
              }
            }
          } catch (apiError) {
            console.warn(
              'Student profile API is not available yet.',
              apiError
            );
          }
        }

        /*
        |--------------------------------------------------------------------------
        | 4. Fallback to local test profile
        |--------------------------------------------------------------------------
        */

        if (mounted) {
          setProfile(accountProfile);
          setIsUsingLocalStorage(true);
        }
      } catch (error) {
        console.error('Failed to load student profile:', error);

        if (mounted) {
          setProfile(
            mergeProfile(TEST_PROFILE, {
              email: user?.email || TEST_PROFILE.email,
            })
          );

          setIsUsingLocalStorage(true);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [user]);

  /*
  |--------------------------------------------------------------------------
  | Profile Completion
  |--------------------------------------------------------------------------
  */

  const profileCompletion = useMemo(() => {
    if (!profile) return 0;

    return calculateProfileCompletion(profile);
  }, [profile]);

  /*
  |--------------------------------------------------------------------------
  | Input Handler
  |--------------------------------------------------------------------------
  */

  const handleChange = (section, field, value) => {
    setProfile((previous) => {
      if (!previous) return previous;

      if (!section) {
        return {
          ...previous,
          [field]: value,
        };
      }

      return {
        ...previous,
        [section]: {
          ...previous[section],
          [field]: value,
        },
      };
    });

    setSaveSuccess(false);
    setSaveError('');
  };

  /*
  |--------------------------------------------------------------------------
  | Checkbox Handler
  |--------------------------------------------------------------------------
  */

  const handleEligibilityChange = (field) => {
    setProfile((previous) => ({
      ...previous,
      eligibility: {
        ...previous.eligibility,
        [field]: !previous.eligibility[field],
      },
    }));

    setSaveSuccess(false);
    setSaveError('');
  };

  /*
  |--------------------------------------------------------------------------
  | Save Profile
  |--------------------------------------------------------------------------
  */

  const handleSave = async (event) => {
    if (event) {
      event.preventDefault();
    }

    if (!profile) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError('');

    try {
      const token = localStorage.getItem('token');

      let savedToBackend = false;

      /*
      |--------------------------------------------------------------------------
      | Try Backend
      |--------------------------------------------------------------------------
      */

      if (token) {
        try {
          const response = await fetch('/api/v1/students/profile', {
            method: 'PUT',

            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },

            body: JSON.stringify(profile),
          });

          if (response.ok) {
            savedToBackend = true;
          }
        } catch (apiError) {
          console.warn(
            'Student profile API unavailable. Saving locally instead.',
            apiError
          );
        }
      }

      /*
      |--------------------------------------------------------------------------
      | Always save locally as backup
      |--------------------------------------------------------------------------
      */

      localStorage.setItem(
        PROFILE_STORAGE_KEY,
        JSON.stringify(profile)
      );

      setIsUsingLocalStorage(!savedToBackend);
      setIsEditing(false);
      setSaveSuccess(true);

      setTimeout(() => {
        setSaveSuccess(false);
      }, 3500);
    } catch (error) {
      console.error('Failed to save profile:', error);

      setSaveError(
        'Unable to save your profile. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Cancel Editing
  |--------------------------------------------------------------------------
  */

  const handleCancel = () => {
    const savedProfile = localStorage.getItem(PROFILE_STORAGE_KEY);

    if (savedProfile) {
      try {
        setProfile(
          mergeProfile(
            DEFAULT_PROFILE,
            JSON.parse(savedProfile)
          )
        );
      } catch (error) {
        console.error(error);
      }
    }

    setIsEditing(false);
    setSaveError('');
  };

  /*
  |--------------------------------------------------------------------------
  | Tabs
  |--------------------------------------------------------------------------
  */

  const tabs = [
    {
      id: 'personal',
      label: 'Personal Information',
      icon: User,
    },
    {
      id: 'academic',
      label: 'Academic Information',
      icon: BookOpen,
    },
    {
      id: 'financial',
      label: 'Financial Information',
      icon: Wallet,
    },
    {
      id: 'location',
      label: 'Location',
      icon: MapPin,
    },
    {
      id: 'eligibility',
      label: 'Eligibility',
      icon: ShieldCheck,
    },
  ];

  /*
  |--------------------------------------------------------------------------
  | Eligibility Options
  |--------------------------------------------------------------------------
  */

  const eligibilityOptions = [
    {
      key: 'isIP',
      label: 'Indigenous Peoples (IP)',
      description:
        'Member of a recognized Indigenous Cultural Community.',
    },

    {
      key: 'isPWD',
      label: 'Person with Disability (PWD)',
      description:
        'Student with a valid PWD identification.',
    },

    {
      key: 'isSoloParentDependent',
      label: 'Solo Parent Dependent',
      description:
        'Child or dependent of a registered solo parent.',
    },

    {
      key: 'isOrphan',
      label: 'Orphan Status',
      description:
        'Student who has lost one or both parents.',
    },

    {
      key: 'isFarmerFisherfolkChild',
      label: 'Child of Farmer / Fisherfolk',
      description:
        'Student whose parent or household earner is a farmer or fisherfolk.',
    },

    {
      key: 'isDisasterAffected',
      label: 'Disaster-Affected Family',
      description:
        'Family affected by a declared disaster or state of calamity.',
    },

    {
      key: 'isWorkingStudent',
      label: 'Working Student',
      description:
        'Student currently working while studying.',
    },

    {
      key: 'is4PsBeneficiary',
      label: '4Ps Beneficiary',
      description:
        'Registered member or dependent of Pantawid Pamilyang Pilipino Program.',
    },
  ];

  /*
  |--------------------------------------------------------------------------
  | Loading
  |--------------------------------------------------------------------------
  */

  if (isLoading || !profile) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />

        <p className="text-sm font-semibold text-slate-600">
          Loading your profile...
        </p>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | UI
  |--------------------------------------------------------------------------
  */

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-6">

      {/* ================================================================
          TOP INFORMATION
      ================================================================= */}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">

          <div className="flex items-center gap-4">

            {/* Avatar */}

            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xl font-black shadow-md">
              {getInitials(profile)}
            </div>

            {/* Name */}

            <div>

              <div className="flex flex-wrap items-center gap-2">

                <h1 className="text-xl font-black text-slate-900">
                  {profile.firstName || 'Student'}{' '}
                  {profile.lastName || ''}
                </h1>

                <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">
                  Student
                </span>

              </div>

              <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />

                {profile.academic?.course ||
                  'Course not yet provided'}
              </p>

            </div>

          </div>

          {/* Completion */}

          <div className="min-w-[240px]">

            <div className="flex justify-between mb-2">

              <span className="text-xs font-bold text-slate-600">
                Profile Completion
              </span>

              <span className="text-xs font-black text-blue-600">
                {profileCompletion}%
              </span>

            </div>

            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">

              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-500"
                style={{
                  width: `${profileCompletion}%`,
                }}
              />

            </div>

          </div>

        </div>

      </div>

      {/* ================================================================
          LOCAL MODE NOTICE
      ================================================================= */}

      {isUsingLocalStorage && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">

          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />

          <div>

            <p className="text-sm font-bold text-amber-800">
              Student profile API is not connected yet
            </p>

            <p className="text-xs text-amber-700 mt-1">
              Your profile changes are currently saved in your
              browser so you can continue testing the student-facing
              experience.
            </p>

          </div>

        </div>
      )}

      {/* ================================================================
          SAVE SUCCESS
      ================================================================= */}

      {saveSuccess && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">

          <CheckCircle2 className="w-5 h-5 text-emerald-600" />

          <div>

            <p className="text-sm font-bold text-emerald-800">
              Profile updated successfully!
            </p>

            <p className="text-xs text-emerald-700">
              Your updated information is now displayed.
            </p>

          </div>

        </div>
      )}

      {/* ================================================================
          SAVE ERROR
      ================================================================= */}

      {saveError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">

          <AlertCircle className="w-5 h-5 text-red-600" />

          <p className="text-sm font-semibold text-red-700">
            {saveError}
          </p>

        </div>
      )}

      {/* ================================================================
          PROFILE CARD
      ================================================================= */}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

        {/* Header */}

        <div className="p-6 border-b border-slate-200">

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

            <div>

              <h2 className="text-lg font-black text-slate-900">
                Student Profile
              </h2>

              <p className="text-xs text-slate-500 mt-1">
                Keep your information updated so scholarships can
                be matched accurately to your profile.
              </p>

            </div>

            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Edit Profile
              </button>
            ) : (
              <div className="flex gap-2">

                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>

              </div>
            )}

          </div>

        </div>

        {/* ================================================================
            TABS
        ================================================================= */}

        <div className="px-4 pt-4 overflow-x-auto">

          <div className="flex gap-2 min-w-max">

            {tabs.map((tab) => {

              const Icon = tab.icon;

              const active = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2
                    px-4 py-2.5
                    rounded-xl
                    text-xs font-bold
                    transition-all
                    whitespace-nowrap
                    ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />

                  {tab.label}
                </button>
              );
            })}

          </div>

        </div>

        {/* ================================================================
            FORM
        ================================================================= */}

        <form
          onSubmit={handleSave}
          className="p-6"
        >

          {/* ============================================================
              PERSONAL INFORMATION
          ============================================================ */}

          {activeTab === 'personal' && (
            <div className="space-y-6">

              <SectionTitle
                icon={User}
                title="Personal Information"
                description="Basic information associated with your student account."
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                <InputField
                  label="First Name"
                  value={profile.firstName}
                  disabled={!isEditing}
                  onChange={(value) =>
                    handleChange(null, 'firstName', value)
                  }
                  placeholder="Juan"
                />

                <InputField
                  label="Last Name"
                  value={profile.lastName}
                  disabled={!isEditing}
                  onChange={(value) =>
                    handleChange(null, 'lastName', value)
                  }
                  placeholder="Dela Cruz"
                />

                <InputField
                  label="Email Address"
                  type="email"
                  value={profile.email}
                  disabled={true}
                  onChange={(value) =>
                    handleChange(null, 'email', value)
                  }
                  icon={Mail}
                  placeholder="student@example.com"
                />

                <InputField
                  label="Phone Number"
                  value={profile.phone}
                  disabled={!isEditing}
                  onChange={(value) =>
                    handleChange(null, 'phone', value)
                  }
                  icon={Phone}
                  placeholder="09XXXXXXXXX"
                />

              </div>

              <InfoBox>
                Your email address is linked to your account and
                cannot be changed from this page.
              </InfoBox>

            </div>
          )}

          {/* ============================================================
              ACADEMIC INFORMATION
          ============================================================ */}

          {activeTab === 'academic' && (
            <div className="space-y-6">

              <SectionTitle
                icon={BookOpen}
                title="Academic Information"
                description="Your academic details are used to determine scholarship eligibility."
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                <InputField
                  label="University / School"
                  value={profile.academic?.university}
                  disabled={!isEditing}
                  onChange={(value) =>
                    handleChange(
                      'academic',
                      'university',
                      value
                    )
                  }
                  placeholder="Enter your school"
                />

                <InputField
                  label="Course / Program"
                  value={profile.academic?.course}
                  disabled={!isEditing}
                  onChange={(value) =>
                    handleChange(
                      'academic',
                      'course',
                      value
                    )
                  }
                  placeholder="BS Information Technology"
                />

                <SelectField
                  label="Year Level"
                  value={profile.academic?.yearLevel}
                  disabled={!isEditing}
                  onChange={(value) =>
                    handleChange(
                      'academic',
                      'yearLevel',
                      value
                    )
                  }
                  options={[
                    '1st Year',
                    '2nd Year',
                    '3rd Year',
                    '4th Year',
                    '5th Year',
                    'Postgraduate',
                  ]}
                />

                <InputField
                  label="Current GWA / GPA"
                  value={profile.academic?.gwa}
                  disabled={!isEditing}
                  onChange={(value) =>
                    handleChange(
                      'academic',
                      'gwa',
                      value
                    )
                  }
                  placeholder="Example: 1.50"
                />

                <SelectField
                  label="Academic Status"
                  value={profile.academic?.academicStatus}
                  disabled={!isEditing}
                  onChange={(value) =>
                    handleChange(
                      'academic',
                      'academicStatus',
                      value
                    )
                  }
                  options={[
                    'Regular Student',
                    'Irregular Student',
                    'Transferee',
                    'Returning Student',
                  ]}
                />

              </div>

            </div>
          )}

          {/* ============================================================
              FINANCIAL INFORMATION
          ============================================================ */}

          {activeTab === 'financial' && (
            <div className="space-y-6">

              <SectionTitle
                icon={Wallet}
                title="Financial Information"
                description="Financial information helps the matching engine identify scholarships intended for specific income groups."
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                <SelectField
                  label="Household Monthly Income Bracket"
                  value={profile.financial?.incomeBracket}
                  disabled={!isEditing}
                  onChange={(value) =>
                    handleChange(
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
                />

                <InputField
                  label="Estimated Monthly Household Income"
                  type="number"
                  value={profile.financial?.householdIncome}
                  disabled={!isEditing}
                  onChange={(value) =>
                    handleChange(
                      'financial',
                      'householdIncome',
                      value
                    )
                  }
                  placeholder="Example: 15000"
                />

              </div>

              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">

                <div className="flex items-start gap-3">

                  <HeartHandshake className="w-5 h-5 text-blue-600 shrink-0" />

                  <div>

                    <p className="text-sm font-bold text-blue-900">
                      Why do we ask for this?
                    </p>

                    <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                      Some scholarships prioritize students from
                      specific household income brackets. This
                      information helps ISKOLARMATCH identify
                      potentially relevant opportunities.

                    </p>

                  </div>

                </div>

              </div>

            </div>
          )}

          {/* ============================================================
              LOCATION
          ============================================================ */}

          {activeTab === 'location' && (
            <div className="space-y-6">

              <SectionTitle
                icon={MapPin}
                title="Location"
                description="Your location may affect eligibility for regional, provincial, municipal, or local scholarships."
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                <InputField
                  label="Region"
                  value={profile.location?.region}
                  disabled={!isEditing}
                  onChange={(value) =>
                    handleChange(
                      'location',
                      'region',
                      value
                    )
                  }
                  placeholder="Example: Region VI - Western Visayas"
                  icon={MapPinned}
                />

                <InputField
                  label="Province"
                  value={profile.location?.province}
                  disabled={!isEditing}
                  onChange={(value) =>
                    handleChange(
                      'location',
                      'province',
                      value
                    )
                  }
                  placeholder="Example: Negros Occidental"
                />

                <InputField
                  label="Municipality / City"
                  value={profile.location?.municipality}
                  disabled={!isEditing}
                  onChange={(value) =>
                    handleChange(
                      'location',
                      'municipality',
                      value
                    )
                  }
                  placeholder="Example: Bago City"
                />

              </div>

            </div>
          )}

          {/* ============================================================
              ELIGIBILITY
          ============================================================ */}

          {activeTab === 'eligibility' && (
            <div className="space-y-6">

              <SectionTitle
                icon={ShieldCheck}
                title="Eligibility Information"
                description="Select the conditions that apply to you. These are used by the scholarship matching engine."
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {eligibilityOptions.map((option) => {

                  const checked =
                    profile.eligibility?.[option.key] || false;

                  return (
                    <label
                      key={option.key}
                      className={`
                        flex items-start gap-3
                        p-4
                        rounded-xl
                        border
                        cursor-pointer
                        transition-all
                        ${
                          checked
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }
                        ${
                          !isEditing
                            ? 'cursor-default'
                            : ''
                        }
                      `}
                    >

                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!isEditing}
                        onChange={() =>
                          handleEligibilityChange(
                            option.key
                          )
                        }
                        className="mt-1 w-4 h-4 accent-blue-600"
                      />

                      <div>

                        <p className="text-sm font-bold text-slate-800">
                          {option.label}
                        </p>

                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          {option.description}
                        </p>

                      </div>

                    </label>
                  );
                })}

              </div>

              <InfoBox>
                Only select eligibility conditions that accurately
                describe your current situation. Scholarship
                providers may require supporting documents during
                their application process.
              </InfoBox>

            </div>
          )}

        </form>

      </div>

      {/* ================================================================
          PROFILE SUMMARY
      ================================================================= */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <SummaryCard
          icon={GraduationCap}
          title="Academic"
          value={
            profile.academic?.course ||
            'Not provided'
          }
          description={
            profile.academic?.yearLevel ||
            'Year level not provided'
          }
        />

        <SummaryCard
          icon={Wallet}
          title="Financial"
          value={
            profile.financial?.incomeBracket ||
            'Not provided'
          }
          description="Income bracket"
        />

        <SummaryCard
          icon={MapPin}
          title="Location"
          value={
            profile.location?.municipality ||
            'Not provided'
          }
          description={
            profile.location?.province ||
            'Province not provided'
          }
        />

      </div>

    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Reusable Components
|--------------------------------------------------------------------------
*/

function SectionTitle({
  icon: Icon,
  title,
  description,
}) {
  return (
    <div className="flex items-start gap-3">

      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </div>

      <div>

        <h3 className="text-base font-black text-slate-900">
          {title}
        </h3>

        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          {description}
        </p>

      </div>

    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  type = 'text',
  icon: Icon,
}) {
  return (
    <div>

      <label className="block text-xs font-bold text-slate-700 mb-2">
        {label}
      </label>

      <div className="relative">

        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        )}

        <input
          type={type}
          value={value || ''}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className={`
            w-full
            px-3.5
            py-3
            rounded-xl
            border
            text-sm
            outline-none
            transition-all
            ${
              Icon
                ? 'pl-10'
                : ''
            }
            ${
              disabled
                ? 'bg-slate-50 border-slate-200 text-slate-600 cursor-not-allowed'
                : 'bg-white border-slate-300 text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
            }
          `}
        />

      </div>

    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  disabled,
  options,
}) {
  return (
    <div>

      <label className="block text-xs font-bold text-slate-700 mb-2">
        {label}
      </label>

      <select
        value={value || ''}
        disabled={disabled}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className={`
          w-full
          px-3.5
          py-3
          rounded-xl
          border
          text-sm
          outline-none
          transition-all
          ${
            disabled
              ? 'bg-slate-50 border-slate-200 text-slate-600 cursor-not-allowed'
              : 'bg-white border-slate-300 text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
          }
        `}
      >

        <option value="">
          Select an option
        </option>

        {options.map((option) => (
          <option
            key={option}
            value={option}
          >
            {option}
          </option>
        ))}

      </select>

    </div>
  );
}

function InfoBox({ children }) {
  return (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">

      <p className="text-xs text-slate-600 leading-relaxed">
        {children}
      </p>

    </div>
  );
}

function SummaryCard({
  icon: Icon,
  title,
  value,
  description,
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

      <div className="flex items-center gap-3">

        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>

        <div className="min-w-0">

          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            {title}
          </p>

          <p className="text-sm font-black text-slate-900 truncate mt-0.5">
            {value}
          </p>

          <p className="text-xs text-slate-500 truncate mt-0.5">
            {description}
          </p>

        </div>

      </div>

    </div>
  );
}