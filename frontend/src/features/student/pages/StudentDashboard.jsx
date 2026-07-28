import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  Bookmark, 
  Send, 
  Clock, 
  ExternalLink, 
  MapPin,
  GraduationCap,
  Coins,
  Info,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Inbox
} from 'lucide-react';

import { useAuth } from '../../../context/AuthContext';
import PageHeader from '../../../components/common/PageHeader';
import MetricCard from '../../../components/common/MetricCard';
import StatusBadge from '../../../components/common/StatusBadge';
import ConfirmModal from '../../../components/common/ConfirmModal';

// Mock Data Fallbacks for Local Testing / Offline Mode
const MOCK_FALLBACK_MATCHES = [
  {
    _id: 'm1',
    title: 'Camarines Sur Academic Excellence Grant',
    provider: 'Provincial Government of CamSur',
    amount: 25000,
    amountPeriod: 'sem',
    deadline: '2026-08-30',
    weightedScore: 96,
    isSaved: false,
    externalUrl: 'https://camsur.gov.ph',
    matchBreakdown: {
      gwa: { score: 40, max: 40, detail: 'GWA fits priority tier' },
      location: { score: 30, max: 30, detail: 'Camarines Sur Resident' },
      financial: { score: 26, max: 30, detail: 'Low-Income Tier verified' }
    }
  },
  {
    _id: 'm2',
    title: 'DOST-SEI Merit Scholarship',
    provider: 'Department of Science and Technology',
    amount: 40000,
    amountPeriod: 'yr',
    deadline: '2026-08-10',
    weightedScore: 88,
    isSaved: true,
    externalUrl: 'https://sei.dost.gov.ph',
    matchBreakdown: {
      gwa: { score: 38, max: 40, detail: 'High Academic Standing' },
      location: { score: 25, max: 30, detail: 'Regional Priority' },
      financial: { score: 25, max: 30, detail: 'Standard Bracket' }
    }
  }
];

const MOCK_FALLBACK_APPS = [
  {
    _id: 'a1',
    scholarshipTitle: 'CHED Tulong Dunong Program',
    provider: 'CHED Regional Office V',
    status: 'In Review',
    submittedAt: '2026-07-01'
  }
];

const formatCurrency = (amount, currency = 'PHP') => {
  if (typeof amount !== 'number' || isNaN(amount)) return '₱0';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const userProfile = {
    name: user?.name || 'Iskolar',
    gwa: user?.profile?.gwa || '1.25',
    location: user?.profile?.location || 'Pili, Camarines Sur',
    financialBracket: user?.profile?.financialBracket || 'Low-Income Tier'
  };

  const [metrics, setMetrics] = useState({
    weightedMatchesCount: 0,
    savedCount: 0,
    trackedCount: 0,
    urgentDeadlinesCount: 0
  });
  const [weightedMatches, setWeightedMatches] = useState([]);
  const [trackedApplications, setTrackedApplications] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingId, setIsSavingId] = useState(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedScholarship, setSelectedScholarship] = useState(null);
  const [expandedMatchId, setExpandedMatchId] = useState(null);

  // Helper to safely parse API responses and detect HTML 404 errors
  const safeFetchJson = async (url, options) => {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type');
    
    // Check if the server returned HTML instead of JSON (common with missing backend/proxy)
    if (!res.ok || (contentType && contentType.includes('text/html'))) {
      throw new Error(`Server returned HTML or non-OK status: ${res.status}`);
    }
    return await res.json();
  };

  useEffect(() => {
    let isMounted = true;

    const fetchDashboardData = async () => {
      setIsLoading(true);

      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        // Attempt live API requests
        const [matchesData, appsData] = await Promise.all([
          safeFetchJson('/api/v1/scholarships/recommended', { headers }),
          safeFetchJson('/api/v1/students/applications', { headers })
        ]);

        if (!isMounted) return;

        setWeightedMatches(matchesData);
        setTrackedApplications(appsData);
        updateMetrics(matchesData, appsData);
        setIsUsingFallback(false);

      } catch (err) {
        console.warn('API unreachable or returning HTML. Switching to local testing mode:', err.message);
        
        if (!isMounted) return;

        // Fallback gracefully so you can still test UI without API server running
        setWeightedMatches(MOCK_FALLBACK_MATCHES);
        setTrackedApplications(MOCK_FALLBACK_APPS);
        updateMetrics(MOCK_FALLBACK_MATCHES, MOCK_FALLBACK_APPS);
        setIsUsingFallback(true);

      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  const updateMetrics = (matchesData, appsData) => {
    setMetrics({
      weightedMatchesCount: matchesData.length,
      savedCount: matchesData.filter(m => m.isSaved).length,
      trackedCount: appsData.length,
      urgentDeadlinesCount: matchesData.filter(m => {
        if (!m.deadline) return false;
        const daysLeft = (new Date(m.deadline) - new Date()) / (1000 * 60 * 60 * 24);
        return daysLeft > 0 && daysLeft <= 14;
      }).length
    });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
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

  const handleToggleSave = async (scholarshipId) => {
    setIsSavingId(scholarshipId);

    try {
      if (!isUsingFallback) {
        const token = localStorage.getItem('token');
        await safeFetchJson(`/api/v1/scholarships/${scholarshipId}/bookmark`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });
      }

      // Optimistic update
      setWeightedMatches((prev) =>
        prev.map((item) =>
          item._id === scholarshipId ? { ...item, isSaved: !item.isSaved } : item
        )
      );
    } catch (err) {
      console.error('Failed to persist bookmark state:', err);
    } finally {
      setIsSavingId(null);
    }
  };

  const handleExploreAllFilters = () => {
    navigate('/student/scholarships');
  };

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

  const toggleBreakdown = (id) => {
    setExpandedMatchId((prev) => (prev === id ? null : id));
  };

  const metricsConfig = [
    { label: 'Weighted Matches', value: metrics.weightedMatchesCount.toString(), icon: Sparkles, trend: 'Based on GWA & Need', color: 'blue' },
    { label: 'Saved Items', value: metrics.savedCount.toString(), icon: Bookmark, color: 'indigo' },
    { label: 'Tracked Outbound', value: metrics.trackedCount.toString(), icon: Send, color: 'emerald' },
    { label: 'Deadlines < 14 Days', value: metrics.urgentDeadlinesCount.toString(), icon: Clock, trend: 'Action required', color: 'amber' },
  ];

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-xs text-text-muted font-medium">Syncing scholarship matches...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Test-mode Alert Banner */}
      {isUsingFallback && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-3 rounded-xl flex items-center justify-between text-xs font-medium">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Backend API offline/unreachable. Showing mock preview mode for testing.
          </span>
        </div>
      )}

      {/* Header */}
      <PageHeader 
        title={`${getGreeting()}, ${userProfile.name}`} 
        subtitle="Weighted scholarship matching based on your official GWA, location, and financial status."
      />

      {/* Student Profile Overview Bar */}
      <div className="bg-primary/5 border border-primary/15 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-app-text">
          <span className="flex items-center gap-1.5 bg-card-bg px-3 py-1.5 rounded-xl border border-app-text/10 shadow-xs">
            <GraduationCap className="h-4 w-4 text-primary" /> Current GWA: <strong>{userProfile.gwa}</strong>
          </span>
          <span className="flex items-center gap-1.5 bg-card-bg px-3 py-1.5 rounded-xl border border-app-text/10 shadow-xs">
            <MapPin className="h-4 w-4 text-primary" /> Location: <strong>{userProfile.location}</strong>
          </span>
          <span className="flex items-center gap-1.5 bg-card-bg px-3 py-1.5 rounded-xl border border-app-text/10 shadow-xs">
            <Coins className="h-4 w-4 text-primary" /> Financial Tier: <strong>{userProfile.financialBracket}</strong>
          </span>
        </div>

        <button 
          type="button"
          onClick={() => navigate('/student/profile')}
          className="text-xs font-semibold text-primary hover:underline cursor-pointer bg-transparent border-0 transition-all"
        >
          Update Profile Data
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricsConfig.map((m, idx) => (
          <MetricCard key={idx} {...m} />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Matches Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-app-text flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Highest Weighted Matches
            </h3>

            <button 
              type="button"
              onClick={handleExploreAllFilters}
              className="text-xs font-semibold text-primary hover:underline cursor-pointer bg-transparent border-0 transition-all"
            >
              Explore All Filters
            </button>
          </div>

          {weightedMatches.length === 0 ? (
            <div className="bg-card-bg border border-app-text/10 rounded-2xl p-8 text-center space-y-3">
              <Inbox className="h-10 w-10 text-text-muted mx-auto" />
              <p className="text-sm font-bold text-app-text">No matches found</p>
              <p className="text-xs text-text-muted">Try updating your academic profile or exploring all available filters.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {weightedMatches.map((item) => {
                const isExpanded = expandedMatchId === item._id;

                return (
                  <div key={item._id} className="bg-card-bg border border-app-text/10 rounded-2xl p-5 hover:border-primary/40 transition-all shadow-xs">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-block px-2.5 py-0.5 bg-primary/10 text-primary text-[11px] font-black rounded-full">
                            {item.weightedScore || item.matchScore}% Match
                          </span>
                          {item.matchBreakdown && (
                            <button 
                              type="button"
                              onClick={() => toggleBreakdown(item._id)}
                              className="flex items-center gap-1 text-[11px] text-text-muted hover:text-primary font-medium cursor-pointer"
                            >
                              <Info className="h-3 w-3" />
                              <span>Score Breakdown</span>
                              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-app-text">{item.title}</h4>
                        <p className="text-xs text-text-muted font-medium">{item.provider}</p>
                      </div>

                      <button 
                        type="button"
                        onClick={() => handleToggleSave(item._id)}
                        disabled={isSavingId === item._id}
                        aria-label="Bookmark scholarship"
                        className={`p-2 rounded-xl transition-colors cursor-pointer ${
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

                    {/* Scoring Breakdown */}
                    {isExpanded && item.matchBreakdown && (
                      <div className="my-3 p-3 bg-app-bg rounded-xl border border-app-text/10 text-xs space-y-2 animate-in fade-in duration-200">
                        <p className="font-bold text-app-text text-[11px] uppercase tracking-wider">Scoring Breakdown</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                          <div className="bg-card-bg p-2 rounded-lg border border-app-text/10">
                            <span className="text-text-muted block">Academic (GWA)</span>
                            <strong className="text-app-text">{item.matchBreakdown.gwa?.score}/{item.matchBreakdown.gwa?.max}</strong>
                            <span className="text-[10px] text-text-muted block mt-0.5">{item.matchBreakdown.gwa?.detail}</span>
                          </div>
                          <div className="bg-card-bg p-2 rounded-lg border border-app-text/10">
                            <span className="text-text-muted block">Location Fit</span>
                            <strong className="text-app-text">{item.matchBreakdown.location?.score}/{item.matchBreakdown.location?.max}</strong>
                            <span className="text-[10px] text-text-muted block mt-0.5">{item.matchBreakdown.location?.detail}</span>
                          </div>
                          <div className="bg-card-bg p-2 rounded-lg border border-app-text/10">
                            <span className="text-text-muted block">Financial Need</span>
                            <strong className="text-app-text">{item.matchBreakdown.financial?.score}/{item.matchBreakdown.financial?.max}</strong>
                            <span className="text-[10px] text-text-muted block mt-0.5">{item.matchBreakdown.financial?.detail}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-app-text/10 text-xs">
                      <div>
                        <span className="text-text-muted font-medium">Grant Value: </span>
                        <span className="font-extrabold text-app-text">
                          {formatCurrency(item.amount)} / {item.amountPeriod || 'yr'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-text-muted text-[11px]">Due: <strong>{formatDate(item.deadline)}</strong></span>
                        <button 
                          type="button"
                          onClick={() => handleApplyClick(item)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-app-text text-card-bg hover:bg-primary hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Apply Directly <ExternalLink className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Outbound Tracker */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-app-text flex items-center gap-2">
            <Send className="h-4 w-4 text-emerald-600" /> Outbound Application Tracker
          </h3>

          <div className="bg-card-bg border border-app-text/10 rounded-2xl p-4 space-y-3 shadow-xs">
            {trackedApplications.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-4">No active applications tracked yet.</p>
            ) : (
              trackedApplications.map((app) => (
                <div key={app._id} className="p-3 bg-app-bg rounded-xl border border-app-text/10 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-app-text truncate">{app.scholarshipTitle || app.title}</h4>
                    <StatusBadge status={app.status} />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-text-muted">
                    <span>{app.provider}</span>
                    <span>Updated {formatDate(app.updatedAt || app.submittedAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Redirect Confirmation Modal */}
      <ConfirmModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={confirmRedirect}
        title="Official Portal Redirect"
        message={`You are leaving IskolarMatch to access the official application portal for ${selectedScholarship?.provider || 'this provider'}.`}
        confirmText="Open Official Website"
      />
    </div>
  );
}