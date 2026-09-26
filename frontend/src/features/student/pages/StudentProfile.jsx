import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  BookOpen,
  Wallet,
  Save,
  CheckCircle2,
  AlertCircle,
  Mail,
  GraduationCap,
  Loader2
} from 'lucide-react';

import {
  REGIONS,
  PROVINCES,
  MUNICIPALITIES
} from '../../../data/locationData';

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'
).replace(/\/$/, '');

const YEAR_LEVELS_BY_ACADEMIC_LEVEL = {
  'Senior High School': ['Grade 11', 'Grade 12'],
  College: ['1st Year', '2nd Year', '3rd Year', '4th Year'],
  'Graduate Studies': ['Masteral', 'Doctoral']
};

const YEAR_LEVEL_LABELS = {
  Masteral: "Master's"
};

const getYearLevelOptions = (academicLevel) =>
  YEAR_LEVELS_BY_ACADEMIC_LEVEL[academicLevel] || [];

const TOUR_STORAGE_KEY = 'studentProfileTourCompleted';
const COMPLETE_CELEBRATED_KEY = 'studentProfileCompleteCelebrated';
const DASHBOARD_ROUTE = '/dashboard/student';

const hasProfileValue = (value) =>
  value !== null &&
  value !== undefined &&
  String(value).trim() !== '';

const getSectionCompletion = (data) => ({
  personal:
    hasProfileValue(data.dateOfBirth) &&
    hasProfileValue(data.citizenship) &&
    hasProfileValue(data.region) &&
    hasProfileValue(data.province) &&
    hasProfileValue(data.municipalityCity),
  academic:
    hasProfileValue(data.academicLevel) &&
    hasProfileValue(data.yearLevel) &&
    hasProfileValue(data.course) &&
    hasProfileValue(data.gwa) &&
    hasProfileValue(data.gwaScale),
  financial: hasProfileValue(data.incomeBracket)
});

const isProfileComplete = (data) => {
  const sections = getSectionCompletion(data);
  return sections.personal && sections.academic && sections.financial;
};

const PROFILE_TOUR_STEPS = [
  {
    tabId: 'academic',
    title: 'Academic Details',
    body: 'Academic information such as your level, year, course, GWA, and GWA scale helps determine scholarship eligibility and matching.'
  },
  {
    tabId: 'financial',
    title: 'Financial Information',
    body: 'Household income is used to identify scholarships with financial requirements that you may qualify for.'
  },
  {
    tabId: 'personal',
    title: 'Location',
    body: 'Your region, province, and municipality help match scholarships available in your area.'
  },
  {
    tabId: 'financial',
    title: 'Eligibility',
    body: 'Special eligibility information can help identify additional scholarship opportunities. These flags are optional, but completing them can improve your matches.'
  }
];

const EMPTY_PROFILE = {
  dateOfBirth: '',
  academicLevel: '',
  yearLevel: '',
  course: '',
  gwa: '',
  gwaScale: '',
  schoolName: '',
  schoolType: '',
  incomeBracket: '',
  region: '',
  province: '',
  municipalityCity: '',
  citizenship: 'Filipino',

  specialEligibilityFlags: {
    isIndigenous: false,
    isPWD: false,
    isSoloParentChild: false,
    isOrphan: false,
    isFarmerFisherfolkChild: false,
    isDisasterAffected: false,
    isWorkingStudent: false,
    is4PsBeneficiary: false
  },

  isMinor: false
};

export default function StudentProfile() {
  const navigate = useNavigate();
  const tourAlreadyDone =
    localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
  const [activeTab, setActiveTab] = useState(
    tourAlreadyDone ? 'personal' : PROFILE_TOUR_STEPS[0].tabId
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [profileExists, setProfileExists] = useState(false);

  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState(EMPTY_PROFILE);

  const [errorMessage, setErrorMessage] = useState('');
  const [isTourOpen, setIsTourOpen] = useState(!tourAlreadyDone);
  const [tourStep, setTourStep] = useState(0);
  const [showCompletePrompt, setShowCompletePrompt] = useState(false);

  /*
   * Get clean JWT token
   */
  const getToken = () => {
    const rawToken = localStorage.getItem('token');

    if (!rawToken) return null;

    return rawToken
      .replace(/^"|"$/g, '')
      .replace(/^Bearer\s+/i, '')
      .trim();
  };

  /*
   * Build authenticated headers
   */
  const getHeaders = () => {
    const token = getToken();

    return {
      'Content-Type': 'application/json',
      ...(token
        ? {
            Authorization: `Bearer ${token}`
          }
        : {})
    };
  };

  /*
   * Safe JSON request
   */
  const safeFetchJson = async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: 'include',
      ...options
    });

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('text/html')) {
      throw new Error(
        `Server returned an HTML response (${response.status}).`
      );
    }

    const data = await response.json();

    return {
      response,
      data
    };
  };

  /*
   * Load user + student profile
   */
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const token = getToken();

        if (!token) {
          throw new Error('You are not logged in.');
        }

        /*
         * ==========================================
         * 1. GET CURRENT USER
         * ==========================================
         */
        const userResult = await safeFetchJson(
          `${API_BASE_URL}/auth/me`,
          {
            method: 'GET',
            headers: getHeaders()
          }
        );

        if (!userResult.response.ok) {
          throw new Error(
            userResult.data.message ||
              'Failed to load account information.'
          );
        }

        const currentUser =
          userResult.data.data ||
          userResult.data.user;

        /*
         * ==========================================
         * 2. GET STUDENT PROFILE
         * ==========================================
         */
        const profileResult = await safeFetchJson(
          `${API_BASE_URL}/students/profile`,
          {
            method: 'GET',
            headers: getHeaders()
          }
        );

        /*
         * A 404 simply means the student hasn't
         * created a profile yet.
         */
        if (profileResult.response.status === 404) {
          if (!isMounted) return;

          setUser(currentUser || null);
          setFormData({
            ...EMPTY_PROFILE,
            specialEligibilityFlags: {
              ...EMPTY_PROFILE.specialEligibilityFlags
            }
          });
          setProfileExists(false);

          return;
        }

        if (!profileResult.response.ok) {
          throw new Error(
            profileResult.data.message ||
              'Failed to load student profile.'
          );
        }

        const existingProfile = profileResult.data.profile;

        if (!isMounted) return;

        setUser(currentUser || null);

        setFormData({
          ...EMPTY_PROFILE,
          ...existingProfile,

          gwa:
            existingProfile?.gwa !== undefined &&
            existingProfile?.gwa !== null
              ? String(existingProfile.gwa)
              : '',

          dateOfBirth: existingProfile?.dateOfBirth
            ? new Date(existingProfile.dateOfBirth)
                .toISOString()
                .split('T')[0]
            : '',

          specialEligibilityFlags: {
            ...EMPTY_PROFILE.specialEligibilityFlags,
            ...(existingProfile?.specialEligibilityFlags || {})
          }
        });

        setProfileExists(true);
      } catch (err) {
        console.error(
          'Student profile loading error:',
          err
        );

        if (isMounted) {
          setErrorMessage(
            err.message ||
              'Failed to load student profile.'
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  /*
   * Handle normal fields
   */
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));

    setSaveSuccess(false);
    setErrorMessage('');
  };

  const handleAcademicLevelChange = (academicLevel) => {
    setFormData((prev) => {
      const validYearLevels = getYearLevelOptions(academicLevel);
      const yearLevel = validYearLevels.includes(prev.yearLevel)
        ? prev.yearLevel
        : '';

      return {
        ...prev,
        academicLevel,
        yearLevel
      };
    });

    setSaveSuccess(false);
    setErrorMessage('');
  };

  /*
   * Handle eligibility flags
   */
  const handleEligibilityChange = (
    field,
    value
  ) => {
    setFormData((prev) => ({
      ...prev,
      specialEligibilityFlags: {
        ...prev.specialEligibilityFlags,
        [field]: value
      }
    }));

    setSaveSuccess(false);
    setErrorMessage('');
  };

  /*
   * Save profile
   */
  const handleSave = async (e) => {
    if (e) e.preventDefault();

    setSaveSuccess(false);
    setErrorMessage('');

    const gwaValue = Number(formData.gwa);

    if (formData.gwa === '' || Number.isNaN(gwaValue)) {
      setErrorMessage('Current GWA is required.');
      return;
    }

    if (!formData.yearLevel) {
      setErrorMessage('Please select a year level.');
      return;
    }

    if (
      !getYearLevelOptions(formData.academicLevel).includes(
        formData.yearLevel
      )
    ) {
      setErrorMessage(
        'Year level must match the selected academic level.'
      );
      return;
    }

    if (!formData.gwaScale) {
      setErrorMessage('Please select a GWA scale.');
      return;
    }

    if (
      formData.gwaScale === '1.00-5.00' &&
      (gwaValue < 1 || gwaValue > 5)
    ) {
      setErrorMessage(
        'GWA must be between 1.00 and 5.00 for the 1.00-5.00 scale.'
      );
      return;
    }

    if (
      formData.gwaScale === '60-100' &&
      (gwaValue < 60 || gwaValue > 100)
    ) {
      setErrorMessage(
        'GWA must be between 60 and 100 for the 60-100 scale.'
      );
      return;
    }

    setIsSaving(true);

    try {
      const token = getToken();

      if (!token) {
        throw new Error('You are not logged in.');
      }

      /*
       * Only send fields supported by
       * StudentProfile schema.
       */
      const payload = {
        dateOfBirth: formData.dateOfBirth,
        academicLevel: formData.academicLevel,
        yearLevel: formData.yearLevel,
        course: formData.course,
        gwa: Number(formData.gwa),
        gwaScale: formData.gwaScale,
        schoolName: formData.schoolName,
        schoolType: formData.schoolType,
        incomeBracket: formData.incomeBracket,
        region: formData.region,
        province: formData.province,
        municipalityCity:
          formData.municipalityCity,
        citizenship: formData.citizenship,

        specialEligibilityFlags: {
          isIndigenous:
            !!formData.specialEligibilityFlags
              .isIndigenous,

          isPWD:
            !!formData.specialEligibilityFlags
              .isPWD,

          isSoloParentChild:
            !!formData.specialEligibilityFlags
              .isSoloParentChild,

          isOrphan:
            !!formData.specialEligibilityFlags
              .isOrphan,

          isFarmerFisherfolkChild:
            !!formData.specialEligibilityFlags
              .isFarmerFisherfolkChild,

          isDisasterAffected:
            !!formData.specialEligibilityFlags
              .isDisasterAffected,

          isWorkingStudent:
            !!formData.specialEligibilityFlags
              .isWorkingStudent,

          is4PsBeneficiary:
            !!formData.specialEligibilityFlags
              .is4PsBeneficiary
        },

        isMinor: !!formData.isMinor
      };

      /*
       * POST = first profile creation
       * PUT  = existing profile update
       */
      const method = profileExists
        ? 'PUT'
        : 'POST';

      const result = await safeFetchJson(
        `${API_BASE_URL}/students/profile`,
        {
          method,
          headers: getHeaders(),
          body: JSON.stringify(payload)
        }
      );

      if (!result.response.ok) {
        throw new Error(
          result.data.message ||
            'Failed to save student profile.'
        );
      }

      /*
       * Update local state with server response
       */
      if (result.data.profile) {
        setFormData((prev) => ({
          ...prev,
          ...result.data.profile,

          gwa:
            result.data.profile.gwa !==
              undefined &&
            result.data.profile.gwa !== null
              ? String(result.data.profile.gwa)
              : prev.gwa,

          dateOfBirth:
            result.data.profile.dateOfBirth
              ? new Date(
                  result.data.profile.dateOfBirth
                )
                  .toISOString()
                  .split('T')[0]
              : prev.dateOfBirth,

          specialEligibilityFlags: {
            ...prev.specialEligibilityFlags,
            ...(result.data.profile
              .specialEligibilityFlags || {})
          }
        }));
      }

      setProfileExists(true);
      setSaveSuccess(true);

      const savedProfile = result.data.profile
        ? {
            ...formData,
            ...result.data.profile,
            gwa:
              result.data.profile.gwa !== undefined &&
              result.data.profile.gwa !== null
                ? String(result.data.profile.gwa)
                : formData.gwa
          }
        : formData;

      if (
        isProfileComplete(savedProfile) &&
        localStorage.getItem(COMPLETE_CELEBRATED_KEY) !== 'true'
      ) {
        localStorage.setItem(COMPLETE_CELEBRATED_KEY, 'true');
        setShowCompletePrompt(true);
      }

      setTimeout(() => {
        setSaveSuccess(false);
      }, 3500);
    } catch (err) {
      console.error(
        'Failed to save profile:',
        err
      );

      setErrorMessage(
        err.message ||
          'Failed to save student profile.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const closeTour = () => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setIsTourOpen(false);
  };

  const goToTourStep = (nextStep) => {
    const step = PROFILE_TOUR_STEPS[nextStep];
    if (!step) {
      closeTour();
      return;
    }

    setTourStep(nextStep);
    setActiveTab(step.tabId);
  };

  const currentTourStep = PROFILE_TOUR_STEPS[tourStep];
  const sectionCompletion = getSectionCompletion(formData);

  const tabs = [
    {
      id: 'personal',
      label: 'Personal Information',
      icon: User
    },
    {
      id: 'academic',
      label: 'Academic Details',
      icon: BookOpen
    },
    {
      id: 'financial',
      label: 'Socioeconomic & Special Flags',
      icon: Wallet
    }
  ];

  const eligibilityFlagsList = [
    {
      key: 'isIndigenous',
      label: 'Indigenous Peoples (IP)',
      description:
        'Member of an officially recognized Indigenous Cultural Community'
    },
    {
      key: 'isPWD',
      label: 'PWD Status',
      description:
        'Person with Disability holding a valid ID'
    },
    {
      key: 'isSoloParentChild',
      label: 'Solo Parent Dependent',
      description:
        'Child or dependent of a registered Solo Parent'
    },
    {
      key: 'isOrphan',
      label: 'Orphan Status',
      description:
        'Student with deceased parent(s)'
    },
    {
      key: 'isFarmerFisherfolkChild',
      label: 'Child of Farmer / Fisherfolk',
      description:
        'Household principal earner is engaged in agriculture or fishing'
    },
    {
      key: 'isDisasterAffected',
      label: 'Disaster-Affected Family',
      description:
        'Family reside in or affected by recent declared state of calamity'
    },
    {
      key: 'isWorkingStudent',
      label: 'Working Student',
      description:
        'Student currently balancing employment and studies'
    },
    {
      key: 'is4PsBeneficiary',
      label: '4Ps Beneficiary',
      description:
        'Registered Pantawid Pamilyang Pilipino Program member'
    }
  ];

  /*
   * Loading
   */
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] gap-3">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />

        <p className="text-xs text-slate-500 font-medium">
          Loading student profile...
        </p>
      </div>
    );
  }

  /*
   * Avatar initials
   *
   * Your User schema has `name`,
   * not firstName/lastName.
   */
  const userName = user?.name || 'Student';

  const nameParts = userName
    .trim()
    .split(/\s+/);

  const initials =
    nameParts.length > 1
      ? `${nameParts[0][0]}${
          nameParts[nameParts.length - 1][0]
        }`
      : nameParts[0]?.[0] || 'S';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">

      {/* ERROR MESSAGE */}
      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 p-3 rounded-xl flex items-center justify-between text-xs font-medium">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />

            {errorMessage}
          </span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">

        <div className="flex items-center gap-4">

          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-md border-2 border-white shrink-0">
            {initials.toUpperCase()}
          </div>

          <div>
            <div className="flex items-center gap-2">

              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                {userName}
              </h1>

              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800">
                {formData.academicLevel ||
                  'Student'}
              </span>

            </div>

            <p className="text-xs font-semibold text-slate-500 mt-0.5 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-slate-400" />

              {formData.course ||
                'Course not yet provided'}

              &bull;

              {formData.schoolName ||
                'School not yet provided'}
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {isSaving ? (
            <>
              <Loader2 className="animate-spin h-4 w-4" />

              Saving Profile...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />

              Save Profile
            </>
          )}
        </button>
      </div>

      {/* SUCCESS */}
      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-xs font-bold animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />

          <span>
            Profile saved successfully!
          </span>
        </div>
      )}

      {/* TABS */}
      <div className="relative">
        {isTourOpen && (
          <div className="fixed inset-0 z-40 bg-slate-900/40" />
        )}

        <div className="relative z-50 flex items-center gap-2 border-b border-slate-200/80 overflow-x-auto pb-1">

        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            activeTab === tab.id;
          const isComplete = sectionCompletion[tab.id];
          const isSpotlighted =
            isTourOpen && currentTourStep?.tabId === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() =>
                setActiveTab(tab.id)
              }
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              } ${
                isSpotlighted
                  ? 'ring-2 ring-offset-2 ring-blue-400'
                  : ''
              }`}
            >
              <Icon className="w-4 h-4" />

              {tab.label}

              {isComplete ? (
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${
                    isActive ? 'text-white' : 'text-emerald-600'
                  }`}
                />
              ) : (
                <AlertCircle
                  className={`w-3.5 h-3.5 ${
                    isActive ? 'text-amber-100' : 'text-amber-500'
                  }`}
                />
              )}
            </button>
          );
        })}

        </div>

        {isTourOpen && currentTourStep && (
          <div className="relative z-50 mt-3 max-w-lg bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xl space-y-3">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600">
              Step {tourStep + 1} of {PROFILE_TOUR_STEPS.length}
            </p>
            <h3 className="text-sm font-extrabold text-slate-900">
              {currentTourStep.title}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {currentTourStep.body}
            </p>
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={closeTour}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Skip
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={tourStep === 0}
                  onClick={() => goToTourStep(tourStep - 1)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  Back
                </button>
                {tourStep < PROFILE_TOUR_STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => goToTourStep(tourStep + 1)}
                    className="px-3 py-1.5 rounded-xl text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={closeTour}
                    className="px-3 py-1.5 rounded-xl text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
                  >
                    Finish
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FORM CONTENT */}
      <form
        onSubmit={handleSave}
        className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6"
      >

        {/* ======================================
            PERSONAL INFORMATION
        ====================================== */}
        {activeTab === 'personal' && (
          <div className="space-y-6">

            <div>
              <h2 className="text-base font-bold text-slate-900">
                Personal Information
              </h2>

              <p className="text-xs text-slate-500">
                Provide geographic location details to match with local municipal, provincial, and regional grants.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Name - read only because User owns it */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name
                </label>

                <input
                  type="text"
                  value={user?.name || ''}
                  disabled
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50 text-slate-500"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address
                </label>

                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50 text-slate-500"
                  />
                </div>
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Date of Birth
                </label>

                <input
                  type="date"
                  value={
                    formData.dateOfBirth || ''
                  }
                  onChange={(e) =>
                    handleInputChange(
                      'dateOfBirth',
                      e.target.value
                    )
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* Citizenship */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Citizenship
                </label>

                <select
                  value={
                    formData.citizenship || ''
                  }
                  onChange={(e) =>
                    handleInputChange(
                      'citizenship',
                      e.target.value
                    )
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                >
                  <option value="Filipino">
                    Filipino
                  </option>

                  <option value="Non-Filipino">
                    Non-Filipino
                  </option>
                </select>
              </div>

              {/* Municipality */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Municipality / City
                </label>

                    <select
                        value={formData.municipalityCity || ''}
                        onChange={(e) =>
                          handleInputChange(
                            'municipalityCity',
                            e.target.value
                          )
                        }
                        disabled={!formData.province}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <option value="">
                          {formData.province
                            ? 'Select municipality / city'
                            : 'Select province first'}
                        </option>

                        {(MUNICIPALITIES[formData.province] || []).map(
                          (municipality) => (
                            <option
                              key={municipality}
                              value={municipality}
                            >
                              {municipality}
                            </option>
                          )
                        )}
                      </select>

              </div>

              {/* Province */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Province
                </label>

                    <select
                        value={formData.province || ''}
                        onChange={(e) => {
                          handleInputChange('province', e.target.value);
                          handleInputChange('municipalityCity', '');
                        }}
                        disabled={!formData.region}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <option value="">
                          {formData.region
                            ? 'Select province'
                            : 'Select region first'}
                        </option>

                        {(PROVINCES[formData.region] || []).map((province) => (
                          <option key={province} value={province}>
                            {province}
                          </option>
                        ))}
                      </select>
              </div>

              {/* Region */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Region
                </label>

                      <select
                    value={formData.region || ''}
                    onChange={(e) => {
                      handleInputChange('region', e.target.value);
                      handleInputChange('province', '');
                      handleInputChange('municipalityCity', '');
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                  >
                    <option value="">Select region</option>

                    {REGIONS.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </select>
              </div>

            </div>
          </div>
        )}

        {/* ======================================
            ACADEMIC DETAILS
        ====================================== */}
        {activeTab === 'academic' && (
          <div className="space-y-6">

            <div>
              <h2 className="text-base font-bold text-slate-900">
                Academic Details
              </h2>

              <p className="text-xs text-slate-500">
                Configure GWA and school program for merit matching.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Academic Level */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Academic Level
                </label>

                <select
                  value={
                    formData.academicLevel ||
                    ''
                  }
                  onChange={(e) =>
                    handleAcademicLevelChange(
                      e.target.value
                    )
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                >
                  <option value="">
                    Select academic level
                  </option>

                  <option value="Senior High School">
                    Senior High School
                  </option>

                  <option value="College">
                    College
                  </option>

                  <option value="Graduate Studies">
                    Graduate Studies
                  </option>
                </select>
              </div>

              {/* Year Level */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Year Level
                </label>

                <select
                  value={
                    formData.yearLevel || ''
                  }
                  onChange={(e) =>
                    handleInputChange(
                      'yearLevel',
                      e.target.value
                    )
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                >
                  <option value="">
                    Select year level
                  </option>

                  {getYearLevelOptions(
                    formData.academicLevel
                  ).map((yearLevel) => (
                    <option
                      key={yearLevel}
                      value={yearLevel}
                    >
                      {YEAR_LEVEL_LABELS[yearLevel] ||
                        yearLevel}
                    </option>
                  ))}
                </select>
              </div>

              {/* School */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  School Name
                </label>

                <input
                  type="text"
                  value={
                    formData.schoolName || ''
                  }
                  onChange={(e) =>
                    handleInputChange(
                      'schoolName',
                      e.target.value
                    )
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* School Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  School Type
                </label>

                <select
                  value={
                    formData.schoolType || ''
                  }
                  onChange={(e) =>
                    handleInputChange(
                      'schoolType',
                      e.target.value
                    )
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                >
                  <option value="">
                    Select school type
                  </option>

                  <option value="Public">
                    Public
                  </option>

                  <option value="Private">
                    Private
                  </option>
                </select>
              </div>

              {/* Course */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Course / Major
                </label>

                <input
                  type="text"
                  value={
                    formData.course || ''
                  }
                  onChange={(e) =>
                    handleInputChange(
                      'course',
                      e.target.value
                    )
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* GWA */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Current GWA
                </label>

                <input
                  type="number"
                  step="0.01"
                  value={
                    formData.gwa || ''
                  }
                  onChange={(e) =>
                    handleInputChange(
                      'gwa',
                      e.target.value
                    )
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* GWA Scale */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  GWA Scale
                </label>

                <select
                  value={
                    formData.gwaScale || ''
                  }
                  onChange={(e) =>
                    handleInputChange(
                      'gwaScale',
                      e.target.value
                    )
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                >
                  <option value="">
                    Select GWA scale
                  </option>

                  <option value="1.00-5.00">
                    1.00 - 5.00
                  </option>

                  <option value="60-100">
                    60 - 100
                  </option>
                </select>
              </div>

            </div>
          </div>
        )}

        {/* ======================================
            FINANCIAL / ELIGIBILITY
        ====================================== */}
        {activeTab === 'financial' && (
          <div className="space-y-6">

            <div>
              <h2 className="text-base font-bold text-slate-900">
                Socioeconomic & Special Flags
              </h2>

              <p className="text-xs text-slate-500">
                Select applicable demographic criteria for specialized grant discovery.
              </p>
            </div>

            {/* Income */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Household Income Bracket
              </label>

              <select
                value={
                  formData.incomeBracket || ''
                }
                onChange={(e) =>
                  handleInputChange(
                    'incomeBracket',
                    e.target.value
                  )
                }
                className="w-full md:w-1/2 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
              >
            

                  <option value="">Select income bracket</option>

                      <option value="Below ₱10,000 / month">
                        Below ₱10,000 / month
                      </option>

                      <option value="₱10,001 – ₱21,190 / month">
                        ₱10,001 – ₱21,190 / month
                      </option>

                      <option value="₱21,191 – ₱43,828 / month">
                        ₱21,191 – ₱43,828  / month
                      </option>

                      <option value="₱43,829 – ₱76,669 / month">
                        ₱43,829 – ₱76,669 / month
                      </option>

                      <option value="₱76,670 – ₱131,484 / month">
                        ₱76,670 – ₱131,484 / month
                      </option>

                      <option value="Above ₱131,484 / month">
                        Above ₱131,484 / month
                      </option>
              </select>
            </div>

            {/* Eligibility */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

              {eligibilityFlagsList.map(
                (flag) => {
                  const isChecked = Boolean(
                    formData
                      .specialEligibilityFlags?.[
                      flag.key
                    ]
                  );

                  return (
                    <label
                      key={flag.key}
                      className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                        isChecked
                          ? 'bg-blue-50/60 border-blue-300 ring-1 ring-blue-300'
                          : 'bg-slate-50/50 border-slate-200/80 hover:bg-slate-100/60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) =>
                          handleEligibilityChange(
                            flag.key,
                            e.target.checked
                          )
                        }
                        className="mt-0.5 w-4 h-4 text-blue-600 rounded-md border-slate-300 focus:ring-blue-500 shrink-0"
                      />

                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          {flag.label}
                        </span>

                        <span className="text-[11px] text-slate-500 font-medium leading-tight block mt-0.5">
                          {flag.description}
                        </span>
                      </div>
                    </label>
                  );
                }
              )}

            </div>
          </div>
        )}

      </form>

      {showCompletePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200/80 rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                Profile Complete! 🎉
              </h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your profile is now ready to help us find better scholarship matches.
            </p>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => navigate(DASHBOARD_ROUTE)}
                className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}