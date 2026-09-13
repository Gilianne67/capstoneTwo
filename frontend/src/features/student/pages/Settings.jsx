import React, { useState, useEffect } from 'react';
import ProfileHeader from '../../../components/settings/ProfileHeader';
import SecurityForm from '../../../components/settings/SecurityForm';
import NotificationToggles from '../../../components/settings/NotificationToggles';
import { GraduationCap, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

const DEFAULT_ACADEMIC = {
  course: 'BS Information Technology',
  yearLevel: '1st Year',
  gpa: '1.25',
  region: 'Region V (Bicol Region)'
};

const DEFAULT_NOTIFICATIONS = [
  { id: '1', label: 'Email alerts for closing deadlines', enabled: true },
  { id: '2', label: 'New matching scholarship notifications', enabled: true },
  { id: '3', label: 'Application status update alerts', enabled: false }
];

export function Settings() {
  const [academicDetails, setAcademicDetails] = useState(DEFAULT_ACADEMIC);
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAcademic, setIsSavingAcademic] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Helper to safely parse JSON responses and guard against HTML/404 fallbacks
  const safeFetchJson = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    };

    const res = await fetch(url, { ...options, headers });
    const contentType = res.headers.get('content-type');

    // Prevent JSON parser crashes when dev server returns <!DOCTYPE html> 404 pages
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(`Endpoint '${url}' returned non-JSON data (${res.status}). Ensure backend route exists.`);
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `Request failed with status ${res.status}`);
    }

    return res.json();
  };

  // Fetch initial profile and settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await safeFetchJson('/api/user/settings');
        
        if (data.academicDetails) setAcademicDetails(data.academicDetails);
        if (data.notifications) setNotifications(data.notifications);
      } catch (err) {
        console.warn('Backend API connection warning:', err.message);
        // Retain default mock data so UI remains usable in dev mode
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Update notification preferences
  const handleToggle = async (id) => {
    const updated = notifications.map(item => 
      item.id === id ? { ...item, enabled: !item.enabled } : item
    );
    setNotifications(updated);

    try {
      await safeFetchJson('/api/user/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ 
          notificationId: id, 
          enabled: updated.find(i => i.id === id)?.enabled 
        })
      });
    } catch (err) {
      console.error('Failed to sync notification settings:', err.message);
    }
  };

  const handleAcademicChange = (e) => {
    setAcademicDetails(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Submit Academic Details
  const handleSaveAcademic = async (e) => {
    e.preventDefault();
    setIsSavingAcademic(true);
    setSaveSuccess(false);
    setError(null);

    try {
      await safeFetchJson('/api/user/academic-profile', {
        method: 'PUT',
        body: JSON.stringify(academicDetails)
      });
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSavingAcademic(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-primary gap-3">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="text-xs font-semibold text-text-muted">Loading student settings...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl text-xs font-bold flex items-center gap-2 border border-red-200">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Header Profile Section */}
      <ProfileHeader 
        name="Juan Dela Cruz"
        email="jdelacruz@gmail.com"
        role="student"
        subtitle={academicDetails.course || "Student"}
        badgeText="Verified Student"
        onAvatarChange={async (file) => {
          try {
            const formData = new FormData();
            formData.append('avatar', file);
            const token = localStorage.getItem('token');
            
            await fetch('/api/user/avatar', {
              method: 'POST',
              headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
              body: formData
            });
          } catch (err) {
            console.error('Failed to update avatar:', err);
          }
        }}
      />

      {/* Academic Profile Preferences Form */}
      <form onSubmit={handleSaveAcademic} className="bg-card-bg rounded-2xl border border-app-text/10 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-4 border-b border-app-text/10">
          <GraduationCap className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-sm font-extrabold text-app-text">Academic Matching Profile</h3>
            <p className="text-xs text-text-muted">Keep these updated to receive accurate scholarship matches</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-app-text mb-1.5">Course / Major</label>
            <input
              type="text"
              name="course"
              value={academicDetails.course}
              onChange={handleAcademicChange}
              placeholder="e.g. BS Computer Science"
              className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-hidden focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text mb-1.5">Year Level</label>
            <select
              name="yearLevel"
              value={academicDetails.yearLevel}
              onChange={handleAcademicChange}
              className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-hidden focus:border-primary cursor-pointer"
            >
              <option>1st Year</option>
              <option>2nd Year</option>
              <option>3rd Year</option>
              <option>4th Year</option>
              <option>Postgraduate</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text mb-1.5">Current GWA / GPA</label>
            <input
              type="text"
              name="gpa"
              value={academicDetails.gpa}
              onChange={handleAcademicChange}
              placeholder="e.g. 1.50"
              className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-hidden focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text mb-1.5">Region</label>
            <input
              type="text"
              name="region"
              value={academicDetails.region}
              onChange={handleAcademicChange}
              placeholder="e.g. Region V"
              className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-hidden focus:border-primary"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-end gap-3">
          {saveSuccess && (
            <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Saved successfully!
            </span>
          )}
          <button 
            type="submit" 
            disabled={isSavingAcademic}
            className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {isSavingAcademic && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Update Match Criteria</span>
          </button>
        </div>
      </form>

      {/* Grid of Security & Notification Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SecurityForm onSave={async (passwordData) => {
          await safeFetchJson('/api/user/security/password', {
            method: 'PUT',
            body: JSON.stringify(passwordData)
          });
        }} />
        <NotificationToggles 
          title="Student Alert Preferences"
          options={notifications}
          onChange={handleToggle}
        />
      </div>
    </div>
  );
}

export default Settings;