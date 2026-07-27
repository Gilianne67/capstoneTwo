import React, { useState } from 'react';
import { 
  Building2, 
  Layers, 
  PlusCircle, 
  Eye, 
  MousePointerClick, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';

// Imported Reusable Components
import PageHeader from '../../../components/common/PageHeader';
import MetricCard from '../../../components/common/MetricCard';
import StatusBadge from '../../../components/common/StatusBadge';
import DataTable from '../../../components/common/DataTable';
import FilterBar from '../../../components/common/FilterBar';
import Pagination from '../../../components/common/Pagination';

export default function ProviderDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // TODO: Replace with your actual user state/auth context when backend is connected
  // Example: const { user } = useAuth();
  const user = {
    name: "DOST Scholarship", // Fallback organization/provider name
    role: "Scholarship Provider"
  };

  // Helper function to generate time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const metrics = [
    { label: 'Official Active Postings', value: '3', icon: Layers, color: 'emerald' },
    { label: 'Search Impressions', value: '8,420', icon: Eye, trend: 'Matching student feeds', color: 'blue' },
    { label: 'Outbound Referral Clicks', value: '1,120', icon: MousePointerClick, trend: '13.3% Click-Through', color: 'indigo' },
  ];

  const columns = [
    { header: 'Official Scholarship Title', accessor: 'title', cell: (row) => <span className="font-bold text-slate-900">{row.title}</span> },
    { header: 'Grant Value', accessor: 'amount' },
    { header: 'Listing Status', accessor: 'status', cell: (row) => <StatusBadge status={row.status} /> },
    { header: 'Feed Views', accessor: 'impressions' },
    { header: 'External Clicks', accessor: 'clicks' },
    { header: 'Deadline', accessor: 'deadline' },
  ];

  const listingsData = [
    { id: '1', title: 'CHED Regional Merit Award 2026', amount: '₱50,000', status: 'Active', impressions: '5,100', clicks: '720', deadline: 'Aug 30, 2026' },
    { id: '2', title: 'Tertiary Education Subsidy (TES)', amount: '₱40,000', status: 'Active', impressions: '3,320', clicks: '400', deadline: 'Sep 15, 2026' },
    { id: '3', title: 'Municipal Honor Graduate Grant', amount: '₱15,000', status: 'Pending Review', impressions: '0', clicks: '0', deadline: 'Oct 01, 2026' },
  ];

  return (
    <div className="space-y-6">
      {/* Dynamic Header Greeting */}
      <PageHeader 
        title={`${getGreeting()}, ${user.name}`} 
        subtitle="Manage official scholarship offerings, set student eligibility criteria, and track outbound application traffic."
        action={
          <button className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs">
            <PlusCircle className="h-4 w-4" /> Post Official Scholarship
          </button>
        }
      />

      {/* Verified Status Banner */}
      <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
        <p className="text-xs text-emerald-900 font-medium">
          <strong>Verified Organization Partner:</strong> Your listed scholarships are automatically processed for student weighted matching (GWA, Location, Financial Status).
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {metrics.map((m, idx) => (
          <MetricCard key={idx} {...m} />
        ))}
      </div>

      {/* Listing Table Section */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-base font-bold text-slate-900">Your Official Listings</h3>
          <FilterBar searchValue={searchQuery} onSearchChange={setSearchQuery} />
        </div>

        <DataTable columns={columns} data={listingsData} />

        <Pagination 
          currentPage={currentPage} 
          totalPages={1} 
          onPageChange={(page) => setCurrentPage(page)} 
        />
      </div>
    </div>
  );
}