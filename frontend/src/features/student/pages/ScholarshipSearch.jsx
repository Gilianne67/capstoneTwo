import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Bookmark, 
  ExternalLink, 
  RotateCcw,
  X,
  ChevronDown,
  ChevronUp,
  Building2,
  Calendar,
  Coins,
  MapPin,
  GraduationCap,
  Loader2,
  AlertCircle,
  Inbox,
  Sparkles,
  Clock,
  Award
} from 'lucide-react';

// Context & Common Components
import { useAuth } from '../../../context/AuthContext';
import ConfirmModal from '../../../components/common/ConfirmModal';

// Mock Seed Data (Aligned with Dashboard Dataset)
const MOCK_SCHOLARSHIPS = [
  {
    _id: '65f1a2b3c4d5e6f7a8b9c0d1',
    title: 'National STEM Excellence Grant 2026',
    provider: 'Department of Science and Technology',
    category: 'STEM Specialty',
    amount: 80000,
    amountValue: 80000,
    amountPeriod: 'yr',
    deadline: '2026-08-20T00:00:00.000Z',
    region: 'Region V (Bicol Region)',
    degreeLevel: 'Undergraduate',
    matchScore: 96,
    targetFlags: ['is4PsBeneficiary', 'isWorkingStudent'],
    matchBreakdown: { 
      'Academic Record': { score: '40/40', detail: '1.45 meets <= 1.50 requirement' }, 
      'Location Priority': { score: '30/30', detail: 'Bicol Region priority' }, 
      'Financial Need': { score: '26/30', detail: 'Tier 1 Income Bracket' } 
    },
    externalUrl: 'https://official.dost.gov.ph/apply'
  },
  {
    _id: '65f1a2b3c4d5e6f7a8b9c0d2',
    title: 'Provincial Youth Tertiary Assistance',
    provider: 'Provincial Government Office',
    category: 'LGU Financial Aid',
    amount: 25000,
    amountValue: 25000,
    amountPeriod: 'sem',
    deadline: '2026-09-05T00:00:00.000Z',
    region: 'Region V (Bicol Region)',
    degreeLevel: 'Undergraduate',
    matchScore: 89,
    targetFlags: ['isIP', 'isSoloParentDependent'],
    matchBreakdown: { 
      'Academic Record': { score: '35/40', detail: '1.45 meets <= 1.75 requirement' }, 
      'Location Priority': { score: '30/30', detail: 'Pili Local Resident' }, 
      'Financial Need': { score: '24/30', detail: 'Tier 2 Income Bracket' } 
    },
    externalUrl: 'https://pili.gov.ph/scholarships'
  },
  {
    _id: '65f1a2b3c4d5e6f7a8b9c0d3',
    title: 'Higher Education Development Grant',
    provider: 'Commission on Higher Education (CHED)',
    category: 'National Merit',
    amount: 60000,
    amountValue: 60000,
    amountPeriod: 'yr',
    deadline: '2026-10-15T00:00:00.000Z',
    region: 'National',
    degreeLevel: 'Undergraduate',
    matchScore: 82,
    targetFlags: ['isPWD', 'isOrphan'],
    matchBreakdown: { 
      'Academic Record': { score: '38/40', detail: '1.45 meets <= 1.60 requirement' }, 
      'Location Priority': { score: '25/30', detail: 'Nationwide coverage' }, 
      'Financial Need': { score: '19/30', detail: 'General Academic Merit' } 
    },
    externalUrl: 'https://ched.gov.ph/grants'
  }
];

const FLAG_OPTIONS = [
  { key: 'isIP', label: 'Indigenous Peoples' },
  { key: 'isPWD', label: 'PWD Status' },
  { key: 'isSoloParentDependent', label: 'Solo Parent Child' },
  { key: 'isOrphan', label: 'Orphan Status' },
  { key: 'isFarmerFisherfolkChild', label: 'Farmer / Fisherfolk Child' },
  { key: 'isDisasterAffected', label: 'Disaster Affected' },
  { key: 'isWorkingStudent', label: 'Working Student' },
  { key: 'is4PsBeneficiary', label: '4Ps Beneficiary' },
];

const formatCurrency = (amount, currency = 'PHP') => {
  if (typeof amount !== 'number' || isNaN(amount)) return '₱0';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
};

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

export default function ScholarshipSearch() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Search & Filter State Management
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [selectedDegree, setSelectedDegree] = useState('All');
  const [selectedFlags, setSelectedFlags] = useState([]);
  const [minMatchScore, setMinMatchScore] = useState(0);
  const [sortBy, setSortBy] = useState('match');

  // Data & Dynamic State
  const [scholarships, setScholarships] = useState([]);
  const [bookmarkedIds, setBookmarkedIds] = useState([]);
  const [expandedMatchId, setExpandedMatchId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [savingBookmarkId, setSavingBookmarkId] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedScholarship, setSelectedScholarship] = useState(null);

  // Dynamic User Profile Attributes (Synced with Logged-in Student Auth state)
  const studentProfile = useMemo(() => {
    const profile = user?.profile || user || {};
    return {
      gwa: profile.gwa || profile.academicInfo?.gwa || '1.45',
      region: profile.region || profile.location || profile.address?.region || 'Region V (Bicol Region)',
      degreeLevel: profile.degreeLevel || profile.educationLevel || 'Undergraduate',
      flags: profile.targetFlags || profile.eligibilityFlags || []
    };
  }, [user]);

  // Sync profile options into filter states upon profile load
  useEffect(() => {
    if (user) {
      if (studentProfile.region && studentProfile.region !== 'All') {
        setSelectedRegion(studentProfile.region);
      }
      if (studentProfile.degreeLevel && studentProfile.degreeLevel !== 'All') {
        setSelectedDegree(studentProfile.degreeLevel);
      }
      if (Array.isArray(studentProfile.flags) && studentProfile.flags.length > 0) {
        setSelectedFlags(studentProfile.flags);
      }
    }
  }, [user, studentProfile]);

  // 1. Fetch Data with Dynamic Fallback Handling
  useEffect(() => {
    let isMounted = true;

    const loadDiscoveryData = async () => {
      setIsLoading(true);

      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const [scholarshipsRes, bookmarksRes] = await Promise.allSettled([
          fetch('/api/v1/scholarships', { headers }),
          fetch('/api/v1/students/bookmarks', { headers })
        ]);

        if (isMounted) {
          if (scholarshipsRes.status === 'fulfilled' && scholarshipsRes.value.ok) {
            const list = await scholarshipsRes.value.json();
            setScholarships(Array.isArray(list) && list.length > 0 ? list : MOCK_SCHOLARSHIPS);
            setIsUsingFallback(!Array.isArray(list) || list.length === 0);
          } else {
            setScholarships(MOCK_SCHOLARSHIPS);
            setIsUsingFallback(true);
          }

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
          console.warn('Backend API connection offline/failed, loading mock preview mode:', err);
          setScholarships(MOCK_SCHOLARSHIPS);
          setIsUsingFallback(true);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadDiscoveryData();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Bookmark Action Handler
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

  const toggleFlag = (flagKey) => {
    setSelectedFlags(prev => 
      prev.includes(flagKey) ? prev.filter(f => f !== flagKey) : [...prev, flagKey]
    );
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedRegion('All');
    setSelectedDegree('All');
    setSelectedFlags([]);
    setMinMatchScore(0);
    setSortBy('match');
  };

  // 3. Computed Filter & Sort Pipeline
  const filteredScholarships = useMemo(() => {
    return scholarships
      .filter(item => {
        const query = searchQuery.toLowerCase();
        const matchesQuery = !searchQuery || 
          item.title?.toLowerCase().includes(query) || 
          item.provider?.toLowerCase().includes(query) ||
          item.category?.toLowerCase().includes(query);

        const matchesRegion = selectedRegion === 'All' || 
          item.region === 'National' || 
          item.region === selectedRegion;

        const matchesDegree = selectedDegree === 'All' || 
          item.degreeLevel === selectedDegree;

        const score = item.matchScore ?? item.weightedScore ?? 80;
        const matchesScore = score >= minMatchScore;

        const matchesFlags = selectedFlags.length === 0 || 
          item.targetFlags?.some(flag => selectedFlags.includes(flag));

        return matchesQuery && matchesRegion && matchesDegree && matchesScore && matchesFlags;
      })
      .sort((a, b) => {
        const scoreA = a.matchScore ?? a.weightedScore ?? 0;
        const scoreB = b.matchScore ?? b.weightedScore ?? 0;

        if (sortBy === 'match') return scoreB - scoreA;
        if (sortBy === 'amount') return (b.amountValue || b.amount || 0) - (a.amountValue || a.amount || 0);
        if (sortBy === 'deadline') return new Date(a.deadline) - new Date(b.deadline);
        return 0;
      });
  }, [scholarships, searchQuery, selectedRegion, selectedDegree, selectedFlags, minMatchScore, sortBy]);

  // Dashboard Information Metrics Computed Live
  const dashboardStats = useMemo(() => {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const closingSoonCount = filteredScholarships.filter(item => {
      if (!item.deadline) return false;
      const d = new Date(item.deadline);
      return d >= now && d <= thirtyDaysFromNow;
    }).length;

    return {
      totalMatched: filteredScholarships.length,
      closingSoonCount,
      activeBookmarksCount: bookmarkedIds.length,
    };
  }, [filteredScholarships, bookmarkedIds]);

  const handleApplyClick = (item) => {
    setSelectedScholarship(item);
    setIsModalOpen(true);
  };

  const confirmRedirect = () => {
    if (selectedScholarship?.externalUrl) {
      window.open(selectedScholarship.externalUrl, '_blank', 'noopener,noreferrer');
    }
    setIsModalOpen(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-xs text-text-muted font-medium">Scanning matched scholarship opportunities...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Test-mode Alert Banner */}
      {isUsingFallback && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-3 rounded-xl flex items-center justify-between text-xs font-medium">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Backend API offline/unreachable. Showing mock preview mode for testing.
          </span>
        </div>
      )}

      {/* Search Header & Dashboard Metrics Bar */}
      <div className="bg-card-bg rounded-2xl border border-app-text/10 p-4 shadow-xs space-y-4">
        {/* Search Controls */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search by grant name, provider, or keyword (e.g., DOST, Agriculture)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold focus:outline-hidden focus:border-primary focus:bg-card-bg text-app-text"
            />
            {searchQuery && (
              <button 
                type="button"
                onClick={() => setSearchQuery('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-app-text cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-app-text/10 text-xs font-bold bg-card-bg text-app-text cursor-pointer"
            >
              <option value="match">Sort by: Highest Match %</option>
              <option value="deadline">Sort by: Nearest Deadline</option>
              <option value="amount">Sort by: Highest Grant Value</option>
            </select>

            <button 
              type="button"
              onClick={resetFilters}
              className="p-2.5 rounded-xl border border-app-text/10 hover:bg-app-bg text-text-muted transition-colors cursor-pointer"
              title="Reset Filters"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dashboard Dynamic Summary Metrics Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-app-text/10">
          <div className="bg-app-bg p-2.5 rounded-xl border border-app-text/5 flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase">Matched Grants</p>
              <p className="text-xs font-black text-app-text">{dashboardStats.totalMatched} Opportunities</p>
            </div>
          </div>

          <div className="bg-app-bg p-2.5 rounded-xl border border-app-text/5 flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase">Closing Soon</p>
              <p className="text-xs font-black text-app-text">{dashboardStats.closingSoonCount} Grants</p>
            </div>
          </div>

          <div className="bg-app-bg p-2.5 rounded-xl border border-app-text/5 flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 shrink-0">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase">Saved Bookmarks</p>
              <p className="text-xs font-black text-app-text">{dashboardStats.activeBookmarksCount} Saved</p>
            </div>
          </div>
        </div>

        {/* Active Profile Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-app-text/10 text-[11px] font-bold text-text-muted">
          <div className="flex flex-wrap items-center gap-2">
            <span>Your Profile Criteria:</span>
            <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-lg border border-primary/20">
              GWA: {studentProfile.gwa}
            </span>
            <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-lg border border-primary/20">
              {studentProfile.region}
            </span>
            <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-lg border border-primary/20">
              {studentProfile.degreeLevel}
            </span>
          </div>
          <span className="text-app-text font-black">{filteredScholarships.length} Grants Active</span>
        </div>
      </div>

      {/* Main Grid: Sidebar Filters & Results Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Filters Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card-bg rounded-2xl border border-app-text/10 p-5 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-app-text/10">
              <h3 className="text-xs font-black uppercase tracking-wider text-app-text flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-primary" /> Discovery Filters
              </h3>
            </div>

            {/* Match Score Threshold Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-app-text">Minimum Match Score</span>
                <span className="text-primary bg-primary/10 px-2 py-0.5 rounded-md font-black">{minMatchScore}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="90"
                step="5"
                value={minMatchScore}
                onChange={(e) => setMinMatchScore(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
            </div>

            {/* Region Filter */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-app-text">Region Coverage</label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-app-text/10 text-xs font-semibold bg-card-bg text-app-text cursor-pointer"
              >
                <option value="All">All Regions / Nationwide</option>
                <option value="Region V (Bicol Region)">Region V (Bicol Region)</option>
                <option value="NCR">National Capital Region (NCR)</option>
                <option value="Region IV-A">Region IV-A (CALABARZON)</option>
              </select>
            </div>

            {/* Degree Level Filter */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-app-text">Degree Level</label>
              <select
                value={selectedDegree}
                onChange={(e) => setSelectedDegree(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-app-text/10 text-xs font-semibold bg-card-bg text-app-text cursor-pointer"
              >
                <option value="All">All Degree Levels</option>
                <option value="Undergraduate">Undergraduate</option>
                <option value="Senior High School">Senior High School</option>
                <option value="Postgraduate">Postgraduate</option>
              </select>
            </div>

            {/* Target Eligibility Flags */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-app-text">Target Eligibility</label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {FLAG_OPTIONS.map(flag => (
                  <label key={flag.key} className="flex items-center gap-2 text-xs text-text-muted font-medium cursor-pointer hover:text-app-text">
                    <input
                      type="checkbox"
                      checked={selectedFlags.includes(flag.key)}
                      onChange={() => toggleFlag(flag.key)}
                      className="rounded border-app-text/20 text-primary focus:ring-primary"
                    />
                    {flag.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Scholarship Results List */}
        <div className="lg:col-span-3 space-y-4">
          {filteredScholarships.length === 0 ? (
            <div className="bg-card-bg rounded-2xl border border-app-text/10 p-8 text-center space-y-3 shadow-xs">
              <Inbox className="h-10 w-10 text-text-muted mx-auto" />
              <p className="text-sm font-bold text-app-text">No matching grants found.</p>
              <p className="text-xs text-text-muted">Try lowering your minimum match threshold or resetting your applied filters.</p>
              <button 
                type="button"
                onClick={resetFilters} 
                className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            filteredScholarships.map(scholarship => {
              const id = scholarship._id || scholarship.id;
              const isBookmarked = bookmarkedIds.includes(id);
              const isExpanded = expandedMatchId === id;
              const matchScore = scholarship.matchScore ?? scholarship.weightedScore ?? 80;

              return (
                <div key={id} className="bg-card-bg rounded-2xl border border-app-text/10 p-5 shadow-xs space-y-4 hover:border-primary/40 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-app-bg text-text-muted border border-app-text/10">
                          {scholarship.category || 'General Grant'}
                        </span>
                        <span className="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                          {matchScore}% Match
                        </span>
                      </div>
                      <h2 className="text-base font-extrabold text-app-text">{scholarship.title}</h2>
                      <p className="text-xs font-semibold text-text-muted flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-primary" /> {scholarship.provider}
                      </p>
                    </div>

                    <button 
                      type="button"
                      onClick={() => toggleBookmark(id)}
                      disabled={savingBookmarkId === id}
                      aria-label="Bookmark scholarship"
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isBookmarked 
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-600' 
                          : 'border-app-text/10 text-text-muted hover:text-primary hover:bg-primary/10'
                      }`}
                    >
                      {savingBookmarkId === id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Bookmark className="w-4 h-4" fill={isBookmarked ? 'currentColor' : 'none'} />
                      )}
                    </button>
                  </div>

                  {/* Details Bar */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-app-text/10 text-xs font-semibold text-app-text">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{typeof scholarship.amount === 'number' ? `${formatCurrency(scholarship.amount)} / ${scholarship.amountPeriod || 'term'}` : (scholarship.amount || 'Financial Grant')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-text-muted shrink-0" />
                      <span>Due: {formatDate(scholarship.deadline)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-text-muted shrink-0" />
                      <span>{scholarship.region || 'Nationwide'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-text-muted shrink-0" />
                      <span>{scholarship.degreeLevel || 'Undergraduate'}</span>
                    </div>
                  </div>

                  {/* Expandable Match Scoring Breakdown */}
                  {scholarship.matchBreakdown && (
                    <div className="pt-2 border-t border-app-text/10">
                      <button 
                        type="button"
                        onClick={() => setExpandedMatchId(isExpanded ? null : id)}
                        className="text-[11px] font-bold text-primary flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        {isExpanded ? 'Hide Algorithm Scoring' : 'Why is this a match?'}
                      </button>

                      {isExpanded && (
                        <div className="mt-3 bg-app-bg rounded-xl p-3.5 space-y-2 text-xs border border-app-text/10 animate-in fade-in duration-200">
                          {Object.entries(scholarship.matchBreakdown).map(([key, val]) => (
                            <div key={key} className="flex justify-between items-center border-b border-app-text/10 pb-1.5 last:border-0 last:pb-0">
                              <span className="font-bold text-app-text">{key}</span>
                              <div className="text-right">
                                <span className="font-black text-primary mr-2">{val.score}</span>
                                <span className="text-[11px] text-text-muted">{val.detail}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Footer */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-app-text/10">
                    <button
                      type="button"
                      onClick={() => handleApplyClick(scholarship)}
                      className="px-4 py-2 rounded-xl bg-app-text text-card-bg hover:bg-primary hover:text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <span>Apply Directly</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Official Portal Redirect Modal */}
      <ConfirmModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={confirmRedirect}
        title="Official Portal Redirect"
        message={`You are leaving IskolarMatch to access the official application portal for ${selectedScholarship?.provider || 'this provider'}. Direct application submission is hosted on their official platform.`}
        confirmText="Open Official Website"
      />
    </div>
  );
}