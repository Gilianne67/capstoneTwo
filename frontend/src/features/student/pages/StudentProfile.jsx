import React, { useState, useEffect } from 'react';
import { 
  User, 
  BookOpen, 
  Wallet, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Mail, 
  Phone, 
  GraduationCap,
  Loader2 
} from 'lucide-react';

// Production & Test Mock Fallback Data (Matches Student Dashboard Test Account)
const MOCK_PROFILE_FALLBACK = {
  firstName: 'Juan',
  lastName: 'Dela Cruz',
  email: 'juan.delacruz@camsur.edu.ph',
  phone: '09171234567',
  address: {
    municipality: 'Pili',
    province: 'Camarines Sur',
    region: 'Region V (Bicol Region)'
  },
  academic: {
    university: 'Mapua Malayan Digital College',
    course: 'BS Information Technology',
    gpa: '1.25',
    academicStatus: 'Regular Student'
  },
  financialBracket: 'Low-Income Tier',
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

export default function StudentProfile() {
  const [activeTab, setActiveTab] = useState('personal');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  const [formData, setFormData] = useState(null);

  // Helper to safely fetch JSON and detect unexpected HTML (404 / dev proxy errors)
  const safeFetchJson = async (url, options = {}) => {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type');
    
    if (!res.ok || (contentType && contentType.includes('text/html'))) {
      throw new Error(`Server returned HTML or non-OK status: ${res.status}`);
    }
    return await res.json();
  };

  // Load profile on mount with API -> Mock Fallback
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        // Attempt live API request
        const apiData = await safeFetchJson('/api/v1/students/profile', { headers });

        if (!isMounted) return;
        setFormData(apiData);
        setIsUsingFallback(false);
      } catch (err) {
        console.warn('Profile API unreachable or returning HTML. Switching to local test mode:', err.message);
        
        if (!isMounted) return;
        // Fallback to local test mock data
        setFormData(MOCK_PROFILE_FALLBACK);
        setIsUsingFallback(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleInputChange = (section, field, value) => {
    if (!section) {
      setFormData(prev => ({ ...prev, [field]: value }));
      return;
    }
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      if (!isUsingFallback) {
        const token = localStorage.getItem('token');
        await safeFetchJson('/api/v1/students/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify(formData)
        });
      } else {
        // Simulate local network delay when using local fallback mock
        await new Promise(resolve => setTimeout(resolve, 600));
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'personal', label: 'Personal Information', icon: User },
    { id: 'academic', label: 'Academic Details', icon: BookOpen },
    { id: 'financial', label: 'Socioeconomic & Special Flags', icon: Wallet },
  ];

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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Test-Mode Alert Banner */}
      {isUsingFallback && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-3 rounded-xl flex items-center justify-between text-xs font-medium">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Backend API offline/unreachable. Showing mock test account data.
          </span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-md border-2 border-white shrink-0">
            {formData.firstName?.[0] || 'J'}{formData.lastName?.[0] || 'D'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                {formData.firstName} {formData.lastName}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800">
                {formData.academic?.academicStatus || 'Student'}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-0.5 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-slate-400" />
              {formData.academic?.course} &bull; {formData.academic?.university}
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

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-xs font-bold animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Profile saved successfully!</span>
        </div>
      )}

      {/* TABS */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                isActive ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* FORM CONTENT */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
        {activeTab === 'personal' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">Personal Information</h2>
              <p className="text-xs text-slate-500">Provide geographic location details to match with local municipal, provincial, and regional grants.</p>
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

        {activeTab === 'academic' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">Academic Details</h2>
              <p className="text-xs text-slate-500">Configure GWA and university program for merit matching.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">University</label>
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Current GWA</label>
                <input
                  type="text"
                  value={formData.academic?.gpa || ''}
                  onChange={(e) => handleInputChange('academic', 'gpa', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'financial' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">Special Eligibility Flags</h2>
              <p className="text-xs text-slate-500">Select applicable demographic criteria for specialized grant discovery.</p>
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
      </form>
    </div>
  );
}