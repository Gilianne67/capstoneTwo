import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
import CreateListing from './CreateListing';
import { formatDeadlineDate } from '../../../utils/deadline';
import { API_BASE_URL } from '../../../config/api';

const listingKey = (item) => {
  if (!item || typeof item !== 'object') return '';
  const id = item._id ?? item.id;
  return id === undefined || id === null ? '' : String(id);
};

const scholarshipFromResponse = (payload) => {
  const scholarship = payload && payload.scholarship;
  if (!scholarship || typeof scholarship !== 'object' || Array.isArray(scholarship)) {
    return null;
  }
  return scholarship;
};

const readResponseBody = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const confirmedListingStatus = (payload) => {
  const scholarship = scholarshipFromResponse(payload);
  if (!scholarship || !Object.prototype.hasOwnProperty.call(scholarship, 'status')) {
    return { scholarship, status: null };
  }
  if (scholarship.status !== 'Open' && scholarship.status !== 'Closed') {
    return { scholarship, status: null, invalid: true };
  }
  return { scholarship, status: scholarship.status };
};

const archiveConfirmed = (payload) => {
  const scholarship = scholarshipFromResponse(payload);
  if (scholarship && Object.prototype.hasOwnProperty.call(scholarship, 'isArchived')) {
    return { scholarship, confirmed: scholarship.isArchived === true };
  }
  return { scholarship, confirmed: true };
};


export default function ScholarshipListings({ onNavigateToCreate, onNavigateToEdit }) {
  const navigate = useNavigate();

  const [listings, setListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingListing, setEditingListing] = useState(null);
  const [currentView, setCurrentView] = useState('listings');

  // Notification Banner State
  const [toastMessage, setToastMessage] = useState(null);


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
  const [isConfirming, setIsConfirming] = useState(false);
  const confirmLock = useRef(false);

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

    if (!token) {
      throw new Error('Authentication token not found. Please log in again.');
    }

    const response = await fetch(
      `${API_BASE_URL}/scholarships/my`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to load scholarships.');
    }

    setListings(data.scholarships || []);
    setIsUsingFallback(false);

  } catch (err) {
    console.error('Failed to fetch scholarships:', err);
    setListings([]);
    setIsUsingFallback(false);
    setToastMessage(err.message || 'Failed to load scholarships.');
  } finally {
    setIsLoading(false);
  }
}, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  
  // Helper to Close Confirm Modal
  const closeConfirmModal = () => {
    if (confirmLock.current) return;
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
      title: 'Archive Scholarship Listing',
      message: `Are you sure you want to permanently archive "${row.name}"? This action cannot be undone.`,
      confirmText: 'Archive Listing',
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
      message: `Are you sure you want to ${actionVerb} applications for "${row.name}"? ${
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
    if (confirmLock.current) return;

    const { type, targetItem } = confirmModal;
    if (!targetItem || (type !== 'delete' && type !== 'toggle')) return;

    const id = listingKey(targetItem);
    if (!id) return;

    const requestedStatus = targetItem.status === 'Open' ? 'Closed' : 'Open';

    confirmLock.current = true;
    setIsConfirming(true);

    try {
      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error('Authentication token not found.');
      }

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      };

      if (type === 'delete') {
        const res = await fetch(
          `${API_BASE_URL}/scholarships/${id}/archive`,
          {
            method: 'PATCH',
            headers
          }
        );
        const data = await readResponseBody(res);

        if (!res.ok) {
          throw new Error((data && data.message) || 'Failed to archive scholarship.');
        }

        const archived = archiveConfirmed(data);
        if (!archived.confirmed) {
          throw new Error((data && data.message) || 'Failed to archive scholarship.');
        }

        setListings((prev) => prev.filter((item) => listingKey(item) !== id));
        showToast('Scholarship archived successfully.');
      } else {
        const res = await fetch(
          `${API_BASE_URL}/scholarships/${id}/status`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              status: requestedStatus
            })
          }
        );
        const data = await readResponseBody(res);

        if (!res.ok) {
          throw new Error((data && data.message) || 'Failed to update scholarship status.');
        }

        const confirmed = confirmedListingStatus(data);
        if (confirmed.invalid) {
          throw new Error((data && data.message) || 'Failed to update scholarship status.');
        }

        const status = confirmed.status || requestedStatus;
        setListings((prev) => prev.map((item) => {
          if (listingKey(item) !== id) return item;
          if (confirmed.scholarship) {
            return { ...item, ...confirmed.scholarship, status };
          }
          return { ...item, status };
        }));
        showToast(`Scholarship status changed to ${status}.`);
      }

      confirmLock.current = false;
      closeConfirmModal();
    } catch (err) {
      console.error('Failed to update scholarship:', err);
      showToast(err.message || 'Failed to update scholarship.');
    } finally {
      confirmLock.current = false;
      setIsConfirming(false);
    }
  };

  // CRUD Operation 3: START CREATE / EDIT
  const handleOpenCreate = () => {
  navigate('/dashboard/provider/create');
};

  const handleOpenEdit = (row) => {
  setEditingListing(row);
  setCurrentView('edit');
};

if (currentView === 'edit') {
  return (
    <CreateListing
      initialData={editingListing}
      onBack={() => {
        setCurrentView('listings');
        setEditingListing(null);
      }}
      onSuccess={() => {
        setCurrentView('listings');
        setEditingListing(null);
        fetchListings();
        showToast('Scholarship listing updated successfully.');
      }}
    />
  );
}


  // Filter Logic
  const filteredListings = listings.filter((item) => {
    const matchesSearch =
  item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
  item.scholarshipType?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
  header: 'Official Scholarship Title',
  accessor: 'name',
  cell: (row) => (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() =>
          navigate(`/dashboard/provider/scholarships/${row._id}`)
        }
        className="font-bold text-slate-900 hover:text-emerald-600 hover:underline text-left cursor-pointer"
      >
        {row.name}
      </button>

      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-400 font-medium">
          {row.scholarshipType || 'General'}
        </span>

        {row.applicationURL && (
          <a
            href={row.applicationURL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-emerald-600 hover:underline flex items-center gap-0.5 font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            Portal Link
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>
    </div>
  )
},
    { 
      header: 'Grant Value', 
      accessor: 'grantValue',
      cell: (row) => <span className="font-semibold text-slate-700">{row.grantValue}</span>
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
    {
      header: 'Deadline',
      accessor: 'deadline',
      cell: (row) => formatDeadlineDate(row.deadline) || 'No deadline'
    },
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

  const createListingAction = (
    <button
      type="button"
      onClick={handleOpenCreate}
      className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
    >
      <PlusCircle className="h-4 w-4" />
      Create Listing
    </button>
  );

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <PageHeader
          title="Scholarship Listings"
          description="Manage, review, and filter your organization's posted scholarship programs."
          role="provider"
          actionButton={createListingAction}
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
        description="Manage, review, and filter your organization's posted scholarship programs."
        role="provider"
        actionButton={createListingAction}
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
                disabled={isConfirming}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={isConfirming}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-xl cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                  confirmModal.confirmVariant === 'rose'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isConfirming && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isConfirming
                  ? (confirmModal.type === 'delete'
                    ? 'Archiving...'
                    : confirmModal.targetItem?.status === 'Open'
                      ? 'Closing...'
                      : 'Opening...')
                  : confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 2. LOCAL CREATE / EDIT FALLBACK MODAL      */}
      {/* ========================================== */}
    
    </div>
  );
}