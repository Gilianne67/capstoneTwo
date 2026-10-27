import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  HelpCircle,
  Search,
  ChevronDown,
  FileText,
  User,
  Award,
  Bookmark,
  Bell,
  PlusCircle,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Mail
} from 'lucide-react';
import { API_BASE_URL } from '../../config/api';

const ROUTES = {
  profile: '/dashboard/student/profile',
  matches: '/dashboard/student/matches',
  search: '/dashboard/student/search',
  saved: '/dashboard/student/saved',
  alerts: '/dashboard/student/notifications'
};

const QUICK_LINKS = [
  { label: 'Student Profile', to: ROUTES.profile, icon: User, hint: 'Update matching information' },
  { label: 'Matched Feed', to: ROUTES.matches, icon: Award, hint: 'See ranked scholarship matches' },
  { label: 'Scholarship Search', to: ROUTES.search, icon: Search, hint: 'Browse and filter listings' },
  { label: 'Saved Scholarships', to: ROUTES.saved, icon: Bookmark, hint: 'Review bookmarked grants' },
  { label: 'Deadline Alerts', to: ROUTES.alerts, icon: Bell, hint: 'Track upcoming due dates' }
];

export default function HelpCenter({ role = 'student', isAdmin = false }) {
  const [faqs, setFaqs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaq, setOpenFaq] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [toast, setToast] = useState(null);

  // Admin CRUD Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newFaq, setNewFaq] = useState({
    targetRole: role === 'admin' ? 'all' : role,
    category: '',
    question: '',
    answer: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const getAuthHeaders = () => {
    const rawToken = localStorage.getItem('token');
    const token = rawToken ? rawToken.replace(/^"|"$/g, '').replace(/^Bearer\s+/i, '').trim() : null;
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };
  };

  const fetchFAQs = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/faqs?role=${role}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to fetch help articles.');
      const data = await res.json();
      const list = Array.isArray(data.faqs) ? data.faqs : (Array.isArray(data) ? data : []);
      setFaqs(list);
    } catch (err) {
      console.error('Fetch FAQs Error:', err);
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFAQs();
  }, [role]);

const handleCreateFAQ = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Updated endpoint from /admin/faqs to /faqs
      const res = await fetch(`${API_BASE_URL}/faqs`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newFaq)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create FAQ article.');

      showToast('FAQ article created successfully!', 'success');
      setIsModalOpen(false);
      setNewFaq({ targetRole: role === 'admin' ? 'all' : role, category: '', question: '', answer: '' });
      fetchFAQs();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFAQ = async (id) => {
    if (!window.confirm('Are you sure you want to delete this FAQ article?')) return;
    try {
      // Updated endpoint from /admin/faqs/:id to /faqs/:id
      const res = await fetch(`${API_BASE_URL}/faqs/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to delete FAQ article.');

      showToast('FAQ article deleted.', 'success');
      fetchFAQs();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
  
  const query = searchQuery.trim().toLowerCase();

  const groupedFaqs = useMemo(() => {
    const map = {};
    faqs.forEach((faq) => {
      const cat = faq.category || 'General';
      if (!map[cat]) map[cat] = [];
      if (
        !query ||
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query) ||
        cat.toLowerCase().includes(query)
      ) {
        map[cat].push(faq);
      }
    });

    return Object.keys(map)
      .map((category) => ({ category, items: map[category] }))
      .filter((group) => group.items.length > 0);
  }, [faqs, query]);

  const hasMatches = groupedFaqs.length > 0;

  const toggleFaq = (id) => {
    setOpenFaq((current) => (current === id ? null : id));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 relative">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 text-white rounded-xl shadow-xl text-xs font-semibold animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-card-bg rounded-2xl border border-app-text/10 p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-app-text capitalize">{role} Help Center</h1>
              <p className="text-xs text-text-muted font-medium">
                Find instant answers, documentation, and operational guides.
              </p>
            </div>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all cursor-pointer shadow-xs"
            >
              <PlusCircle className="w-4 h-4" /> Add FAQ Article
            </button>
          )}
        </div>

        <div className="relative pt-2">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search help topics, matching, or guides..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold focus:outline-hidden focus:border-primary text-app-text"
          />
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className={`grid grid-cols-1 ${role === 'student' ? 'lg:grid-cols-3' : 'grid-cols-1'} gap-6`}>
        <div className={role === 'student' ? 'lg:col-span-2 space-y-4' : 'space-y-4'}>
          <h2 className="text-sm font-extrabold text-app-text flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Frequently Asked Questions
          </h2>

          {isLoading ? (
            <div className="min-h-[220px] flex flex-col items-center justify-center gap-2 bg-card-bg rounded-2xl border border-app-text/10 shadow-xs">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <p className="text-xs text-text-muted font-semibold">Loading help articles...</p>
            </div>
          ) : !hasMatches ? (
            <div className="bg-card-bg rounded-2xl border border-app-text/10 p-6 text-center text-xs text-text-muted">
              No help articles matching your search.
            </div>
          ) : (
            groupedFaqs.map((group) => (
              <div key={group.category} className="space-y-3">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-primary pt-1">
                  {group.category}
                </h3>

                {group.items.map((faq) => {
                  const faqId = faq._id || faq.id;
                  const isOpen = openFaq === faqId;

                  return (
                    <div
                      key={faqId}
                      className="bg-card-bg rounded-2xl border border-app-text/10 overflow-hidden shadow-xs transition-colors"
                    >
                      <div className="flex items-center justify-between p-4 hover:bg-app-bg/50 transition-colors">
                        <button
                          type="button"
                          onClick={() => toggleFaq(faqId)}
                          className="flex-1 text-left flex items-center justify-between gap-3 text-xs font-bold text-app-text cursor-pointer bg-transparent border-0"
                        >
                          <span>{faq.question}</span>
                          <ChevronDown className={`w-4 h-4 text-text-muted shrink-0 transition-transform ${isOpen ? 'rotate-180 text-primary' : ''}`} />
                        </button>

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDeleteFAQ(faqId)}
                            title="Delete FAQ"
                            className="ml-3 p-1.5 text-text-muted hover:text-rose-600 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {isOpen && (
                        <div className="px-4 pb-4 text-xs text-text-muted font-medium border-t border-app-text/5 pt-3 leading-relaxed space-y-3">
                          <p>{faq.answer}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {role === 'student' && (
          <div className="space-y-4">
            <h2 className="text-sm font-extrabold text-app-text flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-primary" />
              Quick Links
            </h2>

            <div className="bg-card-bg rounded-2xl border border-app-text/10 p-5 shadow-xs space-y-3">
              {QUICK_LINKS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-center gap-3 p-3 bg-app-bg rounded-xl border border-app-text/10 hover:border-primary/30 transition-colors"
                  >
                    <span className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span>
                      <span className="block text-xs font-bold text-app-text">{item.label}</span>
                      <span className="block text-[11px] text-text-muted">{item.hint}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Support Contact Card (Student and Provider only) */}
      {(role === 'student' || role === 'provider') && (
        <div className="bg-card-bg rounded-2xl border border-app-text/10 p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-xs font-black text-app-text">Still have questions?</h3>
            <p className="text-[11px] text-text-muted font-medium max-w-md">
              Can’t find what you’re looking for? Reach out directly to our support team and we’ll respond as soon as possible.
            </p>
          </div>
          <a
            href="mailto:iskolarmatch@gmail.com"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-95 transition-all shadow-xs shrink-0"
          >
            <Mail className="w-4 h-4" />
            <span>iskolarmatch@gmail.com</span>
          </a>
        </div>
      )}

      {/* Admin Add FAQ Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card-bg rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-app-text/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-app-text/10">
              <h3 className="font-extrabold text-app-text text-sm">Create New Help Article</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-app-text cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFAQ} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-app-text mb-1">Target Audience / Role</label>
                <select
                  value={newFaq.targetRole}
                  onChange={(e) => setNewFaq({ ...newFaq, targetRole: e.target.value })}
                  className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 font-semibold text-app-text cursor-pointer"
                >
                  <option value="all">All Roles</option>
                  <option value="student">Student Only</option>
                  <option value="provider">Provider Only</option>
                  <option value="admin">Admin Only</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-app-text mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scholarship Matching"
                  value={newFaq.category}
                  onChange={(e) => setNewFaq({ ...newFaq, category: e.target.value })}
                  className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 font-semibold text-app-text"
                />
              </div>

              <div>
                <label className="block font-bold text-app-text mb-1">Question</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. How is my match score calculated?"
                  value={newFaq.question}
                  onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })}
                  className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 font-semibold text-app-text"
                />
              </div>

              <div>
                <label className="block font-bold text-app-text mb-1">Answer</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Provide detailed explanation..."
                  value={newFaq.answer}
                  onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
                  className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 font-medium text-app-text resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-app-text/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-app-text/10 text-app-text font-bold hover:bg-app-text/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-primary text-white font-bold rounded-xl hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Article</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}