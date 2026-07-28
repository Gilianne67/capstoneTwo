import React, { useState } from 'react';
import { 
  Bookmark, 
  Trash2, 
  ExternalLink, 
  Calendar, 
  Coins, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ChevronRight
} from 'lucide-react';

import PageHeader from '../../../components/common/PageHeader';
import ConfirmModal from '../../../components/common/ConfirmModal';

export default function SavedScholarships() {
  const [savedGrants, setSavedGrants] = useState([
    {
      id: 'sch-101',
      title: 'DA-ACE Agricultural & Educational Grant 2026',
      provider: 'Department of Agriculture (DA)',
      amount: '₱50,000 / yr',
      deadline: '2026-08-20',
      daysLeft: 23,
      matchScore: 98,
      eligibilityStatus: 'Fully Eligible',
      category: 'Government / Agriculture',
      externalUrl: 'https://da.gov.ph/scholarships',
      notes: 'Requires certification of land ownership or agrarian reform beneficiary status from local DAR.'
    },
    {
      id: 'sch-102',
      title: 'DOST-SEI Merit Scholarship Program',
      provider: 'Department of Science and Technology',
      amount: '₱80,000 / yr',
      deadline: '2026-09-15',
      daysLeft: 49,
      matchScore: 94,
      eligibilityStatus: 'Fully Eligible',
      category: 'Government / STEM',
      externalUrl: 'https://sei.dost.gov.ph',
      notes: 'Need to secure Form 137 and Principal recommendation letter.'
    },
    {
      id: 'sch-104',
      title: 'Provincial Youth Tertiary Assistance Program',
      provider: 'Provincial Government of Camarines Sur',
      amount: '₱25,000 / sem',
      deadline: '2026-10-01',
      daysLeft: 65,
      matchScore: 89,
      eligibilityStatus: 'Needs Document Verification',
      category: 'Local Government',
      externalUrl: 'https://camarinessur.gov.ph',
      notes: 'Certificate of Indigency from Barangay required.'
    }
  ]);

  const [selectedGrant, setSelectedGrant] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [removeId, setRemoveId] = useState(null);

  // Remove bookmark handler
  const handleRemove = (id) => {
    setSavedGrants(prev => prev.filter(item => item.id !== id));
    setRemoveId(null);
  };

  const handleApplyRedirect = (grant) => {
    setSelectedGrant(grant);
    setIsModalOpen(true);
  };

  const confirmRedirect = () => {
    if (selectedGrant?.externalUrl) {
      window.open(selectedGrant.externalUrl, '_blank', 'noopener,noreferrer');
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader 
        title="Saved Scholarships" 
        subtitle="Your bookmarked grant opportunities. Monitor upcoming deadlines and review eligibility requirements before applying on official agency portals."
      />

      {savedGrants.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <Bookmark className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">No saved scholarships yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Explore the discovery engine or match feed and bookmark grants you want to track or apply for later.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {savedGrants.map((grant) => (
            <div 
              key={grant.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:border-blue-300 transition-all shadow-xs flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Header Badge */}
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> {grant.matchScore}% Match
                  </span>
                  <button 
                    onClick={() => handleRemove(grant.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Remove from saved"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Title & Provider */}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">{grant.title}</h3>
                  <p className="text-xs text-slate-500 font-semibold">{grant.provider}</p>
                </div>

                {/* Info Pills */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Grant Value</span>
                    <strong className="text-slate-800 font-extrabold">{grant.amount}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Deadline</span>
                    <strong className="text-slate-800 font-extrabold flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-500" /> {grant.daysLeft}d left
                    </strong>
                  </div>
                </div>

                {/* Personal Notes */}
                {grant.notes && (
                  <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-100/80 text-[11px] text-amber-900">
                    <span className="font-bold block text-[10px] uppercase text-amber-700">Saved Note:</span>
                    {grant.notes}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                  onClick={() => handleApplyRedirect(grant)}
                  className="flex-1 py-2 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  Official Portal <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={confirmRedirect}
        title="Official Portal Redirect"
        message={`Redirecting to official provider site (${selectedGrant?.provider}). IskolarMatch does not collect or process direct application forms.`}
        confirmText="Open Portal"
      />
    </div>
  );
}