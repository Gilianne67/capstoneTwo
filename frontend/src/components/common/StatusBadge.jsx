import React from 'react';

const STATUS_VARIANTS = {
  // Application / Account States
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  under_review: 'bg-amber-50 text-amber-700 border-amber-200',
  
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  inactive: 'bg-rose-50 text-rose-700 border-rose-200',
  declined: 'bg-rose-50 text-rose-700 border-rose-200',

  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  archived: 'bg-slate-100 text-slate-600 border-slate-200',
};

export function StatusBadge({ status = 'pending', customLabel }) {
  const normalizedKey = String(status).toLowerCase().replace(/\s+/g, '_');
  const styleClass = STATUS_VARIANTS[normalizedKey] || STATUS_VARIANTS.draft;

  // Format label: "under_review" -> "Under Review"
  const formattedLabel = customLabel || status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-bold shrink-0 capitalize ${styleClass}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-75" />
      {formattedLabel}
    </span>
  );
}

export default StatusBadge;