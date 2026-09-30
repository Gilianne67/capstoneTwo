import { useState, useEffect, useMemo } from 'react';
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
  Inbox,
  Sparkles,
  Clock,
  Award,
  UserRound
} from 'lucide-react';

// Context & Common Components
import { useAuth } from '../../../context/AuthContext';
import ConfirmModal from '../../../components/common/ConfirmModal';
import { isProfileComplete } from '../profileCompletion';
import { API_BASE_URL } from '../../../config/api';

const PROFILE_ROUTE = '/dashboard/student/profile';
const ONBOARDING_ROUTE = '/onboarding';

const getCleanToken = (contextToken) => {
  const rawToken = contextToken || localStorage.getItem('token');

  if (!rawToken) return null;

  return String(rawToken)
    .replace(/^"|"$/g, '')
    .replace(/^Bearer\s+/i, '')
    .trim();
};

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

// Existing filter labels compared with the location names stored on scholarships.
const REGION_FILTER_TARGETS = {
  'Region V (Bicol Region)': ['bicol region', 'region v', 'region v (bicol region)'],
  NCR: ['national capital region', 'ncr'],
  'Region IV-A': ['calabarzon', 'region iv-a', 'region iv-a (calabarzon)']
};

// Existing degree labels compared with hardFilters.academicLevel values.
const DEGREE_FILTER_LEVELS = {
  Undergraduate: ['undergraduate', 'college'],
  'Senior High School': ['senior high school'],
  Postgraduate: ['postgraduate', 'graduate studies']
};

// Checkbox keys compared with scholarship.specialTags.tagName values.
const FLAG_TAG_NAMES = {
  isIP: ['indigenous peoples (ip)', 'ip', 'indigenous peoples'],
  isPWD: ['person with disability (pwd)', 'pwd', 'pwd status'],
  isSoloParentDependent: ['solo parent dependent', 'solo parent child'],
  isOrphan: ['orphan status', 'orphan'],
  isFarmerFisherfolkChild: [
    'child of farmer / fisherfolk',
    'farmer / fisherfolk child',
    'farmer/fisherfolk child'
  ],
  isDisasterAffected: ['disaster-affected family', 'disaster affected'],
  isWorkingStudent: ['working student'],
  is4PsBeneficiary: ['4ps beneficiary', '4ps']
};

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

const formatGeographicLocation = (location) => {
  if (!location) return '';
  if (typeof location === 'string') return location;

  const scope = location.scope || '';
  const places = [
    ...(location.municipalities || []),
    ...(location.provinces || []),
    ...(location.regions || [])
  ].map((value) => String(value || '').trim()).filter(Boolean);

  if (scope === 'Nationwide' || places.length === 0) {
    return scope || 'Nationwide';
  }

  return places.join(', ');
};

const parseGrantAmount = (value) => {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  const match = String(value || '').replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
};

const locationMatchesRegion = (geographicLocation, selectedRegion) => {
  if (selectedRegion === 'All') return true;
  if (!geographicLocation) return false;

  if (typeof geographicLocation === 'string') {
    const normalized = geographicLocation.trim().toLowerCase();
    if (normalized === 'nationwide' || normalized === 'national') return true;
    const targets = REGION_FILTER_TARGETS[selectedRegion] || [selectedRegion.toLowerCase()];
    return targets.some((target) => normalized === target || normalized.includes(target));
  }

  if (geographicLocation.scope === 'Nationwide') return true;

  const places = [
    ...(geographicLocation.regions || []),
    ...(geographicLocation.provinces || []),
    ...(geographicLocation.municipalities || [])
  ].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);

  const targets = REGION_FILTER_TARGETS[selectedRegion] || [selectedRegion.toLowerCase()];
  return places.some((place) => targets.some((target) => place === target || place.includes(target)));
};

const levelMatchesDegree = (academicLevel, selectedDegree) => {
  if (selectedDegree === 'All') return true;
  const normalized = String(academicLevel || '').trim().toLowerCase();
  const accepted = DEGREE_FILTER_LEVELS[selectedDegree] || [selectedDegree.toLowerCase()];
  return accepted.includes(normalized);
};

const scholarshipMatchesFlags = (specialTags, selectedFlags) => {
  if (selectedFlags.length === 0) return true;

  const tagNames = (specialTags || [])
    .map((tag) => String(tag?.tagName || '').trim().toLowerCase())
    .filter(Boolean);

  return selectedFlags.some((flag) => {
    const names = FLAG_TAG_NAMES[flag] || [String(flag).toLowerCase()];
    return tagNames.some((tagName) => names.includes(tagName));
  });
};

const mapMatchFromApi = (match) => {
  const scholarship = match?.scholarship || {};
  const hardFilters = scholarship.hardFilters || {};
  const locationLabel = formatGeographicLocation(hardFilters.geographicLocation);
  const breakdown = {};

  if (match?.gpaScore != null) {
    breakdown['GPA / GWA'] = {
      score: match.gpaScore,
      detail: 'GPA / GWA compatibility'
    };
  }

  if (match?.incomeScore != null) {
    breakdown.Income = {
      score: match.incomeScore,
      detail: 'Income compatibility'
    };
  }

  if (match?.tagsScore != null) {
    breakdown['Special Eligibility'] = {
      score: match.tagsScore,
      detail: 'Special eligibility alignment'
    };
  }

  return {
    _id: scholarship._id,
    title: scholarship.name || '',
    scholarshipType: scholarship.scholarshipType || '',
    classification: match?.classification || '',
    provider: scholarship.scholarshipType || '',
    amount: scholarship.grantValue,
    deadline: scholarship.deadline,
    region: locationLabel,
    geographicLocation: hardFilters.geographicLocation,
    degreeLevel: hardFilters.academicLevel || '',
    totalScore: Number(match?.totalScore) || 0,
    matchScore: Number(match?.totalScore) || 0,
    externalUrl: scholarship.applicationURL || '',
    description: scholarship.description || '',
    benefits: Array.isArray(scholarship.benefits) ? scholarship.benefits : [],
    specialTags: Array.isArray(scholarship.specialTags) ? scholarship.specialTags : [],
    matchBreakdown: Object.keys(breakdown).length > 0 ? breakdown : undefined,
    scholarship
  };
};

export default function ScholarshipSearch() {
  const navigate = useNavigate();
  const { user, token: contextToken } = useAuth();

  // Search & Filter State Management
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [selectedDegree, setSelectedDegree] = useState('All');
  const [selectedFlags, setSelectedFlags] = useState([]);
  const [minMatchScore, setMinMatchScore] = useState(0);
  const [sortBy, setSortBy] = useState('match');

  // Data & Dynamic State
  const [scholarships, setScholarships] = useState([]);
  const [matchCount, setMatchCount] = useState(0);
  const [bookmarkedIds, setBookmarkedIds] = useState([]);
  const [expandedMatchId, setExpandedMatchId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchState, setSearchState] = useState('loading');
  const [continuePath, setContinuePath] = useState(PROFILE_ROUTE);
  const [savingBookmarkId, setSavingBookmarkId] = useState(null);
  const [studentProfile, setStudentProfile] = useState({
    gwa: 'Not provided',
    region: 'Not provided',
    academicLevel: 'Not provided'
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedScholarship, setSelectedScholarship] = useState(null);

  // 1. Fetch live matching results
  useEffect(() => {
    let isMounted = true;

    const loadDiscoveryData = async () => {
      setIsLoading(true);
      setLoadError('');
      setScholarships([]);
      setMatchCount(0);

      try {
        const token = getCleanToken(contextToken);
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const profileRes = await fetch(`${API_BASE_URL}/students/profile`, { headers });

        if (!isMounted) return;

        if (profileRes.status === 404) {
          setContinuePath(user?.isOnboarded ? PROFILE_ROUTE : ONBOARDING_ROUTE);
          setSearchState('incomplete');
          return;
        }

        if (!profileRes.ok) {
          setSearchState('error');
          setLoadError('Unable to load your student profile right now.');
          return;
        }

        const profileData = await profileRes.json();
        const profile = profileData.profile || {};
        const hasValue = (value) =>
          value !== undefined && value !== null && String(value).trim() !== '';

        setStudentProfile({
          gwa: hasValue(profile.gwa) ? String(profile.gwa) : 'Not provided',
          region: hasValue(profile.region) ? String(profile.region) : 'Not provided',
          academicLevel: hasValue(profile.academicLevel) ? String(profile.academicLevel) : 'Not provided'
        });

        if (!isProfileComplete(profile)) {
          setContinuePath(user?.isOnboarded ? PROFILE_ROUTE : ONBOARDING_ROUTE);
          setSearchState('incomplete');
          return;
        }

        const [matchesRes, bookmarksRes] = await Promise.allSettled([
          fetch(`${API_BASE_URL}/matching`, { headers }),
          fetch(`${API_BASE_URL}/students/saved-scholarships`, { headers })
        ]);

        if (!isMounted) return;

        if (matchesRes.status === 'fulfilled' && matchesRes.value.ok) {
          const data = await matchesRes.value.json();

          if (data.profileComplete === false) {
            setContinuePath(PROFILE_ROUTE);
            setSearchState('incomplete');
            return;
          }

          const list = Array.isArray(data.matches)
            ? data.matches.map(mapMatchFromApi)
            : [];
          setScholarships(list);
          setMatchCount(typeof data.count === 'number' ? data.count : list.length);
          setSearchState('ready');
        } else {
          let message = 'Unable to load scholarship matches right now.';
          if (matchesRes.status === 'fulfilled') {
            try {
              const data = await matchesRes.value.json();
              if (data?.message) message = data.message;
            } catch {
              // Keep the default message when the error body is not JSON.
            }
          }
          setLoadError(message);
          setSearchState('error');
        }

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
      } catch (err) {
        if (isMounted) {
          console.warn('Matching API request failed:', err);
          setScholarships([]);
          setMatchCount(0);
          setLoadError('Unable to load scholarship matches right now.');
          setSearchState('error');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadDiscoveryData();

    return () => {
      isMounted = false;
    };
  }, [contextToken, user?.isOnboarded]);

  // 2. Bookmark Action Handler
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
        const query = searchQuery.toLowerCase().trim();
        const searchableText = [
          item.title,
          item.scholarshipType,
          item.classification,
          item.description,
          item.degreeLevel,
          item.region,
          item.amount,
          ...(item.benefits || []),
          ...(item.specialTags || []).map((tag) => tag?.tagName)
        ].join(' ').toLowerCase();
        const matchesQuery = !query || searchableText.includes(query);

        const matchesRegion = locationMatchesRegion(item.geographicLocation, selectedRegion);
        const matchesDegree = levelMatchesDegree(item.degreeLevel, selectedDegree);
        const score = Number(item.totalScore ?? item.matchScore ?? 0);
        const matchesScore = score >= minMatchScore;
        const matchesFlags = scholarshipMatchesFlags(item.specialTags, selectedFlags);

        return matchesQuery && matchesRegion && matchesDegree && matchesScore && matchesFlags;
      })
      .sort((a, b) => {
        const scoreA = Number(a.totalScore ?? a.matchScore ?? 0);
        const scoreB = Number(b.totalScore ?? b.matchScore ?? 0);

        if (sortBy === 'match') return scoreB - scoreA;
        if (sortBy === 'amount') return parseGrantAmount(b.amount) - parseGrantAmount(a.amount);
        if (sortBy === 'deadline') {
          const timeA = new Date(a.deadline).getTime();
          const timeB = new Date(b.deadline).getTime();
          return (Number.isNaN(timeA) ? Infinity : timeA) - (Number.isNaN(timeB) ? Infinity : timeB);
        }
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
      closingSoonCount,
      activeBookmarksCount: bookmarkedIds.length,
    };
  }, [filteredScholarships, bookmarkedIds]);

  const handleApplyClick = (event, item) => {
    event.stopPropagation();
    setSelectedScholarship(item);
    setIsModalOpen(true);
  };

  const openScholarshipDetails = (item) => {
    const scholarshipId = item?.scholarship?._id || item?._id;

    if (!scholarshipId) return;

    navigate(`/dashboard/student/scholarships/${scholarshipId}`, {
      state: { scholarship: item.scholarship }
    });
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

  if (searchState === 'incomplete') {
    return (
      <div className="bg-card-bg rounded-2xl border border-app-text/10 p-8 text-center space-y-3">
        <UserRound className="h-8 w-8 text-primary mx-auto" />
        <h2 className="text-sm font-bold text-app-text">Complete Your Student Profile</h2>
        <p className="text-xs text-text-muted max-w-md mx-auto">
          Complete your onboarding profile to receive scholarship matches based on your academic background, household income, location, and eligibility.
        </p>
        <button
          type="button"
          onClick={() => navigate(continuePath)}
          className="inline-flex items-center justify-center px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
        >
          Complete Profile
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
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
              <p className="text-xs font-black text-app-text">{matchCount} Opportunities</p>
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
              {studentProfile.academicLevel}
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
              <p className="text-sm font-bold text-app-text">
                {loadError ? 'Unable to load scholarship matches.' : 'No matching grants found.'}
              </p>
              <p className="text-xs text-text-muted">
                {loadError || 'Try lowering your minimum match threshold or resetting your applied filters.'}
              </p>
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
              const isBookmarked = bookmarkedIds.includes(String(id));
              const isExpanded = expandedMatchId === id;
              const matchScore = scholarship.totalScore ?? scholarship.matchScore ?? 0;
              const canOpenDetails = Boolean(id);

              return (
                <div
                  key={id}
                  role={canOpenDetails ? 'link' : undefined}
                  tabIndex={canOpenDetails ? 0 : undefined}
                  onClick={() => openScholarshipDetails(scholarship)}
                  onKeyDown={(event) => {
                    if (canOpenDetails && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      openScholarshipDetails(scholarship);
                    }
                  }}
                  className={`bg-card-bg rounded-2xl border border-app-text/10 p-5 shadow-xs space-y-4 hover:border-primary/40 transition-all ${
                    canOpenDetails ? 'cursor-pointer' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-app-bg text-text-muted border border-app-text/10">
                          {scholarship.classification || 'Match'}
                        </span>
                        <span className="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                          {matchScore}% Match
                        </span>
                      </div>
                      <h2 className="text-base font-extrabold text-app-text">{scholarship.title}</h2>
                      <p className="text-xs font-semibold text-text-muted flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-primary" /> {scholarship.scholarshipType || scholarship.provider}
                      </p>
                    </div>

                    <button 
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleBookmark(id);
                      }}
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
                      <span>{scholarship.degreeLevel || 'Not specified'}</span>
                    </div>
                  </div>

                  {/* Expandable Match Scoring Breakdown */}
                  {scholarship.matchBreakdown && (
                    <div className="pt-2 border-t border-app-text/10">
                      <button 
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setExpandedMatchId(isExpanded ? null : id);
                        }}
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
                      onClick={(event) => handleApplyClick(event, scholarship)}
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
        message={`You are leaving IskolarMatch to access the official application portal for ${selectedScholarship?.title || selectedScholarship?.provider || 'this scholarship'}. Direct application submission is hosted on their official platform.`}
        confirmText="Open Official Website"
      />
    </div>
  );
}
