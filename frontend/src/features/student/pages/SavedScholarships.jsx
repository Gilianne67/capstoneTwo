import React, { useState, useEffect } from 'react';
import { 
  Bookmark, 
  Trash2, 
  ExternalLink, 
  Sparkles, 
  AlertCircle,
  Clock,
  Loader2
} from 'lucide-react';

import PageHeader from '../../../components/common/PageHeader';
import ConfirmModal from '../../../components/common/ConfirmModal';

// Mock Seed Data (Fallback Data for Saved Scholarships)
const MOCK_SAVED_GRANTS = [
  {
    _id: 'sch-101',
    title: 'DA-ACE Agricultural & Educational Grant 2026',
    provider: 'Department of Agriculture (DA)',
    amount: '₱50,000 / yr',
    deadline: '2026-08-20',
    matchScore: 98,
    eligibilityStatus: 'Fully Eligible',
    category: 'Government / Agriculture',
    externalUrl: 'https://da.gov.ph/scholarships',
    notes: 'Requires certification of land ownership or agrarian reform beneficiary status from local DAR.'
  },
  {
    _id: 'sch-102',
    title: 'DOST-SEI Merit Scholarship Program',
    provider: 'Department of Science and Technology',
    amount: '₱80,000 / yr',
    deadline: '2026-09-15',
    matchScore: 94,
    eligibilityStatus: 'Fully Eligible',
    category: 'Government / STEM',
    externalUrl: 'https://sei.dost.gov.ph',
    notes: 'Need to secure Form 137 and Principal recommendation letter.'
  },
  {
    _id: 'sch-104',
    title: 'Provincial Youth Tertiary Assistance Program',
    provider: 'Provincial Government of Camarines Sur',
    amount: '₱25,000 / sem',
    deadline: '2026-10-01',
    matchScore: 89,
    eligibilityStatus: 'Needs Document Verification',
    category: 'Local Government',
    externalUrl: 'https://camarinessur.gov.ph',
    notes: 'Certificate of Indigency from Barangay required.'
  }
];

// Helper: Calculate remaining days dynamically
const calculateDaysLeft = (deadlineDate) => {
  if (!deadlineDate) return 0;
  const target = new Date(deadlineDate);
  const now = new Date();
  const diffTime = target - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

export default function SavedScholarships() {
  const [savedGrants, setSavedGrants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Modal State
  const [selectedGrant, setSelectedGrant] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 1. Fetch Saved/Bookmarked Scholarships
  useEffect(() => {
    let isMounted = true;

    const fetchSavedScholarships = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const response = await fetch('/api/v1/students/saved-scholarships', { headers });

        if (response.ok) {
          const data = await response.json();
          const list = Array.isArray(data) ? data : (data.savedScholarships || []);
          if (isMounted) {
            setSavedGrants(list.length > 0 ? list : MOCK_SAVED_GRANTS);
            setIsUsingFallback(list.length === 0);
          }
        } else {
          throw new Error('Failed to load saved scholarships from backend');
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Backend connection offline, using mock saved grants feed:', err);
          setSavedGrants(MOCK_SAVED_GRANTS);
          setIsUsingFallback(true);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchSavedScholarships();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Remove bookmark handler with dynamic backend sync
  const handleRemove = async (id) => {
    setDeletingId(id);
    const previousGrants = [...savedGrants];

    // Optimistic UI Update
    setSavedGrants(prev => prev.filter(item => (item._id || item.id) !== id));

    try {
      const token = localStorage.getItem('token');
      if (token) {
        const res = await fetch(`/api/v1/students/bookmarks/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Delete request failed on server');
      }
    } catch (error) {
      console.error('Failed to sync bookmark removal with backend:', error);
      // Revert state if deletion failed
      setSavedGrants(previousGrants);
    } finally {
      setDeletingId(null);
    }
  };

  const handleApplyRedirect = (grant) => {
    setSelectedGrant(grant);
    setIsModalOpen(true);
  };

  const confirmRedirect = () => {
    const targetUrl = selectedGrant?.externalUrl || selectedGrant?.url;
    if (targetUrl) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
    setIsModalOpen(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <PageHeader 
          title="Saved Scholarships" 
          subtitle="Your bookmarked grant opportunities. Monitor upcoming deadlines and review eligibility requirements before applying on official agency portals."
        />
        <div className="min-h-[250px] flex flex-col items-center justify-center gap-3 bg-card-bg rounded-2xl border border-app-text/10 p-6">
          <Loader2 className="h-7 w-7 text-primary animate-spin" />
          <p className="text-xs text-text-muted font-medium">Retrieving your saved scholarships...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader 
        title="Saved Scholarships" 
        subtitle="Your bookmarked grant opportunities. Monitor upcoming deadlines and review eligibility requirements before applying on official agency portals."
      />

      {/* Fallback Warning Banner */}
      {isUsingFallback && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-3 rounded-xl flex items-center justify-between text-xs font-medium">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Backend API offline/unreachable. Displaying fallback saved scholarships for preview.
          </span>
        </div>
      )}

      {savedGrants.length === 0 ? (
        <div className="bg-card-bg rounded-2xl border border-app-text/10 p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-app-bg flex items-center justify-center mx-auto text-text-muted">
            <Bookmark className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-app-text">No saved scholarships yet</h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              Explore the discovery engine or match feed and bookmark grants you want to track or apply for later.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {savedGrants.map((grant) => {
            const id = grant._id || grant.id;
            const daysLeft = grant.daysLeft ?? calculateDaysLeft(grant.deadline);
            const score = grant.matchScore ?? grant.score ?? 85;

            return (
              <div 
                key={id}
                className="bg-card-bg rounded-2xl border border-app-text/10 p-5 hover:border-primary/40 transition-all shadow-xs flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Header Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-primary/10 text-primary flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> {score}% Match
                    </span>
                    <button 
                      type="button"
                      onClick={() => handleRemove(id)}
                      disabled={deletingId === id}
                      className="p-1.5 text-text-muted hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      title="Remove from saved"
                    >
                      {deletingId === id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Title & Provider */}
                  <div>
                    <h3 className="text-sm font-bold text-app-text leading-snug">{grant.title}</h3>
                    <p className="text-xs text-text-muted font-semibold">{grant.provider}</p>
                  </div>

                  {/* Info Pills */}
                  <div className="grid grid-cols-2 gap-2 bg-app-bg p-2.5 rounded-xl border border-app-text/10 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-text-muted block">Grant Value</span>
                      <strong className="text-app-text font-extrabold">{grant.amount || 'Financial Grant'}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-text-muted block">Deadline</span>
                      <strong className="text-app-text font-extrabold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-500" /> {daysLeft}d left
                      </strong>
                    </div>
                  </div>

                  {/* Personal Notes */}
                  {grant.notes && (
                    <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300">
                      <span className="font-bold block text-[10px] uppercase text-amber-600 dark:text-amber-400">Saved Note:</span>
                      {grant.notes}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-app-text/10 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyRedirect(grant)}
                    className="flex-1 py-2 bg-app-text text-card-bg hover:bg-primary hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>Official Portal</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={confirmRedirect}
        title="Official Portal Redirect"
        message={`Redirecting to official provider site (${selectedGrant?.provider || 'Provider'}). IskolarMatch does not collect or process direct application forms.`}
        confirmText="Open Portal"
      />
    </div>
  );
}