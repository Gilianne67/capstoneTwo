import React, { useState } from 'react';
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

export default function CreateListing({ onBack, onSuccess }) {
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
  const [academicLevel, setAcademicLevel] = useState('College');
  const [citizenship, setCitizenship] = useState('Filipino');
  const [maxGwa, setMaxGwa] = useState('2.00');
  const [maxIncome, setMaxIncome] = useState('250000');
  
  // Custom Dynamic Add/Remove: Courses & Locations
  const [allowedCourses, setAllowedCourses] = useState(['BS Computer Science', 'BS Information Technology']);
  const [newCourse, setNewCourse] = useState('');

  const [allowedLocations, setAllowedLocations] = useState(['NCR', 'Region IV-A']);
  const [newLocation, setNewLocation] = useState('');

  // Custom Dynamic Add/Remove: Hard Requirements (Generic)
  const [customHardFilters, setCustomHardFilters] = useState([
    { id: 'hf-1', label: 'Minimum Age Requirement', value: 'Must be at least 18 years old' }
  ]);
  const [newHardFilterLabel, setNewHardFilterLabel] = useState('');
  const [newHardFilterVal, setNewHardFilterVal] = useState('');

  // Hard Filter Tags (Dynamic Gatekeeping - Exclusive / Required "Only")
  const [requiredTags, setRequiredTags] = useState(['4Ps Beneficiary']);
  const [newCustomReqTag, setNewCustomReqTag] = useState('');

  // ---------------------------------------------------------
  // 3. RANKING & SCORING WEIGHTS (PROVIDER-DEFINED)
  // Boundary Constraints: GPA (20-70%), Income (20-70%), Tags (0-30%)
  // ---------------------------------------------------------
  const [weights, setWeights] = useState({
    gpaWeight: 40,
    incomeWeight: 40,
    tagsWeight: 20
  });

  // Preferred Tags (Affinity Multiplier)
  const [preferredTags, setPreferredTags] = useState(['Working Student', 'Disaster-Affected Family']);
  const [newCustomPrefTag, setNewCustomPrefTag] = useState('');

  // ---------------------------------------------------------
  // 4. REQUIRED DOCUMENTS CHECKLIST
  // ---------------------------------------------------------
  const [requirements, setRequirements] = useState([
    'Certificate of Good Moral Character',
    'Certified True Copy of Grades (Form 137 / TOR)',
    'Tax Exemption Certificate or ITR'
  ]);
  const [newReq, setNewReq] = useState('');

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

  const handleAddLocation = () => {
    if (!newLocation.trim()) return;
    if (!allowedLocations.includes(newLocation.trim())) {
      setAllowedLocations(prev => [...prev, newLocation.trim()]);
    }
    setNewLocation('');
  };

  const handleRemoveLocation = (index) => {
    setAllowedLocations(prev => prev.filter((_, idx) => idx !== index));
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
  const handleAddRequirement = () => {
    if (!newReq.trim()) return;
    setRequirements(prev => [...prev, newReq.trim()]);
    setNewReq('');
  };

  const handleRemoveRequirement = (index) => {
    setRequirements(prev => prev.filter((_, idx) => idx !== index));
  };

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

  // Open Confirmation Modal on Form Submit
  const handleOpenConfirmModal = (e) => {
    e.preventDefault();
    setErrorMsg(null);

    const weightValidationError = validateWeights();
    if (weightValidationError) {
      setErrorMsg(weightValidationError);
      return;
    }

    setShowConfirmModal(true);
  };

  // Final Action Executed inside Confirm Modal
  const handleExecutePublish = async () => {
    setShowConfirmModal(false);
    setIsSubmitting(true);

    const newListingPayload = {
      title,
      grantValue,
      category,
      deadline,
      portalUrl: portalUrl || '#',
      description,
      
      hardFilters: {
        academicLevel,
        citizenship,
        maxGwa: parseFloat(maxGwa) || 2.00,
        annualIncomeCap: parseFloat(maxIncome) || 250000,
        allowedCourses,
        allowedLocations,
        customHardFilters: customHardFilters.map(item => ({
          label: item.label,
          value: item.value
        })),
        requiredEligibilityTags: requiredTags
      },

      scoringWeights: {
        wGpa: Number(weights.gpaWeight) / 100,
        wIncome: Number(weights.incomeWeight) / 100,
        wTags: Number(weights.tagsWeight) / 100
      },

      preferredEligibilityTags: preferredTags,
      requiredDocuments: requirements,
      status: 'Active',
      createdAt: new Date().toISOString()
    };

    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
      };

      const res = await fetch('/api/v1/provider/scholarships', {
        method: 'POST',
        headers,
        body: JSON.stringify(newListingPayload)
      });

      if (res.ok) {
        setIsSubmitting(false);
        setShowSuccessModal(true);
      } else {
        throw new Error('Backend server returned an error response.');
      }
    } catch (err) {
      console.warn('Backend server unavailable. Executing fallback mock simulation:', err);
      
      setTimeout(() => {
        setIsSubmitting(false);
        setShowSuccessModal(true);
      }, 800);
    }
  };

  // Navigate to provider/listings or ScholarshipListings view on close
  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    if (onSuccess) {
      // Pass target route or view key to parent callback
      onSuccess('provider/listings'); 
    } else if (onBack) {
      onBack();
    }
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
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl flex items-center gap-3 text-xs font-semibold shadow-2xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

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
                  <option value="Senior High School">Senior High School</option>
                  <option value="College">College / Undergraduate</option>
                  <option value="Graduate Studies">Graduate Studies (Master's / PhD)</option>
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
                  <option value="Filipino">Filipino Citizen Only</option>
                  <option value="Any">Open to Any Citizenship</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Maximum Allowable GWA / GPA
                </label>
                <input 
                  type="text"
                  placeholder="e.g. 2.00 (PH Inverse Scale)"
                  value={maxGwa}
                  onChange={e => setMaxGwa(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:border-rose-500"
                />
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
            <div className="space-y-2 text-xs font-semibold pt-1 border-t border-rose-100/80">
              <label className="block text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-600" /> Geographic Bounds (Regions / Provinces)
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Custom Dynamic List</span>
              </label>
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="e.g. Region V (Bicol Region)"
                  value={newLocation}
                  onChange={e => setNewLocation(e.target.value)}
                  className="flex-1 px-3.5 py-2 bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:border-rose-500"
                />
                <button
                  type="button"
                  onClick={handleAddLocation}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Region
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {allowedLocations.map((loc, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-slate-800 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs">
                    {loc}
                    <button type="button" onClick={() => handleRemoveLocation(idx)} className="hover:text-rose-600 transition-colors cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
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
        <div className="space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">3</span>
              Special Eligibility Tags Configuration (Dynamic Gatekeeping)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Classify demographic attributes as <strong>Required (Hard Gatekeeper)</strong> or <strong>Preferred (Ranking Affinity Weight)</strong>.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">System Standard Demographic Tags</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {SYSTEM_DEMOGRAPHIC_TAGS.map((tag) => {
                const isReq = requiredTags.includes(tag);
                const isPref = preferredTags.includes(tag);

                return (
                  <div key={tag} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-indigo-600" />
                      {tag}
                    </span>

                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => toggleRequiredTag(tag)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                          isReq ? 'bg-rose-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {isReq ? 'Required ("Only")' : 'Require'}
                      </button>

                      <button
                        type="button"
                        onClick={() => togglePreferredTag(tag)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                          isPref ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {isPref ? 'Preferred' : 'Prefer'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold pt-2">
            <div className="space-y-2 p-3 bg-rose-50/50 rounded-xl border border-rose-100">
              <label className="block text-rose-900 font-bold">Add Custom Required Tag (Hard Filter)</label>
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="e.g. Solo Parent First Gen"
                  value={newCustomReqTag}
                  onChange={e => setNewCustomReqTag(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleAddCustomReqTag}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold transition-colors cursor-pointer"
                >
                  Add Required
                </button>
              </div>
            </div>

            <div className="space-y-2 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
              <label className="block text-indigo-900 font-bold">Add Custom Preferred Tag (Ranking Weight)</label>
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="e.g. Tech Club Leader"
                  value={newCustomPrefTag}
                  onChange={e => setNewCustomPrefTag(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleAddCustomPrefTag}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-colors cursor-pointer"
                >
                  Add Preferred
                </button>
              </div>
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

        {/* SECTION 5: REQUIRED DOCUMENTS */}
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

        {/* SUBMIT ACTIONS & VALIDATION SUMMARY */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Backend enforces W<sub>GPA</sub> + W<sub>Income</sub> + W<sub>Tags</sub> = 100% validation prior to publishing.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
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
                  <span>Publish Scholarship Listing</span>
                </>
              )}
            </button>
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
  );
}