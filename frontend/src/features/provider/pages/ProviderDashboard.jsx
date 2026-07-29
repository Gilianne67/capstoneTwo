import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building2, 
  Layers, 
  PlusCircle, 
  Eye, 
  MousePointerClick, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Edit,
  Trash2,
  ExternalLink,
  Power,
  RefreshCw,
  X,
  AlertTriangle
} from 'lucide-react';

// Reusable Common Components
import PageHeader from '../../../components/common/PageHeader';
import MetricCard from '../../../components/common/MetricCard';
import StatusBadge from '../../../components/common/StatusBadge';
import DataTable from '../../../components/common/DataTable';
import FilterBar from '../../../components/common/FilterBar';
import Pagination from '../../../components/common/Pagination';

// Create / Edit Listing View Component
import CreateListing from './CreateListing';

// ==========================================
// FALLBACK MOCK DATA & IN-MEMORY TEST STORE
// ==========================================
const MOCK_PROVIDER_USER = {
  name: 'DOST Scholarship Office',
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
  // Navigation State ('dashboard' | 'create' | 'edit')
  const [currentView, setCurrentView] = useState('dashboard');
  const [editingListing, setEditingListing] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
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
  const [stats, setStats] = useState({
    activePostings: 0,
    impressions: 0,
    clicks: 0,
    clickThroughRate: '0%'
  });

  // Helper to show floating toast messages
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Helper to re-calculate stats dynamically from current listing state
  const recalculateStats = useCallback((currentListings) => {
    const active = currentListings.filter(l => l.status === 'Open').length;
    const totalImpressions = currentListings.reduce((sum, l) => sum + (l.impressions || 0), 0);
    const totalClicks = currentListings.reduce((sum, l) => sum + (l.clicks || 0), 0);
    const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) + '%' : '0%';

    setStats({
      activePostings: active,
      impressions: totalImpressions,
      clicks: totalClicks,
      clickThroughRate: ctr
    });
  }, []);

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
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [statsRes, listingsRes] = await Promise.all([
        fetch('/api/v1/provider/stats', { headers }),
        fetch('/api/v1/provider/scholarships', { headers })
      ]);

      if (statsRes.ok && listingsRes.ok) {
        const statsData = await statsRes.json();
        const listingsData = await listingsRes.json();

        setProviderUser(statsData.provider || MOCK_PROVIDER_USER);
        setStats(statsData.metrics || {});
        const fetchedListings = Array.isArray(listingsData) ? listingsData : listingsData.scholarships || [];
        setListings(fetchedListings);
        setIsUsingFallback(false);
      } else {
        throw new Error('API server returned unexpected status code');
      }
    } catch (err) {
      // Graceful Mock Fallback for Local Testing
      setIsUsingFallback(true);
      setProviderUser(MOCK_PROVIDER_USER);
      setListings((prevListings) => {
        const data = prevListings.length > 0 ? prevListings : INITIAL_MOCK_LISTINGS;
        recalculateStats(data);
        return data;
      });
    } finally {
      setIsLoading(false);
    }
  }, [recalculateStats]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Execute Toggle Status
  const executeToggleStatus = async (listingId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/provider/scholarships/${listingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) throw new Error('Status update failed on server');
      showToast(`Scholarship status changed to ${newStatus}.`, 'success');
      fetchDashboardData();
    } catch (err) {
      // Local Mock Execution if API Offline
      setListings((prev) => {
        const updated = prev.map((item) => 
          item._id === listingId ? { ...item, status: newStatus } : item
        );
        recalculateStats(updated);
        return updated;
      });
      showToast(`Scholarship status updated to ${newStatus} (Local State).`, 'success');
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
      const res = await fetch(`/api/v1/provider/scholarships/${listingId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!res.ok) throw new Error('Delete operation failed on server');
      showToast(`"${title}" has been deleted.`, 'success');
      fetchDashboardData();
    } catch (err) {
      // Local Mock Execution if API Offline
      setListings((prev) => {
        const updated = prev.filter((item) => item._id !== listingId);
        recalculateStats(updated);
        return updated;
      });
      showToast(`"${title}" removed from listing (Local State).`, 'success');
    }
  };

  // Open Confirmation Popup for Delete
  const handleDeleteListing = (listingId, title) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Scholarship Listing',
      message: `Are you sure you want to permanently delete "${title}"? This action cannot be undone.`,
      confirmText: 'Delete Permanently',
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

  // Dashboard Metrics Grid
  const metrics = [
    { 
      label: 'Active Postings (Open)', 
      value: (stats.activePostings ?? 0).toLocaleString(), 
      icon: Layers, 
      color: 'emerald' 
    },
    { 
      label: 'Matching Impressions', 
      value: (stats.impressions ?? 0).toLocaleString(), 
      icon: Eye, 
      trend: 'Student feed evaluations', 
      color: 'blue' 
    },
    { 
      label: 'Outbound Referral Clicks', 
      value: (stats.clicks ?? 0).toLocaleString(), 
      icon: MousePointerClick, 
      trend: `${stats.clickThroughRate || '0%'} CTR to Portal`, 
      color: 'indigo' 
    },
  ];

  // Table Columns configured for Provider Full CRUD & Traffic Metrics
  const columns = [
    { 
      header: 'Scholarship Title', 
      accessor: 'title', 
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900">{row.title}</span>
          {row.applicationUrl && (
            <a 
              href={row.applicationUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-[11px] text-emerald-600 hover:underline flex items-center gap-1 mt-0.5"
            >
              Application Portal <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      ) 
    },
    { 
      header: 'Grant Value', 
      accessor: 'amount',
      cell: (row) => <span className="font-semibold text-slate-700">{row.amount}</span>
    },
    { 
      header: 'Status', 
      accessor: 'status', 
      cell: (row) => <StatusBadge status={row.status} /> 
    },
    { 
      header: 'Match Impressions', 
      accessor: 'impressions', 
      cell: (row) => (row.impressions ?? 0).toLocaleString() 
    },
    { 
      header: 'Outbound Clicks', 
      accessor: 'clicks', 
      cell: (row) => (row.clicks ?? 0).toLocaleString() 
    },
    { 
      header: 'Closing Date', 
      accessor: 'deadline' 
    },
    {
      header: 'Actions',
      accessor: 'actions',
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          {/* Toggle Open/Closed State */}
          <button
            type="button"
            onClick={() => handleToggleStatus(row._id, row.status, row.title)}
            title={row.status === 'Open' ? 'Close Applications' : 'Open Applications'}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <Power className={`h-4 w-4 ${row.status === 'Open' ? 'text-emerald-600' : 'text-slate-400'}`} />
          </button>

          {/* Edit Listing */}
          <button
            type="button"
            onClick={() => handleStartEdit(row)}
            title="Edit Listing & Weights"
            className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
          >
            <Edit className="h-4 w-4" />
          </button>

          {/* Delete Listing */}
          <button
            type="button"
            onClick={() => handleDeleteListing(row._id, row.title)}
            title="Delete Listing"
            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition-colors cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ];

  // Filter listings based on search input
  const filteredListings = listings.filter((item) =>
    item.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <PageHeader 
          title={`${getGreeting()}, Provider`} 
          subtitle="Manage scholarship offerings, configure matching weights, and monitor outbound application traffic."
        />
        <div className="min-h-[300px] flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200/80 p-6">
          <Loader2 className="h-7 w-7 text-emerald-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Retrieving provider metrics and listings...</p>
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

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {metrics.map((m, idx) => (
          <MetricCard key={idx} {...m} />
        ))}
      </div>

      {/* Listing Table Section */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Your Scholarship Listings</h3>
            <p className="text-xs text-slate-500">Track impressions, manage states, and update destination URLs.</p>
          </div>
          <FilterBar searchValue={searchQuery} onSearchChange={setSearchQuery} />
        </div>

        <DataTable columns={columns} data={filteredListings} />

        <Pagination 
          currentPage={currentPage} 
          totalPages={1} 
          onPageChange={(page) => setCurrentPage(page)} 
        />
      </div>
    </div>
  );
}