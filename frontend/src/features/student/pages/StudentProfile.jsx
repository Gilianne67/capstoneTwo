import React, { useState, useEffect } from 'react';
import { 
  User, 
  BookOpen, 
  Wallet, 
  MapPin, 
  ShieldCheck,
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Mail, 
  Phone, 
  GraduationCap,
  Loader2 
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

// Production & Test Mock Fallback Data (Matches Student Dashboard Test Account)
const MOCK_PROFILE_FALLBACK = {
  firstName: 'Juan',
  lastName: 'Dela Cruz',
  email: 'juan.delacruz@camsur.edu.ph',
  phone: '09171234567',
  dateOfBirth: '2004-06-15',
  address: {
    municipality: 'Pili',
    province: 'Camarines Sur',
    region: 'Region V (Bicol Region)'
  },
  academic: {
    university: 'Mapua Malayan Digital College',
    course: 'BS Information Technology',
    academicLevel: 'College',
    gpa: '1.25',
    gwaScale: '4.00',
    academicStatus: 'Regular Student'
  },
  financialBracket: 'Below ₱10,000',
  eligibilityFlags: {
    isIP: false,
    isPWD: false,
    isSoloParentDependent: false,
    isOrphan: false,
    isFarmerFisherfolkChild: true,
    isDisasterAffected: true,
    isWorkingStudent: false,
    is4PsBeneficiary: true
  }
};

const PROFILE_STORAGE_KEY = 'iskolar_student_profile';

const getStoredProfile = () => {
  try {
    const storedProfile = localStorage.getItem(PROFILE_STORAGE_KEY);
    return storedProfile ? JSON.parse(storedProfile) : null;
  } catch (error) {
    console.warn('Stored student profile is invalid. Rebuilding it from the account.', error);
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    return null;
  }
};

const normalizeProfile = (profile = {}, user = {}) => ({
  ...MOCK_PROFILE_FALLBACK,
  ...profile,
  firstName: profile.personal?.firstName || profile.firstName || user.name?.split(' ')[0] || MOCK_PROFILE_FALLBACK.firstName,
  lastName: profile.personal?.lastName || profile.lastName || user.name?.split(' ').slice(1).join(' ') || MOCK_PROFILE_FALLBACK.lastName,
  email: user.email || profile.email || MOCK_PROFILE_FALLBACK.email,
  phone: profile.personal?.phone || profile.phone || MOCK_PROFILE_FALLBACK.phone,
  dateOfBirth: profile.personal?.dateOfBirth
    ? String(profile.personal.dateOfBirth).slice(0, 10)
    : profile.dateOfBirth || MOCK_PROFILE_FALLBACK.dateOfBirth,
  address: {
    ...MOCK_PROFILE_FALLBACK.address,
    ...(profile.location || profile.address || {}),
  },
  academic: {
    ...MOCK_PROFILE_FALLBACK.academic,
    ...(profile.academic || {}),
    gpa: profile.academic?.gwa ?? profile.academic?.gpa ?? MOCK_PROFILE_FALLBACK.academic.gpa,
  },
  financialBracket: profile.financial?.incomeBracket || profile.financialBracket || MOCK_PROFILE_FALLBACK.financialBracket,
  eligibilityFlags: {
    ...MOCK_PROFILE_FALLBACK.eligibilityFlags,
    ...(profile.eligibilityFlags || {}),
  },
});

const toApiProfile = (profile) => ({
  personal: {
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
    dateOfBirth: profile.dateOfBirth,
  },
  academic: {
    ...profile.academic,
    gwa: Number(profile.academic?.gpa),
  },
  financial: {
    incomeBracket: profile.financialBracket,
    monthlyFamilyIncome: Number(profile.monthlyFamilyIncome || 0),
  },
  location: profile.address,
  eligibilityFlags: profile.eligibilityFlags,
});

export default function StudentProfile() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('personal');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [eligibilityReviewed, setEligibilityReviewed] = useState(false);

  const [formData, setFormData] = useState(null);

  // Helper to safely fetch JSON and detect unexpected HTML (404 / dev proxy errors)
  const safeFetchJson = async (url, options = {}) => {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type');

    if (!res.ok || (contentType && contentType.includes('text/html'))) {
      let message = `Server returned HTML or non-OK status: ${res.status}`;

      try {
        const errorData = await res.json();
        message = errorData.message || errorData.error || message;
      } catch {
        // Keep default error message
      }

      throw new Error(message);
    }

    return await res.json();
  };

  // Load profile on mount with API -> Mock Fallback
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setSaveError('');

      try {
        const token = localStorage.getItem('token');
        const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        // Attempt live API request
        const apiData = await safeFetchJson(`${apiBaseUrl}/students/profile`, { headers });

        if (!isMounted) return;

        const profileData = apiData?.profile || apiData?.data || apiData;

        setFormData(normalizeProfile(profileData, user));

        setIsUsingFallback(false);
      } catch (err) {
        console.warn('Profile API unreachable or returning an error. Switching to local test mode:', err.message);

        if (!isMounted) return;

        // Fallback to local test mock data
        const savedProfile = getStoredProfile();
        setFormData(normalizeProfile(savedProfile || {}, user));
        setIsUsingFallback(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleInputChange = (section, field, value) => {
    setHasChanges(true);

    if (!section) {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      [section]: {
        ...(prev?.[section] || {}),
        [field]: value
      }
    }));
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();

    if (!formData.firstName?.trim() || !formData.lastName?.trim()) {
      setSaveError('First name and last name are required.');
      return;
    }

    if (!formData.academic?.university?.trim() || !formData.academic?.course?.trim()) {
      setSaveError('University and course are required.');
      return;
    }

    if (!formData.academic?.gpa || Number.isNaN(Number(formData.academic.gpa))) {
      setSaveError('Please enter a valid GWA.');
      return;
    }

    if (!formData.financialBracket || !formData.address?.municipality?.trim() || !formData.address?.province?.trim() || !formData.address?.region?.trim()) {
      setSaveError('Please complete your financial and location information.');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError('');

    try {
      if (!isUsingFallback) {
        const token = localStorage.getItem('token');
        const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

        const response = await safeFetchJson(`${apiBaseUrl}/students/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify(toApiProfile(formData))
        });

        const updatedProfile = response?.profile || response?.data;

        if (updatedProfile) {
          const normalizedProfile = normalizeProfile(updatedProfile, user);
          setFormData(normalizedProfile);
          localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(normalizedProfile));
        } else {
          localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(formData));
        }
      } else {
        // Simulate local network delay when using local fallback mock
        await new Promise(resolve => setTimeout(resolve, 600));
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(formData));
      }

      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error('Failed to update profile:', err);
      setSaveError(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'personal', label: 'Personal Information', icon: User },
    { id: 'academic', label: 'Academic Details', icon: BookOpen },
    { id: 'financial', label: 'Financial Information', icon: Wallet },
    { id: 'location', label: 'Location', icon: MapPin },
    { id: 'eligibility', label: 'Eligibility', icon: ShieldCheck },
  ];

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);

    // Eligibility is optional. Opening the section confirms that the student reviewed it.
    if (tabId === 'eligibility') {
      setEligibilityReviewed(true);
    }
  };

  const eligibilityFlagsList = [
    { key: 'isIP', label: 'Indigenous Peoples (IP)', description: 'Member of an officially recognized Indigenous Cultural Community' },
    { key: 'isPWD', label: 'PWD Status', description: 'Person with Disability holding a valid ID' },
    { key: 'isSoloParentDependent', label: 'Solo Parent Dependent', description: 'Child or dependent of a registered Solo Parent' },
    { key: 'isOrphan', label: 'Orphan Status', description: 'Student with deceased parent(s)' },
    { key: 'isFarmerFisherfolkChild', label: 'Child of Farmer / Fisherfolk', description: 'Household principal earner is engaged in agriculture or fishing' },
    { key: 'isDisasterAffected', label: 'Disaster-Affected Family', description: 'Family reside in or affected by recent declared state of calamity' },
    { key: 'isWorkingStudent', label: 'Working Student', description: 'Student currently balancing employment and studies' },
    { key: 'is4PsBeneficiary', label: '4Ps Beneficiary', description: 'Registered Pantawid Pamilyang Pilipino Program member' },
  ];

  if (isLoading || !formData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] gap-3">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
        <p className="text-xs text-slate-500 font-medium">Loading student profile...</p>
      </div>
    );
  }

  const sectionProgress = {
    personal: [formData.firstName, formData.lastName, formData.email, formData.phone, formData.dateOfBirth],
    academic: [formData.academic?.university, formData.academic?.course, formData.academic?.academicLevel, formData.academic?.gpa],
    financial: [formData.financialBracket],
    location: [formData.address?.municipality, formData.address?.province, formData.address?.region],
    eligibility: eligibilityReviewed ? new Array(8).fill(true) : [],
  };

  const completionPercent = Math.round(
    (Object.values(sectionProgress).flat().filter(Boolean).length / 21) * 100
  );

  return (
    <div className="relative isolate -mx-6 min-h-full overflow-hidden bg-gradient-to-br from-sky-50 via-white to-emerald-50/60 px-6 pb-16 pt-6">
      <div className="pointer-events-none absolute -left-24 top-20 h-64 w-64 rounded-full bg-blue-200/35 blur-3xl" />
      <div className="pointer-events-none absolute right-[-7rem] top-[-5rem] h-72 w-72 rounded-full bg-cyan-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-8rem] right-16 h-72 w-72 rounded-full bg-emerald-200/25 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(37,99,235,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(37,99,235,0.045)_1px,transparent_1px)] [background-size:32px_32px]" />

      <div className="relative mx-auto max-w-7xl space-y-6">
      {/* Test-Mode Alert Banner */}
      {isUsingFallback && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-xs font-medium text-amber-700 shadow-sm backdrop-blur-sm">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Backend API offline/unreachable. Showing mock test account data.
          </span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="relative overflow-hidden rounded-3xl border border-white/80 bg-white/85 p-6 shadow-xl shadow-blue-900/5 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full border-[18px] border-cyan-100/70" />
        <div className="pointer-events-none absolute -right-2 -top-8 h-24 w-24 rounded-full border-8 border-blue-100/60" />
        <div className="flex items-center gap-4">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 text-xl font-black text-white shadow-lg shadow-blue-500/25 ring-4 ring-blue-50">
            {formData.firstName?.[0] || 'J'}{formData.lastName?.[0] || 'D'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-slate-900">
                {formData.firstName} {formData.lastName}
              </h1>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-extrabold text-blue-700">
                {formData.academic?.academicStatus || 'Student'}
              </span>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <GraduationCap className="w-4 h-4 text-slate-400" />
              {formData.academic?.course} &bull; {formData.academic?.university}
            </p>
          </div>
        </div>

        <div className="relative w-full space-y-2 md:w-auto">
          <div className="flex items-center justify-between gap-4 text-[11px] font-bold text-slate-500">
              <span>
                {hasChanges ? 'Unsaved changes' : completionPercent === 100 ? 'Profile up to date' : 'Profile incomplete'}
              </span>
            <span className="text-blue-600">{completionPercent}% complete</span>
          </div>
          <div className="h-2 w-full md:w-56 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-400 transition-all duration-500" style={{ width: `${completionPercent}%` }} />
          </div>
          <button
            onClick={handleSave}
          disabled={isSaving}
            className="w-full px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? <><Loader2 className="animate-spin h-4 w-4" /> Saving Profile...</> : <><Save className="w-4 h-4" /> Save Profile</>}
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-xs font-bold animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Profile saved successfully!</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-800 text-xs font-bold">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* TABS */}
      <div className="scrollbar-none flex items-center gap-2 overflow-x-auto rounded-2xl border border-white/80 bg-white/65 p-2 shadow-sm backdrop-blur-sm">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                isActive ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {sectionProgress[tab.id].filter(Boolean).length}/{tab.id === 'eligibility' ? 8 : sectionProgress[tab.id].length}
              </span>
            </button>
          );
        })}
      </div>

      {/* FORM CONTENT */}
      <form onSubmit={handleSave} className="rounded-3xl border border-white/90 bg-white/90 p-6 shadow-xl shadow-slate-900/5 backdrop-blur-md md:p-8">
        {activeTab === 'personal' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">Personal Information</h2>
              <p className="text-xs text-slate-500">Provide your basic personal information for your student profile.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">First Name</label>
                <input
                  type="text"
                  value={formData.firstName || ''}
                  onChange={(e) => handleInputChange(null, 'firstName', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Last Name</label>
                <input
                  type="text"
                  value={formData.lastName || ''}
                  onChange={(e) => handleInputChange(null, 'lastName', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => handleInputChange(null, 'email', e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Contact Number</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={formData.phone || ''}
                    onChange={(e) => handleInputChange(null, 'phone', e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={formData.dateOfBirth || ''}
                  onChange={(e) => handleInputChange(null, 'dateOfBirth', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'academic' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">Academic Details</h2>
              <p className="text-xs text-slate-500">Configure your academic information for scholarship matching.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">University / School</label>
                <input
                  type="text"
                  value={formData.academic?.university || ''}
                  onChange={(e) => handleInputChange('academic', 'university', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Course / Major</label>
                <input
                  type="text"
                  value={formData.academic?.course || ''}
                  onChange={(e) => handleInputChange('academic', 'course', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Academic Level</label>
                <select
                  value={formData.academic?.academicLevel || ''}
                  onChange={(e) => handleInputChange('academic', 'academicLevel', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500 bg-white"
                >
                  <option value="">Select academic level</option>
                  <option value="Senior High School">Senior High School</option>
                  <option value="College">College</option>
                  <option value="Graduate">Graduate</option>
                  <option value="Postgraduate">Postgraduate</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Academic Status</label>
                <select
                  value={formData.academic?.academicStatus || ''}
                  onChange={(e) => handleInputChange('academic', 'academicStatus', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500 bg-white"
                >
                  <option value="">Select status</option>
                  <option value="Regular Student">Regular Student</option>
                  <option value="Irregular Student">Irregular Student</option>
                  <option value="Transferee">Transferee</option>
                  <option value="Returning Student">Returning Student</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Current GWA</label>
                <input
                  type="text"
                  value={formData.academic?.gpa || ''}
                  onChange={(e) => handleInputChange('academic', 'gpa', e.target.value)}
                  placeholder="Example: 1.25"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">GWA Scale</label>
                <select
                  value={formData.academic?.gwaScale || ''}
                  onChange={(e) => handleInputChange('academic', 'gwaScale', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500 bg-white"
                >
                  <option value="">Select GWA scale</option>
                  <option value="4.00">4.00 Scale</option>
                  <option value="5.00">5.00 Scale</option>
                  <option value="100">100 Scale</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'financial' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">Financial Information</h2>
              <p className="text-xs text-slate-500">Provide your household income bracket to help identify financially appropriate scholarships.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Household Monthly Income</label>
                <select
                  value={formData.financialBracket || ''}
                  onChange={(e) => handleInputChange(null, 'financialBracket', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500 bg-white"
                >
                  <option value="">Select income bracket</option>
                  <option value="Below ₱10,000">Below ₱10,000</option>
                  <option value="₱10,001–₱20,000">₱10,001–₱20,000</option>
                  <option value="₱20,001–₱40,000">₱20,001–₱40,000</option>
                  <option value="Above ₱40,000">Above ₱40,000</option>
                </select>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
              <div className="flex items-start gap-3">
                <Wallet className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-blue-900">Why do we ask for this?</p>
                  <p className="text-[11px] text-blue-700 mt-1 leading-relaxed">
                    Your income bracket helps ISKOLARMATCH identify scholarships with financial eligibility requirements. 
                    Exact income amounts are not required for the matching process.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'location' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">Location Information</h2>
              <p className="text-xs text-slate-500">Provide your location to match with local municipal, provincial, and regional scholarships.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Municipality / City</label>
                <input
                  type="text"
                  value={formData.address?.municipality || ''}
                  onChange={(e) => handleInputChange('address', 'municipality', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Province</label>
                <input
                  type="text"
                  value={formData.address?.province || ''}
                  onChange={(e) => handleInputChange('address', 'province', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Region</label>
                <input
                  type="text"
                  value={formData.address?.region || ''}
                  onChange={(e) => handleInputChange('address', 'region', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'eligibility' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">Eligibility Information</h2>
              <p className="text-xs text-slate-500">Select the circumstances that apply to you for specialized scholarship matching.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {eligibilityFlagsList.map((flag) => {
                const isChecked = Boolean(formData.eligibilityFlags?.[flag.key]);
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
                      onChange={(e) => handleInputChange('eligibilityFlags', flag.key, e.target.checked)}
                      className="mt-0.5 w-4 h-4 text-blue-600 rounded-md border-slate-300 focus:ring-blue-500 shrink-0"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">{flag.label}</span>
                      <span className="text-[11px] text-slate-500 font-medium leading-tight block mt-0.5">
                        {flag.description}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-8 pt-5 border-t border-slate-200 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="animate-spin h-4 w-4" />
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
      </form>
      </div>
    </div>
  );
}