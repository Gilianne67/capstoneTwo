import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Loader2, AlertCircle } from 'lucide-react';
import PageHeader from '../../../components/common/PageHeader';
import { API_BASE_URL } from '../../../config/api';
import { useAuth } from '../../../context/AuthContext';

const formatRemovalDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export default function ProviderNotifications() {
  const { getCleanToken } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadNotifications = async () => {
      setIsLoading(true);
      setError('');

      try {
        const token = getCleanToken();
        const response = await fetch(`${API_BASE_URL}/provider/notifications`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to load notifications.');
        }

        if (isMounted) {
          setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load notifications.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadNotifications();

    return () => {
      isMounted = false;
    };
  }, [getCleanToken]);

  const openNotification = async (notification) => {
    setSelectedId(notification._id);
    if (notification.isRead) return;

    try {
      const token = getCleanToken();
      const response = await fetch(
        `${API_BASE_URL}/provider/notifications/${notification._id}/read`,
        {
          method: 'PATCH',
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );

      if (!response.ok) return;

      setNotifications((current) => current.map((item) => (
        item._id === notification._id ? { ...item, isRead: true } : item
      )));
      window.dispatchEvent(new Event('provider-notifications-updated'));
    } catch (err) {
      console.error('Failed to mark provider notification read', err);
    }
  };

  const selected = notifications.find((item) => item._id === selectedId) || null;

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <PageHeader
        title="Notifications"
        description="Removal decisions for scholarships owned by your organization."
        role="provider"
      />

      {isLoading ? (
        <div className="min-h-[240px] flex items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading notifications...
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      {!isLoading && !error && notifications.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Removal notices for your scholarships will appear here.
        </div>
      ) : null}

      {!isLoading && !error && notifications.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="space-y-3 lg:col-span-2">
            {notifications.map((notification) => {
              const isSelected = notification._id === selectedId;
              return (
                <button
                  key={notification._id}
                  type="button"
                  onClick={() => openNotification(notification)}
                  className={`w-full rounded-2xl border bg-white p-4 text-left transition-colors ${
                    isSelected ? 'border-emerald-300' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      {!notification.isRead ? (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-label="Unread notification" />
                      ) : (
                        <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      )}
                      <span className="text-sm font-bold text-slate-900">
                        {notification.scholarshipTitle || notification.title}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">
                      {notification.isRead ? 'Read' : 'Unread'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Removed {formatRemovalDate(notification.removedAt) || 'on an unknown date'}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-3">
            {selected ? (
              <div className="space-y-3">
                <h2 className="text-lg font-bold text-slate-900">
                  {selected.scholarshipTitle || selected.title}
                </h2>
                <p className="text-sm text-slate-600">
                  An administrator removed this listing on {formatRemovalDate(selected.removedAt) || 'an unknown date'}.
                </p>
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                  <p className="font-bold">Admin explanation</p>
                  <p className="mt-1">{selected.explanation || selected.message}</p>
                </div>
                {selected.scholarshipId ? (
                  <Link
                    to={`/dashboard/provider/scholarships/${selected.scholarshipId}`}
                    className="inline-flex text-xs font-bold text-emerald-700 hover:text-emerald-800"
                  >
                    View listing
                  </Link>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Select a notification to read the removal date and the administrator’s explanation.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
