import React, { useState } from 'react';
import ProfileHeader from '../../../components/settings/ProfileHeader';
import SecurityForm from '../../../components/settings/SecurityForm';
import PrototypeNotice from '../components/PrototypeNotice';
import { useAuth } from '../../../context/AuthContext';
import { 
  Sliders, 
  Database, 
  Server, 
  Save, 
  RefreshCw,
  AlertCircle,
  UserPlus,
  ShieldCheck
} from 'lucide-react';

export function SystemSettings() {
  const { user } = useAuth();
  const [platformConfig, setPlatformConfig] = useState({
    maintenanceMode: false,
    studentRegistration: true,
    providerRegistration: true,
    matchingThreshold: 70,
    maxFileUploadMB: 10,
    autoApproveProviders: false
  });

  const dbStatus = {
    mongoStatus: 'Not measured',
    redisCache: 'Not connected',
    storageUsage: 'Not measured'
  };

  const [newAdmin, setNewAdmin] = useState({
    fullName: '',
    email: '',
    adminRole: 'admin'
  });

  const [notice, setNotice] = useState(null);

  const showPrototypeNotice = (event) => {
    if (event?.preventDefault) event.preventDefault();
    setNotice('This control is prototype-only. Nothing was saved to the database.');
  };

  const handleToggle = (key) => {
    setPlatformConfig(prev => ({ ...prev, [key]: !prev[key] }));
    setNotice('This change is local to the page and was not saved.');
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setPlatformConfig(prev => ({ 
      ...prev, 
      [name]: type === 'number' || type === 'range' ? Number(value) : value 
    }));
    setNotice('This change is local to the page and was not saved.');
  };

  const handleAdminInputChange = (e) => {
    const { name, value } = e.target;
    setNewAdmin(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <ProfileHeader 
        name={user?.name || 'Administrator'}
        email={user?.email || ''}
        role="admin"
        subtitle="Prototype settings. Controls on this page are not saved."
        badgeText="System Admin"
      />

      <PrototypeNotice>
        System settings, admin invitations, cache tools, and backups are not connected to the database.
      </PrototypeNotice>

      {notice && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <form onSubmit={showPrototypeNotice} className="bg-card-bg rounded-2xl border border-app-text/10 p-6 shadow-xs space-y-6">
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
            className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
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
      <form onSubmit={showPrototypeNotice} className="bg-card-bg rounded-2xl border border-app-text/10 p-6 shadow-xs space-y-4">
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
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Send Admin Invitation</span>
          </button>
        </div>
      </form>

      {/* Database Operations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SecurityForm
          passwordChangeAvailable={false}
          twoFactorAvailable={false}
          onSave={() => setNotice('Password changes are not available on this prototype screen.')}
        />
        
        <div className="bg-card-bg rounded-2xl border border-app-text/10 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-app-text/10">
            <Server className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-extrabold text-app-text">Database & System Health</h3>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-app-bg rounded-xl border border-app-text/10 flex items-center justify-between text-xs">
              <span className="font-semibold text-app-text">MongoDB Database</span>
              <span className="font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                {dbStatus.mongoStatus}
              </span>
            </div>

            <div className="p-3 bg-app-bg rounded-xl border border-app-text/10 flex items-center justify-between text-xs">
              <span className="font-semibold text-app-text">Redis Match Cache</span>
              <span className="font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
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
              onClick={showPrototypeNotice}
              className="flex-1 py-2 bg-app-bg hover:bg-app-text/5 text-app-text border border-app-text/10 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-text-muted" />
              <span>Purge Cache</span>
            </button>
            <button
              type="button"
              onClick={showPrototypeNotice}
              className="flex-1 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Trigger Backup</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SystemSettings;