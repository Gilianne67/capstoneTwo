import { useState, useEffect } from 'react';
import {
  Bookmark,
  ExternalLink,
  Info,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Inbox
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import ConfirmModal from '../../../components/common/ConfirmModal';

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'
).replace(/\/$/, '');

const getCleanToken = (contextToken) => {
  const rawToken = contextToken || localStorage.getItem('token');

  if (!rawToken) return null;

  return String(rawToken)
    .replace(/^"|"$/g, '')
    .replace(/^Bearer\s+/i, '')
    .trim();
};

const mapMatchFromApi = (match) => {
  if (!match?.scholarship) {
    return match;
  }

  const scholarship = match.scholarship;
  const breakdown = {};

  if (match.gpaScore != null) {
    breakdown['GPA / GWA'] = match.gpaScore;
  }

  if (match.incomeScore != null) {
    breakdown.Income = match.incomeScore;
  }

  if (match.tagsScore != null) {
    breakdown['Special Eligibility'] = match.tagsScore;
  }

  return {
    _id: scholarship._id,
    title: scholarship.name,
    provider: scholarship.scholarshipType,
    amount: scholarship.grantValue,
    deadline: scholarship.deadline,
    score: match.totalScore,
    classification: match.classification,
    matchedFlags: match.classification ? [match.classification] : [],
    url: scholarship.applicationURL,
    breakdown: Object.keys(breakdown).length > 0 ? breakdown : undefined,
    scholarship
  };
};

export default function MatchFeed() {
  const navigate = useNavigate();
  const { token: contextToken } = useAuth();

  // State Management
  const [matches, setMatches] = useState([]);
  const [bookmarkedIds, setBookmarkedIds] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [savingBookmarkId, setSavingBookmarkId] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGrant, setSelectedGrant] = useState(null);

  // 1. Fetch Top Matches and Student Bookmarks
  useEffect(() => {
    let isMounted = true;

    const loadMatchFeed = async () => {
      setIsLoading(true);
      setLoadError('');

      try {
        const token = getCleanToken(contextToken);
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const [matchesRes, bookmarksRes] = await Promise.allSettled([
          fetch(`${API_BASE_URL}/matching`, { headers }),
          fetch(`${API_BASE_URL}/students/saved-scholarships`, { headers })
        ]);

        if (isMounted) {
          // Handle Matches Endpoint
          if (matchesRes.status === 'fulfilled' && matchesRes.value.ok) {
            const data = await matchesRes.value.json();
            const list = Array.isArray(data.matches)
              ? data.matches.map(mapMatchFromApi)
              : [];
            setMatches(list);
          } else {
            setMatches([]);
            setLoadError('Unable to load scholarship matches right now.');
          }

          // Handle Bookmarks Endpoint
          if (bookmarksRes.status === 'fulfilled' && bookmarksRes.value.ok) {
            const bookmarks = await bookmarksRes.value.json();
            const list = Array.isArray(bookmarks?.savedScholarships)
              ? bookmarks.savedScholarships
              : [];
            setBookmarkedIds(
              list
                .map((item) => String(item?._id || item?.scholarshipId || item?.id || ''))
                .filter(Boolean)
            );
          }
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Failed to load match feed:', err);
          setMatches([]);
          setLoadError('Unable to load scholarship matches right now.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadMatchFeed();

    return () => {
      isMounted = false;
    };
  }, [contextToken]);

  // 2. Toggle Bookmark State
  const toggleBookmark = async (id) => {
    const scholarshipId = String(id || '');
    if (!scholarshipId) return;

    setSavingBookmarkId(scholarshipId);
    const isBookmarked = bookmarkedIds.includes(scholarshipId);
    const previous = bookmarkedIds;
    const updated = isBookmarked
      ? bookmarkedIds.filter((savedId) => savedId !== scholarshipId)
      : [...bookmarkedIds, scholarshipId];

    setBookmarkedIds(updated);

    try {
      const token = getCleanToken(contextToken);
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE_URL}/students/saved-scholarships/${scholarshipId}`,
        {
          method: isBookmarked ? 'DELETE' : 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const alreadyRemoved = isBookmarked && response.status === 404;

      if (!response.ok && !alreadyRemoved) {
        throw new Error('Failed to update saved scholarship');
      }
    } catch (error) {
      console.error('Failed to sync bookmark state:', error);
      setBookmarkedIds(previous);
    } finally {
      setSavingBookmarkId(null);
    }
  };

  const handleApplyClick = (event, grant) => {
    event.stopPropagation();
    setSelectedGrant(grant);
    setIsModalOpen(true);
  };

  const openScholarshipDetails = (item) => {
    const scholarshipId = item?.scholarship?._id || item?._id;

    if (!scholarshipId || !item?.scholarship?._id) {
      return;
    }

    navigate(`/dashboard/student/scholarships/${scholarshipId}`, {
      state: { scholarship: item.scholarship }
    });
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
      {loadError && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-3 rounded-xl flex items-center justify-between text-xs font-medium">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {loadError}
          </span>
        </div>
      )}

      {/* FEED HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-app-text flex items-center gap-2">
            Your Top Scholarship Matches
          </h2>
          <p className="text-xs text-text-muted">Ranked using your GWA, location, and special eligibility flags.</p>
        </div>
      </div>

      {/* FEED LIST */}
      {matches.length === 0 ? (
        <div className="bg-card-bg rounded-2xl border border-app-text/10 p-8 text-center space-y-2">
          <Inbox className="h-8 w-8 text-text-muted mx-auto" />
          <p className="text-xs font-bold text-app-text">
            {loadError ? 'Scholarship matches could not be loaded.' : 'No matches currently found for your profile.'}
          </p>
          <p className="text-[11px] text-text-muted">
            {loadError
              ? 'Check your connection and open this page again.'
              : 'Update your student profile to re-trigger the matching algorithm.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((item) => {
            const id = item.scholarship?._id || item._id || item.id;
            const isExpanded = expandedId === id;
            const isBookmarked = bookmarkedIds.includes(String(id));
            const score = item.score ?? item.weightedScore ?? item.matchScore ?? 80;
            const flags = item.matchedFlags || (item.tag ? [item.tag] : []);
            const canOpenDetails = Boolean(item.scholarship?._id);

            return (
              <div 
                key={id} 
                role={canOpenDetails ? 'link' : undefined}
                tabIndex={canOpenDetails ? 0 : undefined}
                onClick={() => openScholarshipDetails(item)}
                onKeyDown={(event) => {
                  if (canOpenDetails && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    openScholarshipDetails(item);
                  }
                }}
                className={`bg-card-bg rounded-2xl border border-app-text/10 p-5 hover:border-primary/40 transition-all shadow-xs space-y-3 ${
                  canOpenDetails ? 'cursor-pointer' : ''
                }`}
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
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleBookmark(id);
                    }}
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
                {isExpanded && (item.breakdown || item.matchBreakdown) && (
                  <div className="p-3 bg-app-bg rounded-xl border border-app-text/10 text-xs space-y-2 animate-in fade-in">
                    <p className="font-extrabold text-text-muted text-[10px] uppercase tracking-wider">Weighted Algorithm Calculation</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {Object.entries(item.breakdown || item.matchBreakdown).map(([key, val]) => (
                        <div key={key} className="bg-card-bg p-2 rounded-lg border border-app-text/10">
                          <span className="text-text-muted text-[10px] font-bold block capitalize">{key}</span>
                          <strong className="text-app-text text-xs">
                            {typeof val === 'object' ? `${val.score}/${val.max} (${val.detail})` : val}
                          </strong>
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
                      <strong className="text-app-text font-bold">
                        {typeof item.amount === 'number' ? `₱${item.amount.toLocaleString()} / ${item.amountPeriod || 'yr'}` : (item.amount || 'Financial Grant')}
                      </strong>
                    </div>
                    {(item.breakdown || item.matchBreakdown) && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setExpandedId(isExpanded ? null : id);
                        }}
                        className="text-primary font-bold text-[11px] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Info className="w-3 h-3" />
                        {isExpanded ? 'Hide Score Details' : 'Score Details'}
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(event) => handleApplyClick(event, item)}
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