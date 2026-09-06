import React from 'react';
import { Bell } from 'lucide-react';

export function NotificationToggles({ title = "Notification Preferences", options, onChange }) {
  return (
    <div className="bg-card-bg rounded-2xl border border-app-text/10 p-6 shadow-xs space-y-4">
      <div className="flex items-center gap-2 pb-4 border-b border-app-text/10">
        <Bell className="w-5 h-5 text-primary" />
        <div>
          <h3 className="text-sm font-extrabold text-app-text">{title}</h3>
          <p className="text-xs text-text-muted">Configure how and when you receive alerts</p>
        </div>
      </div>

      <div className="space-y-4">
        {options.map((option) => (
          <div key={option.id} className="flex items-center justify-between py-1">
            <div>
              <p className="text-xs font-bold text-app-text">{option.label}</p>
              {option.description && (
                <p className="text-[11px] text-text-muted">{option.description}</p>
              )}
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={option.enabled}
                onChange={() => onChange(option.id)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

export default NotificationToggles;
