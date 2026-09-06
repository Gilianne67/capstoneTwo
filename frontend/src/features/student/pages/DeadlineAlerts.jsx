import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bell, 
  Clock, 
  Calendar, 
  Search, 
  ExternalLink,
  Sliders,
  Sparkles,
  Inbox,
  Loader2
} from 'lucide-react';

export function DeadlineAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('All');
  
  const [preferences, setPreferences] = useState({
    notify7Days: true,
    notify3Days: true,
    notify1Day: true,
    emailAlerts: true,
    pushAlerts: false,
  });

  // Fetch user alerts & rules on mount
  useEffect(() => {
    const fetchAlertData = async () => {
      try {
        setIsLoading(true);
        const [alertsRes, prefsRes] = await Promise.all([
          fetch('/api/user/deadline-alerts', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          }),
          fetch('/api/user/alert-preferences', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          })
        ]);

        if (alertsRes.ok) setAlerts(await alertsRes.json());
        if (prefsRes.ok) setPreferences(await prefsRes.json());
      } catch (err) {
        console.error('Failed to load deadline alerts', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlertData();
  }, []);

  const handleTogglePref = (key) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSavePreferences = async () => {
    setIsSavingPrefs(true);
    try {
      await fetch('/api/user/alert-preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(preferences)
      });
    } catch (err) {
      console.error('Failed to save alert preferences', err);
    } finally {
      setIsSavingPrefs(false);
    }
  };

  // Helper for dynamic day difference calculation
  const getDaysRemaining = (deadlineDateStr) => {
    const today = new Date();
    const deadline = new Date(deadlineDateStr);
    const diffTime = deadline - today;
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const filteredAlerts = useMemo(() => {
    return alerts.filter(item => {
      const matchesSearch = item.scholarshipTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.provider.toLowerCase().includes(searchQuery.toLowerCase());
      
      const daysLeft = getDaysRemaining(item.deadline);

      if (urgencyFilter === 'Closing Soon') {
        return matchesSearch && daysLeft <= 20;
      }
      if (urgencyFilter === 'High Priority') {
        return matchesSearch && item.urgency === 'high';
      }
      return matchesSearch;
    });
  }, [alerts, searchQuery, urgencyFilter]);

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
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
              const daysRemaining = getDaysRemaining(alert.deadline);
              const isUrgent = daysRemaining <= 20;

              return (
                <div 
                  key={alert.id}
                  className={`bg-card-bg rounded-2xl border p-5 shadow-xs space-y-3 transition-all ${
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
                        <span className="text-[10px] font-bold text-text-muted border border-app-text/10 px-2 py-0.5 rounded-md">
                          Status: {alert.status}
                        </span>
                      </div>
                      <h3 className="text-sm font-extrabold text-app-text">{alert.scholarshipTitle}</h3>
                      <p className="text-xs text-text-muted font-medium">{alert.provider}</p>
                    </div>

                    <a
                      href={alert.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-app-bg hover:bg-primary/10 hover:text-primary border border-app-text/10 text-text-muted transition-colors cursor-pointer shrink-0"
                      title="Open Official Scholarship Page"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
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
                    <div className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      <span className="text-text-muted">Via: {alert.alertChannel}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Preferences Panel */}
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

              <label className="flex items-center justify-between text-xs font-medium text-text-muted cursor-pointer">
                <span>7 Days Before</span>
                <input
                  type="checkbox"
                  checked={preferences.notify7Days}
                  onChange={() => handleTogglePref('notify7Days')}
                  className="rounded border-app-text/20 text-primary focus:ring-primary h-4 w-4"
                />
              </label>

              <label className="flex items-center justify-between text-xs font-medium text-text-muted cursor-pointer">
                <span>3 Days Before</span>
                <input
                  type="checkbox"
                  checked={preferences.notify3Days}
                  onChange={() => handleTogglePref('notify3Days')}
                  className="rounded border-app-text/20 text-primary focus:ring-primary h-4 w-4"
                />
              </label>

              <label className="flex items-center justify-between text-xs font-medium text-text-muted cursor-pointer">
                <span>24 Hours Before (Urgent)</span>
                <input
                  type="checkbox"
                  checked={preferences.notify1Day}
                  onChange={() => handleTogglePref('notify1Day')}
                  className="rounded border-app-text/20 text-primary focus:ring-primary h-4 w-4"
                />
              </label>
            </div>

            <div className="pt-3 border-t border-app-text/10 space-y-3">
              <p className="text-xs font-bold text-app-text">Channels:</p>

              <label className="flex items-center justify-between text-xs font-medium text-text-muted cursor-pointer">
                <span>Email Alerts</span>
                <input
                  type="checkbox"
                  checked={preferences.emailAlerts}
                  onChange={() => handleTogglePref('emailAlerts')}
                  className="rounded border-app-text/20 text-primary focus:ring-primary h-4 w-4"
                />
              </label>

              <label className="flex items-center justify-between text-xs font-medium text-text-muted cursor-pointer">
                <span>Push Alerts</span>
                <input
                  type="checkbox"
                  checked={preferences.pushAlerts}
                  onChange={() => handleTogglePref('pushAlerts')}
                  className="rounded border-app-text/20 text-primary focus:ring-primary h-4 w-4"
                />
              </label>
            </div>

            <div className="pt-2">
              <button 
                type="button"
                disabled={isSavingPrefs}
                onClick={handleSavePreferences}
                className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSavingPrefs && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Preferences</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default DeadlineAlerts;