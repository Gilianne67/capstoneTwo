import React, { useState, useEffect } from 'react';
import { 
  Tags, 
  Plus, 
  Trash2, 
  Search, 
  AlertCircle, 
  Loader2, 
  CheckCircle2, 
  FolderTree,
  X
} from 'lucide-react';

import PageHeader from '../../../components/common/PageHeader';
import ConfirmModal from '../../../components/common/ConfirmModal';

// Fallback Mock Data
const MOCK_TAXONOMY = [
  { _id: 'tag-01', name: 'STEM / Technology', category: 'Field of Study', usageCount: 42, isSystem: true },
  { _id: 'tag-02', name: 'Undergraduate', category: 'Education Level', usageCount: 88, isSystem: true },
  { _id: 'tag-03', name: 'Low-Income Household (4Ps)', category: 'Demographic', usageCount: 31, isSystem: false },
  { _id: 'tag-04', name: 'Full Tuition Grant', category: 'Award Type', usageCount: 65, isSystem: true },
  { _id: 'tag-05', name: 'Agriculture & Forestry', category: 'Field of Study', usageCount: 14, isSystem: false },
  { _id: 'tag-06', name: 'PWD Candidate', category: 'Demographic', usageCount: 19, isSystem: false }
];

const CATEGORIES = ['All', 'Field of Study', 'Education Level', 'Demographic', 'Award Type'];

export default function TaxonomyTags() {
  const [tags, setTags] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Form State
  const [newTagName, setNewTagName] = useState('');
  const [newTagCategory, setNewTagCategory] = useState('Field of Study');
  const [isAdding, setIsAdding] = useState(false);
  const [formError, setFormError] = useState(null);

  // Deletion Modal State
  const [tagToDelete, setTagToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchTags = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await fetch('/api/v1/admin/taxonomy', { headers });

        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setTags(Array.isArray(data) ? data : MOCK_TAXONOMY);
            setIsUsingFallback(false);
          }
        } else {
          throw new Error('Taxonomy API error');
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Backend server offline. Displaying fallback taxonomy tags:', err);
          setTags(MOCK_TAXONOMY);
          setIsUsingFallback(true);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchTags();

    return () => {
      isMounted = false;
    };
  }, []);

  // Safe Tag Creation
  const handleCreateTag = async (e) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    setIsAdding(true);
    setFormError(null);

    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
      };

      const res = await fetch('/api/v1/admin/taxonomy', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: newTagName.trim(), category: newTagCategory })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Server rejected tag creation');
      }

      const createdTag = await res.json();
      setTags(prev => [createdTag, ...prev]);
      setNewTagName('');
    } catch (err) {
      console.error('Create Tag Error:', err);
      
      if (isUsingFallback) {
        // Fallback execution mode
        const tempTag = {
          _id: `tag-${Date.now()}`,
          name: newTagName.trim(),
          category: newTagCategory,
          usageCount: 0,
          isSystem: false
        };
        setTags(prev => [tempTag, ...prev]);
        setNewTagName('');
      } else {
        setFormError(err.message);
      }
    } finally {
      setIsAdding(false);
    }
  };

  // Safe Tag Deletion
  const handleConfirmDelete = async () => {
    if (!tagToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch(`/api/v1/admin/taxonomy/${tagToDelete._id}`, {
        method: 'DELETE',
        headers
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Delete failed on server');
      }

      // Safe update state ONLY on 2xx success
      setTags(prev => prev.filter(t => t._id !== tagToDelete._id));
      setTagToDelete(null);
    } catch (err) {
      console.error('Delete Tag Error:', err);

      if (isUsingFallback) {
        setTags(prev => prev.filter(t => t._id !== tagToDelete._id));
        setTagToDelete(null);
      } else {
        setDeleteError(err.message);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredTags = tags.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'All' || t.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <PageHeader 
          title="Taxonomy & Tag Management" 
          subtitle="Configure system-wide scholarship tags, degree categories, and search filters."
        />
        <div className="min-h-[300px] flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200/80 p-6">
          <Loader2 className="h-7 w-7 text-emerald-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Fetching taxonomy catalog...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader 
        title="Taxonomy & Tag Management" 
        subtitle="Configure system-wide scholarship tags, degree categories, and search filters."
      />

      {isUsingFallback && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 p-3.5 rounded-xl flex items-center justify-between text-xs font-medium">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            Backend API unreachable. Displaying local fallback taxonomy tags.
          </span>
        </div>
      )}

      {/* Add Tag Section */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-emerald-600" /> Add New Category Tag
        </h3>

        {formError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
            {formError}
          </div>
        )}

        <form onSubmit={handleCreateTag} className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <input 
            type="text"
            placeholder="e.g. Indigenous Student Grant"
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-emerald-500"
            required
          />

          <select
            value={newTagCategory}
            onChange={e => setNewTagCategory(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
          >
            {CATEGORIES.filter(c => c !== 'All').map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <button
            type="submit"
            disabled={isAdding || !newTagName.trim()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs shrink-0"
          >
            {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Tag
          </button>
        </form>
      </div>

      {/* Filter and Catalog Workbench */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200/60 pb-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input 
              type="text"
              placeholder="Search taxonomy tags..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Tag Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {filteredTags.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center col-span-full">No taxonomy tags match your search query.</p>
          ) : (
            filteredTags.map((tag) => (
              <div key={tag._id} className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Tags className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <h4 className="text-xs font-bold text-slate-900 truncate">{tag.name}</h4>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {tag.category} • <span className="font-semibold text-slate-700">{tag.usageCount} listings</span>
                  </p>
                </div>

                {!tag.isSystem && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setTagToDelete(tag);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg transition-colors cursor-pointer shrink-0"
                    title="Delete Tag"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(tagToDelete)}
        onClose={() => {
          setTagToDelete(null);
          setDeleteError(null);
        }}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        title="Delete Taxonomy Tag"
        message={
          deleteError
            ? `Server Error: ${deleteError}`
            : `Are you sure you want to delete "${tagToDelete?.name}"? Existing scholarships with this tag will keep their record, but it will be removed from future filters.`
        }
      />
    </div>
  );
}