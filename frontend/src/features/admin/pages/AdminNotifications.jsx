import React, { useState, useMemo } from 'react';
import { 
  Bell, 
  Send, 
  ShieldAlert, 
  UserCheck, 
  Search, 
  CheckCircle2, 
  AlertTriangle,
  Info,
  Radio
} from 'lucide-react';

const MOCK_ADMIN_AUDIT_LOGS = [
  {
    id: 'log-101',
    type: 'Security',
    severity: 'warning',
    message: 'Multiple failed login attempts detected from IP 112.198.70.12',
    timestamp: '2026-08-02T10:14:00.000Z',
    read: false
  },
  {
    id: 'log-102',
    type: 'Provider Verification',
    severity: 'info',
    message: 'New provider account request submitted by Bicol Development Foundation',
    timestamp: '2026-08-02T08:30:00.000Z',
    read: false
  },
  {
    id: 'log-103',
    type: 'System',
    severity: 'success',
    message: 'Automated nightly database backup completed (41.2 GB archived)',
    timestamp: '2026-08-02T02:00:00.000Z',
    read: true
  },
  {
    id: 'log-104',
    type: 'Scholarship Flag',
    severity: 'danger',
    message: 'Scholarship #882 flagged by 3 users for invalid contact details',
    timestamp: '2026-08-01T16:45:00.000Z',
    read: true
  }
];

export function AdminNotifications() {
  const [logs, setLogs] = useState(MOCK_ADMIN_AUDIT_LOGS);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All');
  
  // Broadcast modal state
  const [broadcast, setBroadcast] = useState({ target: 'All Users', title: '', message: '' });
  const [broadcastSent, setBroadcastSent] = useState(false);

  const handleBroadcastSubmit = (e) => {
    e.preventDefault();
    setBroadcastSent(true);
    setBroadcast({ target: 'All Users', title: '', message: '' });
    setTimeout(() => setBroadcastSent(false), 4000);
  };

  const markAllRead = () => {
    setLogs(logs.map(item => ({ ...item, read: true })));
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            log.type.toLowerCase().includes(searchQuery.toLowerCase());
      if (filterType === 'Unread') return matchesSearch && !log.read;
      if (filterType === 'Security') return matchesSearch && log.type === 'Security';
      return matchesSearch;
    });
  }, [logs, searchQuery, filterType]);

  const formatDate = (isoString) => {
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
          className="px-3.5 py-2 bg-app-bg hover:bg-app-text/5 text-app-text border border-app-text/10 text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
        >
          Mark All Logged Events as Read
        </button>
      </div>

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
                  key={log.id}
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
                        {formatDate(log.timestamp)}
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
                    <option>All Users</option>
                    <option>Students Only</option>
                    <option>Grant Providers Only</option>
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
                  className="w-full py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
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