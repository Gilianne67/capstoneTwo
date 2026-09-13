import React from 'react';

export function PageHeader({ badgeText, title, description, actionButton, role = 'student' }) {
  // Optional accent highlights per role for badges or subtle borders
  const accentStyles = {
    student: 'bg-blue-50 text-[#2563eb] border-blue-100',
    provider: 'bg-emerald-50 text-[#059669] border-emerald-100',
    admin: 'bg-amber-50 text-[#d97706] border-amber-100',
  };

  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/60">
      <div className="space-y-1">
        {badgeText && (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${accentStyles[role] || accentStyles.student}`}>
            {badgeText}
          </span>
        )}
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {description && (
          <p className="text-xs sm:text-sm text-slate-500 font-medium">{description}</p>
        )}
      </div>

      {actionButton && (
        <div className="flex items-center gap-2.5 shrink-0">
          {actionButton}
        </div>
      )}
    </div>
  );
}

export default PageHeader;