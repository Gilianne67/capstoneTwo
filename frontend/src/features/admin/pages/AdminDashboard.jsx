import React from 'react';

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      {/* Admin Title */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-black text-slate-800">
          Welcome back, <span className="text-[#1e1b4b]">Administrator! 🔑</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">Web-Based Scholarship Matching System Administration Console</p>
      </div>

      {/* Admin Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', val: '12,458', change: '+12.5% from last month' },
          { label: 'Students', val: '10,342', change: '+10.3% from last month' },
          { label: 'Providers', val: '216', change: '+5.2% from last month' },
          { label: 'Scholarships', val: '1,245', change: '+2.7% from last month' },
        ].map((card, i) => (
          <div key={i} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{card.label}</span>
            <span className="block text-2xl font-black text-[#1e1b4b]">{card.val}</span>
            <span className="text-[11px] text-emerald-600 font-bold">{card.change}</span>
          </div>
        ))}
      </div>

      {/* Admin System Activity */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="font-extrabold text-slate-800 text-sm">Recent Platform Activity</h2>
        <div className="divide-y divide-slate-100 text-xs">
          {[
            { action: 'New Student registered', target: 'Juan Dela Cruz', time: '2 mins ago' },
            { action: 'New scholarship added', target: 'DOST-SEI Undergraduate', time: '15 mins ago' },
            { action: 'New provider registered', target: 'Aboitiz Foundation', time: '1 hour ago' },
            { action: 'System backup completed', target: 'Database Backup', time: '2 hours ago' },
          ].map((act, i) => (
            <div key={i} className="py-3 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800">{act.action}</span> — <span className="text-slate-500">{act.target}</span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">{act.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}