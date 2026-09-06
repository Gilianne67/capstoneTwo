import React, { useState } from 'react';
import ProfileHeader from '../../../components/settings/ProfileHeader';
import SecurityForm from '../../../components/settings/SecurityForm';
import NotificationToggles from '../../../components/settings/NotificationToggles';
import { Building2, Globe, ShieldCheck, Mail, Phone, Award } from 'lucide-react';

export function ProviderSettings() {
  const [orgDetails, setOrgDetails] = useState({
    orgName: 'Department of Science and Technology (DOST)',
    website: 'https://official.dost.gov.ph',
    contactEmail: 'grants@dost.gov.ph',
    contactPhone: '+63 (02) 8837-2071',
    orgType: 'Government Agency',
    fundingDomains: 'STEM, Research, Engineering'
  });

  const [notifications, setNotifications] = useState([
    { 
      id: 'app_submissions', 
      label: 'New Application Submitted', 
      description: 'Get notified via email immediately when a student submits a new application.', 
      enabled: true 
    },
    { 
      id: 'deadline_reminders', 
      label: 'Grant Closing Reminders', 
      description: 'Receive notifications 48 hours before your listed scholarships expire.', 
      enabled: true 
    },
    { 
      id: 'weekly_analytics', 
      label: 'Weekly Applicant Analytics', 
      description: 'A summary report of views, bookmark rates, and applicant demographics sent every Monday.', 
      enabled: false 
    }
  ]);

  const handleToggle = (id) => {
    setNotifications(prev => 
      prev.map(item => item.id === id ? { ...item, enabled: !item.enabled } : item)
    );
  };

  const handleOrgChange = (e) => {
    setOrgDetails({ ...orgDetails, [e.target.name]: e.target.value });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header Profile Section */}
      <ProfileHeader 
        name="DOST Scholarship Secretariat"
        email="grants@dost.gov.ph"
        role="provider"
        subtitle="Verified Grant Provider • Government Agency"
        badgeText="Verified Institution"
        onAvatarChange={() => alert("Organization logo update modal opened")}
      />

      {/* Organization Details Form */}
      <div className="bg-card-bg rounded-2xl border border-app-text/10 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-app-text/10">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <div>
              <h3 className="text-sm font-extrabold text-app-text">Organization Profile</h3>
              <p className="text-xs text-text-muted">Information displayed on your public grant listings</p>
            </div>
          </div>
          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            Verified Status
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-app-text mb-1.5">Organization Name</label>
            <input
              type="text"
              name="orgName"
              value={orgDetails.orgName}
              onChange={handleOrgChange}
              className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-hidden focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text mb-1.5">Organization Type</label>
            <select
              name="orgType"
              value={orgDetails.orgType}
              onChange={handleOrgChange}
              className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-hidden focus:border-primary cursor-pointer"
            >
              <option>Government Agency</option>
              <option>Private Foundation</option>
              <option>Higher Education Institution</option>
              <option>Corporate CSR</option>
              <option>NGO / Non-Profit</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text mb-1.5">Official Website</label>
            <div className="relative">
              <Globe className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="url"
                name="website"
                value={orgDetails.website}
                onChange={handleOrgChange}
                className="w-full pl-9 pr-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-hidden focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text mb-1.5">Primary Funding Focus</label>
            <div className="relative">
              <Award className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                name="fundingDomains"
                value={orgDetails.fundingDomains}
                onChange={handleOrgChange}
                placeholder="e.g. STEM, Medical, Arts"
                className="w-full pl-9 pr-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-hidden focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text mb-1.5">Public Inquiry Email</label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="email"
                name="contactEmail"
                value={orgDetails.contactEmail}
                onChange={handleOrgChange}
                className="w-full pl-9 pr-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-hidden focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text mb-1.5">Contact Hotline</label>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                name="contactPhone"
                value={orgDetails.contactPhone}
                onChange={handleOrgChange}
                className="w-full pl-9 pr-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-hidden focus:border-primary"
              />
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button 
            type="button" 
            className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Save Organization Details
          </button>
        </div>
      </div>

      {/* Security & Notification Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SecurityForm onSave={(data) => console.log('Provider security updated:', data)} />
        <NotificationToggles 
          title="Provider Dispatch Preferences"
          options={notifications}
          onChange={handleToggle}
        />
      </div>
    </div>
  );
}

export default ProviderSettings;