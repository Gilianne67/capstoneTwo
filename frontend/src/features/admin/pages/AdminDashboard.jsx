import React, { useState } from 'react';
import { 
  Building2, 
  AlertTriangle, 
  CheckSquare, 
  Activity,
  Check,
  X,
  SlidersHorizontal
} from 'lucide-react';

// Imported Reusable Components
import PageHeader from '../../../components/common/PageHeader';
import MetricCard from '../../../components/common/MetricCard';
import StatusBadge from '../../../components/common/StatusBadge';
import ConfirmModal from '../../../components/common/ConfirmModal';


export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('providers');
  const [selectedAction, setSelectedAction] = useState(null);

  // TODO: Replace with your actual user state/auth context when backend is connected
  // Example: const { user } = useAuth();
  const user = {
    name: "Admin User", // Fallback name until connected
    role: "System Administrator"
  };

  // Helper function to generate time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const metrics = [
    { label: 'Pending Verifications', value: '6', icon: CheckSquare, color: 'amber' },
    { label: 'Flagged Content', value: '2', icon: AlertTriangle, color: 'rose' },
    { label: 'Active Providers', value: '142', icon: Building2, color: 'emerald' },
    { label: 'System Uptime', value: '99.9%', icon: Activity, color: 'blue' },
  ];

  const pendingProviders = [
    { id: 'prov-101', name: 'Innovate Tech Foundation', email: 'contact@innovatetech.org', taxId: 'SEC-2024-109', submitted: '2 hours ago' },
    { id: 'prov-102', name: 'Apex Student Trust', email: 'admin@apextrust.edu', taxId: 'LGU-2024-882', submitted: '5 hours ago' },
  ];

  const handleActionClick = (id, type) => {
    setSelectedAction({ id, type });
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Header Greeting */}
      <PageHeader 
        title={`${getGreeting()}, ${user.name}`} 
        subtitle="Approve providers, review flagged listings, and monitor platform audit logs."
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m, idx) => (
          <MetricCard key={idx} {...m} />
        ))}
      </div>

      {/* Queue Workbench Section */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-5 shadow-xs">
        
        {/* Queue Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-6">
          <button 
            onClick={() => setActiveTab('providers')}
            className={`pb-3 text-xs font-bold transition-all relative ${
              activeTab === 'providers' ? 'text-amber-600 border-b-2 border-amber-600' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Provider Verifications (2)
          </button>
          <button 
            onClick={() => setActiveTab('scholarships')}
            className={`pb-3 text-xs font-bold transition-all relative ${
              activeTab === 'scholarships' ? 'text-amber-600 border-b-2 border-amber-600' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Pending Listings (4)
          </button>
        </div>

        {/* Provider Approval Queue List */}
        {activeTab === 'providers' && (
          <div className="space-y-3">
            {pendingProviders.map((prov) => (
              <div key={prov.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200/60 rounded-xl">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{prov.name}</h4>
                  <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                    <span>Email: <strong>{prov.email}</strong></span>
                    <span>Registration ID: <strong>{prov.taxId}</strong></span>
                    <span>Submitted: {prov.submitted}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleActionClick(prov.id, 'reject')}
                    className="p-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold transition-all"
                    title="Reject"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleActionClick(prov.id, 'approve')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    <Check className="h-4 w-4" /> Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Modal */}
      <ConfirmModal
        isOpen={Boolean(selectedAction)}
        onClose={() => setSelectedAction(null)}
        onConfirm={() => setSelectedAction(null)}
        title={selectedAction?.type === 'approve' ? 'Approve Provider' : 'Reject Verification'}
        message={`Are you sure you want to ${selectedAction?.type} this organization? This action will immediately update their account status.`}
      />
    </div>
  );
}