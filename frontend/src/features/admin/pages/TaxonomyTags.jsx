import React, { useState, useEffect, useCallback } from 'react';
import { 
  Tags, 
  Plus, 
  Trash2, 
  Search, 
  AlertCircle, 
  Loader2, 
  FolderTree,
  Edit2,
  GitMerge,
  X,
  Check
} from 'lucide-react';

import PageHeader from '../../../components/common/PageHeader';
import ConfirmModal from '../../../components/common/ConfirmModal';

const CATEGORIES = ['All', 'Field of Study', 'Education Level', 'Demographic', 'Award Type'];

export default function TaxonomyTags() {
  const [tags, setTags] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Form State for New Tag / Canonical Rule
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Field of Study');
  const [aliasesInput, setAliasesInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [formError, setFormError] = useState(null);

  // Edit State (Holds whole tag object being updated)
  const [editingTag, setEditingTag] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('Field of Study');
  const [editAliases, setEditAliases] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Deletion Modal State
  const [tagToDelete, setTagToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };
  };

  // Fetch Taxonomy Catalog from Live Backend API
  const fetchTags = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/admin/taxonomy', {
        headers: getHeaders()
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to load taxonomy tags from server.');
      }

      const data = await res.json();
      const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
      setTags(list);
    } catch (err) {
      console.error('Fetch Taxonomy Error:', err);
      setError(err.message || 'Unable to connect to taxonomy service.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  // Open Edit Modal with Pre-filled Tag Data
  const handleStartEdit = (tag) => {
    setEditingTag(tag);
    setEditName(tag.name || '');
    setEditCategory(tag.category || 'Field of Study');
    setEditAliases((tag.aliases || []).join(', '));
  };

  // Handle Create Tag
  const handleCreateTag = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsAdding(true);
    setFormError(null);

    const parsedAliases = aliasesInput
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch('/api/v1/admin/taxonomy', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ 
          name: name.trim(), 
          category,
          aliases: parsedAliases
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to create taxonomy entry.');
      }

      const createdTag = await res.json();
      const tagData = createdTag.data || createdTag;
      setTags(prev => [tagData, ...prev]);
      setName('');
      setAliasesInput('');
    } catch (err) {
      console.error('Create Tag Error:', err);
      setFormError(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  // Handle Update Tag (Name, Category, & Aliases)
  const handleUpdateTag = async (e) => {
    e.preventDefault();
    if (!editingTag || !editName.trim()) return;

    setIsUpdating(true);
    const parsedAliases = editAliases
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch(`/api/v1/admin/taxonomy/${editingTag._id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ 
          name: editName.trim(),
          category: editCategory,
          aliases: parsedAliases 
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to update taxonomy entry.');
      }

      const updated = await res.json();
      const updatedData = updated.data || updated;

      setTags(prev => prev.map(t => (t._id === editingTag._id ? { ...t, ...updatedData } : t)));
      setEditingTag(null);
    } catch (err) {
      console.error('Update Taxonomy Error:', err);
      alert(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle Delete Tag Confirmation
  const handleConfirmDelete = async () => {
    if (!tagToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/v1/admin/taxonomy/${tagToDelete._id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to delete taxonomy tag.');
      }

      setTags(prev => prev.filter(t => t._id !== tagToDelete._id));
      setTagToDelete(null);
      if (editingTag && editingTag._id === tagToDelete._id) {
        setEditingTag(null);
      }
    } catch (err) {
      console.error('Delete Tag Error:', err);
      setDeleteError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredTags = tags.filter((t) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesName = (t.name || '').toLowerCase().includes(searchLower);
    const matchesAliases = Array.isArray(t.aliases) && t.aliases.some(a => a.toLowerCase().includes(searchLower));
    const matchesCat = selectedCategory === 'All' || t.category === selectedCategory;
    
    return (matchesName || matchesAliases) && matchesCat;
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <PageHeader 
          title="Taxonomy & Canonical Tag Management" 
          subtitle="Configure system-wide scholarship tags, degree categories, and term canonicalization rules."
        />
        <div className="min-h-[300px] flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <Loader2 className="h-7 w-7 text-emerald-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading production taxonomy catalog...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader 
        title="Taxonomy & Canonical Tag Management" 
        subtitle="Configure system-wide scholarship tags, degree categories, and term canonicalization rules."
      />

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center justify-between text-xs font-medium">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            {error}
          </span>
          <button 
            type="button" 
            onClick={fetchTags} 
            className="underline text-rose-700 hover:text-rose-900 font-bold cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Add New Tag & Canonicalization Rules */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-emerald-600" /> Add Canonical Category Tag
        </h3>

        {formError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
            {formError}
          </div>
        )}

        <form onSubmit={handleCreateTag} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input 
              type="text"
              placeholder="Canonical Name (e.g. Bachelor of Science in Information Technology)"
              value={name}
              onChange={e => setName(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-emerald-500"
              required
            />

            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
            >
              {CATEGORIES.filter(c => c !== 'All').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <input 
              type="text"
              placeholder="Synonyms/Aliases (comma-separated: BSIT, BS Info Tech)"
              value={aliasesInput}
              onChange={e => setAliasesInput(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isAdding || !name.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs shrink-0"
            >
              {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Save Canonical Entry
            </button>
          </div>
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
              placeholder="Search terms or aliases..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Tag Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {filteredTags.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center col-span-full">No taxonomy terms match your criteria.</p>
          ) : (
            filteredTags.map((tag) => (
              <div key={tag._id} className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col justify-between gap-3">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Tags className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <h4 className="text-xs font-bold text-slate-900 truncate" title={tag.name}>{tag.name}</h4>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(tag)}
                        className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                        title="Edit Tag Details & Canonical Rules"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {!tag.isSystem && (
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setTagToDelete(tag);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                          title="Remove Tag"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    {tag.category} • <span className="font-semibold text-slate-700">{tag.usageCount || 0} listings</span>
                  </p>

                  {/* Canonical Aliases Display */}
                  {Array.isArray(tag.aliases) && tag.aliases.length > 0 && (
                    <div className="pt-1 flex items-center gap-1 flex-wrap">
                      <GitMerge className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="text-[10px] text-slate-400 font-medium">Aliases:</span>
                      {tag.aliases.map((alias, idx) => (
                        <span key={idx} className="inline-block px-1.5 py-0.5 bg-slate-200/70 text-slate-700 text-[10px] rounded-md font-semibold">
                          {alias}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Taxonomy Tag Modal */}
      {editingTag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-600" /> Edit Taxonomy Entry
              </h3>
              <button 
                type="button" 
                onClick={() => setEditingTag(null)} 
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateTag} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Canonical Tag Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="e.g. Bachelor of Science in Information Technology"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={editCategory}
                  onChange={e => setEditCategory(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                >
                  {CATEGORIES.filter(c => c !== 'All').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Synonyms & Aliases (Comma-separated)
                </label>
                <textarea
                  value={editAliases}
                  onChange={e => setEditAliases(e.target.value)}
                  placeholder="BSIT, BS Information Technology, BS Info Tech"
                  rows={3}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Any search or filter matching these terms will resolve to <strong>{editName || 'this tag'}</strong>.
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                {!editingTag.isSystem ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setTagToDelete(editingTag);
                    }}
                    className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove Tag
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTag(null)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating || !editName.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Remove Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(tagToDelete)}
        onClose={() => {
          setTagToDelete(null);
          setDeleteError(null);
        }}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        title="Remove Taxonomy Entry"
        message={
          deleteError
            ? `Server Error: ${deleteError}`
            : `Are you sure you want to remove "${tagToDelete?.name}"? This action removes canonical mapping rules for this term.`
        }
      />
    </div>
  );
}