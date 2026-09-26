import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  FileText,
  Eye,
  ArrowRight
} from 'lucide-react';

// Reusable Components
import PageHeader from '../../../components/common/PageHeader';
import MetricCard from '../../../components/common/MetricCard';
import ConfirmModal from '../../../components/common/ConfirmModal';

// Icon Registry to safely map backend string keys to Lucide components
const ICON_MAP = {
  CheckSquare,
  AlertTriangle,
  Building2,
  Activity,
  ShieldCheck
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('providers');
  const [selectedAction, setSelectedAction] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Backend Data State (Initialized empty)
  const [metrics, setMetrics] = useState([]);
  const [pendingProviders, setPendingProviders] = useState([]);
  const [pendingListings, setPendingListings] = useState([]);
  const [pendingConsents, setPendingConsents] = useState([]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Fetch Live Admin Dashboard Data
  const fetchAdminData = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch('/api/v1/admin/dashboard', { headers });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Server responded with status ${res.status}`);
      }

      const data = await res.json();
      setMetrics(data.metrics || []);
      setPendingProviders(data.pendingProviders || []);
      setPendingListings(data.pendingListings || []);
      setPendingConsents(data.pendingConsents || []);
    } catch (err) {
      console.error('Failed to load admin dashboard data:', err);
      setFetchError(err.message || 'Unable to connect to the server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleActionClick = (id, actionType, targetType) => {
    setActionError(null);
    setSelectedAction({ id, actionType, targetType });
  };

  // Navigate to Verification Queue Page
  const handleReviewProvider = (providerId) => {
    navigate(`/admin/verification-queue${providerId ? `?providerId=${providerId}` : ''}`);
  };

  // Process Approval / Rejection Action via API
  const handleConfirmAction = async () => {
    if (!selectedAction) return;

    setIsProcessing(true);
    setActionError(null);
    const { id, actionType, targetType } = selectedAction;

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
        throw new Error(errorData.message || 'Action failed on server.');
      }

      // Optimistically clear item locally
      if (targetType === 'provider') setPendingProviders(prev => prev.filter(p => p.id !== id));
      else if (targetType === 'scholarship') setPendingListings(prev => prev.filter(l => l.id !== id));
      else if (targetType === 'consent') setPendingConsents(prev => prev.filter(c => c.id !== id));

      setSelectedAction(null);
    } catch (err) {
      console.error('API Action Error:', err);
      setActionError(err.message || 'Failed to process request.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <PageHeader 
          title={`${getGreeting()}, System Administrator`} 
          subtitle="Approve providers, review pending listings, and monitor platform compliance."
        />
        <div className="min-h-[300px] flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <Loader2 className="h-7 w-7 text-amber-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Fetching administrative queues...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader 
        title={`${getGreeting()}, System Administrator`} 
        subtitle="Approve providers, review pending listings, and monitor platform compliance."
      />

      {/* API Fetch Error Banner */}
      {fetchError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>Failed to load dashboard data: {fetchError}</span>
          </div>
          <button 
            type="button" 
            onClick={fetchAdminData}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors font-bold cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Metrics Row */}
      {metrics.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((m, idx) => {
            const IconComponent = ICON_MAP[m.iconKey] || CheckSquare;
            return <MetricCard key={m.id || idx} {...m} icon={IconComponent} />;
          })}
        </div>
      )}

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
              <p className="text-xs text-slate-500 py-8 text-center">No pending provider verifications in queue.</p>
            ) : (
              pendingProviders.map((prov) => (
                <div key={prov.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 border border-slate-200/60 rounded-xl gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{prov.name}</h4>
                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 flex-wrap">
                      <span>Email: <strong>{prov.email}</strong></span>
                      {prov.taxId && <span>Registration ID: <strong>{prov.taxId}</strong></span>}
                      {prov.submitted && <span>Submitted: {prov.submitted}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button 
                      type="button"
                      onClick={() => handleReviewProvider(prov.id)}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      <Eye className="h-4 w-4" /> Review Application <ArrowRight className="h-3.5 w-3.5" />
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
              <p className="text-xs text-slate-500 py-8 text-center">No pending scholarship listings to review.</p>
            ) : (
              pendingListings.map((listing) => (
                <div key={listing.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 border border-slate-200/60 rounded-xl gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{listing.title}</h4>
                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 flex-wrap">
                      <span>Provider: <strong>{listing.provider}</strong></span>
                      {listing.value && <span>Grant Value: <strong>{listing.value}</strong></span>}
                      {listing.submitted && <span>Submitted: {listing.submitted}</span>}
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

        {/* Tab 3: Guardian Consents */}
        {activeTab === 'consents' && (
          <div className="space-y-3">
            {pendingConsents.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No minor student consents awaiting review.</p>
            ) : (
              pendingConsents.map((consent) => (
                <div key={consent.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 border border-slate-200/60 rounded-xl gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{consent.studentName}</h4>
                      {consent.age && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md text-[10px] font-extrabold">
                          Age {consent.age}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 flex-wrap">
                      <span>Guardian: <strong>{consent.guardianName}</strong></span>
                      <span>Guardian Email: <strong>{consent.guardianEmail}</strong></span>
                      {consent.submitted && <span>Submitted: {consent.submitted}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {consent.documentUrl && (
                      <a 
                        href={consent.documentUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2 text-slate-600 hover:bg-slate-200/60 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1"
                        title="View Signed Document"
                      >
                        <FileText className="h-4 w-4" /> Doc
                      </a>
                    )}
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
        message={actionError ? `Error: ${actionError}` : `Are you sure you want to ${selectedAction?.actionType} this request?`}
      />
    </div>
  );
}