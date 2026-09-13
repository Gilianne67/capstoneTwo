import React, { useState, useEffect, useCallback } from 'react';
import { 
  PlusCircle, 
  Trash2, 
  Edit3, 
  Power,
  ExternalLink,
  AlertCircle, 
  Loader2,
  RefreshCw,
  X,
  RotateCcw,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

import PageHeader from '../../../components/common/PageHeader';
import StatusBadge from '../../../components/common/StatusBadge';
import DataTable from '../../../components/common/DataTable';
import FilterBar from '../../../components/common/FilterBar';
import Pagination from '../../../components/common/Pagination';

// ==========================================
// RICH FALLBACK MOCK DATASET FOR TESTING
// ==========================================
const INITIAL_MOCK_LISTINGS = [
  { 
    _id: '1', 
    title: 'CHED Regional Merit Award 2026', 
    amount: '₱50,000', 
    status: 'Open', 
    impressions: 5100, 
    clicks: 720, 
    deadline: '2026-08-30',
    category: 'Merit-Based',
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
    category: 'Need-Based',
    applicationUrl: 'https://unifast.gov.ph/tes'
  },
  { 
    _id: '3', 
    title: 'DOST Science & Technology Grant', 
    amount: '₱80,000', 
    status: 'Open', 
    impressions: 8900, 
    clicks: 1420, 
    deadline: '2026-11-20',
    category: 'STEM',
    applicationUrl: 'https://dost.gov.ph/st-scholarship'
  },
  { 
    _id: '4', 
    title: 'Municipal Honor Graduate Grant', 
    amount: '₱15,000', 
    status: 'Closed', 
    impressions: 1200, 
    clicks: 85, 
    deadline: '2026-05-01',
    category: 'Specialized',
    applicationUrl: 'https://pasig.gov.ph/grant'
  },
  { 
    _id: '5', 
    title: 'Private Sector Tech Leaders Fund', 
    amount: '₱100,000', 
    status: 'Closed', 
    impressions: 14200, 
    clicks: 2950, 
    deadline: '2026-04-15',
    category: 'Technology',
    applicationUrl: 'https://techleaders.ph/grant'
  }
];

export default function ScholarshipListings({ onNavigateToCreate, onNavigateToEdit }) {
  const [listings, setListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);

  // Notification Banner State
  const [toastMessage, setToastMessage] = useState(null);

  // Quick Modal State for Editing / Creating inside local test mode
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [formData, setFormData] = useState({
    _id: '',
    title: '',
    amount: '',
    status: 'Open',
    category: 'General',
    deadline: '',
    applicationUrl: '',
    impressions: 0,
    clicks: 0
  });

  // Action Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: null, // 'delete' | 'toggle'
    targetItem: null,
    title: '',
    message: '',
    confirmText: 'Confirm',
    confirmVariant: 'emerald' // 'emerald' | 'rose'
  });

  // Helper Toast Notification
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Fetch Listings from Backend Engine with Graceful Mock Fallback
  const fetchListings = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await fetch('/api/v1/provider/scholarships', { headers });

      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data) ? data : (data.scholarships || []);
        setListings(list);
        setIsUsingFallback(false);
      } else {
        throw new Error('API unreachable');
      }
    } catch (err) {
      setListings((prev) => (prev.length > 0 ? prev : INITIAL_MOCK_LISTINGS));
      setIsUsingFallback(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Reset Mock Data Helper
  const handleResetMockData = () => {
    setListings(INITIAL_MOCK_LISTINGS);
    showToast('Mock sample listings restored to initial state.');
  };

  // Helper to Close Confirm Modal
  const closeConfirmModal = () => {
    setConfirmModal({
      isOpen: false,
      type: null,
      targetItem: null,
      title: '',
      message: '',
      confirmText: 'Confirm',
      confirmVariant: 'emerald'
    });
  };

  // ==========================================
  // CONFIRMATION DIALOG PROMPTS
  // ==========================================
  
  // Prompt 1: Open Delete Confirmation
  const promptDeleteListing = (row) => {
    setConfirmModal({
      isOpen: true,
      type: 'delete',
      targetItem: row,
      title: 'Delete Scholarship Listing',
      message: `Are you sure you want to permanently delete "${row.title}"? This action cannot be undone.`,
      confirmText: 'Delete Listing',
      confirmVariant: 'rose'
    });
  };

  // Prompt 2: Open Status Toggle Confirmation
  const promptToggleStatus = (row) => {
    const isOpening = row.status !== 'Open';
    const actionVerb = isOpening ? 'open' : 'close';
    const actionCapitalized = isOpening ? 'Open' : 'Close';

    setConfirmModal({
      isOpen: true,
      type: 'toggle',
      targetItem: row,
      title: `${actionCapitalized} Applications`,
      message: `Are you sure you want to ${actionVerb} applications for "${row.title}"? ${
        isOpening 
          ? 'Students will be able to apply again.' 
          : 'New applications will no longer be accepted.'
      }`,
      confirmText: `${actionCapitalized} Applications`,
      confirmVariant: isOpening ? 'emerald' : 'rose'
    });
  };

  // Execute Action upon Modal Confirmation
  const handleConfirmAction = async () => {
    const { type, targetItem } = confirmModal;
    if (!targetItem) return;

    const id = targetItem._id || targetItem.id;

    if (type === 'delete') {
      const previousListings = [...listings];
      setListings(prev => prev.filter(item => (item._id || item.id) !== id));

      try {
        const token = localStorage.getItem('token');
        if (token && !isUsingFallback) {
          const res = await fetch(`/api/v1/provider/scholarships/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!res.ok) throw new Error('Deletion failed on server');
        } else {
          showToast('Listing removed locally (Mock Mode).');
        }
      } catch (err) {
        console.error('Failed to delete on server:', err);
        setListings(previousListings); // Revert state on failure
        showToast('Failed to delete listing. Changes reverted.');
      }
    } else if (type === 'toggle') {
      const newStatus = targetItem.status === 'Open' ? 'Closed' : 'Open';

      setListings(prev =>
        prev.map(item => (item._id || item.id) === id ? { ...item, status: newStatus } : item)
      );

      try {
        const token = localStorage.getItem('token');
        if (token && !isUsingFallback) {
          const res = await fetch(`/api/v1/provider/scholarships/${id}/status`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
          });
          if (!res.ok) throw new Error('Status update failed');
        } else {
          showToast(`Status updated to "${newStatus}" (Mock Mode).`);
        }
      } catch (err) {
        console.error('Failed to update status on server:', err);
        showToast('Failed to update status on server.');
      }
    }

    closeConfirmModal();
  };

  // CRUD Operation 3: START CREATE / EDIT
  const handleOpenCreate = () => {
    if (typeof onNavigateToCreate === 'function') {
      onNavigateToCreate();
    } else {
      setIsCreateMode(true);
      setFormData({
        _id: String(Date.now()),
        title: '',
        amount: '₱25,000',
        status: 'Open',
        category: 'General Merit',
        deadline: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        applicationUrl: 'https://example.gov.ph/apply',
        impressions: 0,
        clicks: 0
      });
      setIsModalOpen(true);
    }
  };

  const handleOpenEdit = (row) => {
    if (typeof onNavigateToEdit === 'function') {
      onNavigateToEdit(row);
    } else {
      setIsCreateMode(false);
      setFormData({ ...row });
      setIsModalOpen(true);
    }
  };

  // Save Form Submission
  const handleSaveForm = (e) => {
    e.preventDefault();
    if (isCreateMode) {
      setListings(prev => [formData, ...prev]);
      showToast('New scholarship listing created (Mock Mode).');
    } else {
      const targetId = formData._id || formData.id;
      setListings(prev =>
        prev.map(item => ((item._id || item.id) === targetId ? formData : item))
      );
      showToast('Scholarship listing updated (Mock Mode).');
    }
    setIsModalOpen(false);
  };

  // Add Quick Pre-filled Mock Listing Button
  const handleAddQuickSample = () => {
    const sampleId = String(Date.now());
    const newSample = {
      _id: sampleId,
      title: `Sample Grant #${listings.length + 1} (Test Entry)`,
      amount: '₱35,000',
      status: 'Open',
      impressions: 150,
      clicks: 22,
      deadline: '2026-12-31',
      category: 'Innovation Fund',
      applicationUrl: 'https://example.org/apply'
    };
    setListings(prev => [newSample, ...prev]);
    showToast('Added pre-filled sample listing.');
  };

  // Filter Logic
  const filteredListings = listings.filter((item) => {
    const matchesSearch = item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.category?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns = [
    { 
      header: 'Official Scholarship Title', 
      accessor: 'title', 
      cell: (row) => (
        <div className="space-y-0.5">
          <p className="font-bold text-slate-900">{row.title}</p>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-medium">{row.category || 'General'}</span>
            {row.applicationUrl && (
              <a 
                href={row.applicationUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-[11px] text-emerald-600 hover:underline flex items-center gap-0.5 font-medium"
              >
                Portal Link <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        </div>
      )
    },
    { 
      header: 'Grant Value', 
      accessor: 'amount',
      cell: (row) => <span className="font-semibold text-slate-700">{row.amount}</span>
    },
    { 
      header: 'Listing Status', 
      accessor: 'status', 
      cell: (row) => <StatusBadge status={row.status} /> 
    },
    { 
      header: 'Impressions', 
      accessor: 'impressions', 
      cell: (row) => (row.impressions ?? 0).toLocaleString() 
    },
    { 
      header: 'Outbound Clicks', 
      accessor: 'clicks', 
      cell: (row) => (row.clicks ?? 0).toLocaleString() 
    },
    { header: 'Deadline', accessor: 'deadline' },
    {
      header: 'Actions',
      accessor: 'actions',
      cell: (row) => {
        return (
          <div className="flex items-center gap-1">
            {/* Toggle Status Button (Triggers Validation Modal) */}
            <button
              type="button"
              onClick={() => promptToggleStatus(row)}
              className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title={row.status === 'Open' ? 'Close Applications' : 'Open Applications'}
            >
              <Power className={`w-4 h-4 ${row.status === 'Open' ? 'text-emerald-600' : 'text-slate-400'}`} />
            </button>

            {/* Edit Button */}
            <button
              type="button"
              onClick={() => handleOpenEdit(row)}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              title="Edit Scholarship"
            >
              <Edit3 className="w-4 h-4" />
            </button>

            {/* Delete Button (Triggers Validation Modal) */}
            <button
              type="button"
              onClick={() => promptDeleteListing(row)}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Delete Listing"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      }
    }
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <PageHeader 
          title="Scholarship Listings" 
          subtitle="Manage, review, and filter your organization's posted scholarship programs."
        />
        <div className="min-h-[300px] flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200/80 p-6">
          <Loader2 className="h-7 w-7 text-emerald-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading official scholarship listings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toastMessage}
        </div>
      )}

      <PageHeader 
        title="Scholarship Listings" 
        subtitle="Manage, review, and filter your organization's posted scholarship programs."
        action={
          <button 
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" /> Create New Listing
          </button>
        }
      />

      {/* Mock Engine & Connection Bar */}
      {isUsingFallback && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-900 p-3.5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-medium">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            Backend API offline. Mock mode active — full CRUD operations will update live in state.
          </span>
          
          <div className="flex items-center gap-2 shrink-0">
            <button 
              type="button"
              onClick={handleAddQuickSample}
              className="flex items-center gap-1 text-[11px] bg-amber-200/80 hover:bg-amber-200 text-amber-900 px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-bold"
            >
              <PlusCircle className="h-3 w-3" /> Quick Sample
            </button>
            <button 
              type="button"
              onClick={handleResetMockData}
              className="flex items-center gap-1 text-[11px] bg-amber-200/80 hover:bg-amber-200 text-amber-900 px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-bold"
            >
              <RotateCcw className="h-3 w-3" /> Reset Data
            </button>
            <button 
              type="button"
              onClick={fetchListings}
              className="flex items-center gap-1 text-[11px] bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-bold"
            >
              <RefreshCw className="h-3 w-3" /> Retry API
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
        {/* Filter Controls Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            {['All', 'Open', 'Closed'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                  statusFilter === status
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {status} ({status === 'All' ? listings.length : listings.filter(i => i.status === status).length})
              </button>
            ))}
          </div>

          <FilterBar searchValue={searchQuery} onSearchChange={setSearchQuery} />
        </div>

        {/* Listings Table */}
        <DataTable columns={columns} data={filteredListings} />

        <Pagination 
          currentPage={currentPage} 
          totalPages={1} 
          onPageChange={(page) => setCurrentPage(page)} 
        />
      </div>

      {/* ========================================== */}
      {/* 1. ACTION VALIDATION / CONFIRMATION MODAL */}
      {/* ========================================== */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-xl shrink-0 ${
                confirmModal.confirmVariant === 'rose' 
                  ? 'bg-rose-50 text-rose-600' 
                  : 'bg-amber-50 text-amber-600'
              }`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-sm">{confirmModal.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{confirmModal.message}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={closeConfirmModal}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl cursor-pointer transition-colors ${
                  confirmModal.confirmVariant === 'rose'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 2. LOCAL CREATE / EDIT FALLBACK MODAL      */}
      {/* ========================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                {isCreateMode ? 'Create New Scholarship Listing' : 'Edit Scholarship Listing'}
              </h3>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Scholarship Title</label>
                <input 
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., National Excellence Scholarship 2026"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:border-emerald-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Grant Value</label>
                  <input 
                    type="text"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="e.g., ₱50,000"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:border-emerald-600"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Category</label>
                  <input 
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., Merit-Based"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:border-emerald-600 bg-white"
                  >
                    <option value="Open">Open</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Application Deadline</label>
                  <input 
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:border-emerald-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Application Portal URL</label>
                <input 
                  type="url"
                  value={formData.applicationUrl}
                  onChange={(e) => setFormData({ ...formData, applicationUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:border-emerald-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer"
                >
                  {isCreateMode ? 'Create Listing' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}