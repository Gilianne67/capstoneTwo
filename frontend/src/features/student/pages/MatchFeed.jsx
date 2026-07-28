import React, { useState } from 'react';
import { 
  Sparkles, 
  Bookmark, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp, 
  Info,
  Sliders,
  CheckCircle2
} from 'lucide-react';

import ConfirmModal from '../../../components/common/ConfirmModal';

export default function MatchFeed() {
  const [expandedId, setExpandedId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGrant, setSelectedGrant] = useState(null);
  const [bookmarkedIds, setBookmarkedIds] = useState([]);

  // Curated High-Match Feed Data
  const matches = [
    {
      id: 'feed-1',
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
      id: 'feed-2',
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
      id: 'feed-3',
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

  const toggleBookmark = (id) => {
    setBookmarkedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleApplyClick = (grant) => {
    setSelectedGrant(grant);
    setIsModalOpen(true);
  };

  const confirmRedirect = () => {
    if (selectedGrant?.url) {
      window.open(selectedGrant.url, '_blank', 'noopener,noreferrer');
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-4">
      
      {/* FEED HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            Your Top Scholarship Matches
          </h2>
          <p className="text-xs text-slate-500">Ranked using your GWA, location, and special eligibility flags.</p>
        </div>
      </div>

      {/* FEED LIST */}
      <div className="space-y-3">
        {matches.map((item) => {
          const isExpanded = expandedId === item.id;
          const isBookmarked = bookmarkedIds.includes(item.id);

          return (
            <div 
              key={item.id} 
              className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:border-blue-300 transition-all shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {item.score}% Match Score
                    </span>
                    {item.matchedFlags.map((flag, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700">
                        {flag}
                      </span>
                    ))}
                  </div>

                  <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                  <p className="text-xs font-semibold text-slate-500">{item.provider}</p>
                </div>

                <button
                  onClick={() => toggleBookmark(item.id)}
                  className={`p-2 rounded-xl transition-colors cursor-pointer ${
                    isBookmarked ? 'bg-amber-50 text-amber-600' : 'text-slate-400 hover:bg-slate-100'
                  }`}
                  title="Bookmark Scholarship"
                >
                  <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-amber-600' : ''}`} />
                </button>
              </div>

              {/* Match Criteria Drawer */}
              {isExpanded && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-2 animate-in fade-in">
                  <p className="font-extrabold text-slate-700 text-[10px] uppercase tracking-wider">Weighted Algorithm Calculation</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {Object.entries(item.breakdown).map(([key, val]) => (
                      <div key={key} className="bg-white p-2 rounded-lg border border-slate-200/60">
                        <span className="text-slate-400 text-[10px] font-bold block">{key}</span>
                        <strong className="text-slate-800 text-xs">{val}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-slate-400 font-medium">Grant Value: </span>
                    <strong className="text-slate-800 font-bold">{item.amount}</strong>
                  </div>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="text-blue-600 font-bold text-[11px] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Info className="w-3 h-3" />
                    {isExpanded ? 'Hide Score Details' : 'Score Details'}
                  </button>
                </div>

                <button
                  onClick={() => handleApplyClick(item)}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  Apply Off-Site <ExternalLink className="w-3 h-3" />
                </button>
              </div>

            </div>
          );
        })}
      </div>

      <ConfirmModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={confirmRedirect}
        title="Official Portal Redirect"
        message={`Redirecting to official provider site (${selectedGrant?.provider}). Applications are hosted on official agency portals.`}
        confirmText="Open Portal"
      />

    </div>
  );
}
