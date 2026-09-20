import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import {
  GraduationCap,
  Building2,
  Globe,
  Phone,
  User,
  Briefcase,
  Mail,
  FileCheck,
  Upload,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  FileText
} from 'lucide-react';

const ProviderOnboarding = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    institutionName: '',
    institutionType: 'Non-Profit',
    website: '',
    contactNumber: '',
    street: '',
    city: '',
    province: '',
    region: '',
    repName: '',
    repTitle: '',
    repEmail: '',
  });

  const [docType, setDocType] = useState('SEC_DTI');
  const [documentFile, setDocumentFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    if (error) setError('');
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    if (error) setError('');
    if (e.target.files && e.target.files[0]) {
      setDocumentFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!documentFile) {
      setError('Please upload a verification document (SEC/DTI/CHED permit or Auth Letter).');
      return;
    }

    setLoading(true);
    setError('');

    const payload = new FormData();
    Object.keys(formData).forEach((key) => payload.append(key, formData[key]));
    payload.append('documentType', docType);
    payload.append('verificationDoc', documentFile);

    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/v1/provider/onboarding', payload, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
      });

      navigate('/provider/pending-approval');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit verification details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-bg text-app-text flex flex-col justify-between relative overflow-hidden pt-20">
      {/* Provider Theme Accent Bar */}
      <div className="h-1.5 w-full bg-emerald-900" />

      {/* Main Container */}
      <div className="max-w-6xl w-full mx-auto px-4 py-8 sm:px-6 lg:px-8 flex-1 flex items-center justify-center relative z-10">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-0 items-stretch bg-card-bg border border-app-text/10 rounded-3xl shadow-2xl overflow-hidden">
          
          {/* Left Hero Panel */}
          <div className="lg:col-span-4 bg-emerald-900 text-white p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden transition-colors duration-500">
            <div className="absolute -right-10 -bottom-10 w-64 h-64 border border-white/10 rounded-3xl rotate-12 bg-white/[0.04] pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.15)_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />

            <div className="relative z-10 space-y-6">
              <Link to="/" className="inline-flex items-center gap-2.5 group">
                <GraduationCap className="h-8 w-8 text-accent transition-transform duration-300 group-hover:scale-110" />
                <span className="font-extrabold text-2xl tracking-tight text-white">
                  ISKOLAR<span className="text-accent">MATCH</span>
                </span>
              </Link>

              <div className="space-y-3 pt-4">
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                  Provider Verification
                </h2>
                <p className="text-white/80 text-xs sm:text-sm leading-relaxed">
                  Complete your organization profile and submit proof of legitimacy to unlock full access to posting and managing scholarship opportunities.
                </p>
              </div>
            </div>

            {/* Verification Features */}
            <div className="relative z-10 space-y-3.5 my-8">
              {[
                'Verified Sponsor Badge On All Postings',
                'Direct Access to Scholar Match Engine',
                'Encrypted & Secure Regulatory Compliance',
                'Dedicated Partner Support Services'
              ].map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2.5 text-xs sm:text-sm text-white/90 font-medium">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <div className="relative z-10 pt-6 border-t border-white/15 text-xs text-white/70">
              Supporting Iskolar ng Bayan
            </div>
          </div>

          {/* Right Form Panel */}
          <div className="lg:col-span-8 p-6 sm:p-10 lg:p-12 flex flex-col justify-center">
            <div className="w-full space-y-6">
              
              {/* Header */}
              <div>
                <h3 className="text-2xl font-black text-app-text">Organization Profile</h3>
                <p className="text-xs text-text-muted mt-1">
                  Fill in your official organization details and representative contact information.
                </p>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2.5 text-xs text-rose-600">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Section 1: Organization Details */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 border-b border-app-text/10 pb-2">
                    <Building2 className="h-4 w-4" />
                    <span>1. Organization Details</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-app-text mb-1.5">Institution Name</label>
                      <div className="relative">
                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                        <input
                          type="text"
                          name="institutionName"
                          required
                          value={formData.institutionName}
                          onChange={handleChange}
                          placeholder="e.g., DOST Foundation"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-app-bg border border-app-text/10 text-xs sm:text-sm text-app-text focus:outline-none focus:border-emerald-800 transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-app-text mb-1.5">Institution Type</label>
                      <select
                        name="institutionType"
                        value={formData.institutionType}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl bg-app-bg border border-app-text/10 text-xs sm:text-sm text-app-text focus:outline-none focus:border-emerald-800 transition-colors"
                      >
                        <option value="University">University / College</option>
                        <option value="Non-Profit">Non-Profit / NGO</option>
                        <option value="Corporate">Corporate Foundation</option>
                        <option value="Government">Government Agency</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-app-text mb-1.5">Official Website</label>
                      <div className="relative">
                        <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                        <input
                          type="url"
                          name="website"
                          required
                          value={formData.website}
                          onChange={handleChange}
                          placeholder="https://example.org"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-app-bg border border-app-text/10 text-xs sm:text-sm text-app-text focus:outline-none focus:border-emerald-800 transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-app-text mb-1.5">Contact Number</label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                        <input
                          type="text"
                          name="contactNumber"
                          required
                          value={formData.contactNumber}
                          onChange={handleChange}
                          placeholder="+63 912 345 6789"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-app-bg border border-app-text/10 text-xs sm:text-sm text-app-text focus:outline-none focus:border-emerald-800 transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Authorized Representative */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 border-b border-app-text/10 pb-2">
                    <User className="h-4 w-4" />
                    <span>2. Authorized Representative</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-app-text mb-1.5">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                        <input
                          type="text"
                          name="repName"
                          required
                          value={formData.repName}
                          onChange={handleChange}
                          placeholder="Juan Dela Cruz"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-app-bg border border-app-text/10 text-xs sm:text-sm text-app-text focus:outline-none focus:border-emerald-800 transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-app-text mb-1.5">Job Title</label>
                      <div className="relative">
                        <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                        <input
                          type="text"
                          name="repTitle"
                          required
                          value={formData.repTitle}
                          onChange={handleChange}
                          placeholder="Program Director"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-app-bg border border-app-text/10 text-xs sm:text-sm text-app-text focus:outline-none focus:border-emerald-800 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-1 col-span-1">
                      <label className="block text-xs font-bold text-app-text mb-1.5">Work Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                        <input
                          type="email"
                          name="repEmail"
                          required
                          value={formData.repEmail}
                          onChange={handleChange}
                          placeholder="rep@example.org"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-app-bg border border-app-text/10 text-xs sm:text-sm text-app-text focus:outline-none focus:border-emerald-800 transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Verification Document */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 border-b border-app-text/10 pb-2">
                    <ShieldCheck className="h-4 w-4" />
                    <span>3. Verification Document</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-app-text mb-1.5">Document Type</label>
                      <select
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-app-bg border border-app-text/10 text-xs sm:text-sm text-app-text focus:outline-none focus:border-emerald-800 transition-colors"
                      >
                        <option value="SEC_DTI">SEC / DTI Registration</option>
                        <option value="CHED_DepEd">CHED / DepEd Recognition</option>
                        <option value="Authorization_Letter">Signed Authorization Letter</option>
                        <option value="Gov_ID">Government ID of Representative</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-app-text mb-1.5">Upload File (.pdf, .jpg, .png)</label>
                      <div className="relative">
                        <input
                          type="file"
                          id="verificationDoc"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={handleFileChange}
                          required
                          className="hidden"
                        />
                        <label
                          htmlFor="verificationDoc"
                          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-app-bg border border-app-text/10 text-xs text-text-muted hover:border-emerald-800 cursor-pointer transition-colors"
                        >
                          <span className="truncate pr-2">
                            {documentFile ? documentFile.name : 'Choose official file...'}
                          </span>
                          <Upload className="h-4 w-4 shrink-0 text-emerald-900" />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-6 rounded-xl bg-emerald-900 hover:bg-emerald-950 text-white font-bold text-sm shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <span>Submit for Verification</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 text-xs text-text-muted border-t border-app-text/10 relative z-10">
        © {new Date().getFullYear()} IskolarMatch. All rights reserved.
      </div>
    </div>
  );
};

export default ProviderOnboarding;