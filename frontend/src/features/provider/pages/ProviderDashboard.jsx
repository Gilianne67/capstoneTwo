import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Layers,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Edit,
  ExternalLink,
  Power,
  RefreshCw,
  X,
  AlertTriangle,
  Clock3,
  FileText,
  CalendarDays
} from 'lucide-react';


// Reusable Common Components
import PageHeader from '../../../components/common/PageHeader';
import StatusBadge from '../../../components/common/StatusBadge';


// Create / Edit Listing View Component
import CreateListing from './CreateListing';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

// ==========================================
// FALLBACK MOCK DATA & IN-MEMORY TEST STORE
// ==========================================
const MOCK_PROVIDER_USER = {
  name: 'Scholarship Provider',
  role: 'Scholarship Provider'
};

const INITIAL_MOCK_LISTINGS = [
  { 
    _id: '1', 
    title: 'CHED Regional Merit Award 2026', 
    amount: '₱50,000', 
    status: 'Open', 
    impressions: 5100, 
    clicks: 720, 
    deadline: '2026-08-30',
    applicationUrl: 'https://ched.gov.ph/apply'
  },
  { 
    _id: '2', 
    title: 'Tertiary Education Subsidy (TES)', 
    amount: '₱40,000', 
    status: 'Open', 
    impressions: 3320, 
    clicks: 400, 
    deadline: '2026-09-15',
    applicationUrl: 'https://unifast.gov.ph/tes'
  },
  { 
    _id: '3', 
    title: 'Municipal Honor Graduate Grant', 
    amount: '₱15,000', 
    status: 'Closed', 
    impressions: 1200, 
    clicks: 85, 
    deadline: '2026-05-01',
    applicationUrl: 'https://pasig.gov.ph/grant'
  },
];

export default function ProviderDashboard() {
  const navigate = useNavigate();
  // Navigation State ('dashboard' | 'create' | 'edit')
  const [currentView, setCurrentView] = useState('dashboard');
  const [editingListing, setEditingListing] = useState(null);


  const [isLoading, setIsLoading] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  // Modal & Toast Notification States
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    variant: 'danger', // 'danger' | 'warning' | 'primary'
    onConfirm: null
  });
  const [toast, setToast] = useState(null); // { type: 'success'|'error'|'info', message: string }

  // Dashboard Data State
  const [providerUser, setProviderUser] = useState(MOCK_PROVIDER_USER);
  const [listings, setListings] = useState(INITIAL_MOCK_LISTINGS);

  // Helper to show floating toast messages
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };


  // Dynamic Greeting Helper
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Fetch Dashboard Data (with Fallback Engine)
 
  const fetchDashboardData = useCallback(async () => {
  setIsLoading(true);

  try {
    const token = localStorage.getItem('token')

    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };

    const [dashboardRes, listingsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/providers/dashboard`, { headers }),
      fetch(`${API_BASE_URL}/scholarships/my`, { headers })
    ]);

    const dashboardData = await dashboardRes.json();
    const listingsData = await listingsRes.json();

    if (!dashboardRes.ok) {
      throw new Error(
        dashboardData.message || 'Failed to load provider dashboard.'
      );
    }

    if (!listingsRes.ok) {
      throw new Error(
        listingsData.message || 'Failed to load scholarship listings.'
      );
    }

    // Provider information
    if (dashboardData.dashboard?.provider) {
      setProviderUser({
        name: dashboardData.dashboard.provider.institutionName,
        role: 'Scholarship Provider'
      });
    }

    // Scholarship listings
    const fetchedListings = listingsData.scholarships || [];

    setListings(fetchedListings);
    setIsUsingFallback(false);

   } catch (error) {
    console.error('Failed to fetch provider dashboard:', error);

    setIsUsingFallback(true);

    // Keep existing mock data as fallback
    setListings((prevListings) => {
      return prevListings.length > 0
        ? prevListings
        : INITIAL_MOCK_LISTINGS;
    });

  } finally {
    setIsLoading(false);
  }
}, []);

useEffect(() => {
  fetchDashboardData();
}, [fetchDashboardData]);
  // Execute Toggle Status
  const executeToggleStatus = async (listingId, newStatus) => {
  try {
    const token = localStorage.getItem('token');

    const res = await fetch(
      `${API_BASE_URL}/scholarships/${listingId}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify({
          status: newStatus
        })
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.message || 'Status update failed on server.'
      );
    }

    showToast(
      `Scholarship status changed to ${newStatus}.`,
      'success'
    );

    await fetchDashboardData();

  } catch (error) {
    console.error('Status update failed:', error);

    showToast(
      error.message || 'Unable to update scholarship status.',
      'error'
    );
  }
};

  // Open Confirmation Popup for Status Toggle
  const handleToggleStatus = (listingId, currentStatus, title) => {
    const newStatus = currentStatus === 'Open' ? 'Closed' : 'Open';
    setConfirmModal({
      isOpen: true,
      title: `${newStatus === 'Open' ? 'Reopen' : 'Close'} Applications`,
      message: `Are you sure you want to change the status of "${title}" to "${newStatus}"?`,
      confirmText: newStatus === 'Open' ? 'Reopen Listing' : 'Close Listing',
      variant: 'warning',
      onConfirm: () => executeToggleStatus(listingId, newStatus)
    });
  };

  // Execute Soft-Delete
  const executeDeleteListing = async (listingId, title) => {
    try {
      const token = localStorage.getItem('token');
      
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/scholarships/${listingId}/archive`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) throw new Error('Delete operation failed on server');
      showToast(`"${title}" has been deleted.`, 'success');
      fetchDashboardData();
    } catch  {
      // Local Mock Execution if API Offline
        setListings((prev) => {
            return prev.filter((item) => item._id !== listingId);
          });
      showToast(`"${title}" removed from listing (Local State).`, 'success');
    }
  };

  // Open Confirmation Popup for Delete
  const handleDeleteListing = (listingId, title) => {
    setConfirmModal({
      isOpen: true,
      title: 'Archive Scholarship Listing',
      message: `Are you sure you want to permanently archive "${title}"? This action cannot be undone.`,
      confirmText: 'Archived Scholarship',
      variant: 'danger',
      onConfirm: () => executeDeleteListing(listingId, title)
    });
  };

  // Switch to edit mode
  const handleStartEdit = (listing) => {
    setEditingListing(listing);
    setCurrentView('edit');
  };

  // Handle return to dashboard from Create/Edit listing form
  const handleCreatedSuccess = (actionType = 'created') => {
    setCurrentView('dashboard');
    setEditingListing(null);
    showToast(`Scholarship listing successfully ${actionType === 'updated' ? 'updated' : 'published'}!`, 'success');
    fetchDashboardData();
  };

  // Render Form Component when creating or editing
  if (currentView === 'create' || currentView === 'edit') {
    return (
      <CreateListing 
        initialData={editingListing}
        onBack={() => {
          setCurrentView('dashboard');
          setEditingListing(null);
        }}
        onSuccess={() => handleCreatedSuccess(editingListing ? 'updated' : 'created')}
      />
    );
  }




// Dashboard overview data
const activeScholarships = listings.filter(
  (item) => item.status === 'Open'
);


const today = new Date();
today.setHours(0, 0, 0, 0);

const closingSoon = listings
  .filter((item) => {
    if (!item.deadline || item.status !== 'Open') return false;

    const deadline = new Date(item.deadline);
    deadline.setHours(23, 59, 59, 999);

    const daysUntil =
      (deadline - today) / (1000 * 60 * 60 * 24);

    return daysUntil >= 0 && daysUntil <= 14;
  })
  .sort(
    (a, b) =>
      new Date(a.deadline) - new Date(b.deadline)
  )
  .slice(0, 3);

const recentScholarships = [...listings]
  .sort((a, b) => {
    if (!a.createdAt && !b.createdAt) return 0;
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;

    return new Date(b.createdAt) - new Date(a.createdAt);
  })
  .slice(0, 5);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <PageHeader 
          title={`${getGreeting()}, Provider`} 
          subtitle="Manage scholarship offerings, configure matching weights, and monitor outbound application traffic."
        />
        <div className="min-h-[300px] flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200/80 p-6">
          <Loader2 className="h-7 w-7 text-emerald-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Retrieving your scholarship listings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 relative">
      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 text-white rounded-xl shadow-xl text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toast.message}</span>
          <button 
            onClick={() => setToast(null)} 
            className="ml-2 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${confirmModal.variant === 'danger' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">{confirmModal.title}</h3>
              </div>
              <button 
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {confirmModal.message}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmModal.onConfirm) confirmModal.onConfirm();
                  setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                }}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold transition-colors ${
                  confirmModal.variant === 'danger' 
                    ? 'bg-rose-600 hover:bg-rose-700' 
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Greeting */}
      <PageHeader 
        title={`${getGreeting()}, ${providerUser.name}`} 
        subtitle="Manage scholarship offerings, configure matching weights, and monitor outbound application traffic."
        action={
          <button 
            type="button"
            onClick={() => {
              setEditingListing(null);
              setCurrentView('create');
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" /> Post New Scholarship
          </button>
        }
      />

      {/* API Offline Warning Banner */}
      {isUsingFallback && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 p-3.5 rounded-xl flex items-center justify-between text-xs font-medium">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            Backend API offline/unreachable. Mock API active — local interactions (Status toggle, Edit, Delete) will update live in state.
          </span>
          <button 
            type="button"
            onClick={fetchDashboardData}
            className="flex items-center gap-1 text-[11px] bg-amber-200/60 hover:bg-amber-200 px-2.5 py-1 rounded-md transition-colors cursor-pointer font-bold"
          >
            <RefreshCw className="h-3 w-3" /> Retry Connection
          </button>
        </div>
      )}

      {/* Verified Status Banner */}
      <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
        <p className="text-xs text-emerald-900 font-medium">
          <strong>Verified Institutional Partner:</strong> Your published scholarships are evaluated by the matching engine using your custom weighting parameters.
        </p>
      </div>


      {/* Dashboard Summary */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

  {/* Active */}
  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-500">
          Active Scholarships
        </p>
        <p className="text-2xl font-extrabold text-slate-900 mt-1">
          {activeScholarships.length}
        </p>
      </div>

      <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
        <Layers className="h-5 w-5" />
      </div>
    </div>

    <p className="text-[11px] text-slate-400 mt-3">
      Currently accepting applications
    </p>
  </div>


  {/* Closing Soon */}
  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-500">
          Closing Soon
        </p>
        <p className="text-2xl font-extrabold text-slate-900 mt-1">
          {closingSoon.length}
        </p>
      </div>

      <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
        <Clock3 className="h-5 w-5" />
      </div>
    </div>

    <p className="text-[11px] text-slate-400 mt-3">
      Within the next 14 days
    </p>
  </div>

  {/* Total */}
  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-500">
          Total Scholarships
        </p>
        <p className="text-2xl font-extrabold text-slate-900 mt-1">
          {listings.length}
        </p>
      </div>

      <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
        <CalendarDays className="h-5 w-5" />
      </div>
    </div>

    <p className="text-[11px] text-slate-400 mt-3">
      All scholarship listings
    </p>
  </div>

</div>

{/* Closing Soon */}
<div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">

  <div className="flex items-center justify-between mb-4">
    <div>
      <h3 className="text-base font-bold text-slate-900">
        Scholarships Closing Soon
      </h3>

      <p className="text-xs text-slate-500 mt-0.5">
        Applications approaching their deadline
      </p>
    </div>
  </div>

  {closingSoon.length === 0 ? (
    <div className="py-8 text-center">
      <CheckCircle2 className="h-7 w-7 text-emerald-500 mx-auto mb-2" />

      <p className="text-xs font-semibold text-slate-700">
        No scholarships are closing soon.
      </p>

      <p className="text-[11px] text-slate-400 mt-1">
        Your current open scholarships have more than 14 days remaining.
      </p>
    </div>
  ) : (
    <div className="divide-y divide-slate-100">
      {closingSoon.map((scholarship) => {

        const deadline = new Date(scholarship.deadline);
        const daysLeft = Math.ceil(
          (deadline - today) / (1000 * 60 * 60 * 24)
        );

        return (
          <div
            key={scholarship._id}
            className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">
                {scholarship.name}
              </p>

              <div className="flex items-center gap-1.5 mt-1">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400" />

                <span className="text-[11px] text-slate-500">
                  Deadline:{' '}
                  {deadline.toLocaleDateString('en-PH', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>

            <span className="shrink-0 ml-4 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
              {daysLeft === 0
                ? 'Due today'
                : daysLeft === 1
                  ? '1 day left'
                  : `${daysLeft} days left`}
            </span>
          </div>
        );
      })}
    </div>
  )}
</div>

   {/* Recent Scholarship Listings */}
<div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">

  <div className="flex items-center justify-between">
    <div>
      <h3 className="text-base font-bold text-slate-900">
        Recent Scholarship Listings
      </h3>

      <p className="text-xs text-slate-500 mt-0.5">
        Your latest scholarship postings
      </p>
    </div>

    <button
      type="button"
      onClick={() => {
        
        navigate('/dashboard/provider/listings');
      }}
      className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
    >
      View All →
    </button>
  </div>

  {recentScholarships.length === 0 ? (
    <div className="py-10 text-center border border-dashed border-slate-200 rounded-xl">
      <FileText className="h-7 w-7 text-slate-300 mx-auto mb-2" />

      <p className="text-xs font-semibold text-slate-600">
        No scholarship listings yet.
      </p>

      <p className="text-[11px] text-slate-400 mt-1">
        Create your first scholarship listing to get started.
      </p>
    </div>
  ) : (
    <div className="divide-y divide-slate-100">

      {recentScholarships.map((listing) => (
        <div
          key={listing._id}
          className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
        >

          {/* Scholarship Information */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-800 truncate">
              {listing.name}
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-1.5">

              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />

                {listing.deadline
                  ? new Date(listing.deadline).toLocaleDateString(
                      'en-PH',
                      {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      }
                    )
                  : 'No deadline'}
              </span>

              {listing.applicationURL && (
                <a
                  href={listing.applicationURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-emerald-600 hover:underline flex items-center gap-1"
                >
                  Application Portal
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}

            </div>
          </div>

          {/* Status */}
          <StatusBadge status={listing.status} />

          {/* Edit */}
          <button
            type="button"
            onClick={() => handleStartEdit(listing)}
            title="Edit Scholarship"
            className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
          >
            <Edit className="h-4 w-4" />
          </button>

        </div>
      ))}

    </div>
  )}

</div>

       </div>
  );
}