import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  Bookmark, 
  ExternalLink, 
  MapPin,
  GraduationCap,
  Coins,
  ChevronDown,
  ChevronUp,
  Loader2,
  Inbox,
  Filter,
  CheckCircle2,
  ArrowRight,
  Award,
  Lightbulb,
  UserRound
} from 'lucide-react';

import { useAuth } from '../../../context/AuthContext';
import ConfirmModal from '../../../components/common/ConfirmModal';

import { API_BASE_URL, apiErrorText } from '../../../config/api';
import {
  EMPTY_MATCH_TITLE,
  INCOMPLETE_PROFILE_MESSAGE,
  INCOMPLETE_PROFILE_TITLE,
  interpretDashboardMatches
} from '../dashboardMatch';

const getCleanToken = (contextToken) => {
  const rawToken = contextToken || localStorage.getItem('token');

  if (!rawToken) return null;

  return String(rawToken)
    .replace(/^"|"$/g, '')
    .replace(/^Bearer\s+/i, '')
    .trim();
};

const formatLocation = (profile) =>
  [profile?.municipalityCity, profile?.province, profile?.region]
    .map((part) => (part ? String(part).trim() : ''))
    .filter(Boolean)
    .join(', ');

const formatCurrency = (amount, currency = 'PHP') => {
  if (typeof amount !== 'number' || isNaN(amount)) return '₱0';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatGrantValue = (amount, amountPeriod) => {
  if (typeof amount === 'number' && !isNaN(amount)) {
    return {
      value: formatCurrency(amount),
      period: amountPeriod || 'yr'
    };
  }

  if (amount !== undefined && amount !== null && String(amount).trim() !== '') {
    return { value: String(amount), period: null };
  }

  return { value: 'Financial Grant', period: null };
};

const getGreeting = () => {
  const currentHour = new Date().getHours();
  if (currentHour < 12) {
    return 'Magandang umaga';
  } else if (currentHour < 18) {
    return 'Magandang hapon';
  } else {
    return 'Magandang gabi';
  }
};

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user, token: contextToken } = useAuth();

  const [profileDetails, setProfileDetails] = useState({
    gwa: '',
    location: '',
    financialBracket: ''
  });

  const userProfile = {
    name: user?.name?.split(' ')[0] || 'Iskolar',
    fullName: user?.name || 'Iskolar',
    gwa: profileDetails.gwa || 'Not provided',
    location: profileDetails.location || 'Not provided',
    financialBracket: profileDetails.financialBracket || 'Not provided'
  };

  const [weightedMatches, setWeightedMatches] = useState([]);
  const [matchCount, setMatchCount] = useState(0);
  const [matchesError, setMatchesError] = useState('');
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingId, setIsSavingId] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedScholarship, setSelectedScholarship] = useState(null);
  const [expandedMatchId, setExpandedMatchId] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchDashboardData = async () => {
      setIsLoading(true);
      setMatchesError('');
      setProfileIncomplete(false);

      const token = getCleanToken(contextToken);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [matchesResult, profileResult, savedResult] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/matching`, { headers }),
        fetch(`${API_BASE_URL}/students/profile`, { headers }),
        fetch(`${API_BASE_URL}/students/saved-scholarships`, { headers })
      ]);

      if (!isMounted) return;

      let savedIds = new Set();

      if (savedResult.status === 'fulfilled' && savedResult.value.ok) {
        try {
          const savedData = await savedResult.value.json();
          const savedList = Array.isArray(savedData.savedScholarships)
            ? savedData.savedScholarships
            : [];
          savedIds = new Set(
            savedList
              .map((item) => String(item?._id || item?.scholarshipId || item?.id || ''))
              .filter(Boolean)
          );
        } catch {
          savedIds = new Set();
        }
      }

      if (
        matchesResult.status === 'fulfilled' &&
        matchesResult.value.ok
      ) {
        try {
          const data = await matchesResult.value.json();
          const view = interpretDashboardMatches(data);

          setProfileIncomplete(view.profileIncomplete);
          setWeightedMatches(
            view.matches.map((item) => ({
              ...item,
              isSaved: savedIds.has(String(item._id || ''))
            }))
          );
          setMatchCount(view.count);
        } catch (_err) {
          setProfileIncomplete(false);
          setWeightedMatches([]);
          setMatchCount(0);
          setMatchesError('Unable to load scholarship matches right now.');
        }
      } else {
        let message = 'Unable to load scholarship matches right now.';
        if (matchesResult.status === 'fulfilled') {
          try {
            const data = await matchesResult.value.json();
            message = apiErrorText(data, message);
          } catch {
            // Keep the fallback when the error body is not JSON.
          }
        }
        setProfileIncomplete(false);
        setWeightedMatches([]);
        setMatchCount(0);
        setMatchesError(message);
      }

      if (
        profileResult.status === 'fulfilled' &&
        profileResult.value.ok
      ) {
        try {
          const data = await profileResult.value.json();
          const profile = data.profile || {};

          setProfileDetails({
            gwa:
              profile.gwa !== undefined && profile.gwa !== null
                ? String(profile.gwa)
                : '',
            location: formatLocation(profile),
            financialBracket: profile.incomeBracket || ''
          });
        } catch (_err) {
          setProfileDetails({
            gwa: '',
            location: '',
            financialBracket: ''
          });
        }
      }

      setIsLoading(false);
    };

    fetchDashboardData();

    return () => {
      isMounted = false;
    };
  }, [contextToken]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const handleToggleSave = async (scholarshipId) => {
    const savedId = String(scholarshipId || '');
    if (!savedId) return;

    const current = weightedMatches.find((item) => String(item._id) === savedId);
    const wasSaved = Boolean(current?.isSaved);

    setIsSavingId(savedId);
    setWeightedMatches((prev) =>
      prev.map((item) =>
        String(item._id) === savedId ? { ...item, isSaved: !wasSaved } : item
      )
    );

    try {
      const token = getCleanToken(contextToken);
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE_URL}/students/saved-scholarships/${savedId}`,
        {
          method: wasSaved ? 'DELETE' : 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const alreadyRemoved = wasSaved && response.status === 404;

      if (!response.ok && !alreadyRemoved) {
        throw new Error('Failed to update saved scholarship');
      }
    } catch (error) {
      console.error('Failed to sync saved scholarship:', error);
      setWeightedMatches((prev) =>
        prev.map((item) =>
          String(item._id) === savedId ? { ...item, isSaved: wasSaved } : item
        )
      );
    } finally {
      setIsSavingId(null);
    }
  };

  const handleApplyClick = (event, item) => {
    event.stopPropagation();
    setSelectedScholarship(item);
    setIsModalOpen(true);
  };

  const openScholarshipDetails = (item) => {
    const scholarshipId = item?.scholarship?._id || item?._id;

    if (!item?.scholarship?._id) {
      return;
    }

    navigate(`/dashboard/student/scholarships/${scholarshipId}`, {
      state: { scholarship: item.scholarship }
    });
  };

  const confirmRedirect = () => {
    const targetUrl =
      selectedScholarship?.externalUrl ||
      selectedScholarship?.scholarship?.applicationURL;

    if (targetUrl) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
    setIsModalOpen(false);
  };

  const toggleBreakdown = (id) => {
    setExpandedMatchId((prev) => (prev === id ? null : id));
  };

  if (isLoading) {
    return (
      <div className="min-h-[420px] flex flex-col items-center justify-center gap-3">
        <div className="p-3 bg-primary/10 rounded-2xl animate-bounce">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <p className="text-xs text-text-muted font-bold tracking-wide">Finding your best scholarship matches...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dynamic Student Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary to-primary/90 p-6 md:p-8 text-white shadow-xl">
        <div className="absolute inset-0 z-0 opacity-10 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="absolute -bottom-16 -right-16 w-80 h-80 rounded-full border border-white/10 bg-white/5 backdrop-blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {getGreeting()}, {userProfile.name}!
            </h1>
            <p className="text-xs md:text-sm text-white/90 max-w-xl font-medium leading-relaxed">
              {profileIncomplete ? (
                'Complete your student profile to see scholarship matches.'
              ) : matchCount > 0 ? (
                <>
                  Your highest-scoring eligible scholarship is shown below.
                  {' '}
                  <strong className="text-accent font-black">{matchCount}</strong>
                  {' '}
                  eligible {matchCount === 1 ? 'match is' : 'matches are'} available in Explore All Grants.
                </>
              ) : (
                'No eligible scholarship matches yet.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/dashboard/student/matches')}
              className="px-5 py-2.5 rounded-2xl bg-card-bg text-primary font-extrabold text-xs shadow-md hover:bg-accent hover:text-app-text transition-all cursor-pointer flex items-center gap-2"
            >
              <span>Explore All Grants</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Student Profile Quick Info Bar */}
      <div className="bg-card-bg border border-app-text/10 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-text-muted font-bold text-[11px] uppercase tracking-wider mr-1">Your Profile:</span>
          
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary font-bold border border-primary/20">
            <GraduationCap className="h-3.5 w-3.5" /> GWA: {userProfile.gwa}
          </span>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/10 text-secondary font-bold border border-secondary/20">
            <MapPin className="h-3.5 w-3.5" /> {userProfile.location}
          </span>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/10 text-accent font-bold border border-accent/20">
            <Coins className="h-3.5 w-3.5" /> {userProfile.financialBracket}
          </span>
        </div>

        <button 
          type="button"
          onClick={() => navigate('/dashboard/student/profile')}
          className="text-xs font-bold text-primary hover:underline cursor-pointer bg-transparent border-0"
        >
          Edit Profile
        </button>
      </div>

      {/* Main Grid: Matches + Quick Tip Column */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Section: All Matches (3 Columns Grid) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-app-text flex items-center gap-2">
                <span>{profileIncomplete ? 'Your student profile' : 'Your top scholarship match'}</span>
              </h2>
              <p className="text-xs text-text-muted font-medium">
                {profileIncomplete
                  ? 'Scholarship matching uses your saved academic, location, and income details.'
                  : 'The highest-scoring scholarship you are eligible for.'}
              </p>
            </div>

            <button 
              type="button"
              onClick={() => navigate('/dashboard/student/search')}
              className="flex items-center gap-1 text-xs font-bold text-primary hover:underline cursor-pointer bg-transparent border-0"
            >
              <Filter className="h-3.5 w-3.5" /> All Grants
            </button>
          </div>

          {profileIncomplete ? (
            <div className="bg-card-bg border border-app-text/10 rounded-2xl p-8 text-center space-y-3">
              <UserRound className="h-10 w-10 text-primary mx-auto" />
              <p className="text-sm font-bold text-app-text">{INCOMPLETE_PROFILE_TITLE}</p>
              <p className="text-xs text-text-muted max-w-md mx-auto">
                {INCOMPLETE_PROFILE_MESSAGE}
              </p>
              <button
                type="button"
                onClick={() => navigate('/dashboard/student/profile')}
                className="inline-flex items-center justify-center px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
              >
                Complete Profile
              </button>
            </div>
          ) : weightedMatches.length === 0 ? (
            <div className="bg-card-bg border border-app-text/10 rounded-2xl p-8 text-center space-y-3">
              <Inbox className="h-10 w-10 text-text-muted mx-auto" />
              <p className="text-sm font-bold text-app-text">{EMPTY_MATCH_TITLE}</p>
              <p className="text-xs text-text-muted">
                {matchesError || 'Update your academic profile to unlock a recommendation.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 max-w-xl gap-4">
                {weightedMatches.map((item) => {
                  const isExpanded = expandedMatchId === item._id;
                  const matchScore = item.weightedScore ?? item.matchScore ?? 0;
                  const grant = formatGrantValue(item.amount, item.amountPeriod);
                  const canOpenDetails = Boolean(item.scholarship?._id);

                  return (
                    <div 
                      key={item._id}
                      role={canOpenDetails ? 'link' : undefined}
                      tabIndex={canOpenDetails ? 0 : undefined}
                      onClick={() => openScholarshipDetails(item)}
                      onKeyDown={(event) => {
                        if (canOpenDetails && (event.key === 'Enter' || event.key === ' ')) {
                          event.preventDefault();
                          openScholarshipDetails(item);
                        }
                      }}
                      className={`bg-card-bg border border-app-text/10 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300 relative flex flex-col justify-between group ${
                        canOpenDetails ? 'cursor-pointer' : ''
                      }`}
                    >
                      {/* Header Badge & Bookmark */}
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-secondary/15 text-secondary text-[10px] font-black rounded-full border border-secondary/20">
                            <CheckCircle2 className="h-3 w-3 text-secondary" />
                            {matchScore}% Fit
                          </span>

                          <button 
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleToggleSave(item._id);
                            }}
                            disabled={isSavingId === item._id}
                            aria-label="Save scholarship"
                            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                              item.isSaved 
                                ? 'text-primary bg-primary/10' 
                                : 'text-text-muted hover:text-primary hover:bg-primary/10'
                            }`}
                          >
                            {isSavingId === item._id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Bookmark className="h-3.5 w-3.5" fill={item.isSaved ? 'currentColor' : 'none'} />
                            )}
                          </button>
                        </div>

                        {/* Title & Provider */}
                        <h3 className="text-xs font-black text-app-text group-hover:text-primary transition-colors line-clamp-1 leading-snug">
                          {item.title}
                        </h3>
                        <p className="text-[11px] text-text-muted font-medium mt-0.5 truncate">{item.provider}</p>
                        
                        {/* Scholarship Description */}
                        <p className="text-[11px] text-text-muted line-clamp-2 mt-1.5 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      {/* Middle: Grant Amount & Qualification Dropdown */}
                      <div className="my-1.5 space-y-1.5">
                        <div className="bg-primary/5 p-2 rounded-xl border border-primary/10">
                          <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Grant Amount</span>
                          <strong className="text-sm font-extrabold text-primary">
                            {grant.value}
                            {grant.period && (
                              <span className="text-[10px] font-normal text-text-muted">/{grant.period}</span>
                            )}
                          </strong>
                        </div>

                        {item.matchBreakdown && (
                          <div>
                            <button 
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleBreakdown(item._id);
                              }}
                              className="flex items-center gap-1 text-[10px] font-bold text-primary hover:underline cursor-pointer bg-transparent border-0 p-0"
                            >
                              <Award className="h-3 w-3 text-primary" />
                              <span>Why you qualify</span>
                              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>

                            {isExpanded && (
                              <div className="mt-1 p-2 bg-app-bg rounded-lg border border-app-text/10 text-[9px] space-y-0.5 animate-in fade-in duration-200">
                                <p>Academic: <strong className="text-app-text">{item.matchBreakdown.gwa?.score}/100</strong></p>
                                <p>Income: <strong className="text-app-text">{item.matchBreakdown.financial?.score}/100</strong></p>
                                <p>Special eligibility: <strong className="text-app-text">{item.matchBreakdown.specialEligibility?.score}/100</strong></p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Footer: Due Date & Action */}
                      <div className="pt-2 border-t border-app-text/10 flex items-center justify-between gap-1.5">
                        <span className="text-text-muted text-[10px] font-medium truncate">
                          Due: <strong className="text-app-text">{formatDate(item.deadline)}</strong>
                        </span>

                        <button 
                          type="button"
                          onClick={(event) => handleApplyClick(event, item)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-primary text-white hover:bg-primary/90 rounded-xl text-[10px] font-extrabold transition-all cursor-pointer shadow-xs shrink-0"
                        >
                          <span>Apply</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Section: Quick Iskolar Tip Box */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-card-bg border border-primary/20 rounded-2xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary text-white rounded-xl shadow-xs">
                <Lightbulb className="h-4 w-4" />
              </div>
              <h3 className="font-extrabold text-sm text-primary">Quick Iskolar Tip</h3>
            </div>
            
            <p className="text-xs text-text-muted leading-relaxed font-medium">
              Keep your profile up to date! Providers prioritize students whose profiles match.
            </p>

            <button
              type="button"
              onClick={() => navigate('/dashboard/student/profile')}
              className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 pt-1"
            >
              Update Profile Now <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

      </div>

      {/* External Portal Redirect Modal */}
      <ConfirmModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={confirmRedirect}
        title="Official Portal External Link"
        message={`You are leaving IskolarMatch to proceed directly to the official portal for ${selectedScholarship?.provider || 'this scholarship'}.`}
        confirmText="Open Official Portal"
      />
    </div>
  );
}