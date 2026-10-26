import React, { useState, useEffect } from 'react';
import ProfileHeader from '../../../components/settings/ProfileHeader';
import SecurityForm from '../../../components/settings/SecurityForm';
import { useAuth } from '../../../context/AuthContext';
import axios from 'axios';
import { 
  Sliders, 
  Save, 
  AlertCircle,
  CheckCircle2,
  UserPlus,
  ShieldCheck,
  KeyRound
} from 'lucide-react';

export function SystemSettings() {
  const { user } = useAuth();
  
  const [platformConfig, setPlatformConfig] = useState({
    maintenanceMode: false,
    autoApproveProviders: false
  });

  const [newAdmin, setNewAdmin] = useState({
    fullName: '',
    email: '',
    adminRole: 'admin'
  });

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // 🔄 Fetch current system configuration on load
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await axios.get('/api/v1/admin/config', { withCredentials: true });
        if (res.data?.data) {
          setPlatformConfig({
            maintenanceMode: res.data.data.maintenanceMode || false,
            autoApproveProviders: res.data.data.autoApproveProviders || false
          });
        }
      } catch (err) {
        console.warn('Could not load system config:', err.response?.data?.message);
      }
    };
    fetchConfig();
  }, []);

  const handleToggle = (key) => {
    setPlatformConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAdminInputChange = (e) => {
    const { name, value } = e.target;
    setNewAdmin(prev => ({ ...prev, [name]: value }));
  };

  // 💾 Save configuration changes to backend
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback({ type: '', message: '' });

    try {
      const res = await axios.put('/api/v1/admin/config', platformConfig, { withCredentials: true });
      setLoading(false);
      setFeedback({ type: 'success', message: res.data.message || 'System configuration saved successfully.' });
    } catch (err) {
      setLoading(false);
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to update system configuration.' });
    }
  };

  // 🛡️ Provision / Invite New Admin
  const handleInviteAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback({ type: '', message: '' });

    try {
      const res = await axios.post('/api/v1/admin/invite', newAdmin, { withCredentials: true });
      setLoading(false);
      setFeedback({ 
        type: 'success', 
        message: `Admin account created! Temporary password: ${res.data.data?.tempPassword}` 
      });
      setNewAdmin({ fullName: '', email: '', adminRole: 'admin' });
    } catch (err) {
      setLoading(false);
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to send admin invitation.' });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <ProfileHeader 
        name={user?.name || 'Administrator'}
        email={user?.email || ''}
        role="admin"
        subtitle="Manage global runtime policies, security credentials, and administrative provisioning."
        badgeText="System Admin"
      />

      {feedback.message && (
        <div className={`p-4 border text-xs font-bold rounded-2xl flex items-center gap-2 ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : 'bg-red-50 border-red-200 text-red-900'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Global Platform Controls */}
      <form onSubmit={handleSaveConfig} className="bg-card-bg rounded-2xl border border-app-text/10 p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-app-text/10">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-primary" />
            <div>
              <h3 className="text-sm font-extrabold text-app-text">Global Operational Policies</h3>
              <p className="text-xs text-text-muted">Control system availability and provider verification rules</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{loading ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center justify-between p-4 bg-app-bg rounded-xl border border-app-text/10 cursor-pointer">
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

          <label className="flex items-center justify-between p-4 bg-app-bg rounded-xl border border-app-text/10 cursor-pointer">
            <div>
              <p className="text-xs font-bold text-app-text">Auto-Approve Providers</p>
              <p className="text-[11px] text-text-muted">Bypass manual admin verification for new organizations</p>
            </div>
            <input
              type="checkbox"
              checked={platformConfig.autoApproveProviders}
              onChange={() => handleToggle('autoApproveProviders')}
              className="rounded border-app-text/20 text-primary focus:ring-primary h-4 w-4"
            />
          </label>
        </div>
      </form>

      {/* Admin Account Security & Password Form */}
      <div className="bg-card-bg rounded-2xl border border-app-text/10 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-app-text/10">
          <KeyRound className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-sm font-extrabold text-app-text">Admin Security Credentials</h3>
            <p className="text-xs text-text-muted">Update your administrative password and account security settings</p>
          </div>
        </div>

        <SecurityForm
          passwordChangeAvailable={true}
          twoFactorAvailable={false}
          onSave={() => setFeedback({ type: 'success', message: 'Admin security password successfully updated.' })}
        />
      </div>

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
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Send Admin Invitation</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default SystemSettings;