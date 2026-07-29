import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Bookmark, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp, 
  Info,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Inbox
} from 'lucide-react';

import { useAuth } from '../../../context/AuthContext';
import ConfirmModal from '../../../components/common/ConfirmModal';

// Mock Seed Data (Fallback Data for Match Feed)
const MOCK_MATCHES = [
  {
    _id: 'feed-1',
    title: 'DA-ACE Agricultural & Educational Grant 2026',
    provider: 'Department of Agriculture (DA)',
    score: 98,
    amount: '₱50,000 / year',
    deadline: 'Aug 20, 2026',
    matchedFlags: ['Child of Farmer / Fisherfolk'],
    breakdown: {
      'Special Flag Match': '35/35 (Matched: Child of Farmer)',
      'Academic Compatibility': '35/35 (GWA 1.45 qualifies)',
      'Regional Priority': '28/30 (Bicol Region priority)'
    },
    url: 'https://da.gov.ph'
  },
  {
    _id: 'feed-2',
    title: 'DOST-SEI Merit Scholarship Program',
    provider: 'Department of Science and Technology',
    score: 94,
    amount: '₱80,000 / year',
    deadline: 'Sep 15, 2026',
    matchedFlags: ['4Ps Beneficiary'],
    breakdown: {
      'Academic Rank': '40/40 (Top tier GWA)',
      'Financial Need': '28/30 (Low-income bracket)',
      'Socioeconomic Priority': '26/30 (4Ps Member)'
    },
    url: 'https://sei.dost.gov.ph'
  },
  {
    _id: 'feed-3',
    title: 'Camarines Sur Tertiary Education Assistance',
    provider: 'Provincial Government Office',
    score: 89,
    amount: '₱25,000 / semester',
    deadline: 'Oct 01, 2026',
    matchedFlags: ['4Ps Beneficiary', 'Local Resident'],
    breakdown: {
      'Location Residency': '30/30 (Pili, Camarines Sur)',
      'Socioeconomic Need': '30/35 (4Ps Beneficiary)',
      'Academic Fit': '29/35 (GWA 1.45)'
    },
    url: 'https://camarinessur.gov.ph'
  }
];

export default function MatchFeed() {
  const { user } = useAuth();

  // State Management
  const [matches, setMatches] = useState([]);
  const [bookmarkedIds, setBookmarkedIds] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [savingBookmarkId, setSavingBookmarkId] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGrant, setSelectedGrant] = useState(null);

  // 1. Fetch Top Matches and Student Bookmarks
  useEffect(() => {
    let isMounted = true;

    const loadMatchFeed = async () => {
      setIsLoading(true);

      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const [matchesRes, bookmarksRes] = await Promise.allSettled([
          fetch('/api/v1/scholarships/matches', { headers }),
          fetch('/api/v1/students/bookmarks', { headers })
        ]);

        if (isMounted) {
          // Handle Matches Endpoint Response
          if (matchesRes.status === 'fulfilled' && matchesRes.value.ok) {
            const data = await matchesRes.value.json();
            const list = Array.isArray(data) ? data : (data.matches || []);
            setMatches(list.length > 0 ? list : MOCK_MATCHES);
            setIsUsingFallback(list.length === 0);
          } else {
            setMatches(MOCK_MATCHES);
            setIsUsingFallback(true);
          }

          // Handle Bookmarks Endpoint Response
          if (bookmarksRes.status === 'fulfilled' && bookmarksRes.value.ok) {
            const bookmarks = await bookmarksRes.value.json();
            const ids = Array.isArray(bookmarks)
              ? bookmarks.map(b => typeof b === 'string' ? b : (b._id || b.id))
              : [];
            setBookmarkedIds(ids);
          }
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Backend connection offline, using mock match feed:', err);
          setMatches(MOCK_MATCHES);
          setIsUsingFallback(true);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadMatchFeed();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Toggle Bookmark State
  const toggleBookmark = async (id) => {
    setSavingBookmarkId(id);
    const isBookmarked = bookmarkedIds.includes(id);
    const updated = isBookmarked 
      ? bookmarkedIds.filter(bId => bId !== id) 
      : [...bookmarkedIds, id];

    setBookmarkedIds(updated);

    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch(`/api/v1/students/bookmarks/${id}`, {
          method: isBookmarked ? 'DELETE' : 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error('Failed to sync bookmark state:', error);
    } finally {
      setSavingBookmarkId(null);
    }
  };

  const handleApplyClick = (grant) => {
    setSelectedGrant(grant);
    setIsModalOpen(true);
  };

  const confirmRedirect = () => {
    const targetUrl = selectedGrant?.url || selectedGrant?.externalUrl;
    if (targetUrl) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
    setIsModalOpen(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-[250px] flex flex-col items-center justify-center gap-3 bg-card-bg rounded-2xl border border-app-text/10 p-6">
        <Loader2 className="h-7 w-7 text-primary animate-spin" />
        <p className="text-xs text-text-muted font-medium">Calculating personalized scholarship matches...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Test-mode Alert Banner */}
      {isUsingFallback && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-3 rounded-xl flex items-center justify-between text-xs font-medium">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Backend API offline/unreachable. Displaying top fallback matches preview.
          </span>
        </div>
      )}

      {/* FEED HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-app-text flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Your Top Scholarship Matches
          </h2>
          <p className="text-xs text-text-muted">Ranked using your GWA, location, and special eligibility flags.</p>
        </div>
      </div>

      {/* FEED LIST */}
      {matches.length === 0 ? (
        <div className="bg-card-bg rounded-2xl border border-app-text/10 p-8 text-center space-y-2">
          <Inbox className="h-8 w-8 text-text-muted mx-auto" />
          <p className="text-xs font-bold text-app-text">No matches currently found for your profile.</p>
          <p className="text-[11px] text-text-muted">Update your student profile to re-trigger the matching algorithm.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((item) => {
            const id = item._id || item.id;
            const isExpanded = expandedId === id;
            const isBookmarked = bookmarkedIds.includes(id);
            const score = item.score ?? item.matchScore ?? 80;
            const flags = item.matchedFlags || item.targetFlags || [];

            return (
              <div 
                key={id} 
                className="bg-card-bg rounded-2xl border border-app-text/10 p-5 hover:border-primary/40 transition-all shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/10 text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {score}% Match Score
                      </span>
                      {flags.map((flag, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary">
                          {flag}
                        </span>
                      ))}
                    </div>

                    <h3 className="text-sm font-bold text-app-text">{item.title}</h3>
                    <p className="text-xs font-semibold text-text-muted">{item.provider}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleBookmark(id)}
                    disabled={savingBookmarkId === id}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                      isBookmarked 
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-600' 
                        : 'border-app-text/10 text-text-muted hover:bg-app-bg hover:text-app-text'
                    }`}
                    title="Bookmark Scholarship"
                  >
                    {savingBookmarkId === id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-amber-600' : ''}`} />
                    )}
                  </button>
                </div>

                {/* Match Criteria Drawer */}
                {isExpanded && item.breakdown && (
                  <div className="p-3 bg-app-bg rounded-xl border border-app-text/10 text-xs space-y-2 animate-in fade-in">
                    <p className="font-extrabold text-text-muted text-[10px] uppercase tracking-wider">Weighted Algorithm Calculation</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {Object.entries(item.breakdown).map(([key, val]) => (
                        <div key={key} className="bg-card-bg p-2 rounded-lg border border-app-text/10">
                          <span className="text-text-muted text-[10px] font-bold block">{key}</span>
                          <strong className="text-app-text text-xs">{typeof val === 'object' ? `${val.score} (${val.detail})` : val}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bottom Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-app-text/10 text-xs">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-text-muted font-medium">Grant Value: </span>
                      <strong className="text-app-text font-bold">{item.amount || 'Financial Grant'}</strong>
                    </div>
                    {item.breakdown && (
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : id)}
                        className="text-primary font-bold text-[11px] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Info className="w-3 h-3" />
                        {isExpanded ? 'Hide Score Details' : 'Score Details'}
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleApplyClick(item)}
                    className="px-3.5 py-1.5 bg-app-text text-card-bg hover:bg-primary hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>Apply Off-Site</span>
                    <ExternalLink className="w-3 h-3" />
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
        message={`Redirecting to official provider site (${selectedGrant?.provider || 'Provider'}). Applications are hosted on official agency portals.`}
        confirmText="Open Portal"
      />
    </div>
  );
}