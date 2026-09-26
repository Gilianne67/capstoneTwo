import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  Bookmark, 
  Send, 
  ExternalLink, 
  MapPin,
  GraduationCap,
  Coins,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Inbox,
  Filter,
  CheckCircle2,
  ArrowRight,
  Flame,
  Award,
  Zap
} from 'lucide-react';

import { useAuth } from '../../../context/AuthContext';
import StatusBadge from '../../../components/common/StatusBadge';
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

const formatLocation = (profile) =>
  [profile?.municipalityCity, profile?.province, profile?.region]
    .map((part) => (part ? String(part).trim() : ''))
    .filter(Boolean)
    .join(', ');

const mapMatchFromApi = (match) => {
  const scholarship = match?.scholarship || {};

  return {
    _id: scholarship._id,
    title: scholarship.name,
    provider: scholarship.scholarshipType,
    amount: scholarship.grantValue,
    deadline: scholarship.deadline,
    weightedScore: match.totalScore,
    tag: match.classification,
    isSaved: false,
    externalUrl: scholarship.applicationURL,
    matchBreakdown: {
      gwa: {
        score: match.gpaScore,
        max: 100,
        detail: 'GPA / GWA compatibility'
      },
      location: {
        score: match.tagsScore,
        max: 100,
        detail: 'Special eligibility alignment'
      },
      financial: {
        score: match.incomeScore,
        max: 100,
        detail: 'Income compatibility'
      }
    },
    scholarship
  };
};

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

// Helper function to return dynamic Tagalog greeting based on current time
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
  const [trackedApplications] = useState([]);
  const [matchesError, setMatchesError] = useState('');
  
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

      const token = getCleanToken(contextToken);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [matchesResult, profileResult] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/matching`, { headers }),
        fetch(`${API_BASE_URL}/students/profile`, { headers })
      ]);

      if (!isMounted) return;

      if (
        matchesResult.status === 'fulfilled' &&
        matchesResult.value.ok
      ) {
        try {
          const data = await matchesResult.value.json();
          const list = Array.isArray(data.matches)
            ? [...data.matches].sort(
                (left, right) =>
                  (Number(right.totalScore) || 0) -
                  (Number(left.totalScore) || 0)
              )
            : [];

          setWeightedMatches(list.map(mapMatchFromApi));
          setMatchCount(
            typeof data.count === 'number' ? data.count : list.length
          );
        } catch (_err) {
          setWeightedMatches([]);
          setMatchCount(0);
          setMatchesError('Unable to load scholarship matches right now.');
        }
      } else {
        setWeightedMatches([]);
        setMatchCount(0);
        setMatchesError('Unable to load scholarship matches right now.');
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
    setIsSavingId(scholarshipId);

    setWeightedMatches((prev) =>
      prev.map((item) =>
        item._id === scholarshipId ? { ...item, isSaved: !item.isSaved } : item
      )
    );

    setIsSavingId(null);
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

      {/* Dynamic Student Banner with Geometric Pattern & Dynamic Greeting */}
      <div className="relative overflow-hidden rounded-3xl bg-primary p-6 md:p-8 text-white shadow-lg">
        {/* Background Geometric Pattern Accent */}
        <div className="absolute inset-0 z-0 opacity-10 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="absolute -bottom-16 -right-16 w-80 h-80 rounded-full border border-white/10 bg-white/5 backdrop-blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
  {getGreeting()}, {userProfile.name}!
</h1>
<p className="text-xs md:text-sm text-white/90 max-w-xl font-medium leading-relaxed">
  We found <strong className="text-accent font-black">{matchCount} scholarship matches</strong> for you based on your profile.
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

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Direct Matched Scholarships */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-app-text flex items-center gap-2">
                
                <span>Top Matches For You</span>
              </h2>
              <p className="text-xs text-text-muted font-medium">Ranked directly by your GWA, residence, and income class.</p>
            </div>

            <button 
              type="button"
              onClick={() => navigate('/dashboard/student/search')}
              className="flex items-center gap-1 text-xs font-bold text-primary hover:underline cursor-pointer bg-transparent border-0"
            >
              <Filter className="h-3.5 w-3.5" /> All Grants
            </button>
          </div>

          {weightedMatches.length === 0 ? (
            <div className="bg-card-bg border border-app-text/10 rounded-2xl p-8 text-center space-y-3">
              <Inbox className="h-10 w-10 text-text-muted mx-auto" />
              <p className="text-sm font-bold text-app-text">No matches available right now</p>
              <p className="text-xs text-text-muted">
                {matchesError || 'Update your academic profile to unlock fresh recommendations.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {(() => {
                const item = weightedMatches[0];
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
                    className={`bg-card-bg border border-app-text/10 rounded-2xl p-5 hover:border-primary/50 transition-all shadow-xs relative overflow-hidden group ${
                      canOpenDetails ? 'cursor-pointer' : ''
                    }`}
                  >
                    {/* Top Accent Pill */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-secondary text-white text-[11px] font-black rounded-full shadow-xs">
                          <CheckCircle2 className="h-3 w-3" />
                          {matchScore}% Match Fit
                        </span>

                        {item.tag && (
                          <span className="px-2.5 py-0.5 bg-primary/10 text-primary text-[11px] font-extrabold rounded-full">
                            {item.tag}
                          </span>
                        )}
                      </div>

                      <button 
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleToggleSave(item._id);
                        }}
                        disabled={isSavingId === item._id}
                        aria-label="Save scholarship"
                        className={`p-2 rounded-xl transition-all cursor-pointer ${
                          item.isSaved 
                            ? 'text-primary bg-primary/10' 
                            : 'text-text-muted hover:text-primary hover:bg-primary/10'
                        }`}
                      >
                        {isSavingId === item._id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Bookmark className="h-4 w-4" fill={item.isSaved ? 'currentColor' : 'none'} />
                        )}
                      </button>
                    </div>

                    {/* Title & Provider */}
                    <h3 className="text-sm font-black text-app-text group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-text-muted font-medium mt-0.5">{item.provider}</p>

                    {/* Qualification Reason Dropdown */}
                    {item.matchBreakdown && (
                      <div className="mt-3">
                        <button 
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleBreakdown(item._id);
                          }}
                          className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline cursor-pointer bg-transparent border-0 p-0"
                        >
                          <Award className="h-3.5 w-3.5 text-primary" />
                          <span>Why you qualify for this</span>
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 p-3 bg-app-bg rounded-xl border border-app-text/10 text-xs space-y-2 animate-in fade-in duration-200">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div className="bg-card-bg p-2 rounded-lg border border-app-text/10">
                                <span className="text-text-muted text-[10px] uppercase font-bold block">Academic Fit</span>
                                <strong className="text-app-text text-xs">{item.matchBreakdown.gwa?.score}/{item.matchBreakdown.gwa?.max} pts</strong>
                                <p className="text-[10px] text-text-muted mt-0.5">{item.matchBreakdown.gwa?.detail}</p>
                              </div>

                              <div className="bg-card-bg p-2 rounded-lg border border-app-text/10">
                                <span className="text-text-muted text-[10px] uppercase font-bold block">Eligibility Fit</span>
                                <strong className="text-app-text text-xs">{item.matchBreakdown.location?.score}/{item.matchBreakdown.location?.max} pts</strong>
                                <p className="text-[10px] text-text-muted mt-0.5">{item.matchBreakdown.location?.detail}</p>
                              </div>

                              <div className="bg-card-bg p-2 rounded-lg border border-app-text/10">
                                <span className="text-text-muted text-[10px] uppercase font-bold block">Financial Bracket</span>
                                <strong className="text-app-text text-xs">{item.matchBreakdown.financial?.score}/{item.matchBreakdown.financial?.max} pts</strong>
                                <p className="text-[10px] text-text-muted mt-0.5">{item.matchBreakdown.financial?.detail}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Footer Info & Direct Apply Action */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-3 border-t border-app-text/10 text-xs">
                      <div>
                        <span className="text-text-muted font-medium">Grant Amount: </span>
                        <strong className="text-sm font-extrabold text-app-text">
                          {grant.value}
                          {grant.period && (
                            <span className="text-xs font-normal text-text-muted">/{grant.period}</span>
                          )}
                        </strong>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-text-muted text-[11px] font-medium">
                          Due: <strong className="text-app-text">{formatDate(item.deadline)}</strong>
                        </span>

                        <button 
                          type="button"
                          onClick={(event) => handleApplyClick(event, item)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white hover:bg-primary/90 rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-xs"
                        >
                          <span>Apply Direct</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <button
                type="button"
                onClick={() => navigate('/dashboard/student/matches')}
                className="flex items-center justify-center gap-1.5 w-full px-4 py-2.5 rounded-2xl border border-app-text/10 bg-card-bg text-primary font-extrabold text-xs hover:border-primary/40 transition-all cursor-pointer"
              >
                <span>Show More Scholarships</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Tracked Outbound Applications */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-app-text flex items-center gap-2">
              <Send className="h-4 w-4 text-secondary" />
              <span>Tracked Applications</span>
            </h2>
          </div>

          <div className="bg-card-bg border border-app-text/10 rounded-2xl p-4 space-y-3 shadow-xs">
            {trackedApplications.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <p className="text-xs font-bold text-app-text">No outbound applications yet</p>
                <p className="text-[11px] text-text-muted">Applied scholarships will show up here automatically.</p>
              </div>
            ) : (
              trackedApplications.map((app) => (
                <div key={app._id} className="p-3 bg-app-bg rounded-xl border border-app-text/10 space-y-2 hover:border-primary/30 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-extrabold text-app-text leading-snug">{app.scholarshipTitle || app.title}</h3>
                    <StatusBadge status={app.status} />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-text-muted font-medium">
                    <span>{app.provider}</span>
                    <span>Applied {formatDate(app.updatedAt || app.submittedAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quick Tip Box with Theme Primary */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-1 text-xs">
            <p className="font-extrabold text-primary flex items-center gap-1.5">
              Quick Iskolar Tip
            </p>
            <p className="text-text-muted leading-relaxed text-[11px]">
              Keep your profile GWA up to date! Providers prioritize students whose profiles match their target grade range.
            </p>
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
