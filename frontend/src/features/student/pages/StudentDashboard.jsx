import React from 'react';
import { Award, BookOpen, Clock, CheckCircle2, ArrowUpRight, Search } from 'lucide-react';
import PageHeader from '../../../components/common/PageHeader';
import MetricCard from '../../../components/common/MetricCard';
import StatusBadge from '../../../components/common/StatusBadge';

const RECENT_MATCHES = [
  { id: 'sch-1', title: 'CHED Merit Scholarship Program', sponsor: 'CHED Central', amount: '₱80,000 / yr', match: '98%', deadline: 'Aug 15, 2026' },
  { id: 'sch-2', title: 'DOST-SEI Undergraduate Scholarship', sponsor: 'DOST Regional', amount: '₱40,000 + Stipend', match: '94%', deadline: 'Sep 01, 2026' },
  { id: 'sch-3', title: 'SM Foundation College Scholarship', sponsor: 'SM Foundation', amount: 'Full Tuition', match: '89%', deadline: 'Aug 30, 2026' },
];

export default function StudentDashboard() {
  const session = JSON.parse(localStorage.getItem('iskolar_session') || '{}');

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        badgeText="Student Portal"
        title={`Welcome back, ${session.name || 'Scholar'}!`}
        description="Here is an overview of your matched scholarships, application statuses, and profile completion."
      />

      <div className="space-y-6">
        {/* Core Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Matched Scholarships" value="12" icon={Award} trend="+3 new" />
          <MetricCard title="Active Applications" value="2" icon={Clock} description="1 under review" />
          <MetricCard title="Approved Grants" value="1" icon={CheckCircle2} description="₱40,000 awarded" />
          <MetricCard title="Profile Match Rate" value="95%" icon={BookOpen} trend="Verified" />
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Matches Feed */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-slate-800 text-base">Top Recommended Matches</h2>
              <button className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                View All <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {RECENT_MATCHES.map((item) => (
                <div key={item.id} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between hover:border-blue-300 transition-all">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-primary font-black text-[10px] border border-blue-100">
                        {item.match} Match
                      </span>
                      <span className="text-xs text-slate-400 font-medium">Deadline: {item.deadline}</span>
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm">{item.title}</h3>
                    <p className="text-xs text-slate-500">{item.sponsor} • <span className="font-bold text-emerald-600">{item.amount}</span></p>
                  </div>
                  <button className="px-3.5 py-2 rounded-xl bg-primary text-white font-bold text-xs shadow-md hover:bg-blue-700 transition-colors shrink-0">
                    Apply Now
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Side Progress Widget */}
          <div className="space-y-4">
            <h2 className="font-extrabold text-slate-800 text-base">Application Tracker</h2>
            <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-700">DOST-SEI Application</span>
                  <StatusBadge status="pending" />
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full w-2/3" />
                </div>
                <p className="text-[11px] text-slate-400">Step 2 of 3: Verification in progress</p>
              </div>

              <hr className="border-slate-100" />

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-700">CHED Merit Scholarship</span>
                  <StatusBadge status="verified" />
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-full" />
                </div>
                <p className="text-[11px] text-slate-400">Awarded • Disbursement pending</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}