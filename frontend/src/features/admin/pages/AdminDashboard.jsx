import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  AlertTriangle, 
  CheckSquare, 
  Activity,
  Check,
  X,
  AlertCircle,
  Loader2,
  ShieldCheck,
  FileText
} from 'lucide-react';

// Reusable Components
import PageHeader from '../../../components/common/PageHeader';
import MetricCard from '../../../components/common/MetricCard';
import ConfirmModal from '../../../components/common/ConfirmModal';

// Icon Registry to map backend key strings to Lucide Components safely
const ICON_MAP = {
  CheckSquare,
  AlertTriangle,
  Building2,
  Activity,
  ShieldCheck
};

// Fallback Mock Data with Parental Consent added for DPA Compliance
const MOCK_ADMIN_DATA = {
  metrics: [
    { label: 'Pending Verifications', value: '2', iconKey: 'CheckSquare', color: 'amber' },
    { label: 'Pending Minor Consents', value: '1', iconKey: 'ShieldCheck', color: 'blue' },
    { label: 'Active Providers', value: '142', iconKey: 'Building2', color: 'emerald' },
    { label: 'System Uptime', value: '99.9%', iconKey: 'Activity', color: 'blue' }
  ],
  pendingProviders: [
    { id: 'prov-101', name: 'Innovate Tech Foundation', email: 'contact@innovatetech.org', taxId: 'SEC-2024-109', submitted: '2 hours ago' },
    { id: 'prov-102', name: 'Apex Student Trust', email: 'admin@apextrust.edu', taxId: 'LGU-2024-882', submitted: '5 hours ago' }
  ],
  pendingListings: [
    { id: 'sch-201', title: 'STEM Future Leaders Grant', provider: 'Innovate Tech Foundation', value: '₱50,000', submitted: '1 day ago' },
    { id: 'sch-202', title: 'Community Development Bursary', provider: 'Apex Student Trust', value: '₱25,000', submitted: '2 days ago' }
  ],
  pendingConsents: [
    { id: 'std-301', studentName: 'Juan Dela Cruz', age: 17, guardianName: 'Maria Dela Cruz', guardianEmail: 'maria@gmail.com', documentUrl: '#', submitted: '3 hours ago' }
  ]
};

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('providers');
  const [selectedAction, setSelectedAction] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Dashboard Data State
  const [metrics, setMetrics] = useState(MOCK_ADMIN_DATA.metrics);
  const [pendingProviders, setPendingProviders] = useState(MOCK_ADMIN_DATA.pendingProviders);
  const [pendingListings, setPendingListings] = useState(MOCK_ADMIN_DATA.pendingListings);
  const [pendingConsents, setPendingConsents] = useState(MOCK_ADMIN_DATA.pendingConsents);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Fetch Admin Queue Data
  useEffect(() => {
    let isMounted = true;

    const fetchAdminData = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await fetch('/api/v1/admin/dashboard', { headers });

        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            if (data.metrics) setMetrics(data.metrics);
            if (data.pendingProviders) setPendingProviders(data.pendingProviders);
            if (data.pendingListings) setPendingListings(data.pendingListings);
            if (data.pendingConsents) setPendingConsents(data.pendingConsents);
            setIsUsingFallback(false);
          }
        } else {
          throw new Error('Admin API error');
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Backend server offline. Using fallback admin mock data:', err);
          setMetrics(MOCK_ADMIN_DATA.metrics);
          setPendingProviders(MOCK_ADMIN_DATA.pendingProviders);
          setPendingListings(MOCK_ADMIN_DATA.pendingListings);
          setPendingConsents(MOCK_ADMIN_DATA.pendingConsents);
          setIsUsingFallback(true);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchAdminData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleActionClick = (id, actionType, targetType) => {
    setActionError(null);
    setSelectedAction({ id, actionType, targetType });
  };

  // Process Approval / Rejection Action
  const handleConfirmAction = async () => {
    if (!selectedAction) return;

    setIsProcessing(true);
    setActionError(null);
    const { id, actionType, targetType } = selectedAction;

    // Route resolution based on entity type
    let endpoint = '';
    if (targetType === 'provider') endpoint = `/api/v1/admin/providers/${id}/verification`;
    else if (targetType === 'scholarship') endpoint = `/api/v1/admin/scholarships/${id}/status`;
    else if (targetType === 'consent') endpoint = `/api/v1/admin/parental-consent/${id}/status`;

    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
      };

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: actionType === 'approve' ? 'APPROVED' : 'REJECTED' })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Action failed on server');
      }

      // Update UI state ONLY upon actual API success
      if (targetType === 'provider') setPendingProviders(prev => prev.filter(p => p.id !== id));
      else if (targetType === 'scholarship') setPendingListings(prev => prev.filter(l => l.id !== id));
      else if (targetType === 'consent') setPendingConsents(prev => prev.filter(c => c.id !== id));

      setSelectedAction(null);
    } catch (err) {
      console.error('API Action Failure:', err);
      setActionError(err.message);
      
      // If dev fallback is active, update optimistically for presentation testing
      if (isUsingFallback) {
        if (targetType === 'provider') setPendingProviders(prev => prev.filter(p => p.id !== id));
        else if (targetType === 'scholarship') setPendingListings(prev => prev.filter(l => l.id !== id));
        else if (targetType === 'consent') setPendingConsents(prev => prev.filter(c => c.id !== id));
        setSelectedAction(null);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <PageHeader 
          title={`${getGreeting()}, System Administrator`} 
          subtitle="Approve providers, review flagged listings, and monitor platform compliance."
        />
        <div className="min-h-[300px] flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200/80 p-6">
          <Loader2 className="h-7 w-7 text-emerald-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Fetching administrative queues...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader 
        title={`${getGreeting()}, System Administrator`} 
        subtitle="Approve providers, review flagged listings, and monitor platform compliance."
      />

      {isUsingFallback && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 p-3.5 rounded-xl flex items-center justify-between text-xs font-medium">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            Backend API unreachable. Displaying local fallback admin workbench data.
          </span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m, idx) => {
          const IconComponent = ICON_MAP[m.iconKey] || CheckSquare;
          return <MetricCard key={idx} {...m} icon={IconComponent} />;
        })}
      </div>

      {/* Queue Workbench Section */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-5 shadow-xs">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-6 overflow-x-auto">
          <button 
            type="button"
            onClick={() => setActiveTab('providers')}
            className={`pb-3 text-xs font-bold transition-all relative cursor-pointer whitespace-nowrap ${
              activeTab === 'providers' ? 'text-amber-600 border-b-2 border-amber-600' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Provider Verifications ({pendingProviders.length})
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('scholarships')}
            className={`pb-3 text-xs font-bold transition-all relative cursor-pointer whitespace-nowrap ${
              activeTab === 'scholarships' ? 'text-amber-600 border-b-2 border-amber-600' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Pending Listings ({pendingListings.length})
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('consents')}
            className={`pb-3 text-xs font-bold transition-all relative cursor-pointer whitespace-nowrap ${
              activeTab === 'consents' ? 'text-amber-600 border-b-2 border-amber-600' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Guardian Consents ({pendingConsents.length})
          </button>
        </div>

        {/* Tab 1: Provider Approvals */}
        {activeTab === 'providers' && (
          <div className="space-y-3">
            {pendingProviders.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No pending provider verifications in queue.</p>
            ) : (
              pendingProviders.map((prov) => (
                <div key={prov.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 border border-slate-200/60 rounded-xl gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{prov.name}</h4>
                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 flex-wrap">
                      <span>Email: <strong>{prov.email}</strong></span>
                      <span>Registration ID: <strong>{prov.taxId}</strong></span>
                      <span>Submitted: {prov.submitted}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button 
                      type="button"
                      onClick={() => handleActionClick(prov.id, 'reject', 'provider')}
                      className="p-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      title="Reject"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleActionClick(prov.id, 'approve', 'provider')}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      <Check className="h-4 w-4" /> Approve
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Pending Listings */}
        {activeTab === 'scholarships' && (
          <div className="space-y-3">
            {pendingListings.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No pending scholarship listings to review.</p>
            ) : (
              pendingListings.map((listing) => (
                <div key={listing.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 border border-slate-200/60 rounded-xl gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{listing.title}</h4>
                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 flex-wrap">
                      <span>Provider: <strong>{listing.provider}</strong></span>
                      <span>Grant Value: <strong>{listing.value}</strong></span>
                      <span>Submitted: {listing.submitted}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button 
                      type="button"
                      onClick={() => handleActionClick(listing.id, 'reject', 'scholarship')}
                      className="p-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      title="Reject Listing"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleActionClick(listing.id, 'approve', 'scholarship')}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      <Check className="h-4 w-4" /> Publish Listing
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Data Privacy Act Parental Consents */}
        {activeTab === 'consents' && (
          <div className="space-y-3">
            {pendingConsents.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No minor student consents awaiting review.</p>
            ) : (
              pendingConsents.map((consent) => (
                <div key={consent.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 border border-slate-200/60 rounded-xl gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{consent.studentName}</h4>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md text-[10px] font-extrabold">Age {consent.age}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 flex-wrap">
                      <span>Guardian: <strong>{consent.guardianName}</strong></span>
                      <span>Guardian Email: <strong>{consent.guardianEmail}</strong></span>
                      <span>Submitted: {consent.submitted}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a 
                      href={consent.documentUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 text-slate-600 hover:bg-slate-200/60 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1"
                      title="View Signed Document"
                    >
                      <FileText className="h-4 w-4" /> Doc
                    </a>
                    <button 
                      type="button"
                      onClick={() => handleActionClick(consent.id, 'reject', 'consent')}
                      className="p-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      title="Reject Consent"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleActionClick(consent.id, 'approve', 'consent')}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      <Check className="h-4 w-4" /> Verify Consent
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(selectedAction)}
        onClose={() => {
          setSelectedAction(null);
          setActionError(null);
        }}
        onConfirm={handleConfirmAction}
        isLoading={isProcessing}
        title={selectedAction?.actionType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
        message={actionError ? `Error: ${actionError}` : `Are you sure you want to ${selectedAction?.actionType} this request? This action will immediately update system authorization.`}
      />
    </div>
  );
}