import React, { useState, useEffect, useRef } from 'react';
import ProfileHeader from '../../../components/settings/ProfileHeader';
import SecurityForm from '../../../components/settings/SecurityForm';
import { presentPasswordUpdateResult } from '../../../components/settings/passwordUpdateMessage';
import {
  createInvitationSubmitGuard,
  invitationFormAfterResponse,
  readStoredAuthorizationHeaders,
} from '../adminInvitation';
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

const authHeader = () => readStoredAuthorizationHeaders(
  typeof localStorage !== 'undefined' ? localStorage : null
);

const apiErrorMessage = (err, fallback) =>
  err.response?.data?.message || err.response?.data?.error || fallback;

export function SystemSettings() {
  const { user, replaceSession } = useAuth();
  const callerIsSuperAdmin = ['superadmin', 'super_admin', 'super-admin'].includes(
    String(user?.role || '').toLowerCase()
  );
  
  const [platformConfig, setPlatformConfig] = useState({
    maintenanceMode: false,
  });

  const [newAdmin, setNewAdmin] = useState({
    fullName: '',
    email: '',
    adminRole: 'admin'
  });

  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const invitationSubmit = useRef(createInvitationSubmitGuard());
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // 🔄 Fetch current system configuration on load
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await axios.get('/api/v1/admin/config', {
          withCredentials: true,
          headers: authHeader(),
        });
        if (res.data?.data) {
          setPlatformConfig({
            maintenanceMode: res.data.data.maintenanceMode || false,
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
      const res = await axios.put('/api/v1/admin/config', platformConfig, {
        withCredentials: true,
        headers: authHeader(),
      });
      setLoading(false);
      setFeedback({ type: 'success', message: res.data.message || 'System configuration saved successfully.' });
    } catch (err) {
      setLoading(false);
      setFeedback({ type: 'error', message: apiErrorMessage(err, 'Failed to update system configuration.') });
    }
  };

  // 🛡️ Provision / Invite New Admin
  const handleInviteAdmin = async (e) => {
    e.preventDefault();
    if (!invitationSubmit.current.begin()) return;
    setInviting(true);
    setFeedback({ type: '', message: '' });

    try {
      const res = await axios.post('/api/v1/admin/invite', newAdmin, {
        withCredentials: true,
        headers: authHeader(),
      });
      setFeedback({
        type: 'success',
        message: res.data.message || `An invitation link was emailed to ${newAdmin.email}.`,
      });
      setNewAdmin(invitationFormAfterResponse(newAdmin, true));
    } catch (err) {
      setFeedback({ type: 'error', message: apiErrorMessage(err, 'Failed to send admin invitation.') });
      setNewAdmin(invitationFormAfterResponse(newAdmin, false));
    } finally {
      invitationSubmit.current.end();
      setInviting(false);
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
              <p className="text-xs text-text-muted">Control whether students and providers can use the app</p>
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

        <label className="flex items-center justify-between gap-4 p-4 bg-app-bg rounded-xl border border-app-text/10 cursor-pointer">
          <div>
            <p className="text-xs font-bold text-app-text">Maintenance Mode</p>
            <p className="text-[11px] text-text-muted">When enabled, students and providers cannot use the app. Administrators can still sign in and turn this off.</p>
          </div>
          <input
            type="checkbox"
            checked={platformConfig.maintenanceMode}
            onChange={() => handleToggle('maintenanceMode')}
            className="rounded border-app-text/20 text-primary focus:ring-primary h-4 w-4 shrink-0"
          />
        </label>
      </form>

      {/* Admin Account Security & Password Form */}
      <div className="bg-card-bg rounded-2xl border border-app-text/10 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-app-text/10">
          <KeyRound className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-sm font-extrabold text-app-text">Admin Security Credentials</h3>
            <p className="text-xs text-text-muted">Password for this administrator account</p>
          </div>
        </div>

        <SecurityForm
          passwordChangeAvailable={true}
          onSave={async ({ passwords }) => {
            try {
              const res = await axios.put('/api/v1/auth/updatepassword', {
                currentPassword: passwords.currentPassword,
                newPassword: passwords.newPassword,
              }, {
                withCredentials: true,
                headers: authHeader(),
              });
              if (res.data?.token && replaceSession) replaceSession(res.data.token);
              return presentPasswordUpdateResult({ httpStatus: res.status, data: res.data });
            } catch (err) {
              if (err.response?.data?.token && replaceSession) {
                replaceSession(err.response.data.token);
              }
              const presented = presentPasswordUpdateResult({
                httpStatus: err.response?.status,
                data: err.response?.data,
                thrownMessage: apiErrorMessage(err, 'Your password could not be updated. Please try again.'),
              });
              if (presented.type === 'error') throw new Error(presented.text);
              return presented;
            }
          }}
        />
      </div>

      {/* Admin Account Provisioning Panel */}
      <form onSubmit={handleInviteAdmin} className="bg-card-bg rounded-2xl border border-app-text/10 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-app-text/10">
          <UserPlus className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-sm font-extrabold text-app-text">Provision New Admin Account</h3>
            <p className="text-xs text-text-muted">Email a one-time link so the new administrator can choose a password</p>
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
              {callerIsSuperAdmin && (
                <option value="superadmin">Super Admin (Root Authority)</option>
              )}
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={inviting}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{inviting ? 'Sending...' : 'Send Admin Invitation'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default SystemSettings;