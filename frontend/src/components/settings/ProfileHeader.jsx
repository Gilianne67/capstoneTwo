import React from 'react';
import { Camera, ShieldCheck, Mail, Building2, User } from 'lucide-react';

export function ProfileHeader({ 
  name, 
  email, 
  role, 
  subtitle, 
  avatarUrl, 
  badgeText = 'Verified Account',
  onAvatarChange 
}) {
  const roleBadges = {
    student: 'bg-blue-100 text-blue-700 border-blue-200',
    provider: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    admin: 'bg-amber-100 text-amber-700 border-amber-200'
  };

  return (
    <div className="bg-card-bg rounded-2xl border border-app-text/10 p-6 shadow-xs relative overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        
        <div className="flex items-center gap-4">
          {/* Avatar with Upload Hover Trigger */}
          <div className="relative group">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-xl overflow-hidden border border-app-text/10">
              {avatarUrl ? (
                <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
              ) : (
                <span>{name ? name.charAt(0).toUpperCase() : 'U'}</span>
              )}
            </div>
            {onAvatarChange && (
              <button
                type="button"
                onClick={onAvatarChange}
                className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity flex items-center justify-center text-white cursor-pointer"
                title="Change Avatar"
              >
                <Camera className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* User Meta Details */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-black text-app-text">{name}</h2>
              <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${roleBadges[role] || roleBadges.student}`}>
                {role}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted font-medium">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" />
                {email}
              </span>
              {subtitle && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" />
                  {subtitle}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status Badge */}
        {badgeText && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold self-start sm:self-center">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>{badgeText}</span>
          </div>
        )}

      </div>
    </div>
  );
}

export default ProfileHeader;