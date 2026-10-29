import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Info, 
  AlertTriangle, 
  AlertOctagon, 
  X, 
  Megaphone 
} from 'lucide-react';

import { API_BASE_URL } from '../../config/api';
import { bannerPresentation, compareBroadcasts } from '../../features/admin/broadcastDispatch';

export default function BroadcastBanner() {
  const location = useLocation();
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
          setBroadcasts(list.slice().sort(compareBroadcasts));
        }
      } catch (err) {
        console.error('Failed to load active broadcasts:', err);
      }
    };

    fetchActiveBroadcasts();

    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

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
        const style = bannerPresentation(priority);
        const Icon = priority === 'Warning' ? AlertTriangle : priority === 'Urgent' ? AlertOctagon : Info;

        return (
          <div
            key={itemId}
            className={`relative flex items-start justify-between gap-3 p-4 rounded-2xl border shadow-xs ${style.card}`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl shrink-0 ${style.icon}`}>
                <Icon className="w-4 h-4" />
              </div>

              <div className="space-y-0.5 pr-6">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${style.text}`}>
                    <Megaphone className="w-3 h-3" /> System Announcement
                  </span>
                  {priority !== 'Info' && (
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${style.badge}`}>
                      {priority}
                    </span>
                  )}
                </div>
                <h4 className={`text-xs font-extrabold leading-snug ${style.text}`}>{item.title}</h4>
                <p className={`text-xs font-medium leading-relaxed ${style.text}`}>{item.message}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleDismiss(itemId)}
              className={`p-1 rounded-lg transition-colors cursor-pointer shrink-0 ${style.dismiss}`}
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