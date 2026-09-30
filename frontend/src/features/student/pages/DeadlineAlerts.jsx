import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  Clock, 
  Calendar, 
  Search, 
  ExternalLink,
  Sliders,
  Inbox,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { isDeadlineOpen, manilaDeadlineEnd } from '../../../utils/deadline';

import { API_BASE_URL } from '../../../config/api';

const DETAILS_BACK_PATH = '/dashboard/student/notifications';
const DAY_MS = 24 * 60 * 60 * 1000;
const CLOSING_SOON_DAYS = 20;

const getCleanToken = (contextToken) => {
  const rawToken = contextToken || localStorage.getItem('token');

  if (!rawToken) return null;

  return String(rawToken)
    .replace(/^"|"$/g, '')
    .replace(/^Bearer\s+/i, '')
    .trim();
};

const getRemainingMs = (deadlineDateStr) => {
  const end = manilaDeadlineEnd(deadlineDateStr);

  if (end === null) return null;

  return end - Date.now();
};

const isUpcomingDeadline = (remainingMs) =>
  remainingMs !== null && remainingMs > 0;

export function DeadlineAlerts() {
  const navigate = useNavigate();
  const { token: contextToken } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('All');

  useEffect(() => {
    let isMounted = true;

    const fetchDeadlineAlerts = async () => {
      try {
        setIsLoading(true);
        const token = getCleanToken(contextToken);
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const [notificationsRes, savedRes] = await Promise.all([
          fetch(`${API_BASE_URL}/students/notifications`, { headers }),
          fetch(`${API_BASE_URL}/students/saved-scholarships`, { headers })
        ]);

        if (!notificationsRes.ok) {
          throw new Error('Failed to load notifications');
        }

        if (!savedRes.ok) {
          throw new Error('Failed to load saved scholarships');
        }

        const notificationsData = await notificationsRes.json();
        const savedData = await savedRes.json();
        const notifications = Array.isArray(notificationsData?.notifications)
          ? notificationsData.notifications
          : [];
        const savedScholarships = Array.isArray(savedData?.savedScholarships)
          ? savedData.savedScholarships
          : [];
        const savedById = new Map(
          savedScholarships.map((item) => [String(item._id), item])
        );

        const list = notifications
          .filter((item) => item?.type === 'deadline' && item.scholarshipId)
          .map((item) => {
            const saved = savedById.get(String(item.scholarshipId));

            if (!saved?.deadline) return null;
            if (saved.status === 'Closed' || saved.isArchived) return null;
            if (!isDeadlineOpen(saved.deadline)) return null;

            return {
              notificationId: item._id,
              scholarshipId: item.scholarshipId,
              isRead: Boolean(item.isRead),
              status: item.isRead ? 'Read' : 'Unread',
              title: saved.title || '',
              provider: saved.provider || '',
              amount: saved.amount || '',
              deadline: saved.deadline,
              externalUrl: saved.externalUrl || ''
            };
          })
          .filter(Boolean);

        if (isMounted) {
          setAlerts(list);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to load deadline alerts', err);
          setAlerts([]);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchDeadlineAlerts();

    return () => {
      isMounted = false;
    };
  }, [contextToken]);

  const getDaysRemaining = (deadlineDateStr) => {
    const remainingMs = getRemainingMs(deadlineDateStr);

    if (remainingMs === null || remainingMs <= 0) return 0;

    return Math.ceil(remainingMs / DAY_MS);
  };

  const filteredAlerts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return alerts.filter(item => {
      const remainingMs = getRemainingMs(item.deadline);

      if (!isUpcomingDeadline(remainingMs)) {
        return false;
      }

      const title = String(item.title || item.scholarshipTitle || item.name || '').toLowerCase();
      const provider = String(item.provider || '').toLowerCase();
      const matchesSearch = !query || title.includes(query) || provider.includes(query);

      if (!matchesSearch) return false;

      const daysLeft = Math.ceil(remainingMs / DAY_MS);

      if (urgencyFilter === 'Closing Soon') {
        return daysLeft <= CLOSING_SOON_DAYS;
      }

      if (urgencyFilter === 'High Priority') {
        return remainingMs <= DAY_MS;
      }

      return true;
    });
  }, [alerts, searchQuery, urgencyFilter]);

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  };

  const openScholarshipDetails = async (alert) => {
    const notificationId = alert?.notificationId;
    const scholarshipId = alert?.scholarshipId;

    if (notificationId && !alert.isRead) {
      try {
        const token = getCleanToken(contextToken);
        const response = await fetch(
          `${API_BASE_URL}/students/notifications/${notificationId}/read`,
          {
            method: 'PATCH',
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          }
        );

        if (response.ok) {
          setAlerts((prev) => prev.map((item) => (
            item.notificationId === notificationId
              ? { ...item, isRead: true, status: 'Read' }
              : item
          )));
        }
      } catch (err) {
        console.error('Failed to mark notification read', err);
      }
    }

    if (!scholarshipId) return;

    navigate(`/dashboard/student/scholarships/${scholarshipId}`, {
      state: { backPath: DETAILS_BACK_PATH }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-primary">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-card-bg rounded-2xl border border-app-text/10 p-5 shadow-xs space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-app-text">Deadline Alerts</h1>
            <p className="text-xs text-text-muted font-medium">
              Track critical due dates for your saved and ongoing scholarship applications.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Alerts List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card-bg rounded-2xl border border-app-text/10 p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search alert by grant or provider..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold focus:outline-hidden focus:border-primary text-app-text"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              {['All', 'Closing Soon', 'High Priority'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setUrgencyFilter(filter)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                    urgencyFilter === filter 
                      ? 'bg-primary text-white' 
                      : 'bg-app-bg text-text-muted hover:text-app-text border border-app-text/10'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {filteredAlerts.length === 0 ? (
            <div className="bg-card-bg rounded-2xl border border-app-text/10 p-8 text-center space-y-3 shadow-xs">
              <Inbox className="h-10 w-10 text-text-muted mx-auto" />
              <p className="text-sm font-bold text-app-text">No active deadline alerts</p>
              <p className="text-xs text-text-muted">Save more scholarships to enable deadline tracking and push reminders.</p>
            </div>
          ) : (
            filteredAlerts.map((alert) => {
              const remainingMs = getRemainingMs(alert.deadline);
              const daysRemaining = getDaysRemaining(alert.deadline);
              const isUrgent = remainingMs !== null && remainingMs > 0 && remainingMs <= DAY_MS;
              const scholarshipId = alert.scholarshipId;
              const title = alert.title || '';
              const provider = alert.provider || '';
              const canOpenDetails = Boolean(scholarshipId);

              return (
                <div 
                  key={alert.notificationId || scholarshipId || title}
                  role={canOpenDetails ? 'link' : undefined}
                  tabIndex={canOpenDetails ? 0 : undefined}
                  onClick={() => openScholarshipDetails(alert)}
                  onKeyDown={(event) => {
                    if (canOpenDetails && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      openScholarshipDetails(alert);
                    }
                  }}
                  className={`bg-card-bg rounded-2xl border p-5 shadow-xs space-y-3 transition-all ${
                    canOpenDetails ? 'cursor-pointer' : ''
                  } ${
                    isUrgent ? 'border-amber-500/40 bg-amber-500/5' : 'border-app-text/10 hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                          isUrgent ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary'
                        }`}>
                          {daysRemaining} Days Left
                        </span>
                        {alert.status ? (
                          <span className="text-[10px] font-bold text-text-muted border border-app-text/10 px-2 py-0.5 rounded-md">
                            Status: {alert.status}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="text-sm font-extrabold text-app-text">{title}</h3>
                      <p className="text-xs text-text-muted font-medium">{provider}</p>
                    </div>

                    {alert.externalUrl ? (
                      <a
                        href={alert.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="p-2 rounded-xl bg-app-bg hover:bg-primary/10 hover:text-primary border border-app-text/10 text-text-muted transition-colors cursor-pointer shrink-0"
                        title="Open Official Scholarship Page"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-app-text/10 text-xs font-semibold text-app-text">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-text-muted" />
                      <span>Due: {formatDate(alert.deadline)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-text-muted" />
                      <span>{alert.amount}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Alert Rules */}
        <div className="space-y-4">
          <div className="bg-card-bg rounded-2xl border border-app-text/10 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-app-text/10">
              <Sliders className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-black uppercase tracking-wider text-app-text">
                Alert Rules
              </h2>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-app-text">Remind Me Before Deadline:</p>
              <p className="text-xs font-medium text-text-muted">7 Days Before</p>
              <p className="text-xs font-medium text-text-muted">3 Days Before</p>
              <p className="text-xs font-medium text-text-muted">24 Hours Before (Urgent)</p>
              <p className="text-[11px] text-text-muted font-medium leading-relaxed">
                Deadline reminders are automatically generated for scholarships you have saved.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default DeadlineAlerts;
