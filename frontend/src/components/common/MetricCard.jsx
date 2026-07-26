import React from 'react';

export function MetricCard({ title, value, icon: Icon, trend, description }) {
  return (
    <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{title}</span>
        {Icon && (
          <div className="p-2 bg-slate-100 rounded-xl text-slate-600">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-slate-800 tracking-tight">{value}</span>
          {trend && (
            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              {trend}
            </span>
          )}
        </div>
        {description && <p className="text-[11px] text-slate-400 font-medium">{description}</p>}
      </div>
    </div>
  );
}

export default MetricCard;