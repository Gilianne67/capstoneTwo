import React, { useState, useEffect } from 'react';
import ProfileHeader from '../../../components/settings/ProfileHeader';
import SecurityForm from '../../../components/settings/SecurityForm';
import { 
  Sliders, 
  Database, 
  Server, 
  Save, 
  CheckCircle2,
  RefreshCw,
  Loader2,
  AlertCircle,
  UserPlus,
  Mail,
  ShieldCheck
} from 'lucide-react';

export function SystemSettings() {
  const [platformConfig, setPlatformConfig] = useState({
    maintenanceMode: false,
    studentRegistration: true,
    providerRegistration: true,
    matchingThreshold: 70,
    maxFileUploadMB: 10,
    autoApproveProviders: false
  });

  const [dbStatus, setDbStatus] = useState({
    mongoStatus: 'Connected',
    redisCache: 'Active (99.8%)',
    storageUsage: '41.2 GB / 500 GB'
  });

  // New Admin Provisioning Form State
  const [newAdmin, setNewAdmin] = useState({
    fullName: '',
    email: '',
    adminRole: 'admin' // 'admin' or 'super_admin'
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isInvitingAdmin, setIsInvitingAdmin] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  
  const [saved, setSaved] = useState(false);
  const [adminInviteSuccess, setAdminInviteSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await fetch('/api/v1/admin/settings', { headers });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setPlatformConfig(data.config || data);
            if (data.dbStatus) setDbStatus(data.dbStatus);
          }
        }
      } catch (err) {
        console.warn('Backend offline. Using local settings state:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchSettings();
    return () => { isMounted = false; };
  }, []);

  const handleToggle = (key) => {
    setPlatformConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setPlatformConfig(prev => ({ 
      ...prev, 
      [name]: type === 'number' || type === 'range' ? Number(value) : value 
    }));
  };

  const handleAdminInputChange = (e) => {
    const { name, value } = e.target;
    setNewAdmin(prev => ({ ...prev, [name]: value }));
  };

  // Save Settings to MongoDB
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify(platformConfig)
      });

      if (!res.ok) throw new Error('Failed to update system configuration');

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Provision New Admin User Endpoint Trigger
  const handleInviteAdmin = async (e) => {
    e.preventDefault();
    setIsInvitingAdmin(true);
    setErrorMessage(null);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/admin/users/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify(newAdmin)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to send admin invitation');
      }

      setAdminInviteSuccess(true);
      setNewAdmin({ fullName: '', email: '', adminRole: 'admin' });
      setTimeout(() => setAdminInviteSuccess(false), 4000);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsInvitingAdmin(false);
    }
  };

  const handlePurgeCache = async () => {
    setIsPurging(true);
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/v1/admin/system/purge-cache', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      alert('Redis match cache purged successfully.');
    } catch (err) {
      alert('Failed to purge cache.');
    } finally {
      setIsPurging(false);
    }
  };

  const handleTriggerBackup = async () => {
    setIsBackingUp(true);
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/v1/admin/system/backup', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      alert('MongoDB database backup job queued successfully.');
    } catch (err) {
      alert('Failed to trigger database backup.');
    } finally {
      setIsBackingUp(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto min-h-[400px] flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200 p-6">
        <Loader2 className="h-7 w-7 text-emerald-600 animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Loading system configuration...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <ProfileHeader 
        name="System Administrator"
        email="admin@iskolarmatch.ph"
        role="admin"
        subtitle="Super Admin Level Access • Root Authority"
        badgeText="System Admin"
      />

      {saved && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-2xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>System configuration parameters saved to MongoDB successfully.</span>
        </div>
      )}

      {adminInviteSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-2xl flex items-center gap-2">
          <Mail className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Admin account invitation email sent successfully with registration token.</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Global Platform Controls */}
      <form onSubmit={handleSaveConfig} className="bg-card-bg rounded-2xl border border-app-text/10 p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-app-text/10">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-primary" />
            <div>
              <h3 className="text-sm font-extrabold text-app-text">Global Platform Controls</h3>
              <p className="text-xs text-text-muted">Manage system runtime policies and feature flags</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save System Config</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-app-text border-b border-app-text/5 pb-2">
              Access & Maintenance
            </h4>

            <label className="flex items-center justify-between p-3 bg-app-bg rounded-xl border border-app-text/10 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-app-text">Maintenance Mode</p>
                <p className="text-[11px] text-text-muted">Disable public access for scheduled updates</p>
              </div>
              <input
                type="checkbox"
                checked={platformConfig.maintenanceMode}
                onChange={() => handleToggle('maintenanceMode')}
                className="rounded border-app-text/20 text-primary focus:ring-primary h-4 w-4"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-app-bg rounded-xl border border-app-text/10 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-app-text">Student Registration</p>
                <p className="text-[11px] text-text-muted">Allow new student accounts to sign up</p>
              </div>
              <input
                type="checkbox"
                checked={platformConfig.studentRegistration}
                onChange={() => handleToggle('studentRegistration')}
                className="rounded border-app-text/20 text-primary focus:ring-primary h-4 w-4"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-app-bg rounded-xl border border-app-text/10 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-app-text">Provider Registration</p>
                <p className="text-[11px] text-text-muted">Allow new organizations to request accounts</p>
              </div>
              <input
                type="checkbox"
                checked={platformConfig.providerRegistration}
                onChange={() => handleToggle('providerRegistration')}
                className="rounded border-app-text/20 text-primary focus:ring-primary h-4 w-4"
              />
            </label>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-app-text border-b border-app-text/5 pb-2">
              Engine Thresholds & Storage
            </h4>

            <div>
              <label className="block text-xs font-bold text-app-text mb-1">
                Matching Algorithm Threshold ({platformConfig.matchingThreshold}%)
              </label>
              <input
                type="range"
                min="50"
                max="95"
                step="5"
                name="matchingThreshold"
                value={platformConfig.matchingThreshold}
                onChange={handleChange}
                className="w-full accent-primary cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-app-text mb-1">Max Document Attachment (MB)</label>
              <input
                type="number"
                name="maxFileUploadMB"
                value={platformConfig.maxFileUploadMB}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-hidden focus:border-primary"
              />
            </div>

            <label className="flex items-center justify-between p-3 bg-app-bg rounded-xl border border-app-text/10 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-app-text">Auto-Approve Providers</p>
                <p className="text-[11px] text-text-muted">Bypass manual admin verification step</p>
              </div>
              <input
                type="checkbox"
                checked={platformConfig.autoApproveProviders}
                onChange={() => handleToggle('autoApproveProviders')}
                className="rounded border-app-text/20 text-primary focus:ring-primary h-4 w-4"
              />
            </label>
          </div>
        </div>
      </form>

      {/* Admin Account Provisioning Panel */}
      <form onSubmit={handleInviteAdmin} className="bg-card-bg rounded-2xl border border-app-text/10 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-app-text/10">
          <UserPlus className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-sm font-extrabold text-app-text">Provision New Admin Account</h3>
            <p className="text-xs text-text-muted">Grant administrative control to trusted staff members</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-app-text mb-1">Full Name</label>
            <input
              type="text"
              name="fullName"
              required
              placeholder="e.g. Maria Santos"
              value={newAdmin.fullName}
              onChange={handleAdminInputChange}
              className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-hidden focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text mb-1">Official Email Address</label>
            <input
              type="email"
              name="email"
              required
              placeholder="admin.name@iskolarmatch.ph"
              value={newAdmin.email}
              onChange={handleAdminInputChange}
              className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-hidden focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text mb-1">Role Permission Level</label>
            <select
              name="adminRole"
              value={newAdmin.adminRole}
              onChange={handleAdminInputChange}
              className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-hidden focus:border-primary cursor-pointer"
            >
              <option value="admin">System Admin (Standard)</option>
              <option value="super_admin">Super Admin (Root Authority)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isInvitingAdmin}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            {isInvitingAdmin ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
            <span>Send Admin Invitation</span>
          </button>
        </div>
      </form>

      {/* Database Operations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SecurityForm onSave={(data) => console.log('Admin password updated:', data)} />
        
        <div className="bg-card-bg rounded-2xl border border-app-text/10 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-app-text/10">
            <Server className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-extrabold text-app-text">Database & System Health</h3>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-app-bg rounded-xl border border-app-text/10 flex items-center justify-between text-xs">
              <span className="font-semibold text-app-text">MongoDB Database</span>
              <span className="font-black text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                {dbStatus.mongoStatus}
              </span>
            </div>

            <div className="p-3 bg-app-bg rounded-xl border border-app-text/10 flex items-center justify-between text-xs">
              <span className="font-semibold text-app-text">Redis Match Cache</span>
              <span className="font-black text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                {dbStatus.redisCache}
              </span>
            </div>

            <div className="p-3 bg-app-bg rounded-xl border border-app-text/10 flex items-center justify-between text-xs">
              <span className="font-semibold text-app-text">Storage Bucket Usage</span>
              <span className="font-bold text-text-muted">{dbStatus.storageUsage}</span>
            </div>
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              disabled={isPurging}
              onClick={handlePurgeCache}
              className="flex-1 py-2 bg-app-bg hover:bg-app-text/5 text-app-text border border-app-text/10 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isPurging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 text-text-muted" />}
              <span>Purge Cache</span>
            </button>
            <button
              type="button"
              disabled={isBackingUp}
              onClick={handleTriggerBackup}
              className="flex-1 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isBackingUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
              <span>Trigger Backup</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SystemSettings;