import { useCallback, useEffect, useRef, useState } from 'react';
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
import { API_BASE_URL } from '../../../config/api';
import {
  ACADEMIC_LEVELS,
  CITIZENSHIP_OPTIONS,
  SCHOLARSHIP_CATEGORIES,
  SYSTEM_DEMOGRAPHIC_TAGS,
  isStandardDemographicTag,
  liveDeadlineError,
  localDateInputValue,
  manilaDateInputValue,
  sanitizedListingText,
  validateListingForm
} from '../listingFormValidation';

const VALIDATION_SUMMARY = 'Please correct the highlighted fields before publishing.';

function FieldError({ field, message }) {
  if (!message) return null;

  return (
    <p id={`listing-${field}-error`} className="mt-1 text-[11px] font-medium text-rose-600" role="alert">
      {message}
    </p>
  );
}


export default function CreateListing({ onBack, onSuccess, initialData = null }) {
  const navigate = useNavigate();
  const isEditMode = Boolean(initialData?._id);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const publishLock = useRef(false);

  // Modal State Control
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCriterionRequestModal, setShowCriterionRequestModal] = useState(false);
  const [criterionRequests, setCriterionRequests] = useState([]);
  const [criterionRequestForm, setCriterionRequestForm] = useState({
    criterionName: '',
    criterionType: 'Preferred Tag',
    description: ''
  });
  const [criterionRequestError, setCriterionRequestError] = useState(null);
  const [criterionRequestSuccess, setCriterionRequestSuccess] = useState(null);
  const [isSubmittingCriterionRequest, setIsSubmittingCriterionRequest] = useState(false);

  // ---------------------------------------------------------
  // 1. BASIC PROGRAM METADATA
  // ---------------------------------------------------------
  const [title, setTitle] = useState('');
  const [grantValue, setGrantValue] = useState('');
  const [category, setCategory] = useState('Merit-Based');
  const [deadline, setDeadline] = useState('');
  const [portalUrl, setPortalUrl] = useState('');
  const [description, setDescription] = useState('');
  const [benefits, setBenefits] = useState([]);
  const [newBenefit, setNewBenefit] = useState('');

  // ---------------------------------------------------------
  // 2. HARD FILTERS (BOOLEAN GATEKEEPERS)
  // ---------------------------------------------------------
 const [academicLevel, setAcademicLevel] = useState('');
const [citizenship, setCitizenship] = useState('');
const [enableScale105, setEnableScale105] = useState(true);
const [maxGwa105, setMaxGwa105] = useState('');
const [enableScale60100, setEnableScale60100] = useState(false);
const [minGpa60100, setMinGpa60100] = useState('');
const [maxIncome, setMaxIncome] = useState('');

const [allowedCourses, setAllowedCourses] = useState([]);
const [newCourse, setNewCourse] = useState('');

const [geographicScope, setGeographicScope] = useState('Nationwide');
const [selectedRegion, setSelectedRegion] = useState('');
const [selectedProvince, setSelectedProvince] = useState('');
const [selectedMunicipality, setSelectedMunicipality] = useState('');

const [requiredTags, setRequiredTags] = useState([]);
const [preferredTags, setPreferredTags] = useState([]);

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
  setBenefits(
    Array.isArray(initialData.benefits)
      ? initialData.benefits
          .filter((benefit) => typeof benefit === 'string')
          .map((benefit) => benefit.trim())
          .filter(Boolean)
      : []
  );
  setNewBenefit('');
  setDeadline(manilaDateInputValue(initialData.deadline));
  setPortalUrl(initialData.applicationURL || '');

  // Academic requirements
  setAcademicLevel(
  initialData.hardFilters?.academicLevel || ''
  );

  setCitizenship(
    initialData.hardFilters?.citizenshipStatus || ''
  );

  const normalizeScale = (scale) => {
    if (scale === '1-5' || scale === '1.00-5.00') return '1.00-5.00';
    if (scale === '60-100') return '60-100';
    return null;
  };

  let loadedRequirements = Array.isArray(initialData.academicRequirements)
    ? initialData.academicRequirements
    : [];

  if (loadedRequirements.length === 0 && initialData.academicRequirement) {
    loadedRequirements = [initialData.academicRequirement];
  }

  setEnableScale105(false);
  setMaxGwa105('');
  setEnableScale60100(false);
  setMinGpa60100('');

  loadedRequirements.forEach((requirement) => {
    const scale = normalizeScale(requirement?.gradingScale);
    const value =
      requirement?.minimumGPA !== undefined &&
      requirement?.minimumGPA !== null
        ? requirement.minimumGPA.toString()
        : '';

    if (scale === '1.00-5.00') {
      setEnableScale105(true);
      setMaxGwa105(value);
    }

    if (scale === '60-100') {
      setEnableScale60100(true);
      setMinGpa60100(value);
    }
  });

  const loadedMonthlyIncome =
    initialData.incomeRequirement?.maxMonthlyIncome ??
    initialData.incomeRequirement?.maximumIncome;

  setMaxIncome(
    loadedMonthlyIncome !== undefined &&
    loadedMonthlyIncome !== null &&
    loadedMonthlyIncome !== ''
      ? loadedMonthlyIncome.toString()
      : ''
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
      .filter(
        (tag) =>
          tag.mode === 'Exclusive' &&
          isStandardDemographicTag(tag.tagName)
      )
      .map((tag) => tag.tagName)
  );

  setPreferredTags(
    tags
      .filter(
        (tag) =>
          tag.mode === 'Preferred' &&
          isStandardDemographicTag(tag.tagName)
      )
      .map((tag) => tag.tagName)
  );

}, [initialData]);

  const fetchCriterionRequests = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return Promise.resolve(null);

    return fetch(`${API_BASE_URL}/providers/eligibility-criterion-requests`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return null;
        return Array.isArray(data.requests) ? data.requests : [];
      })
      .catch((err) => {
        console.warn('Unable to load eligibility criterion requests:', err);
        return null;
      });
  }, []);

  const loadCriterionRequests = useCallback(
    () =>
      fetchCriterionRequests().then((requests) => {
        if (requests) setCriterionRequests(requests);
      }),
    [fetchCriterionRequests]
  );

  useEffect(() => {
    let ignore = false;

    fetchCriterionRequests().then((requests) => {
      if (ignore || !requests) return;
      setCriterionRequests(requests);
    });

    return () => {
      ignore = true;
    };
  }, [fetchCriterionRequests]);

  // ---------------------------------------------------------
  // HANDLERS: HARD FILTERS (COURSES, LOCATIONS)
  // ---------------------------------------------------------
  const handleAddBenefit = () => {
    const benefit = newBenefit.trim();
    if (!benefit) return;
    setBenefits((prev) => (prev.includes(benefit) ? prev : [...prev, benefit]));
    setNewBenefit('');
  };

  const handleRemoveBenefit = (index) => {
    setBenefits((prev) => prev.filter((_, idx) => idx !== index));
  };

  const buildBenefits = () => {
    const pendingBenefit = newBenefit.trim();

    return [...benefits, pendingBenefit]
      .map((benefit) => benefit.trim())
      .filter(Boolean)
      .filter((benefit, index, list) => list.indexOf(benefit) === index);
  };

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

  const openCriterionRequestModal = () => {
    setCriterionRequestForm({
      criterionName: '',
      criterionType: 'Preferred Tag',
      description: ''
    });
    setCriterionRequestError(null);
    setCriterionRequestSuccess(null);
    setShowCriterionRequestModal(true);
  };

  const closeCriterionRequestModal = () => {
    if (isSubmittingCriterionRequest) return;
    setShowCriterionRequestModal(false);
  };

  const handleSubmitCriterionRequest = async (e) => {
    e.preventDefault();
    setCriterionRequestError(null);
    setCriterionRequestSuccess(null);

    const criterionName = criterionRequestForm.criterionName.trim();
    const description = criterionRequestForm.description.trim();

    if (!criterionName) {
      setCriterionRequestError('Criterion name is required.');
      return;
    }

    if (!description) {
      setCriterionRequestError(
        'Description is required. Explain what the criterion means and why it is needed.'
      );
      return;
    }

    const token = localStorage.getItem('token');

    if (!token) {
      setCriterionRequestError('Authentication token not found. Please log in again.');
      return;
    }

    setIsSubmittingCriterionRequest(true);

    try {
      const res = await fetch(`${API_BASE_URL}/providers/eligibility-criterion-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          criterionName,
          criterionType: criterionRequestForm.criterionType,
          description
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Unable to submit eligibility criterion request.');
      }

      setCriterionRequestSuccess(
        data.message ||
          'Eligibility criterion request submitted successfully. An administrator will review this request before it can be used for scholarship matching.'
      );
      await loadCriterionRequests();
    } catch (err) {
      setCriterionRequestError(err.message);
    } finally {
      setIsSubmittingCriterionRequest(false);
    }
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
  const minDeadline = localDateInputValue();

  const listingValues = () => ({
    title,
    grantValue,
    category,
    deadline,
    portalUrl,
    description,
    benefits,
    academicLevel,
    citizenship,
    enableScale105,
    maxGwa105,
    enableScale60100,
    minGpa60100,
    maxIncome,
    allowedCourses,
    geographicScope,
    selectedRegion,
    selectedProvince,
    selectedMunicipality,
    requiredTags,
    preferredTags,
    weights
  });

  const derivedErrors = validateListingForm(listingValues(), minDeadline);
  const fieldErrors = showFieldErrors
    ? derivedErrors
    : {
        ...(liveDeadlineError(deadline, minDeadline) ? { deadline: derivedErrors.deadline } : {}),
        ...(derivedErrors.weights ? { weights: derivedErrors.weights } : {})
      };
  const bannerMessage = errorMsg || (
    showFieldErrors && Object.keys(derivedErrors).length > 0 ? VALIDATION_SUMMARY : null
  );

  const rejectInvalidListing = (errors) => {
    setShowFieldErrors(true);
    setErrorMsg(null);
    const firstField = Object.keys(errors)[0];
    document.getElementById(`listing-${firstField}`)?.focus();
  };

  const buildAcademicRequirements = () => {
    const requirements = [];

    if (enableScale105) {
      requirements.push({
        gradingScale: '1.00-5.00',
        minimumGPA: parseFloat(maxGwa105)
      });
    }

    if (enableScale60100) {
      requirements.push({
        gradingScale: '60-100',
        minimumGPA: parseFloat(minGpa60100)
      });
    }

    return requirements;
  };

const handleOpenConfirmModal = (e) => {
  e.preventDefault();

  if (isSubmitting || publishLock.current) return;

  const errors = validateListingForm(listingValues(), minDeadline);

  if (Object.keys(errors).length > 0) {
    rejectInvalidListing(errors);
    return;
  }

  setErrorMsg(null);
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
    'academicRequirements': 'Academic Grading Scale Requirements',
    'description': 'Program Description',
    'applicationURL': 'Application URL',
    'name': 'Scholarship Name',
    'scholarshipType': 'Scholarship Type',
    'deadline': 'Application Deadline',
    'incomeRequirement.maximumIncome': 'Maximum Household Monthly Income',
    'incomeRequirement.maxMonthlyIncome': 'Maximum Household Monthly Income'
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
  if (publishLock.current || isSubmitting) return;

  const errors = validateListingForm(listingValues(), minDeadline);

  if (Object.keys(errors).length > 0) {
    setShowConfirmModal(false);
    rejectInvalidListing(errors);
    return;
  }

  publishLock.current = true;
  setShowConfirmModal(false);
  setIsSubmitting(true);
  setErrorMsg(null);

  const cleaned = sanitizedListingText({
    ...listingValues(),
    benefits: buildBenefits()
  });

  const newListingPayload = {
    name: cleaned.name,
    grantValue: cleaned.grantValue,
    scholarshipType: category,
    description: cleaned.description,

    benefits: cleaned.benefits,

    academicRequirements: buildAcademicRequirements(),

    hardFilters: {
      academicLevel: academicLevel.trim(),
      courseProgram: cleaned.courses,
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
      citizenshipStatus: citizenship.trim()
    },

    incomeRequirement: {
      maxMonthlyIncome:
        String(maxIncome).trim() === '' ? null : Number(String(maxIncome).trim())
    },

    specialTags: [
      ...requiredTags
        .filter(isStandardDemographicTag)
        .map((tag) => ({
          tagName: tag,
          mode: 'Exclusive'
        })),
      ...preferredTags
        .filter(isStandardDemographicTag)
        .map((tag) => ({
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
    deadline: String(deadline).trim(),
    applicationURL: cleaned.applicationURL,

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
      ? `${API_BASE_URL}/scholarships/${initialData._id}`
      : `${API_BASE_URL}/scholarships`;

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

    setShowSuccessModal(true);

  } catch (err) {
    console.error('Scholarship Publish Error:', err);

    setShowSuccessModal(false);
    setErrorMsg(
      formatPublishError(err.message)
    );
  } finally {
    publishLock.current = false;
    setIsSubmitting(false);
  }
};


// Navigate to Scholarship Listings only after a successful save.
// Edit is rendered inside the listings page, so a same-route navigate
// does not leave the form. onSuccess clears that embedded view.
const handleBack = () => {
  if (typeof onBack === 'function') {
    onBack();
    return;
  }

  navigate('/dashboard/provider/listings');
};

const handleSuccessClose = () => {
  setShowSuccessModal(false);

  if (isEditMode && typeof onSuccess === 'function') {
    onSuccess();
  }

  navigate('/dashboard/provider/listings');
};

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 relative">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleBack}
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
      

      <form noValidate onSubmit={handleOpenConfirmModal} className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-8">
        
        {/* SECTION 1: PROGRAM METADATA */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">1</span>
            Basic Program Details
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
            <div className="md:col-span-2">
              <label className="block text-slate-700 mb-1" htmlFor="listing-title">Scholarship Program Title *</label>
              <input 
                id="listing-title"
                type="text"
                required
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.title)}
                aria-describedby={fieldErrors.title ? 'listing-title-error' : undefined}
                placeholder="e.g. DOST-SEI Merit Scholarship Program 2026"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className={`w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border focus:outline-hidden focus:border-emerald-500 ${fieldErrors.title ? 'border-rose-400' : 'border-slate-200'}`}
              />
              <FieldError field="title" message={fieldErrors.title} />
            </div>

            <div>
              <label className="block text-slate-700 mb-1" htmlFor="listing-grantValue">Grant / Financial Value *</label>
              <input 
                id="listing-grantValue"
                type="text"
                required
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.grantValue)}
                aria-describedby={fieldErrors.grantValue ? 'listing-grantValue-error' : undefined}
                placeholder="e.g. ₱40,000 / semester"
                value={grantValue}
                onChange={e => setGrantValue(e.target.value)}
                className={`w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border focus:outline-hidden focus:border-emerald-500 ${fieldErrors.grantValue ? 'border-rose-400' : 'border-slate-200'}`}
              />
              <FieldError field="grantValue" message={fieldErrors.grantValue} />
            </div>

            <div>
              <label className="block text-slate-700 mb-1" htmlFor="listing-category">Category *</label>
              <select 
                id="listing-category"
                value={category}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.category)}
                aria-describedby={fieldErrors.category ? 'listing-category-error' : undefined}
                onChange={e => setCategory(e.target.value)}
                className={`w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border focus:outline-hidden focus:border-emerald-500 cursor-pointer ${fieldErrors.category ? 'border-rose-400' : 'border-slate-200'}`}
              >
                {SCHOLARSHIP_CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option === 'STEM' ? 'STEM Specialized' : option}
                  </option>
                ))}
              </select>
              <FieldError field="category" message={fieldErrors.category} />
            </div>

            <div>
              <label className="block text-slate-700 mb-1" htmlFor="listing-deadline">Application Deadline *</label>
              <input 
                id="listing-deadline"
                type="date"
                required
                min={minDeadline}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.deadline)}
                aria-describedby={fieldErrors.deadline ? 'listing-deadline-error' : undefined}
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className={`listing-deadline w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border focus:outline-hidden focus:border-emerald-500 ${fieldErrors.deadline ? 'border-rose-400 text-slate-400' : 'border-slate-200'}`}
              />
              <FieldError field="deadline" message={fieldErrors.deadline} />
            </div>

            <div>
              <label className="block text-slate-700 mb-1" htmlFor="listing-portalUrl">External Application Portal URL *</label>
              <input 
                id="listing-portalUrl"
                type="url"
                required
                inputMode="url"
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.portalUrl)}
                aria-describedby={fieldErrors.portalUrl ? 'listing-portalUrl-error' : undefined}
                placeholder="https://provider.gov.ph/apply"
                value={portalUrl}
                onChange={e => setPortalUrl(e.target.value)}
                className={`w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border focus:outline-hidden focus:border-emerald-500 ${fieldErrors.portalUrl ? 'border-rose-400' : 'border-slate-200'}`}
              />
              <FieldError field="portalUrl" message={fieldErrors.portalUrl} />
            </div>

            <div className="md:col-span-2">
              <label className="block text-slate-700 mb-1" htmlFor="listing-description">Program Overview & Description *</label>
              <textarea 
                id="listing-description"
                rows={3}
                required
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.description)}
                aria-describedby={fieldErrors.description ? 'listing-description-error' : undefined}
                placeholder="Provide a summary of coverage, stipulations, obligations, and perks..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className={`w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border focus:outline-hidden focus:border-emerald-500 ${fieldErrors.description ? 'border-rose-400' : 'border-slate-200'}`}
              />
              <FieldError field="description" message={fieldErrors.description} />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="block text-slate-700 flex items-center justify-between">
                <span>Scholarship Benefits</span>
                <span className="text-[10px] text-slate-400 font-normal">Optional</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Full tuition coverage"
                  value={newBenefit}
                  onChange={(e) => setNewBenefit(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddBenefit();
                    }
                  }}
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAddBenefit}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Benefit
                </button>
              </div>
              {benefits.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {benefits.map((benefit, idx) => (
                    <span
                      key={`${benefit}-${idx}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-slate-800 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs"
                    >
                      {benefit}
                      <button
                        type="button"
                        onClick={() => handleRemoveBenefit(idx)}
                        className="hover:text-rose-600 transition-colors cursor-pointer"
                        aria-label={`Remove ${benefit}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <FieldError field="benefits" message={fieldErrors.benefits} />
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
              Applicants who miss any requirement in this section are excluded from matching. Supported requirements are academic level, citizenship, grading scale, maximum household income, course or program, and geographic eligibility.
            </p>
          </div>

          <div className="bg-rose-50/40 border border-rose-100 rounded-2xl p-4 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 mb-1 flex items-center gap-1" htmlFor="listing-academicLevel">
                  <BookOpen className="w-3.5 h-3.5 text-rose-600" /> Academic Level Constraint *
                </label>
                <select 
                  id="listing-academicLevel"
                  value={academicLevel}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.academicLevel)}
                  aria-describedby={fieldErrors.academicLevel ? 'listing-academicLevel-error' : undefined}
                  onChange={e => setAcademicLevel(e.target.value)}
                  className={`w-full px-3.5 py-2.5 bg-white rounded-xl border focus:outline-hidden focus:border-rose-500 cursor-pointer ${fieldErrors.academicLevel ? 'border-rose-400' : 'border-slate-200'}`}
                >
                  <option value="" disabled>
                    Select academic level
                  </option>

                  {ACADEMIC_LEVELS.map((option) => (
                    <option key={option} value={option}>
                      {option === 'College'
                        ? 'College / Undergraduate'
                        : option === 'Graduate Studies'
                          ? "Graduate Studies (Master's / PhD)"
                          : option}
                    </option>
                  ))}
                </select>
                <FieldError field="academicLevel" message={fieldErrors.academicLevel} />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 flex items-center gap-1" htmlFor="listing-citizenship">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Mandatory Citizenship *
                </label>
                <select 
                  id="listing-citizenship"
                  value={citizenship}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.citizenship)}
                  aria-describedby={fieldErrors.citizenship ? 'listing-citizenship-error' : undefined}
                  onChange={e => setCitizenship(e.target.value)}
                  className={`w-full px-3.5 py-2.5 bg-white rounded-xl border focus:outline-hidden focus:border-rose-500 cursor-pointer ${fieldErrors.citizenship ? 'border-rose-400' : 'border-slate-200'}`}
                >
                  <option value="" disabled>
                    Select citizenship requirement
                  </option>

                  {CITIZENSHIP_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === 'Filipino' ? 'Filipino Citizen Only' : 'Open to Any Citizenship'}
                    </option>
                  ))}
                </select>
                <FieldError field="citizenship" message={fieldErrors.citizenship} />
              </div>

              <div className="md:col-span-2 space-y-3">
                <label className="block text-slate-700 flex items-center gap-1" id="listing-gradingScale">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Accepted Grading Scales *
                </label>
                <p className="text-[10px] text-slate-400 font-normal">
                  Select at least one scale. Students matching any selected scale can be accepted.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                    <label className="flex items-center gap-2 text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableScale105}
                        onChange={(e) => setEnableScale105(e.target.checked)}
                      />
                      1.00 - 5.00
                    </label>
                    {enableScale105 && (
                      <>
                        <label className="block text-slate-700" htmlFor="listing-maxGwa105">
                          Maximum Allowable GWA *
                        </label>
                        <input
                          id="listing-maxGwa105"
                          type="number"
                          min="1"
                          max="5"
                          step="0.01"
                          inputMode="decimal"
                          aria-required="true"
                          aria-invalid={Boolean(fieldErrors.maxGwa105)}
                          aria-describedby={fieldErrors.maxGwa105 ? 'listing-maxGwa105-error' : undefined}
                          placeholder="e.g. 2.50"
                          value={maxGwa105}
                          onChange={(e) => setMaxGwa105(e.target.value)}
                          className={`w-full px-3.5 py-2.5 bg-white rounded-xl border focus:outline-hidden focus:border-rose-500 ${fieldErrors.maxGwa105 ? 'border-rose-400' : 'border-slate-200'}`}
                        />
                        <FieldError field="maxGwa105" message={fieldErrors.maxGwa105} />
                        <p className="text-[10px] text-slate-400 font-normal">
                          Lower value is better.
                        </p>
                      </>
                    )}
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                    <label className="flex items-center gap-2 text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableScale60100}
                        onChange={(e) => setEnableScale60100(e.target.checked)}
                      />
                      60 - 100
                    </label>
                    {enableScale60100 && (
                      <>
                        <label className="block text-slate-700" htmlFor="listing-minGpa60100">
                          Minimum Required GPA *
                        </label>
                        <input
                          id="listing-minGpa60100"
                          type="number"
                          min="60"
                          max="100"
                          step="0.01"
                          inputMode="decimal"
                          aria-required="true"
                          aria-invalid={Boolean(fieldErrors.minGpa60100)}
                          aria-describedby={fieldErrors.minGpa60100 ? 'listing-minGpa60100-error' : undefined}
                          placeholder="e.g. 85"
                          value={minGpa60100}
                          onChange={(e) => setMinGpa60100(e.target.value)}
                          className={`w-full px-3.5 py-2.5 bg-white rounded-xl border focus:outline-hidden focus:border-rose-500 ${fieldErrors.minGpa60100 ? 'border-rose-400' : 'border-slate-200'}`}
                        />
                        <FieldError field="minGpa60100" message={fieldErrors.minGpa60100} />
                        <p className="text-[10px] text-slate-400 font-normal">
                          Higher value is better.
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <FieldError field="gradingScale" message={fieldErrors.gradingScale} />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 flex items-center gap-1" htmlFor="listing-maxIncome">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Maximum Household Monthly Income
                </label>
                <input 
                  id="listing-maxIncome"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="decimal"
                  aria-invalid={Boolean(fieldErrors.maxIncome)}
                  aria-describedby={fieldErrors.maxIncome ? 'listing-maxIncome-error' : undefined}
                  placeholder="e.g. 30000"
                  value={maxIncome}
                  onChange={e => setMaxIncome(e.target.value)}
                  className={`w-full px-3.5 py-2.5 bg-white rounded-xl border focus:outline-hidden focus:border-rose-500 ${fieldErrors.maxIncome ? 'border-rose-400' : 'border-slate-200'}`}
                />
                <FieldError field="maxIncome" message={fieldErrors.maxIncome} />
                <p className="text-[10px] text-slate-400 font-normal mt-1">
                  Enter a peso amount without ₱ or commas. Leave blank if there is no income ceiling.
                </p>
              </div>
            </div>

            {/* Courses */}
            <div className="space-y-2 text-xs font-semibold pt-1 border-t border-rose-100/80">
              <label className="block text-slate-700 flex items-center justify-between">
                <span>Course / Program</span>
                <span className="text-[10px] text-slate-400 font-normal">Leave empty to allow every program</span>
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
              <FieldError field="allowedCourses" message={fieldErrors.allowedCourses} />
            </div>

            {/* Locations */}
            {/* Geographic Eligibility */}
              <div className="space-y-3 text-xs font-semibold pt-1 border-t border-rose-100/80">
                <label className="block text-slate-700 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-600" />
                  Geographic Eligibility
                </label>
                <p className="text-[10px] text-slate-400 font-normal">
                  Nationwide accepts every region. Region, province, and municipality limits require the student location to match.
                </p>

                {/* Geographic Scope */}
                <select
                  id="listing-geographicScope"
                  value={geographicScope}
                  aria-invalid={Boolean(fieldErrors.geographicScope)}
                  aria-describedby={fieldErrors.geographicScope ? 'listing-geographicScope-error' : undefined}
                  onChange={(e) => {
                    setGeographicScope(e.target.value);
                    setSelectedRegion('');
                    setSelectedProvince('');
                    setSelectedMunicipality('');
                  }}
                  className={`w-full px-3.5 py-2.5 bg-white rounded-xl border focus:outline-hidden focus:border-rose-500 cursor-pointer ${fieldErrors.geographicScope ? 'border-rose-400' : 'border-slate-200'}`}
                >
                  <option value="Nationwide">Nationwide</option>
                  <option value="Region">Region</option>
                  <option value="Province">Province</option>
                  <option value="Municipality">Municipality / City</option>
                </select>
                <FieldError field="geographicScope" message={fieldErrors.geographicScope} />

                {/* Region */}
                {geographicScope !== 'Nationwide' && (
                  <div>
                    <label className="block text-slate-700 mb-1" htmlFor="listing-selectedRegion">
                      Region *
                    </label>

                    <select
                      id="listing-selectedRegion"
                      aria-required="true"
                      aria-invalid={Boolean(fieldErrors.selectedRegion)}
                      aria-describedby={fieldErrors.selectedRegion ? 'listing-selectedRegion-error' : undefined}
                      value={selectedRegion}
                      onChange={(e) => {
                        setSelectedRegion(e.target.value);
                        setSelectedProvince('');
                        setSelectedMunicipality('');
                      }}
                      className={`w-full px-3.5 py-2.5 bg-white rounded-xl border focus:outline-hidden focus:border-rose-500 cursor-pointer ${fieldErrors.selectedRegion ? 'border-rose-400' : 'border-slate-200'}`}
                    >
                      <option value="">Select region</option>

                      {REGIONS.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </select>
                    <FieldError field="selectedRegion" message={fieldErrors.selectedRegion} />
                  </div>
                )}

                {/* Province */}
                {(geographicScope === 'Province' ||
                  geographicScope === 'Municipality') &&
                  selectedRegion && (
                    <div>
                      <label className="block text-slate-700 mb-1" htmlFor="listing-selectedProvince">
                        Province *
                      </label>

                      <select
                        id="listing-selectedProvince"
                        aria-required="true"
                        aria-invalid={Boolean(fieldErrors.selectedProvince)}
                        aria-describedby={fieldErrors.selectedProvince ? 'listing-selectedProvince-error' : undefined}
                        value={selectedProvince}
                        onChange={(e) => {
                          setSelectedProvince(e.target.value);
                          setSelectedMunicipality('');
                        }}
                        className={`w-full px-3.5 py-2.5 bg-white rounded-xl border focus:outline-hidden focus:border-rose-500 cursor-pointer ${fieldErrors.selectedProvince ? 'border-rose-400' : 'border-slate-200'}`}
                      >
                        <option value="">Select province</option>

                        {(PROVINCES[selectedRegion] || []).map((province) => (
                          <option key={province} value={province}>
                            {province}
                          </option>
                        ))}
                      </select>
                      <FieldError field="selectedProvince" message={fieldErrors.selectedProvince} />
                    </div>
                  )}

                {/* Municipality */}
                {geographicScope === 'Municipality' &&
                  selectedProvince && (
                    <div>
                      <label className="block text-slate-700 mb-1" htmlFor="listing-selectedMunicipality">
                        Municipality / City *
                      </label>

                      <select
                        id="listing-selectedMunicipality"
                        aria-required="true"
                        aria-invalid={Boolean(fieldErrors.selectedMunicipality)}
                        aria-describedby={fieldErrors.selectedMunicipality ? 'listing-selectedMunicipality-error' : undefined}
                        value={selectedMunicipality}
                        onChange={(e) => setSelectedMunicipality(e.target.value)}
                        className={`w-full px-3.5 py-2.5 bg-white rounded-xl border focus:outline-hidden focus:border-rose-500 cursor-pointer ${fieldErrors.selectedMunicipality ? 'border-rose-400' : 'border-slate-200'}`}
                      >
                        <option value="">Select municipality / city</option>

                        {(MUNICIPALITIES[selectedProvince] || []).map((municipality) => (
                          <option key={municipality} value={municipality}>
                            {municipality}
                          </option>
                        ))}
                      </select>
                      <FieldError field="selectedMunicipality" message={fieldErrors.selectedMunicipality} />
                    </div>
                  )}
              </div>

          </div>
        </div>

        {/* SECTION 3: SPECIAL ELIGIBILITY TAGS */}
<div className="space-y-4">
  <div className="border-b border-slate-100 pb-2">
    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
        3
      </span>
      Special Eligibility Tags
    </h3>

    <p className="text-xs text-slate-500 mt-1">
      Required tags exclude students who do not have them. Preferred tags are used only to rank students who already pass the hard requirements. Matching uses these eight standard tags.
    </p>
  </div>

  {/* SYSTEM STANDARD TAGS */}
  <div className="space-y-2">
    <label className="block text-xs font-bold text-slate-700">
      Standard tags
    </label>
    <p className="text-[10px] text-slate-400 font-normal">
      A tag can be required or preferred, not both. Leave a tag unset if it should not affect this listing.
    </p>

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
    <FieldError field="tags" message={fieldErrors.tags} />
  </div>

  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3.5 space-y-3">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <p className="text-xs font-bold text-slate-800">
          Don't see the eligibility criterion you need?
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Request a Preferred, Exclusive, or Hard Eligibility tag. The request starts as Pending, stays visible on this account, and is not used for matching.
        </p>
      </div>
      <button
        type="button"
        onClick={openCriterionRequestModal}
        className="shrink-0 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
      >
        Request New Criterion
      </button>
    </div>

    {criterionRequests.length > 0 && (
      <div className="space-y-1.5">
        {criterionRequests.map((request) => (
          <div
            key={request._id}
            className="rounded-lg bg-white border border-slate-200 px-3 py-2 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {request.criterionName}
                </p>
                <p className="text-[10px] text-slate-500">
                  {request.criterionType}
                  {request.createdAt
                    ? ` · Submitted ${new Date(request.createdAt).toLocaleDateString()}`
                    : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span
                  className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold ${
                    request.status === 'Approved'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : request.status === 'Rejected'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {request.status === 'Pending' ? 'Pending review' : request.status}
                </span>
                {request.status === 'Approved' && (
                  <span
                    className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold ${
                      request.fulfillmentStatus === 'Done'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : request.fulfillmentStatus === 'In Progress'
                          ? 'bg-sky-50 text-sky-700 border-sky-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {request.fulfillmentStatus || 'Pending'}
                  </span>
                )}
              </div>
            </div>
            {request.status === 'Rejected' && request.rejectionReason && (
              <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-1.5">
                Admin feedback: {request.rejectionReason}
              </p>
            )}
          </div>
        ))}
      </div>
    )}
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
                Ranking applies only after a student passes every hard requirement. The default is 40% academic, 40% income, and 20% preferred tags. The three weights must total 100%.
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
          <div id="listing-weights">
            <FieldError field="weights" message={fieldErrors.weights} />
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
{bannerMessage && (
  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3 text-xs shadow-sm">
    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />

    <div>
      <p className="font-bold text-rose-900">
        Unable to publish scholarship
      </p>

      <p className="text-rose-700 mt-1">
        {bannerMessage}
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
        onClick={handleBack}
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
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
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

      {showCriterionRequestModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Request New Criterion</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  An administrator reviews this before it can become an official matching criterion.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCriterionRequestModal}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {criterionRequestSuccess ? (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 text-xs">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-emerald-800 font-medium">{criterionRequestSuccess}</p>
                </div>
                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={closeCriterionRequestModal}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitCriterionRequest} className="space-y-4">
                <div className="text-xs font-semibold">
                  <label htmlFor="criterionName" className="block text-slate-700 mb-1">
                    Criterion Name
                  </label>
                  <input
                    id="criterionName"
                    type="text"
                    required
                    maxLength={120}
                    value={criterionRequestForm.criterionName}
                    onChange={(e) =>
                      setCriterionRequestForm((prev) => ({
                        ...prev,
                        criterionName: e.target.value
                      }))
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 font-semibold focus:outline-hidden focus:border-indigo-500"
                    placeholder="Name of the eligibility criterion"
                  />
                </div>

                <div className="text-xs font-semibold">
                  <label htmlFor="criterionType" className="block text-slate-700 mb-1">
                    Classification
                  </label>
                  <select
                    id="criterionType"
                    required
                    value={criterionRequestForm.criterionType}
                    onChange={(e) =>
                      setCriterionRequestForm((prev) => ({
                        ...prev,
                        criterionType: e.target.value
                      }))
                    }
                    className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="Preferred Tag">Preferred Tag</option>
                    <option value="Exclusive Tag">Exclusive Tag</option>
                    <option value="Hard Eligibility Tag">Hard Eligibility Tag</option>
                  </select>
                  <p className="mt-1 text-[11px] font-medium text-slate-500">
                    Preferred tags affect ranking. Exclusive and Hard Eligibility tags describe requirements a student must meet. Submitting a request does not add it to matching.
                  </p>
                </div>

                <div className="text-xs font-semibold">
                  <label htmlFor="criterionDescription" className="block text-slate-700 mb-1">
                    Description / Justification
                  </label>
                  <textarea
                    id="criterionDescription"
                    required
                    rows={4}
                    maxLength={2000}
                    value={criterionRequestForm.description}
                    onChange={(e) =>
                      setCriterionRequestForm((prev) => ({
                        ...prev,
                        description: e.target.value
                      }))
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 font-medium focus:outline-hidden focus:border-indigo-500 resize-y"
                    placeholder="Explain what this criterion means and why it is needed."
                  />
                </div>

                {criterionRequestError && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2 text-xs">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <p className="text-rose-700">{criterionRequestError}</p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={closeCriterionRequestModal}
                    disabled={isSubmittingCriterionRequest}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingCriterionRequest}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmittingCriterionRequest ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Request'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
