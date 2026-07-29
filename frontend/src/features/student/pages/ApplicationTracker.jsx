import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileText,
  Building2,
  Trash2,
  X,
  Loader2
} from 'lucide-react';

import PageHeader from '../../../components/common/PageHeader';

// Mock Seed Data (Fallback Data for Testing & Offline API)
const MOCK_APPLICATIONS = [
  {
    _id: 'app-1',
    grantTitle: 'DOST-SEI Undergraduate Science Scholarship',
    provider: 'Department of Science and Technology',
    portalUrl: 'https://sei.dost.gov.ph',
    status: 'Submitted',
    dateApplied: '2026-07-10',
    nextMilestone: 'Exam Schedule Release (Aug 2026)',
    checklist: [
      { label: 'Form 137 Transcript', completed: true },
      { label: 'Barangay Indigency Clearance', completed: true },
      { label: 'Principal Recommendation Letter', completed: true },
      { label: 'Online Application Form', completed: true }
    ]
  },
  {
    _id: 'app-2',
    grantTitle: 'DA-ACE Agricultural Grant 2026',
    provider: 'Department of Agriculture',
    portalUrl: 'https://da.gov.ph',
    status: 'In Progress',
    dateApplied: 'Pending Submission',
    nextMilestone: 'Submit Certified Farm Ownership Form by Aug 15',
    checklist: [
      { label: 'DA RSBSA Registration Copy', completed: true },
      { label: 'GWA Certification (1.45)', completed: true },
      { label: 'Local Municipal Endorsement', completed: false }
    ]
  }
];

export default function ApplicationTracker() {
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newProvider, setNewProvider] = useState('');
  const [newUrl, setNewUrl] = useState('');

  // 1. Fetch Applications from Backend API with Fallback
  useEffect(() => {
    let isMounted = true;

    const fetchApplications = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const response = await fetch('/api/v1/applications', { headers });

        if (response.ok) {
          const data = await response.json();
          const list = Array.isArray(data) ? data : (data.applications || []);
          if (isMounted) {
            setApplications(list.length > 0 ? list : MOCK_APPLICATIONS);
            setIsUsingFallback(list.length === 0);
          }
        } else {
          throw new Error('Failed to fetch application trackers');
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Backend connection offline, using mock application tracker feed:', err);
          setApplications(MOCK_APPLICATIONS);
          setIsUsingFallback(true);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchApplications();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Add New Application (POST Request)
  const handleAddApplication = async (e) => {
    e.preventDefault();
    if (!newTitle || !newProvider) return;

    const newAppPayload = {
      grantTitle: newTitle,
      provider: newProvider,
      portalUrl: newUrl || '#',
      status: 'Preparing',
      dateApplied: 'Not Yet Submitted',
      nextMilestone: 'Gathering Documents',
      checklist: [
        { label: 'Review Eligibility Criteria', completed: true },
        { label: 'Prepare Academic Records', completed: false }
      ]
    };

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
      };

      const res = await fetch('/api/v1/applications', {
        method: 'POST',
        headers,
        body: JSON.stringify(newAppPayload)
      });

      if (res.ok) {
        const savedApp = await res.json();
        setApplications(prev => [savedApp, ...prev]);
      } else {
        throw new Error('API save failed');
      }
    } catch (err) {
      console.warn('Using local fallback for creation:', err);
      const fallbackApp = {
        _id: `app-${Date.now()}`,
        ...newAppPayload
      };
      setApplications(prev => [fallbackApp, ...prev]);
    } finally {
      setIsSubmitting(false);
      setNewTitle('');
      setNewProvider('');
      setNewUrl('');
      setIsModalOpen(false);
    }
  };

  // 3. Toggle Checklist Item Completion (PATCH Sync)
  const toggleChecklistItem = async (appId, index) => {
    let updatedChecklist = [];

    setApplications(prev => prev.map(app => {
      const currentId = app._id || app.id;
      if (currentId !== appId) return app;
      
      updatedChecklist = app.checklist.map((item, idx) => 
        idx === index ? { ...item, completed: !item.completed } : item
      );
      return { ...app, checklist: updatedChecklist };
    }));

    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch(`/api/v1/applications/${appId}/checklist`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ checklist: updatedChecklist })
        });
      }
    } catch (err) {
      console.error('Failed to sync checklist update with backend:', err);
    }
  };

  // 4. Delete Tracker (DELETE Request)
  const deleteTracker = async (id) => {
    const previousApps = [...applications];
    setApplications(prev => prev.filter(a => (a._id || a.id) !== id));

    try {
      const token = localStorage.getItem('token');
      if (token) {
        const res = await fetch(`/api/v1/applications/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Deletion failed on server');
      }
    } catch (err) {
      console.error('Failed to delete tracker on backend:', err);
      setApplications(previousApps); // Revert on failure
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Submitted':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Submitted</span>;
      case 'In Progress':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 flex items-center gap-1"><Clock className="w-3 h-3" /> In Progress</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 flex items-center gap-1"><FileText className="w-3 h-3" /> Preparing</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <PageHeader 
          title="Off-Site Application Tracker" 
          subtitle="Keep personal notes, document checklists, and track your off-site agency application progress in one place."
        />
        <div className="min-h-[250px] flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200/80 p-6">
          <Loader2 className="h-7 w-7 text-blue-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading your tracked applications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader 
          title="Off-Site Application Tracker" 
          subtitle="Keep personal notes, document checklists, and track your off-site agency application progress in one place."
        />
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 self-start sm:self-auto cursor-pointer transition-colors"
        >
          <Plus className="w-4 h-4" /> Track New Application
        </button>
      </div>

      {/* Fallback Warning Banner */}
      {isUsingFallback && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 p-3 rounded-xl flex items-center justify-between text-xs font-medium">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            Backend API offline/unreachable. Displaying local application trackers for preview.
          </span>
        </div>
      )}

      {applications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <FileText className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">No applications being tracked</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Start tracking your government, local, or university scholarship applications to keep checklists and deadlines organized.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
            const id = app._id || app.id;

            return (
              <div key={id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(app.status)}
                      <span className="text-[11px] font-bold text-slate-400">Applied: {app.dateApplied}</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{app.grantTitle}</h3>
                    <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" /> {app.provider}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {app.portalUrl && app.portalUrl !== '#' && (
                      <a
                        href={app.portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                      >
                        Provider Portal <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteTracker(id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Remove Tracker"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Checklist & Next Milestone Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  
                  {/* Checklist Column */}
                  <div className="md:col-span-2 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Required Documents & Tasks</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {app.checklist?.map((item, idx) => (
                        <label 
                          key={idx}
                          className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                            item.completed ? 'bg-slate-50 border-slate-200 text-slate-500 line-through' : 'bg-white border-slate-200 text-slate-800'
                          }`}
                        >
                          <input 
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => toggleChecklistItem(id, idx)}
                            className="w-3.5 h-3.5 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500"
                          />
                          <span className="truncate">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Milestone Box */}
                  <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100/80 space-y-1">
                    <span className="text-[10px] font-extrabold text-blue-900 uppercase tracking-wider block">Next Milestone / Note</span>
                    <p className="text-xs font-bold text-blue-950 leading-relaxed">{app.nextMilestone || 'No pending milestones'}</p>
                  </div>

                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ADD TRACKER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Track New Off-Site Grant</h3>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddApplication} className="space-y-3 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 mb-1">Scholarship Title *</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. CHED Merit Scholarship"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Agency / Provider *</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. CHED Region V"
                  value={newProvider}
                  onChange={e => setNewProvider(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Official Website URL (Optional)</label>
                <input 
                  type="url"
                  placeholder="https://ched.gov.ph"
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmitting ? 'Saving...' : 'Add Tracker'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}