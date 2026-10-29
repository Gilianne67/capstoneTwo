import React, { useState, useEffect, useCallback } from 'react';
import {
  Send,
  Radio,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Megaphone,
  Users,
} from 'lucide-react';

import { API_BASE_URL } from '../../../config/api';
import {
  SAVED_MESSAGE,
  buildBroadcastPayload,
  compareBroadcasts,
  countLiveBroadcasts,
  dispatchServiceLabel,
  emptyBroadcastDraft,
  formatBroadcastWhen,
  interpretBroadcastList,
  interpretBroadcastResponse,
  interpretRevokeResponse,
  phaseLabel,
  priorityTone,
  broadcastPhase,
} from '../broadcastDispatch';

const PRIORITY_BADGE = {
  info: 'bg-blue-500/10 text-blue-700',
  warning: 'bg-amber-500/10 text-amber-700',
  urgent: 'bg-rose-500/10 text-rose-700',
};

const PHASE_BADGE = {
  live: 'bg-emerald-500/10 text-emerald-700',
  scheduled: 'bg-slate-500/10 text-slate-600',
  expired: 'bg-slate-200 text-slate-500',
  revoked: 'bg-rose-500/10 text-rose-700',
};

export function AdminNotifications() {
  const [activeBroadcasts, setActiveBroadcasts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [broadcast, setBroadcast] = useState(() => emptyBroadcastDraft());
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [saveWarning, setSaveWarning] = useState('');

  const getAuthHeaders = () => {
    const rawToken = localStorage.getItem('token');
    const token = rawToken ? rawToken.replace(/^"|"$/g, '').replace(/^Bearer\s+/i, '').trim() : null;
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  };

  const fetchBroadcasts = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoading(true);
      setLoadError('');
    }

    try {
      const res = await fetch(`${API_BASE_URL}/admin/broadcasts`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      const result = interpretBroadcastList({ ok: res.ok, body: data });

      if (result.outcome !== 'loaded') {
        if (!silent) setActiveBroadcasts([]);
        setLoadError(result.message);
        return false;
      }

      setActiveBroadcasts(result.broadcasts);
      setLoadError('');
      return true;
    } catch (err) {
      console.error('Fetch Broadcasts Error:', err);
      if (!silent) setActiveBroadcasts([]);
      setLoadError('Announcements could not be loaded. Please try again.');
      return false;
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBroadcasts();
  }, [fetchBroadcasts]);

  const handleBroadcastSubmit = async (event) => {
    event.preventDefault();
    if (isBroadcasting) return;

    const prepared = buildBroadcastPayload(broadcast);
    if (!prepared.ok) {
      setFormError(prepared.error);
      setBroadcastSent(false);
      return;
    }

    setIsBroadcasting(true);
    setBroadcastSent(false);
    setSaveWarning('');
    setFormError('');

    try {
      const res = await fetch(`${API_BASE_URL}/admin/broadcast`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(prepared.body),
      });
      const data = await res.json().catch(() => ({}));
      const result = interpretBroadcastResponse({ ok: res.ok, body: data });

      if (result.outcome !== 'saved') {
        setFormError(result.message);
        return;
      }

      setSaveWarning(result.warning || '');
      setBroadcastSent(true);
      setBroadcast(emptyBroadcastDraft());
      setTimeout(() => setBroadcastSent(false), 4000);

      const refreshed = await fetchBroadcasts({ silent: true });
      if (!refreshed) {
        setActiveBroadcasts((prev) => {
          const createdId = result.broadcast._id || result.broadcast.id;
          return [
            result.broadcast,
            ...prev.filter((item) => (item._id || item.id) !== createdId),
          ];
        });
        setFormError('The announcement was saved, but the list could not be refreshed.');
      }
    } catch (err) {
      console.error('Broadcast Error:', err);
      setFormError('The announcement could not be saved. Please try again.');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleRevoke = async (id) => {
    if (!id) return;
    setFormError('');

    try {
      const res = await fetch(`${API_BASE_URL}/admin/broadcast/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      const result = interpretRevokeResponse({ ok: res.ok, status: res.status, body: data });

      if (result.outcome !== 'removed') {
        setFormError(result.message);
        return;
      }

      setActiveBroadcasts((prev) => prev.filter((item) => (item.id || item._id) !== id));
    } catch (err) {
      console.error('Revoke Error:', err);
      setFormError('The announcement could not be revoked. Please try again.');
    }
  };

  const announcements = [...activeBroadcasts].sort(compareBroadcasts);
  const liveCount = countLiveBroadcasts(activeBroadcasts);
  const serviceLabel = dispatchServiceLabel({
    loading: isLoading,
    loadError: Boolean(loadError),
  });
  const serviceTone = serviceLabel === 'Unavailable'
    ? 'bg-rose-500/10 text-rose-600'
    : serviceLabel === 'Checking'
      ? 'bg-slate-500/10 text-slate-500'
      : 'bg-emerald-500/10 text-emerald-600';

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <div className="bg-card-bg rounded-2xl border border-app-text/10 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-app-text">System Dispatch & Announcement Center</h1>
            <p className="text-xs text-text-muted font-medium">
              Save banner announcements for student and provider dashboards. This page does not send email or push notifications.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card-bg border border-app-text/10 rounded-2xl p-4 flex items-center gap-3.5 shadow-xs">
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <Radio className={`w-5 h-5 ${liveCount > 0 ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <span className="text-text-muted text-[11px] font-bold uppercase tracking-wider block">Active Broadcasts</span>
            <strong className="text-lg font-black text-app-text">{liveCount} Banners Live</strong>
          </div>
        </div>

        <div className="bg-card-bg border border-app-text/10 rounded-2xl p-4 flex items-center gap-3.5 shadow-xs">
          <div className="p-3 bg-secondary/10 text-secondary rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-text-muted text-[11px] font-bold uppercase tracking-wider block">Target Channels</span>
            <strong className="text-lg font-black text-app-text">Students & Providers</strong>
          </div>
        </div>

        <div className="bg-card-bg border border-app-text/10 rounded-2xl p-4 flex items-center gap-3.5 shadow-xs">
          <div className={`p-3 rounded-xl ${serviceTone}`}>
            {serviceLabel === 'Checking' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : serviceLabel === 'Unavailable' ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
          </div>
          <div>
            <span className="text-text-muted text-[11px] font-bold uppercase tracking-wider block">Announcement Service</span>
            <strong className="text-lg font-black text-app-text">{serviceLabel}</strong>
          </div>
        </div>
      </div>

      {(loadError || formError) && (
        <div role="alert" className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{[loadError, formError].filter(Boolean).join(' ')}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card-bg rounded-2xl border border-app-text/10 p-4 shadow-xs flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-app-text">System Announcements</h2>
            <span className="text-xs text-text-muted font-bold">{announcements.length} items</span>
          </div>

          {isLoading ? (
            <div className="min-h-[220px] flex flex-col items-center justify-center gap-2 bg-card-bg rounded-2xl border border-app-text/10 shadow-xs">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <p className="text-xs text-text-muted font-semibold">Loading broadcasts...</p>
            </div>
          ) : loadError && announcements.length === 0 ? (
            <div className="p-12 text-center bg-card-bg rounded-2xl border border-app-text/10 shadow-xs space-y-3">
              <p className="text-xs text-rose-700 font-semibold">{loadError}</p>
              <button
                type="button"
                onClick={() => fetchBroadcasts()}
                className="px-3 py-1.5 text-xs font-bold rounded-xl border border-app-text/10 text-app-text hover:bg-app-bg cursor-pointer"
              >
                Try again
              </button>
            </div>
          ) : announcements.length === 0 ? (
            <div className="p-12 text-center bg-card-bg rounded-2xl border border-app-text/10 text-xs text-text-muted font-medium shadow-xs">
              No broadcast announcements found in the database.
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((item) => {
                const itemId = item.id || item._id;
                const phase = broadcastPhase(item);
                const tone = priorityTone(item.priority);
                return (
                  <div
                    key={itemId}
                    className="bg-card-bg rounded-2xl border border-app-text/10 p-4 shadow-xs flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full ${PRIORITY_BADGE[tone]}`}>
                          {item.priority || 'Info'}
                        </span>
                        <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full ${PHASE_BADGE[phase] || PHASE_BADGE.expired}`}>
                          {phaseLabel(phase)}
                        </span>
                        <span className="px-2.5 py-0.5 bg-primary/10 text-primary text-[10px] font-extrabold rounded-full">
                          {item.target}
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-app-text">{item.title}</h3>
                      <p className="text-xs text-text-muted font-medium leading-relaxed">{item.message}</p>
                      <p className="text-[10px] text-text-muted font-bold">
                        Starts {formatBroadcastWhen(item.startDate)} · Expires {formatBroadcastWhen(item.expiresAt)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRevoke(itemId)}
                      title="Revoke Broadcast"
                      className="p-2 rounded-xl text-text-muted hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-card-bg rounded-2xl border border-app-text/10 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-app-text/10">
              <Radio className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-black uppercase tracking-wider text-app-text">
                New Broadcast Dispatch
              </h2>
            </div>

            {broadcastSent ? (
              <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold flex items-start gap-2 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  {SAVED_MESSAGE}
                  {saveWarning ? <span className="block mt-1 font-semibold">{saveWarning}</span> : null}
                </span>
              </div>
            ) : (
              <form onSubmit={handleBroadcastSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-app-text mb-1" htmlFor="broadcast-target">Target Audience</label>
                  <select
                    id="broadcast-target"
                    value={broadcast.target}
                    onChange={(event) => setBroadcast({ ...broadcast, target: event.target.value })}
                    className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="All Users">All Users</option>
                    <option value="Students Only">Students Only</option>
                    <option value="Grant Providers Only">Grant Providers Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-app-text mb-1" htmlFor="broadcast-priority">Priority Level</label>
                  <select
                    id="broadcast-priority"
                    value={broadcast.priority}
                    onChange={(event) => setBroadcast({ ...broadcast, priority: event.target.value })}
                    className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="Info">Info (Standard)</option>
                    <option value="Warning">Warning (Important)</option>
                    <option value="Urgent">Urgent (Critical Alert)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-app-text mb-1" htmlFor="broadcast-title">Banner Title</label>
                  <input
                    id="broadcast-title"
                    type="text"
                    required
                    maxLength={120}
                    placeholder="e.g. Scheduled System Maintenance"
                    value={broadcast.title}
                    onChange={(event) => setBroadcast({ ...broadcast, title: event.target.value })}
                    className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-app-text mb-1" htmlFor="broadcast-start">Start Date</label>
                    <input
                      id="broadcast-start"
                      type="datetime-local"
                      value={broadcast.startDate}
                      onChange={(event) => setBroadcast({ ...broadcast, startDate: event.target.value })}
                      className="w-full px-2.5 py-1.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-app-text mb-1" htmlFor="broadcast-expires">Expires At *</label>
                    <input
                      id="broadcast-expires"
                      type="datetime-local"
                      required
                      value={broadcast.expiresAt}
                      onChange={(event) => setBroadcast({ ...broadcast, expiresAt: event.target.value })}
                      className="w-full px-2.5 py-1.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-app-text mb-1" htmlFor="broadcast-message">Broadcast Message</label>
                  <textarea
                    id="broadcast-message"
                    rows={3}
                    required
                    maxLength={2000}
                    placeholder="Message to display on user dashboards..."
                    value={broadcast.message}
                    onChange={(event) => setBroadcast({ ...broadcast, message: event.target.value })}
                    className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 text-xs font-medium text-app-text focus:outline-none focus:border-primary resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isBroadcasting}
                  className="w-full py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-xs"
                >
                  {isBroadcasting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Transmit Broadcast</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminNotifications;
