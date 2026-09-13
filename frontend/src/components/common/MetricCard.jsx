import React from 'react';

export default function MetricCard({ 
  title, 
  label, 
  value, 
  icon: Icon, 
  trend, 
  color = 'blue' 
}) {
  const cardTitle = title || label || 'Metric';

  const colorStyles = {
    blue: { bg: 'bg-blue-50/60', text: 'text-blue-600', border: 'border-blue-100' },
    emerald: { bg: 'bg-emerald-50/60', text: 'text-emerald-600', border: 'border-emerald-100' },
    amber: { bg: 'bg-amber-50/60', text: 'text-amber-600', border: 'border-amber-100' },
    indigo: { bg: 'bg-indigo-50/60', text: 'text-indigo-600', border: 'border-indigo-100' },
    rose: { bg: 'bg-rose-50/60', text: 'text-rose-600', border: 'border-rose-100' }
  };

  const theme = colorStyles[color] || colorStyles.blue;

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-full min-h-[128px]">
      
      {/* Top Row: Title & Icon */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-bold text-slate-600 tracking-wide uppercase truncate">
          {cardTitle}
        </span>

        {Icon && (
          <div className={`p-2 rounded-xl border ${theme.bg} ${theme.text} ${theme.border} shrink-0`}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      {/* Main Metric Value */}
      <div className="my-auto">
        <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
          {value ?? '0'}
        </h3>
      </div>

      {/* Footer Area: Fixed height container prevents layout jumping */}
      <div className="mt-3 min-h-[18px] flex items-center">
        {trend ? (
          <span className="text-[11px] font-semibold text-slate-500 truncate">
            {trend}
          </span>
        ) : (
          /* Invisible spacer to maintain structural alignment across cards without trend */
          <span className="text-[11px] opacity-0 select-none" aria-hidden="true">
            Spacer
          </span>
        )}
      </div>

    </div>
  );
}