import React, { useState } from 'react';
import { 
  Sparkles, 
  Bookmark, 
  Send, 
  Clock, 
  ExternalLink, 
  SlidersHorizontal,
  MapPin,
  GraduationCap,
  Coins
} from 'lucide-react';

// Imported Reusable Components
import PageHeader from '../../../components/common/PageHeader';
import MetricCard from '../../../components/common/MetricCard';
import StatusBadge from '../../../components/common/StatusBadge';
import ConfirmModal from '../../../components/common/ConfirmModal';

export default function StudentDashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedScholarship, setSelectedScholarship] = useState(null);

  // TODO: Replace with your actual user state/auth context when backend is connected
  // Example: const { user } = useAuth();
  const user = {
    name: "Juan Dela Cruz", // Fallback student name
    role: "Student"
  };

  // Helper function to generate time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Metrics focused on profile weights and matching
  const metrics = [
    { label: 'Weighted Matches', value: '18', icon: Sparkles, trend: 'Based on GWA & Financial Need', color: 'blue' },
    { label: 'Saved Items', value: '6', icon: Bookmark, color: 'indigo' },
    { label: 'Tracked Outbound', value: '4', icon: Send, color: 'emerald' },
    { label: 'Deadlines < 14 Days', value: '2', icon: Clock, trend: 'Action required', color: 'amber' },
  ];

  // Weighted Scoring Match Feed
  const weightedMatches = [
    {
      id: 'sch-101',
      title: 'National STEM Excellence Grant 2026',
      provider: 'Department of Science and Technology',
      amount: '₱80,000 / yr',
      deadline: 'Aug 20, 2026',
      weightedScore: '96% Match',
      matchBreakdown: { GWA: '1.25', location: 'Bicol Region', financial: 'Tier 1 Need' },
      externalUrl: 'https://official.dost.gov.ph/apply'
    },
    {
      id: 'sch-102',
      title: 'Provincial Youth Tertiary Assistance',
      provider: 'Provincial Government Office',
      amount: '₱25,000 / sem',
      deadline: 'Sep 05, 2026',
      weightedScore: '89% Match',
      matchBreakdown: { GWA: '1.75', location: 'Pili / Local Resident', financial: 'Tier 2 Need' },
      externalUrl: 'https://pili.gov.ph/scholarships'
    }
  ];

  const trackedApplications = [
    { id: '1', title: 'National STEM Excellence Grant', provider: 'DOST', status: 'Applied', updated: 'Yesterday' },
    { id: '2', title: 'CHED Merit Scholarship Program', provider: 'CHED', status: 'Under Review', updated: '5 days ago' },
  ];

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

  return (
    <div className="space-y-6">
      {/* Dynamic Header Greeting */}
      <PageHeader 
        title={`${getGreeting()}, ${user.name}`} 
        subtitle="AI-weighted scholarship matching based on your official GWA, location, and financial status."
      />

      {/* Weighted Profile Criteria Summary Bar */}
      <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-700">
          <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-blue-100 shadow-xs">
            <GraduationCap className="h-4 w-4 text-blue-600" /> Target GWA: <strong>1.25–1.75</strong>
          </span>
          <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-blue-100 shadow-xs">
            <MapPin className="h-4 w-4 text-blue-600" /> Location: <strong>Bicol Region</strong>
          </span>
          <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-blue-100 shadow-xs">
            <Coins className="h-4 w-4 text-blue-600" /> Financial bracket: <strong>Low-Income Tier</strong>
          </span>
        </div>
        <button className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Refine Weights
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m, idx) => (
          <MetricCard key={idx} {...m} />
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Weighted Matches Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600" /> Highest Weighted Matches
            </h3>
            <span className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer">Explore All Filters</span>
          </div>

          <div className="space-y-3">
            {weightedMatches.map((item) => (
              <div key={item.id} className="bg-white border border-slate-200/80 rounded-2xl p-5 hover:border-blue-300 transition-all shadow-xs">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="inline-block px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-black rounded-full mb-2">
                      {item.weightedScore}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                    <p className="text-xs text-slate-500 font-medium">{item.provider}</p>
                  </div>
                  <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors">
                    <Bookmark className="h-4 w-4" />
                  </button>
                </div>

                {/* Score Factor Badges */}
                <div className="flex flex-wrap items-center gap-2 my-3 text-[10px] font-bold">
                  <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg">GWA: {item.matchBreakdown.GWA}</span>
                  <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg">Location: {item.matchBreakdown.location}</span>
                  <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg">Need: {item.matchBreakdown.financial}</span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 font-medium">Grant Value: </span>
                    <span className="font-extrabold text-slate-900">{item.amount}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 text-[11px]">Due: <strong>{item.deadline}</strong></span>
                    <button 
                      onClick={() => handleApplyClick(item)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all"
                    >
                      Apply Directly <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Outbound Tracker */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Send className="h-4 w-4 text-emerald-600" /> Outbound Application Tracker
          </h3>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3 shadow-xs">
            {trackedApplications.map((app) => (
              <div key={app.id} className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-slate-800 truncate max-w-[140px]">{app.title}</h5>
                  <StatusBadge status={app.status} />
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-500">
                  <span>{app.provider}</span>
                  <span>Updated {app.updated}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      <ConfirmModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={confirmRedirect}
        title="Official Portal Redirect"
        message={`You are leaving IskolarMatch to access the official application portal for ${selectedScholarship?.provider}. Direct application hosting is not performed on our platform.`}
        confirmText="Open Official Website"
      />
    </div>
  );
}