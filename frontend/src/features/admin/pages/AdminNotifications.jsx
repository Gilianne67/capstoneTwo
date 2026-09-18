import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bell, 
  Send, 
  ShieldAlert, 
  Search, 
  CheckCircle2, 
  AlertTriangle,
  Info,
  Radio,
  Loader2,
  AlertCircle
} from 'lucide-react';

export function AdminNotifications() {
  const [logs, setLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All');
  
  // Loading & Error States
  const [isLoading, setIsLoading] = useState(true);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  
  // Broadcast Form State
  const [broadcast, setBroadcast] = useState({ target: 'All Users', title: '', message: '' });
  const [broadcastSent, setBroadcastSent] = useState(false);

  // Helper for Authorization Headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };
  };

  // 1. GET: Fetch Audit Logs from API
  const fetchAuditLogs = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/v1/admin/audit-logs', {
        headers: getAuthHeaders()
      });

      if (!res.ok) throw new Error('Failed to load system audit logs.');

      const data = await res.json();
      setLogs(data.logs || data);
    } catch (err) {
      console.error('Fetch Logs Error:', err);
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  // 2. POST: Dispatch Broadcast Announcement
  const handleBroadcastSubmit = async (e) => {
    e.preventDefault();
    setIsBroadcasting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/v1/admin/broadcasts', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(broadcast)
      });

      if (!res.ok) throw new Error('Failed to send broadcast announcement.');

      setBroadcastSent(true);
      setBroadcast({ target: 'All Users', title: '', message: '' });
      setTimeout(() => setBroadcastSent(false), 4000);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsBroadcasting(false);
    }
  };

  // 3. PATCH: Mark All Logged Events as Read
  const markAllRead = async () => {
    setIsMarkingRead(true);
    try {
      const res = await fetch('/api/v1/admin/audit-logs/mark-read', {
        method: 'PATCH',
        headers: getAuthHeaders()
      });

      if (!res.ok) throw new Error('Failed to update logs status.');

      // Optimistically update local state on success
      setLogs(prev => prev.map(item => ({ ...item, read: true })));
    } catch (err) {
      alert(err.message);
    } finally {
      setIsMarkingRead(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = (log.message || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (log.type || '').toLowerCase().includes(searchQuery.toLowerCase());
      if (filterType === 'Unread') return matchesSearch && !log.read;
      if (filterType === 'Security') return matchesSearch && log.type === 'Security';
      return matchesSearch;
    });
  }, [logs, searchQuery, filterType]);

  const formatDate = (isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleString('en-US', {
      month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-card-bg rounded-2xl border border-app-text/10 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-app-text">System Dispatch & Audit Logs</h1>
            <p className="text-xs text-text-muted font-medium">
              Monitor security triggers, operational events, and broadcast system alerts.
            </p>
          </div>
        </div>

        <button
          onClick={markAllRead}
          disabled={isMarkingRead || logs.length === 0}
          className="px-3.5 py-2 bg-app-bg hover:bg-app-text/5 text-app-text border border-app-text/10 text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0 disabled:opacity-50 flex items-center gap-2"
        >
          {isMarkingRead && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>Mark All Logged Events as Read</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: System Audit Log Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card-bg rounded-2xl border border-app-text/10 p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search audit logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold focus:outline-hidden focus:border-primary text-app-text"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              {['All', 'Unread', 'Security'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterType(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                    filterType === f 
                      ? 'bg-primary text-white' 
                      : 'bg-app-bg text-text-muted hover:text-app-text border border-app-text/10'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="min-h-[250px] flex flex-col items-center justify-center gap-2 bg-card-bg rounded-2xl border border-app-text/10">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <p className="text-xs text-text-muted font-semibold">Fetching audit stream...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center bg-card-bg rounded-2xl border border-app-text/10 text-xs text-text-muted font-medium">
              No audit logs found matching your criteria.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => {
                let Icon = Info;
                let iconStyle = 'bg-blue-500/10 text-blue-600';
                
                if (log.severity === 'warning') {
                  Icon = AlertTriangle;
                  iconStyle = 'bg-amber-500/10 text-amber-600';
                } else if (log.severity === 'danger') {
                  Icon = ShieldAlert;
                  iconStyle = 'bg-rose-500/10 text-rose-600';
                } else if (log.severity === 'success') {
                  Icon = CheckCircle2;
                  iconStyle = 'bg-emerald-500/10 text-emerald-600';
                }

                return (
                  <div 
                    key={log._id || log.id}
                    className={`bg-card-bg rounded-2xl border p-4 shadow-xs transition-all flex items-start gap-3.5 ${
                      !log.read ? 'border-primary/40 bg-primary/5' : 'border-app-text/10'
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl shrink-0 ${iconStyle}`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-primary">
                          {log.type}
                        </span>
                        <span className="text-[10px] text-text-muted font-bold">
                          {formatDate(log.timestamp || log.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-app-text leading-relaxed">
                        {log.message}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Col: Global System Broadcast Tool */}
        <div className="space-y-4">
          <div className="bg-card-bg rounded-2xl border border-app-text/10 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-app-text/10">
              <Radio className="w-4 h-4 text-primary animate-pulse" />
              <h2 className="text-xs font-black uppercase tracking-wider text-app-text">
                Broadcast Announcement
              </h2>
            </div>

            {broadcastSent ? (
              <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-2 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Global announcement broadcasted to target users!</span>
              </div>
            ) : (
              <form onSubmit={handleBroadcastSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-app-text mb-1">Target Audience</label>
                  <select
                    value={broadcast.target}
                    onChange={(e) => setBroadcast({ ...broadcast, target: e.target.value })}
                    className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-hidden focus:border-primary cursor-pointer"
                  >
                    <option value="All Users">All Users</option>
                    <option value="Students Only">Students Only</option>
                    <option value="Grant Providers Only">Grant Providers Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-app-text mb-1">Banner Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. System Maintenance Notice"
                    value={broadcast.title}
                    onChange={(e) => setBroadcast({ ...broadcast, title: e.target.value })}
                    className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-hidden focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-app-text mb-1">Broadcast Message</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Message to display on user dashboards..."
                    value={broadcast.message}
                    onChange={(e) => setBroadcast({ ...broadcast, message: e.target.value })}
                    className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 text-xs font-medium text-app-text focus:outline-hidden focus:border-primary resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isBroadcasting}
                  className="w-full py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
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