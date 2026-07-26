import React from 'react';
import { Building2, FileCheck, Users, Plus, ArrowUpRight, CheckCircle, Clock } from 'lucide-react';
import PageHeader from '../../../components/common/PageHeader';
import MetricCard from '../../../components/common/MetricCard';
import DataTable from '../../../components/common/DataTable';
import StatusBadge from '../../../components/common/StatusBadge';

const APPLICANTS_QUEUE = [
  { id: 'app-101', candidate: 'Maria Santos', program: 'STEM Excellence Grant', gpa: '1.25', status: 'pending', date: 'Jul 24, 2026' },
  { id: 'app-102', candidate: 'Kevin Reyes', program: 'STEM Excellence Grant', gpa: '1.40', status: 'verified', date: 'Jul 22, 2026' },
  { id: 'app-103', candidate: 'Angela Cruz', program: 'Tech Innovators Fund', gpa: '1.15', status: 'verified', date: 'Jul 20, 2026' },
];

export default function ProviderDashboard() {
  const session = JSON.parse(localStorage.getItem('iskolar_session') || '{}');

  const columns = [
    { header: 'Applicant', key: 'candidate', renderCell: (row) => <span className="font-bold text-slate-800">{row.candidate}</span> },
    { header: 'Scholarship Program', key: 'program' },
    { header: 'GWA / GPA', key: 'gpa', renderCell: (row) => <span className="font-bold text-emerald-600">{row.gpa}</span> },
    { header: 'Submitted', key: 'date' },
    { header: 'Status', key: 'status', renderCell: (row) => <StatusBadge status={row.status} /> },
    {
      header: 'Action',
      key: 'action',
      renderCell: () => (
        <button className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-lg hover:bg-emerald-100 border border-emerald-200">
          Review
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          badgeText="Sponsor Workspace"
          title={session.name || "DOST Scholarship Office"}
          description="Manage your scholarship postings, evaluate candidate applications, and track fund allocations."
        />
        <button className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md hover:bg-emerald-700 transition-colors flex items-center gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          <span>Create New Listing</span>
        </button>
      </div>

      <div className="space-y-6">
        {/* Core Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Active Listings" value="4" icon={Building2} />
          <MetricCard title="Total Applications" value="342" icon={Users} trend="+18% this week" />
          <MetricCard title="Pending Review" value="28" icon={Clock} description="Requires action" />
          <MetricCard title="Approved Scholars" value="85" icon={FileCheck} trend="₱1.2M Allocated" />
        </div>

        {/* Recent Applicants */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-slate-800 text-base">Recent Applicant Submissions</h2>
            <button className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1">
              View All Submissions <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <DataTable columns={columns} data={APPLICANTS_QUEUE} />
        </div>
      </div>
    </div>
  );
}