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
  Pencil,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Mail
} from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import {
  FAQ_AUDIENCES,
  FAQ_AUDIENCE_LABELS,
  buildFaqWriteBody,
  filterHelpArticles,
} from './faqHelp';

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

const PAGE_COPY = {
  student: {
    title: 'Help',
    subtitle: 'Find instant answers, documentation, and operational guides.',
    search: 'Search help topics, matching, or guides...'
  },
  provider: {
    title: 'Help',
    subtitle: 'Resource center for scholarship listings, eligibility, matching, and verification.',
    search: 'Search scholarship listing, matching, eligibility, or verification guides...'
  },
  admin: {
    title: 'Help',
    subtitle: 'Create, edit, publish, and remove help articles for each portal.',
    search: 'Search questions, answers, or categories...'
  }
};

const emptyDraft = () => ({
  targetRole: 'all',
  category: '',
  question: '',
  answer: '',
  isPublished: true
});

const readJson = async (res) => {
  try {
    return await res.json();
  } catch {
    return {};
  }
};

export default function HelpCenter({ role = 'student', isAdmin = false }) {
  const copy = PAGE_COPY[role] || PAGE_COPY.student;
  const [faqs, setFaqs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('any');
  const [statusFilter, setStatusFilter] = useState('any');
  const [categoryFilter, setCategoryFilter] = useState('any');
  const [openFaq, setOpenFaq] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [toast, setToast] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingId, setPendingId] = useState(null);

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
      const res = await fetch(`${API_BASE_URL}/faqs`, {
        headers: getAuthHeaders()
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.message || 'Failed to fetch help articles.');
      const list = Array.isArray(data.faqs) ? data.faqs : [];
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

  const categoryOptions = useMemo(() => {
    const names = new Set();
    faqs.forEach((faq) => {
      if (faq?.category) names.add(faq.category);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [faqs]);

  useEffect(() => {
    if (categoryFilter !== 'any' && !categoryOptions.includes(categoryFilter)) {
      setCategoryFilter('any');
    }
  }, [categoryOptions, categoryFilter]);

  const visibleFaqs = useMemo(() => filterHelpArticles(faqs, {
    role,
    isAdmin,
    query: searchQuery,
    audience: audienceFilter,
    status: statusFilter,
    category: categoryFilter
  }), [faqs, role, isAdmin, searchQuery, audienceFilter, statusFilter, categoryFilter]);

  const groupedFaqs = useMemo(() => {
    const map = {};
    visibleFaqs.forEach((faq) => {
      const cat = faq.category || 'General';
      if (!map[cat]) map[cat] = [];
      map[cat].push(faq);
    });

    return Object.keys(map).map((category) => ({ category, items: map[category] }));
  }, [visibleFaqs]);

  const filtersActive = Boolean(searchQuery.trim())
    || (isAdmin && (audienceFilter !== 'any' || statusFilter !== 'any' || categoryFilter !== 'any'));

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setIsModalOpen(true);
  };

  const openEdit = (faq) => {
    setEditingId(faq._id);
    setDraft({
      targetRole: faq.targetRole || 'all',
      category: faq.category || '',
      question: faq.question || '',
      answer: faq.answer || '',
      isPublished: faq.isPublished === true
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSaveFAQ = async (e) => {
    e.preventDefault();
    const built = buildFaqWriteBody(draft);
    if (!built.ok) {
      showToast(built.error, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(
        editingId ? `${API_BASE_URL}/faqs/${editingId}` : `${API_BASE_URL}/faqs`,
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(built.body)
        }
      );
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.message || 'Failed to save the FAQ article.');

      showToast(editingId ? 'FAQ article updated.' : 'FAQ article created successfully!', 'success');
      setIsModalOpen(false);
      setEditingId(null);
      setDraft(emptyDraft());
      fetchFAQs();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePublished = async (faq) => {
    if (!faq?._id) return;
    setPendingId(faq._id);
    try {
      const res = await fetch(`${API_BASE_URL}/faqs/${faq._id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isPublished: faq.isPublished !== true })
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.message || 'Failed to update publication status.');
      showToast(faq.isPublished ? 'FAQ unpublished.' : 'FAQ published.', 'success');
      fetchFAQs();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setPendingId(null);
    }
  };

  const handleDeleteFAQ = async (id) => {
    if (!window.confirm('Are you sure you want to delete this FAQ article?')) return;
    setPendingId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/faqs/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.message || 'Failed to delete FAQ article.');

      showToast('FAQ article deleted.', 'success');
      fetchFAQs();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setPendingId(null);
    }
  };

  const toggleFaq = (id) => {
    setOpenFaq((current) => (current === id ? null : id));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 relative">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 text-white rounded-xl shadow-xl text-xs font-semibold animate-in fade-in slide-in-from-bottom-3">
          {toast.type === 'error'
            ? <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            : <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="bg-card-bg rounded-2xl border border-app-text/10 p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-app-text">{copy.title}</h1>
              <p className="text-xs text-text-muted font-medium">
                {copy.subtitle}
              </p>
            </div>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all cursor-pointer shadow-xs shrink-0"
            >
              <PlusCircle className="w-4 h-4" /> Add FAQ Article
            </button>
          )}
        </div>

        <div className="relative pt-2">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            placeholder={copy.search}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search help articles"
            className="w-full pl-10 pr-4 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold focus:outline-hidden focus:border-primary text-app-text"
          />
        </div>

        {isAdmin && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="space-y-1">
              <span className="block text-[10px] font-black uppercase tracking-wider text-text-muted">Audience</span>
              <select
                value={audienceFilter}
                onChange={(e) => setAudienceFilter(e.target.value)}
                aria-label="Filter by audience"
                className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text cursor-pointer"
              >
                <option value="any">Any audience</option>
                {FAQ_AUDIENCES.map((audience) => (
                  <option key={audience} value={audience}>{FAQ_AUDIENCE_LABELS[audience]}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-black uppercase tracking-wider text-text-muted">Status</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by publication status"
                className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text cursor-pointer"
              >
                <option value="any">Published and unpublished</option>
                <option value="published">Published</option>
                <option value="unpublished">Unpublished</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-black uppercase tracking-wider text-text-muted">Category</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter by category"
                className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text cursor-pointer"
              >
                <option value="any">All categories</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>
          </div>
        )}
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
          ) : groupedFaqs.length === 0 ? (
            <div className="bg-card-bg rounded-2xl border border-app-text/10 p-6 text-center text-xs text-text-muted">
              {filtersActive ? 'No help articles matching your search.' : 'No help articles yet.'}
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
                  const audienceLabel = FAQ_AUDIENCE_LABELS[faq.targetRole] || faq.targetRole;

                  return (
                    <div
                      key={faqId}
                      className="bg-card-bg rounded-2xl border border-app-text/10 overflow-hidden shadow-xs transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 p-4 hover:bg-app-bg/50 transition-colors">
                        <button
                          type="button"
                          onClick={() => toggleFaq(faqId)}
                          aria-expanded={isOpen}
                          className="flex-1 text-left flex items-center justify-between gap-3 text-xs font-bold text-app-text cursor-pointer bg-transparent border-0"
                        >
                          <span className="space-y-1.5">
                            <span className="block">{faq.question}</span>
                            {isAdmin && (
                              <span className="flex flex-wrap gap-1.5">
                                <span className="inline-flex px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wide">
                                  {audienceLabel}
                                </span>
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${faq.isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                  {faq.isPublished ? 'Published' : 'Unpublished'}
                                </span>
                              </span>
                            )}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-text-muted shrink-0 transition-transform ${isOpen ? 'rotate-180 text-primary' : ''}`} />
                        </button>

                        {isAdmin && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleTogglePublished(faq)}
                              disabled={pendingId === faqId}
                              className="px-2.5 py-1.5 rounded-lg border border-app-text/10 text-[10px] font-bold text-app-text hover:bg-app-bg cursor-pointer disabled:opacity-60"
                            >
                              {faq.isPublished ? 'Unpublish' : 'Publish'}
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(faq)}
                              title="Edit FAQ"
                              className="p-1.5 text-text-muted hover:text-primary transition-colors cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFAQ(faqId)}
                              title="Delete FAQ"
                              disabled={pendingId === faqId}
                              className="p-1.5 text-text-muted hover:text-rose-600 transition-colors cursor-pointer disabled:opacity-60"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card-bg rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-app-text/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-app-text/10">
              <h3 className="font-extrabold text-app-text text-sm">
                {editingId ? 'Edit Help Article' : 'Create New Help Article'}
              </h3>
              <button type="button" onClick={closeModal} className="text-text-muted hover:text-app-text cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFAQ} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-app-text mb-1" htmlFor="faq-audience">Target audience</label>
                <select
                  id="faq-audience"
                  value={draft.targetRole}
                  onChange={(e) => setDraft({ ...draft, targetRole: e.target.value })}
                  className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 font-semibold text-app-text cursor-pointer"
                >
                  {FAQ_AUDIENCES.map((audience) => (
                    <option key={audience} value={audience}>{FAQ_AUDIENCE_LABELS[audience]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-app-text mb-1" htmlFor="faq-status">Publication status</label>
                <select
                  id="faq-status"
                  value={String(draft.isPublished)}
                  onChange={(e) => setDraft({ ...draft, isPublished: e.target.value === 'true' })}
                  className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 font-semibold text-app-text cursor-pointer"
                >
                  <option value="true">Published</option>
                  <option value="false">Unpublished</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-app-text mb-1" htmlFor="faq-category">Category</label>
                <input
                  id="faq-category"
                  type="text"
                  required
                  placeholder="e.g. Scholarship Matching"
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 font-semibold text-app-text"
                />
              </div>

              <div>
                <label className="block font-bold text-app-text mb-1" htmlFor="faq-question">Question</label>
                <input
                  id="faq-question"
                  type="text"
                  required
                  placeholder="e.g. How is my match score calculated?"
                  value={draft.question}
                  onChange={(e) => setDraft({ ...draft, question: e.target.value })}
                  className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 font-semibold text-app-text"
                />
              </div>

              <div>
                <label className="block font-bold text-app-text mb-1" htmlFor="faq-answer">Answer</label>
                <textarea
                  id="faq-answer"
                  rows={4}
                  required
                  placeholder="Provide a detailed explanation..."
                  value={draft.answer}
                  onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
                  className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 font-medium text-app-text resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-app-text/10">
                <button
                  type="button"
                  onClick={closeModal}
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
                  <span>{editingId ? 'Save Changes' : 'Save Article'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
