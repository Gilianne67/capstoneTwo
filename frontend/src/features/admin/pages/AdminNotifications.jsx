import React, { useState, useEffect, useMemo } from 'react';
import { 
  Send, 
  Radio, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Trash2, 
  Megaphone,
  Users,
  ShieldCheck
} from 'lucide-react';

import { API_BASE_URL } from '../../../config/api';

export function AdminNotifications() {
  const [activeBroadcasts, setActiveBroadcasts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Loading & Error States
  const [isLoading, setIsLoading] = useState(true);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  
  // Broadcast Form State
  const [broadcast, setBroadcast] = useState({ target: 'All Users', title: '', message: '' });
  const [broadcastSent, setBroadcastSent] = useState(false);

  const getAuthHeaders = () => {
    const rawToken = localStorage.getItem('token');
    const token = rawToken ? rawToken.replace(/^"|"$/g, '').replace(/^Bearer\s+/i, '').trim() : null;
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };
  };

  // 1. GET: Fetch Broadcasts from backend
  const fetchBroadcasts = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/broadcasts`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        // If endpoint doesn't exist yet, gracefully set empty list
        if (res.status === 404) {
          setActiveBroadcasts([]);
          return;
        }
        throw new Error('Failed to fetch system broadcasts from server.');
      }

      const data = await res.json();
      const list = Array.isArray(data) ? data : (Array.isArray(data.broadcasts) ? data.broadcasts : (Array.isArray(data.data) ? data.data : []));
      setActiveBroadcasts(list);
    } catch (err) {
      console.error('Fetch Broadcasts Error:', err);
      // Keep list empty on connection error rather than crashing UI
      setActiveBroadcasts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  // 2. POST: Transmit New Broadcast
  const handleBroadcastSubmit = async (e) => {
    e.preventDefault();
    setIsBroadcasting(true);
    setBroadcastSent(false);
    setErrorMessage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/admin/broadcast`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(broadcast)
      });

      if (!res.ok) {
        throw new Error('Failed to transmit system broadcast.');
      }

      const data = await res.json();
      const newBroadcastItem = data.broadcast || data.data || {
        id: `b-${Date.now()}`,
        title: broadcast.title,
        target: broadcast.target,
        message: broadcast.message,
        date: new Date().toISOString().split('T')[0],
        status: 'Active'
      };

      setActiveBroadcasts(prev => [newBroadcastItem, ...prev]);
      setBroadcastSent(true);
      setBroadcast({ target: 'All Users', title: '', message: '' });
      setTimeout(() => setBroadcastSent(false), 4000);
    } catch (err) {
      console.error('Broadcast Error:', err);
      setErrorMessage(err.message);
    } finally {
      setIsBroadcasting(false);
    }
  };

  // 3. DELETE / REVOKE: Remove Broadcast
  const handleRevoke = async (id) => {
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/broadcast/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!res.ok && res.status !== 404) {
        throw new Error('Failed to revoke broadcast.');
      }

      setActiveBroadcasts(prev => prev.filter(item => (item.id || item._id) !== id));
    } catch (err) {
      console.error('Revoke Error:', err);
      setErrorMessage(err.message);
    }
  };

  const filteredBroadcasts = useMemo(() => {
    return activeBroadcasts.filter(b => 
      (b.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.message || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.target || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [activeBroadcasts, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-card-bg rounded-2xl border border-app-text/10 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-app-text">System Dispatch & Announcement Center</h1>
            <p className="text-xs text-text-muted font-medium">
              Broadcast active banner alerts and manage system-wide notifications for students and providers.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card-bg border border-app-text/10 rounded-2xl p-4 flex items-center gap-3.5 shadow-xs">
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="text-text-muted text-[11px] font-bold uppercase tracking-wider block">Active Broadcasts</span>
            <strong className="text-lg font-black text-app-text">{activeBroadcasts.length} Banners Live</strong>
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
          <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-text-muted text-[11px] font-bold uppercase tracking-wider block">Dispatch Status</span>
            <strong className="text-lg font-black text-app-text">Online & Secure</strong>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Active Broadcasts List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card-bg rounded-2xl border border-app-text/10 p-4 shadow-xs flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-app-text">Active System Announcements</h2>
            <span className="text-xs text-text-muted font-bold">{filteredBroadcasts.length} items</span>
          </div>

          {isLoading ? (
            <div className="min-h-[220px] flex flex-col items-center justify-center gap-2 bg-card-bg rounded-2xl border border-app-text/10 shadow-xs">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <p className="text-xs text-text-muted font-semibold">Loading broadcasts...</p>
            </div>
          ) : filteredBroadcasts.length === 0 ? (
            <div className="p-12 text-center bg-card-bg rounded-2xl border border-app-text/10 text-xs text-text-muted font-medium shadow-xs">
              No active broadcast announcements found in the database.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBroadcasts.map((item) => {
                const itemId = item.id || item._id;
                return (
                  <div 
                    key={itemId}
                    className="bg-card-bg rounded-2xl border border-app-text/10 p-4 shadow-xs flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-primary/10 text-primary text-[10px] font-extrabold rounded-full">
                          {item.target}
                        </span>
                        <span className="text-[10px] text-text-muted font-bold">
                          {item.date ? new Date(item.date).toLocaleDateString() : ''}
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-app-text">{item.title}</h3>
                      <p className="text-xs text-text-muted font-medium leading-relaxed">{item.message}</p>
                    </div>

                    <button
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

        {/* Right Col: Dispatch Broadcast Form */}
        <div className="space-y-4">
          <div className="bg-card-bg rounded-2xl border border-app-text/10 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-app-text/10">
              <Radio className="w-4 h-4 text-primary animate-pulse" />
              <h2 className="text-xs font-black uppercase tracking-wider text-app-text">
                New Broadcast Dispatch
              </h2>
            </div>

            {broadcastSent ? (
              <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-2 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Broadcast dispatched to target dashboards!</span>
              </div>
            ) : (
             <form onSubmit={handleBroadcastSubmit} className="space-y-3">
  <div>
    <label className="block text-xs font-bold text-app-text mb-1">Target Audience</label>
    <select
      value={broadcast.target}
      onChange={(e) => setBroadcast({ ...broadcast, target: e.target.value })}
      className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-none focus:border-primary cursor-pointer"
    >
      <option value="All Users">All Users</option>
      <option value="Students Only">Students Only</option>
      <option value="Grant Providers Only">Grant Providers Only</option>
    </select>
  </div>

  <div>
    <label className="block text-xs font-bold text-app-text mb-1">Priority Level</label>
    <select
      value={broadcast.priority || 'Info'}
      onChange={(e) => setBroadcast({ ...broadcast, priority: e.target.value })}
      className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-none focus:border-primary cursor-pointer"
    >
      <option value="Info">Info (Standard)</option>
      <option value="Warning">Warning (Important)</option>
      <option value="Urgent">Urgent (Critical Alert)</option>
    </select>
  </div>

  <div>
    <label className="block text-xs font-bold text-app-text mb-1">Banner Title</label>
    <input
      type="text"
      required
      placeholder="e.g. Scheduled System Maintenance"
      value={broadcast.title}
      onChange={(e) => setBroadcast({ ...broadcast, title: e.target.value })}
      className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-none focus:border-primary"
    />
  </div>

  <div className="grid grid-cols-2 gap-2">
    <div>
      <label className="block text-xs font-bold text-app-text mb-1">Start Date</label>
      <input
        type="datetime-local"
        value={broadcast.startDate || ''}
        onChange={(e) => setBroadcast({ ...broadcast, startDate: e.target.value })}
        className="w-full px-2.5 py-1.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-none focus:border-primary"
      />
    </div>

    <div>
      <label className="block text-xs font-bold text-app-text mb-1">Expires At *</label>
      <input
        type="datetime-local"
        required
        value={broadcast.expiresAt || ''}
        onChange={(e) => setBroadcast({ ...broadcast, expiresAt: e.target.value })}
        className="w-full px-2.5 py-1.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-none focus:border-primary"
      />
    </div>
  </div>

  <div>
    <label className="block text-xs font-bold text-app-text mb-1">Broadcast Message</label>
    <textarea
      rows={3}
      required
      placeholder="Message to display on user dashboards..."
      value={broadcast.message}
      onChange={(e) => setBroadcast({ ...broadcast, message: e.target.value })}
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