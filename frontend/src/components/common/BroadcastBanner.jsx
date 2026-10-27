import React, { useState, useEffect } from 'react';
import { 
  Info, 
  AlertTriangle, 
  AlertOctagon, 
  X, 
  Megaphone 
} from 'lucide-react';

import { API_BASE_URL } from '../../config/api';

export default function BroadcastBanner() {
  const [broadcasts, setBroadcasts] = useState([]);
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const stored = sessionStorage.getItem('dismissed_broadcasts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const getAuthToken = () => {
    const rawToken = localStorage.getItem('token');
    return rawToken ? rawToken.replace(/^"|"$/g, '').replace(/^Bearer\s+/i, '').trim() : null;
  };

  useEffect(() => {
    let isMounted = true;

    const fetchActiveBroadcasts = async () => {
      const token = getAuthToken();
      if (!token) return;

      try {
        const res = await fetch(`${API_BASE_URL}/broadcasts/active`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        });

        if (!res.ok) return;

        const data = await res.json();
        const list = Array.isArray(data.broadcasts) ? data.broadcasts : (Array.isArray(data) ? data : []);

        if (isMounted) {
          setBroadcasts(list);
        }
      } catch (err) {
        console.error('Failed to load active broadcasts:', err);
      }
    };

    fetchActiveBroadcasts();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDismiss = (id) => {
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    try {
      sessionStorage.setItem('dismissed_broadcasts', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to store dismissed broadcast ID:', e);
    }
  };

  const visibleBroadcasts = broadcasts.filter(
    (b) => !dismissedIds.includes(b._id || b.id)
  );

  if (visibleBroadcasts.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      {visibleBroadcasts.map((item) => {
        const itemId = item._id || item.id;
        const priority = item.priority || 'Info';

        let bgStyle = 'bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-200';
        let iconStyle = 'bg-blue-500 text-white';
        let Icon = Info;

        if (priority === 'Warning') {
          bgStyle = 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200';
          iconStyle = 'bg-amber-500 text-white';
          Icon = AlertTriangle;
        } else if (priority === 'Urgent') {
          bgStyle = 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200';
          iconStyle = 'bg-rose-500 text-white';
          Icon = AlertOctagon;
        }

        return (
          <div
            key={itemId}
            className={`relative flex items-start justify-between gap-3 p-4 rounded-2xl border backdrop-blur-md shadow-xs transition-all animate-in fade-in slide-in-from-top-2 duration-300 ${bgStyle}`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl shrink-0 ${iconStyle}`}>
                <Icon className="w-4 h-4" />
              </div>

              <div className="space-y-0.5 pr-6">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider opacity-80 flex items-center gap-1">
                    <Megaphone className="w-3 h-3" /> System Announcement
                  </span>
                  {priority !== 'Info' && (
                    <span className="px-2 py-0.2 rounded-full text-[9px] font-black uppercase bg-current/10">
                      {priority}
                    </span>
                  )}
                </div>
                <h4 className="text-xs font-extrabold leading-snug">{item.title}</h4>
                <p className="text-xs font-medium opacity-90 leading-relaxed">{item.message}</p>
              </div>
            </div>

            <button
              onClick={() => handleDismiss(itemId)}
              className="p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity cursor-pointer shrink-0"
              title="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}