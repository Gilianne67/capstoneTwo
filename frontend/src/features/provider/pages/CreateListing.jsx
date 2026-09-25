import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  X, 
  Loader2, 
  AlertCircle, 
  Sliders, 
  ShieldAlert, 
  CheckCircle2, 
  HelpCircle,
  Tag,
  BookOpen,
  MapPin,
  Send
} from 'lucide-react';

import PageHeader from '../../../components/common/PageHeader';

import {
  REGIONS,
  PROVINCES,
  MUNICIPALITIES
} from '../../../data/locationData';

// Standard System Demographic Tags from Paper Blueprint (Table 3.8)
const SYSTEM_DEMOGRAPHIC_TAGS = [
  '4Ps Beneficiary',
  'Indigenous Peoples (IP)',
  'Person with Disability (PWD)',
  'Solo Parent Dependent',
  'Orphan Status',
  'Child of Farmer / Fisherfolk',
  'Disaster-Affected Family',
  'Working Student'
];
;


export default function CreateListing({ onBack, onSuccess, initialData = null }) {
  const navigate = useNavigate();
  const isEditMode = Boolean(initialData?._id);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Modal State Control
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // ---------------------------------------------------------
  // 1. BASIC PROGRAM METADATA
  // ---------------------------------------------------------
  const [title, setTitle] = useState('');
  const [grantValue, setGrantValue] = useState('');
  const [category, setCategory] = useState('Merit-Based');
  const [deadline, setDeadline] = useState('');
  const [portalUrl, setPortalUrl] = useState('');
  const [description, setDescription] = useState('');

  // ---------------------------------------------------------
  // 2. HARD FILTERS (BOOLEAN GATEKEEPERS)
  // ---------------------------------------------------------
 const [academicLevel, setAcademicLevel] = useState('');
const [citizenship, setCitizenship] = useState('');
const [maxGwa, setMaxGwa] = useState('');
const [gwaScale, setGwaScale] = useState('1.00-5.00');
const [maxIncome, setMaxIncome] = useState('');

const [allowedCourses, setAllowedCourses] = useState([]);
const [newCourse, setNewCourse] = useState('');

const [geographicScope, setGeographicScope] = useState('Nationwide');
const [selectedRegion, setSelectedRegion] = useState('');
const [selectedProvince, setSelectedProvince] = useState('');
const [selectedMunicipality, setSelectedMunicipality] = useState('');

const [customHardFilters, setCustomHardFilters] = useState([]);
const [newHardFilterLabel, setNewHardFilterLabel] = useState('');
const [newHardFilterVal, setNewHardFilterVal] = useState('');

const [requiredTags, setRequiredTags] = useState([]);
const [newCustomReqTag, setNewCustomReqTag] = useState('');

const [preferredTags, setPreferredTags] = useState([]);
const [newCustomPrefTag, setNewCustomPrefTag] = useState('');

  // ---------------------------------------------------------
  // 3. RANKING & SCORING WEIGHTS (PROVIDER-DEFINED)
  // Boundary Constraints: GPA (20-70%), Income (20-70%), Tags (0-30%)
  // ---------------------------------------------------------
  const [weights, setWeights] = useState({
    gpaWeight: 40,
    incomeWeight: 40,
    tagsWeight: 20
  });


  // ---------------------------------------------------------
  // 4. REQUIRED DOCUMENTS CHECKLIST
  // ---------------------------------------------------------
//  const [requirements, setRequirements] = useState([
  //  'Certificate of Good Moral Character',
//    'Certified True Copy of Grades (Form 137 / TOR)',
 //   'Tax Exemption Certificate or ITR'
 // ]);
 // const [newReq, setNewReq] = useState('');

  // ---------------------------------------------------------
// LOAD EXISTING SCHOLARSHIP DATA FOR EDIT MODE
// ---------------------------------------------------------
useEffect(() => {
  if (!initialData) return;

  setTitle(initialData.name || '');
  setGrantValue(initialData.grantValue || '');
  setCategory(initialData.scholarshipType || 'Merit-Based');
  setDescription(initialData.description || '');
  setDeadline(
    initialData.deadline
      ? new Date(initialData.deadline).toISOString().split('T')[0]
      : ''
  );
  setPortalUrl(initialData.applicationURL || '');

  // Academic requirements
  setAcademicLevel(
  initialData.hardFilters?.academicLevel || ''
  );

  setCitizenship(
    initialData.hardFilters?.citizenshipStatus || ''
  );

  setMaxGwa(
    initialData.academicRequirement?.minimumGPA?.toString() || ''
  );

  const loadedScale =
    initialData.academicRequirement?.gradingScale || '1.00-5.00';
  setGwaScale(loadedScale === '1-5' ? '1.00-5.00' : loadedScale);

  setMaxIncome(
    initialData.incomeRequirement?.maximumIncome?.toString() || ''
  );

    setAllowedCourses(
      initialData.hardFilters?.courseProgram || []
    );

      const geographicLocation =
      initialData.hardFilters?.geographicLocation;

    if (geographicLocation) {
      setGeographicScope(
        geographicLocation.scope || 'Nationwide'
      );

      setSelectedRegion(
        geographicLocation.regions?.[0] || ''
      );

      setSelectedProvince(
        geographicLocation.provinces?.[0] || ''
      );

      setSelectedMunicipality(
        geographicLocation.municipalities?.[0] || ''
      );
    } else {
    setAllowedLocations([]);
  }

  // Ranking weights
  if (initialData.criteriaWeights) {
    setWeights({
      gpaWeight: (initialData.criteriaWeights.gwaWeight || 0) * 100,
      incomeWeight: (initialData.criteriaWeights.incomeWeight || 0) * 100,
      tagsWeight: (initialData.criteriaWeights.tagsWeight || 0) * 100
    });
  }

  // Special eligibility tags
  const tags = initialData.specialTags || [];

  setRequiredTags(
  tags
    .filter(tag => tag.mode === 'Exclusive')
    .map(tag => tag.tagName)
);

  setPreferredTags(
    tags
      .filter(tag => tag.mode === 'Preferred')
      .map(tag => tag.tagName)
  );

}, [initialData]);

  // ---------------------------------------------------------
  // HANDLERS: HARD FILTERS (COURSES, LOCATIONS, CUSTOM)
  // ---------------------------------------------------------
  const handleAddCourse = () => {
    if (!newCourse.trim()) return;
    if (!allowedCourses.includes(newCourse.trim())) {
      setAllowedCourses(prev => [...prev, newCourse.trim()]);
    }
    setNewCourse('');
  };

  const handleRemoveCourse = (index) => {
    setAllowedCourses(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleAddCustomHardFilter = () => {
    if (!newHardFilterLabel.trim() || !newHardFilterVal.trim()) return;
    setCustomHardFilters(prev => [
      ...prev,
      {
        id: `hf-${Date.now()}`,
        label: newHardFilterLabel.trim(),
        value: newHardFilterVal.trim()
      }
    ]);
    setNewHardFilterLabel('');
    setNewHardFilterVal('');
  };

  const handleRemoveCustomHardFilter = (id) => {
    setCustomHardFilters(prev => prev.filter(item => item.id !== id));
  };

  // ---------------------------------------------------------
  // HANDLERS: SPECIAL TAGS (REQUIRED VS PREFERRED)
  // ---------------------------------------------------------
  const toggleRequiredTag = (tagName) => {
    if (requiredTags.includes(tagName)) {
      setRequiredTags(prev => prev.filter(t => t !== tagName));
    } else {
      setRequiredTags(prev => [...prev, tagName]);
      setPreferredTags(prev => prev.filter(t => t !== tagName));
    }
  };

  const togglePreferredTag = (tagName) => {
    if (preferredTags.includes(tagName)) {
      setPreferredTags(prev => prev.filter(t => t !== tagName));
    } else {
      setPreferredTags(prev => [...prev, tagName]);
      setRequiredTags(prev => prev.filter(t => t !== tagName));
    }
  };

  const handleAddCustomReqTag = () => {
    if (!newCustomReqTag.trim()) return;
    const tag = newCustomReqTag.trim();
    if (!requiredTags.includes(tag)) {
      setRequiredTags(prev => [...prev, tag]);
    }
    setNewCustomReqTag('');
  };

  const handleAddCustomPrefTag = () => {
    if (!newCustomPrefTag.trim()) return;
    const tag = newCustomPrefTag.trim();
    if (!preferredTags.includes(tag)) {
      setPreferredTags(prev => [...prev, tag]);
    }
    setNewCustomPrefTag('');
  };

  // ---------------------------------------------------------
  // HANDLERS: DOCUMENTS CHECKLIST
  // ---------------------------------------------------------
 // const handleAddRequirement = () => {
 //   if (!newReq.trim()) return;
 //   setRequirements(prev => [...prev, newReq.trim()]);
 //   setNewReq('');
 // };

//  const handleRemoveRequirement = (index) => {
//    setRequirements(prev => prev.filter((_, idx) => idx !== index));
//  };

  // ---------------------------------------------------------
  // WEIGHT VALIDATION CALCULATIONS
  // ---------------------------------------------------------
  const totalWeight = Number(weights.gpaWeight) + Number(weights.incomeWeight) + Number(weights.tagsWeight);

  const validateWeights = () => {
    const gpa = Number(weights.gpaWeight);
    const inc = Number(weights.incomeWeight);
    const tags = Number(weights.tagsWeight);

    if (gpa < 20 || gpa > 70) return 'GPA / GWA Weight must be between 20% and 70%.';
    if (inc < 20 || inc > 70) return 'Household Income Weight must be between 20% and 70%.';
    if (tags < 0 || tags > 30) return 'Special Eligibility Tags Weight must be between 0% and 30%.';
    if (totalWeight !== 100) return `Total ranking weights must equal exactly 100%. Current total: ${totalWeight}%.`;
    return null;
  };

  const validateGwa = () => {
    const gwaValue = parseFloat(maxGwa);

    if (maxGwa === '' || Number.isNaN(gwaValue)) {
      return 'Maximum Allowable GWA / GPA is required.';
    }

    if (gwaScale === '1.00-5.00' && (gwaValue < 1 || gwaValue > 5)) {
      return 'Maximum Allowable GWA / GPA must be between 1.00 and 5.00 for the 1.00-5.00 scale.';
    }

    if (gwaScale === '60-100' && (gwaValue < 60 || gwaValue > 100)) {
      return 'Maximum Allowable GWA / GPA must be between 60 and 100 for the 60-100 scale.';
    }

    return null;
  };

  // Open Confirmation Modal on Form Submit
  // Open Confirmation Modal on Form Submit
const handleOpenConfirmModal = (e) => {
  e.preventDefault();
  setErrorMsg(null);

  const gwaValidationError = validateGwa();

  if (gwaValidationError) {
    setErrorMsg(gwaValidationError);
    return;
  }

  const weightValidationError = validateWeights();

  if (weightValidationError) {
    setErrorMsg(weightValidationError);
    return;
  }

  setShowConfirmModal(true);
};


// Format backend validation errors into user-friendly messages
const formatPublishError = (message) => {
  if (!message) {
    return 'Unable to publish scholarship. Please check your information and try again.';
  }

  const fieldMap = {
    'hardFilters.citizenshipStatus': 'Citizenship Requirement',
    'hardFilters.academicLevel': 'Academic Level',
    'academicRequirement.minimumGPA': 'Minimum GWA / GPA',
    'description': 'Program Description',
    'applicationURL': 'Application URL',
    'name': 'Scholarship Name',
    'scholarshipType': 'Scholarship Type',
    'deadline': 'Application Deadline',
    'incomeRequirement.maximumIncome': 'Annual Income Ceiling'
  };

  const missingFields = [];

  Object.entries(fieldMap).forEach(([field, label]) => {
    if (
      message.includes(field) &&
      message.includes('is required')
    ) {
      missingFields.push(label);
    }
  });

  if (missingFields.length > 0) {
    return `Please complete the following required fields: ${missingFields.join(', ')}.`;
  }

  return message;
};


// Final Action Executed inside Confirm Modal
const handleExecutePublish = async () => {
  setShowConfirmModal(false);
  setIsSubmitting(true);
  setErrorMsg(null);

  const newListingPayload = {
    name: title,
    grantValue: grantValue,
    scholarshipType: category,
    description,

    benefits: [],

    academicRequirement: {
      minimumGPA: parseFloat(maxGwa),
      gradingScale: gwaScale
    },

    hardFilters: {
      academicLevel,
      courseProgram: allowedCourses,
        geographicLocation: {
          scope: geographicScope,

          regions:
            geographicScope !== 'Nationwide' && selectedRegion
              ? [selectedRegion]
              : [],

          provinces:
            (geographicScope === 'Province' ||
              geographicScope === 'Municipality') &&
            selectedProvince
              ? [selectedProvince]
              : [],

          municipalities:
            geographicScope === 'Municipality' &&
            selectedMunicipality
              ? [selectedMunicipality]
              : []
        },
      citizenshipStatus: citizenship
    },

    incomeRequirement: {
      maximumIncome: parseFloat(maxIncome)
    },

    specialTags: [
      ...requiredTags.map(tag => ({
        tagName: tag,
        mode: 'Exclusive'
      })),
      ...preferredTags.map(tag => ({
        tagName: tag,
        mode: 'Preferred'
      }))
    ],

    criteriaWeights: {
      gwaWeight: Number(weights.gpaWeight) / 100,
      incomeWeight: Number(weights.incomeWeight) / 100,
      tagsWeight: Number(weights.tagsWeight) / 100
    },

    rankingMode: 'Weighted',
    deadline,
    applicationURL: portalUrl,

    status: initialData?.status || 'Open',
    isArchived: initialData?.isArchived || false
  };

  try {
    const token = localStorage.getItem('token');

    if (!token) {
      throw new Error(
        'Authentication token not found. Please log in again.'
      );
    }

    const endpoint = isEditMode
      ? `${import.meta.env.VITE_API_URL}/scholarships/${initialData._id}`
      : `${import.meta.env.VITE_API_URL}/scholarships`;

    const method = isEditMode ? 'PUT' : 'POST';

    const res = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(newListingPayload)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.message ||
        data.error ||
        'Unable to publish scholarship listing.'
      );
    }

    console.log(
      isEditMode
        ? 'Scholarship updated successfully:'
        : 'Scholarship created successfully:',
      data
    );

    setIsSubmitting(false);
    setShowSuccessModal(true);

  } catch (err) {
    console.error('Scholarship Publish Error:', err);

    setIsSubmitting(false);

    setErrorMsg(
      formatPublishError(err.message)
    );
  }
};


// Navigate to the actual Scholarship Listings page
const handleSuccessClose = () => {
  setShowSuccessModal(false);

  navigate('/dashboard/provider/listings');
};

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 relative">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
          title="Go back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <PageHeader 
          title="Post Official Scholarship Listing" 
          subtitle="Configure basic program data, hard boolean gatekeepers, and provider-defined ranking weights."
        />
      </div>

      {/* Validation / Error Banner */}
      

      <form onSubmit={handleOpenConfirmModal} className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-8">
        
        {/* SECTION 1: PROGRAM METADATA */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">1</span>
            Basic Program Details
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
            <div className="md:col-span-2">
              <label className="block text-slate-700 mb-1">Scholarship Program Title *</label>
              <input 
                type="text"
                required
                placeholder="e.g. DOST-SEI Merit Scholarship Program 2026"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 mb-1">Grant / Financial Value *</label>
              <input 
                type="text"
                required
                placeholder="e.g. ₱40,000 / semester"
                value={grantValue}
                onChange={e => setGrantValue(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 mb-1">Category *</label>
              <select 
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
              >
                <option value="Merit-Based">Merit-Based</option>
                <option value="Need-Based">Need-Based</option>
                <option value="STEM">STEM Specialized</option>
                <option value="Agricultural">Agricultural</option>
                <option value="Municipal / Local">Municipal / Local</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 mb-1">Application Deadline *</label>
              <input 
                type="date"
                required
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 mb-1">External Application Portal URL</label>
              <input 
                type="url"
                placeholder="https://provider.gov.ph/apply"
                value={portalUrl}
                onChange={e => setPortalUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-slate-700 mb-1">Program Overview & Description</label>
              <textarea 
                rows={3}
                placeholder="Provide a summary of coverage, stipulations, obligations, and perks..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: HARD FILTERS */}
        <div className="space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs">2</span>
              Hard Requirements (Boolean Gatekeeper Constraints)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Applicants failing any of these core conditions are instantly excluded from matching (Score = 0%).
            </p>
          </div>

          <div className="bg-rose-50/40 border border-rose-100 rounded-2xl p-4 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 mb-1 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-rose-600" /> Academic Level Constraint
                </label>
                <select 
                  value={academicLevel}
                  onChange={e => setAcademicLevel(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:border-rose-500 cursor-pointer"
                >
                  <option value="" disabled>
                    Select academic level
                  </option>

                  <option value="Senior High School">
                    Senior High School
                  </option>

                  <option value="College">
                    College / Undergraduate
                  </option>

                  <option value="Graduate Studies">
                    Graduate Studies (Master's / PhD)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Mandatory Citizenship
                </label>
                <select 
                  value={citizenship}
                  onChange={e => setCitizenship(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:border-rose-500 cursor-pointer"
                >
                  <option value="" disabled>
                    Select citizenship requirement
                  </option>

                  <option value="Filipino">
                    Filipino Citizen Only
                  </option>

                  <option value="Any">
                    Open to Any Citizenship
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Maximum Allowable GWA / GPA
                </label>
                <input 
                  type="number"
                  step="0.01"
                  placeholder={gwaScale === '60-100' ? 'e.g. 85' : 'e.g. 2.00'}
                  value={maxGwa}
                  onChange={e => setMaxGwa(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Grading Scale
                </label>
                <select
                  value={gwaScale}
                  onChange={e => setGwaScale(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:border-rose-500 cursor-pointer"
                >
                  <option value="1.00-5.00">1.00 - 5.00</option>
                  <option value="60-100">60 - 100</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Annual Income Ceiling (PHP)
                </label>
                <input 
                  type="number"
                  placeholder="e.g. 250000"
                  value={maxIncome}
                  onChange={e => setMaxIncome(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:border-rose-500"
                />
              </div>
            </div>

            {/* Courses */}
            <div className="space-y-2 text-xs font-semibold pt-1 border-t border-rose-100/80">
              <label className="block text-slate-700 flex items-center justify-between">
                <span>Eligible Degree Programs / Majors</span>
                <span className="text-[10px] text-slate-400 font-normal">Custom Dynamic List</span>
              </label>
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="e.g. BS Civil Engineering"
                  value={newCourse}
                  onChange={e => setNewCourse(e.target.value)}
                  className="flex-1 px-3.5 py-2 bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:border-rose-500"
                />
                <button
                  type="button"
                  onClick={handleAddCourse}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Course
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {allowedCourses.map((course, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-rose-900 border border-rose-200 rounded-xl text-xs font-semibold shadow-2xs">
                    {course}
                    <button type="button" onClick={() => handleRemoveCourse(idx)} className="hover:text-rose-600 transition-colors cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Locations */}
            {/* Geographic Eligibility */}
              <div className="space-y-3 text-xs font-semibold pt-1 border-t border-rose-100/80">
                <label className="block text-slate-700 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-600" />
                  Geographic Eligibility
                </label>

                {/* Geographic Scope */}
                <select
                  value={geographicScope}
                  onChange={(e) => {
                    setGeographicScope(e.target.value);
                    setSelectedRegion('');
                    setSelectedProvince('');
                    setSelectedMunicipality('');
                  }}
                  className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:border-rose-500 cursor-pointer"
                >
                  <option value="Nationwide">Nationwide</option>
                  <option value="Region">Region</option>
                  <option value="Province">Province</option>
                  <option value="Municipality">Municipality / City</option>
                </select>

                {/* Region */}
                {geographicScope !== 'Nationwide' && (
                  <div>
                    <label className="block text-slate-700 mb-1">
                      Region
                    </label>

                    <select
                      value={selectedRegion}
                      onChange={(e) => {
                        setSelectedRegion(e.target.value);
                        setSelectedProvince('');
                        setSelectedMunicipality('');
                      }}
                      className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:border-rose-500 cursor-pointer"
                    >
                      <option value="">Select region</option>

                      {REGIONS.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Province */}
                {(geographicScope === 'Province' ||
                  geographicScope === 'Municipality') &&
                  selectedRegion && (
                    <div>
                      <label className="block text-slate-700 mb-1">
                        Province
                      </label>

                      <select
                        value={selectedProvince}
                        onChange={(e) => {
                          setSelectedProvince(e.target.value);
                          setSelectedMunicipality('');
                        }}
                        className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:border-rose-500 cursor-pointer"
                      >
                        <option value="">Select province</option>

                        {(PROVINCES[selectedRegion] || []).map((province) => (
                          <option key={province} value={province}>
                            {province}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                {/* Municipality */}
                {geographicScope === 'Municipality' &&
                  selectedProvince && (
                    <div>
                      <label className="block text-slate-700 mb-1">
                        Municipality / City
                      </label>

                      <select
                        value={selectedMunicipality}
                        onChange={(e) => setSelectedMunicipality(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:border-rose-500 cursor-pointer"
                      >
                        <option value="">Select municipality / city</option>

                        {(MUNICIPALITIES[selectedProvince] || []).map((municipality) => (
                          <option key={municipality} value={municipality}>
                            {municipality}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
              </div>

            {/* Custom Hard Filters */}
            <div className="space-y-2 text-xs font-semibold pt-1 border-t border-rose-100/80">
              <label className="block text-slate-700">Custom Provider Hard Requirements</label>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                <input 
                  type="text"
                  placeholder="Requirement Name"
                  value={newHardFilterLabel}
                  onChange={e => setNewHardFilterLabel(e.target.value)}
                  className="md:col-span-2 px-3.5 py-2 bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:border-rose-500"
                />
                <input 
                  type="text"
                  placeholder="Condition Value"
                  value={newHardFilterVal}
                  onChange={e => setNewHardFilterVal(e.target.value)}
                  className="md:col-span-2 px-3.5 py-2 bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:border-rose-500"
                />
                <button
                  type="button"
                  onClick={handleAddCustomHardFilter}
                  className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>

              {customHardFilters.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  {customHardFilters.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2.5 bg-white border border-rose-200/80 rounded-xl">
                      <div className="text-slate-800">
                        <span className="font-bold text-rose-900">{item.label}:</span> {item.value}
                      </div>
                      <button type="button" onClick={() => handleRemoveCustomHardFilter(item.id)} className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 3: SPECIAL ELIGIBILITY TAGS */}
        {/* SECTION 3: SPECIAL ELIGIBILITY TAGS */}
<div className="space-y-4">
  <div className="border-b border-slate-100 pb-2">
    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
        3
      </span>
      Special Eligibility Tags Configuration (Dynamic Gatekeeping)
    </h3>

    <p className="text-xs text-slate-500 mt-1">
      Classify demographic attributes as{" "}
      <strong>Required (Hard Gatekeeper)</strong> or{" "}
      <strong>Preferred (Ranking Affinity Weight)</strong>.
    </p>
  </div>

  {/* SYSTEM STANDARD TAGS */}
  <div className="space-y-2">
    <label className="block text-xs font-bold text-slate-700">
      System Standard Demographic Tags
    </label>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
      {SYSTEM_DEMOGRAPHIC_TAGS.map((tag) => {
        const isReq = requiredTags.includes(tag);
        const isPref = preferredTags.includes(tag);

        return (
          <div
            key={tag}
            className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between"
          >
            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-600" />
              {tag}
            </span>

            <div className="flex gap-1">
              {/* REQUIRED BUTTON */}
              <button
                type="button"
                onClick={() => toggleRequiredTag(tag)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  isReq
                    ? "bg-rose-600 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {isReq ? 'Required ("Only")' : "Require"}
              </button>

              {/* PREFERRED BUTTON */}
              <button
                type="button"
                onClick={() => togglePreferredTag(tag)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  isPref
                    ? "bg-indigo-600 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {isPref ? "Preferred" : "Prefer"}
              </button>
            </div>
          </div>
        );
      })}      
    </div>
  </div>

  {/* CUSTOM TAGS */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold pt-2">

    {/* ========================================= */}
    {/* CUSTOM REQUIRED TAGS */}
    {/* ========================================= */}
    <div className="space-y-3 p-3 bg-rose-50/50 rounded-xl border border-rose-100">

      <label className="block text-rose-900 font-bold">
        Add Custom Required Tag (Hard Filter)
      </label>

      {/* INPUT + BUTTON */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="e.g. Solo Parent First Gen"
          value={newCustomReqTag}
          onChange={(e) => setNewCustomReqTag(e.target.value)}
          className="flex-1 min-w-0 px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden"
        />

        <button
          type="button"
          onClick={handleAddCustomReqTag}
          className="shrink-0 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold transition-colors cursor-pointer"
        >
          Add Required
        </button>
      </div>

      {/* CUSTOM REQUIRED TAG LIST */}
      {requiredTags.filter(
        (tag) => !SYSTEM_DEMOGRAPHIC_TAGS.includes(tag)
      ).length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {requiredTags
            .filter(
              (tag) => !SYSTEM_DEMOGRAPHIC_TAGS.includes(tag)
            )
            .map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-rose-900 border border-rose-200 rounded-xl text-xs font-semibold"
              >
                <span className="truncate max-w-[180px]">
                  {tag}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setRequiredTags((prev) =>
                      prev.filter((t) => t !== tag)
                    )
                  }
                  className="shrink-0 text-rose-400 hover:text-rose-600 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
        </div>
      )}
    </div>

    {/* ========================================= */}
    {/* CUSTOM PREFERRED TAGS */}
    {/* ========================================= */}
    <div className="space-y-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">

      <label className="block text-indigo-900 font-bold">
        Add Custom Preferred Tag (Ranking Weight)
      </label>

      {/* INPUT + BUTTON */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="e.g. Tech Club Leader"
          value={newCustomPrefTag}
          onChange={(e) => setNewCustomPrefTag(e.target.value)}
          className="flex-1 min-w-0 px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden"
        />

        <button
          type="button"
          onClick={handleAddCustomPrefTag}
          className="shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-colors cursor-pointer"
        >
          Add Preferred
        </button>
      </div>

      {/* CUSTOM PREFERRED TAG LIST */}
      {preferredTags.filter(
        (tag) => !SYSTEM_DEMOGRAPHIC_TAGS.includes(tag)
      ).length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {preferredTags
            .filter(
              (tag) => !SYSTEM_DEMOGRAPHIC_TAGS.includes(tag)
            )
            .map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-indigo-900 border border-indigo-200 rounded-xl text-xs font-semibold"
              >
                <span className="truncate max-w-[180px]">
                  {tag}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setPreferredTags((prev) =>
                      prev.filter((t) => t !== tag)
                    )
                  }
                  className="shrink-0 text-indigo-400 hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
        </div>
      )}
    </div>

  </div>
</div>
        
        {/* SECTION 4: RANKING WEIGHTS */}
        <div className="space-y-4">
          <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">4</span>
                Provider-Defined Ranking Weight Distribution
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Customize relative evaluation weights for passed candidates (W<sub>GPA</sub> + W<sub>Income</sub> + W<sub>Tags</sub> = 100%).
              </p>
            </div>

            <div className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 ${
              totalWeight === 100 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              <Sliders className="w-3.5 h-3.5" />
              <span>Total Weight: {totalWeight}% / 100%</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                <span>Academic Score (W<sub>GPA</sub>)</span>
                <span className="text-emerald-700">{weights.gpaWeight}%</span>
              </div>
              <p className="text-[11px] text-slate-500">Boundaries: 20% Min – 70% Max</p>
              <input 
                type="range"
                min="20"
                max="70"
                value={weights.gpaWeight}
                onChange={e => setWeights(prev => ({ ...prev, gpaWeight: Number(e.target.value) }))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                <span>Financial Need (W<sub>Income</sub>)</span>
                <span className="text-emerald-700">{weights.incomeWeight}%</span>
              </div>
              <p className="text-[11px] text-slate-500">Boundaries: 20% Min – 70% Max</p>
              <input 
                type="range"
                min="20"
                max="70"
                value={weights.incomeWeight}
                onChange={e => setWeights(prev => ({ ...prev, incomeWeight: Number(e.target.value) }))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                <span>Preferred Tags (W<sub>Tags</sub>)</span>
                <span className="text-emerald-700">{weights.tagsWeight}%</span>
              </div>
              <p className="text-[11px] text-slate-500">Boundaries: 0% Min – 30% Max</p>
              <input 
                type="range"
                min="0"
                max="30"
                value={weights.tagsWeight}
                onChange={e => setWeights(prev => ({ ...prev, tagsWeight: Number(e.target.value) }))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>
          </div>
        </div>

    {/*}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">5</span>
            Required Documents Checklist
          </h3>
          
          <div className="flex gap-2">
            <input 
              type="text"
              placeholder="e.g. Certificate of Indigency or Income Tax Return"
              value={newReq}
              onChange={e => setNewReq(e.target.value)}
              className="flex-1 px-3.5 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={handleAddRequirement}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Document
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {requirements.map((req, idx) => (
              <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-semibold">
                {req}
                <button type="button" onClick={() => handleRemoveRequirement(idx)} className="hover:text-rose-600 transition-colors cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
        */}

        {/* SUBMIT ACTIONS & VALIDATION SUMMARY */}
        {/* SUBMIT ACTIONS & VALIDATION SUMMARY */}
<div className="pt-4 border-t border-slate-100 space-y-3">

  {/* ERROR MESSAGE */}
  {/* Validation / Error Banner */}
{errorMsg && (
  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3 text-xs shadow-sm">
    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />

    <div>
      <p className="font-bold text-rose-900">
        Unable to publish scholarship
      </p>

      <p className="text-rose-700 mt-1">
        {errorMsg}
      </p>
    </div>
  </div>
)}

  {/* ACTIONS */}
  <div className="flex items-center justify-between">

    <div className="text-xs text-slate-500 flex items-center gap-1.5">
      <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />

      <span>
        Backend enforces W<sub>GPA</sub> + W<sub>Income</sub> + W<sub>Tags</sub> = 100% validation prior to publishing.
      </span>
    </div>

    <div className="flex items-center gap-3">

      {/* CANCEL */}
      <button
        type="button"
        onClick={onBack}
        className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
      >
        Cancel
      </button>

      {/* PUBLISH */}
      <button
        type="submit"
        disabled={isSubmitting || totalWeight !== 100}
        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Publishing Listing...</span>
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            <span>
              {isEditMode
                ? 'Update Scholarship Listing'
                : 'Publish Scholarship Listing'}
            </span>
          </>
        )}
      </button>

    </div>
  </div>
</div>

      </form>

      {/* ========================================================= */}
      {/* CONFIRMATION MODAL */}
      {/* ========================================================= */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5">
            
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Confirm Scholarship Listing</h3>
                  <p className="text-xs text-slate-500">Please review key parameters before publishing live.</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowConfirmModal(false)} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Summary Box */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2.5 text-xs">
              <div>
                <span className="text-slate-500">Title:</span>
                <p className="font-bold text-slate-900">{title || 'Untitled Scholarship'}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                <div>
                  <span className="text-slate-500">Grant Value:</span>
                  <p className="font-semibold text-slate-800">{grantValue || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Category:</span>
                  <p className="font-semibold text-slate-800">{category}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60">
                <span className="text-slate-500 font-medium">Scoring Weights Distribution:</span>
                <div className="flex justify-between items-center mt-1 font-bold text-slate-800 bg-white p-2 rounded-lg border border-slate-200">
                  <span>GPA: {weights.gpaWeight}%</span>
                  <span>Income: {weights.incomeWeight}%</span>
                  <span>Tags: {weights.tagsWeight}%</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Publishing will make this listing active for matching against candidate profiles.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Go Back & Edit
              </button>
              <button
                type="button"
                onClick={handleExecutePublish}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirm & Publish
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUCCESS MODAL */}
      {/* ========================================================= */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl space-y-4">
            
            {/* Clean Checkmark Badge */}
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs border border-emerald-200">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">Scholarship Listing Published!</h3>
              <p className="text-xs text-slate-500 mt-1">
                <strong className="text-slate-800">{title}</strong> has been successfully registered and is now live for matching.
              </p>
            </div>

            <div className="bg-emerald-50/80 border border-emerald-100 rounded-xl p-3 text-left text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-900 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Status: Active</span>
              </div>
              <p className="text-emerald-700 text-[11px] pl-5">
                Applicants can now match against this listing based on your dynamic weight settings.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSuccessClose}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                Done & Return to Listings
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
