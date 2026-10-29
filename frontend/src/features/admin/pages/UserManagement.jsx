import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

import PageHeader from '../../../components/common/PageHeader';
import DataTable from '../../../components/common/DataTable';
import FilterBar from '../../../components/common/FilterBar';
import StatusBadge from '../../../components/common/StatusBadge';
import Pagination from '../../../components/common/Pagination';
import ConfirmModal from '../../../components/common/ConfirmModal';
import { apiErrorText, apiUrl } from '../../../config/api';
import { useAuth } from '../../../context/AuthContext';
import {
  ACCOUNT_STATUS_FILTERS,
  ROLE_FILTERS,
  directoryFiltersFromSearch,
  directorySearchWithFilters,
  interpretStatusResult,
  providerVerificationPath,
  reduceStatusDialog,
  roleLabel,
  statusActionFor,
} from '../userManagement';

const authHeaders = (json = false) => {
  const token = localStorage.getItem('token');
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const formatRegistered = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const statusBadge = (status) => {
  if (status === 'suspended') return { status: 'inactive', label: 'Suspended' };
  if (status === 'pending_consent') return { status: 'pending', label: 'Pending consent' };
  if (status === 'active') return { status: 'active', label: 'Active' };
  return { status: 'draft', label: status || 'Unknown' };
};

const actionNote = (reason) => {
  if (reason === 'self') return 'Signed-in account';
  if (reason === 'admin-restricted') return 'Only a super admin can change this account';
  if (reason === 'unsupported-status') return 'Managed by parental consent';
  return '';
};

export default function UserManagement() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const directoryFilters = directoryFiltersFromSearch(searchParams);
  const roleFilter = directoryFilters.role;
  const statusFilter = directoryFilters.status;
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [dialog, setDialog] = useState({
    phase: 'closed',
    action: null,
    requests: 0,
  });
  const [dialogError, setDialogError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const dialogRef = useRef(dialog);

  const applyDialog = (event) => {
    const next = reduceStatusDialog(dialogRef.current, event);
    dialogRef.current = next;
    setDialog(next);
    return next;
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    let isMounted = true;

    const loadUsers = async () => {
      setIsLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: '20',
          role: roleFilter,
          status: statusFilter,
        });
        if (debouncedSearch) params.set('search', debouncedSearch);

        const res = await fetch(`${apiUrl('admin/users')}?${params.toString()}`, {
          headers: authHeaders(),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(apiErrorText(payload, 'Unable to load users.'));
        }
        if (!isMounted) return;
        setUsers(Array.isArray(payload.data) ? payload.data : []);
        setPages(Number(payload.pages) || 0);
        setTotal(Number(payload.total) || 0);
      } catch (err) {
        if (!isMounted) return;
        setUsers([]);
        setPages(0);
        setTotal(0);
        setError(err.message || 'Unable to load users.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadUsers();
    return () => {
      isMounted = false;
    };
  }, [page, roleFilter, statusFilter, debouncedSearch, reloadKey]);

  const closeAction = () => {
    if (dialogRef.current.phase === 'submitting') return;
    applyDialog({ type: 'cancel' });
    setDialogError('');
  };

  const submitStatus = async () => {
    const before = dialogRef.current.requests;
    const next = applyDialog({ type: 'confirm' });
    if (next.requests === before) return;
    const pending = next.action;
    setDialogError('');

    try {
      const res = await fetch(apiUrl(`admin/users/${pending.user.id}/status`), {
        method: 'PATCH',
        headers: authHeaders(true),
        body: JSON.stringify({ status: pending.nextStatus }),
      });
      const payload = await res.json().catch(() => ({}));
      const result = interpretStatusResult({ ok: res.ok, body: payload });
      if (result.outcome === 'failed') {
        applyDialog({ type: 'fail' });
        setDialogError(result.message || 'Unable to update this account.');
        return;
      }

      const verb = pending.action === 'suspend' ? 'suspended' : 'restored';
      const friendly = `${pending.user.name || pending.user.email} was ${verb}.`;
      applyDialog({ type: 'finish' });
      setFeedback({
        type: 'success',
        message: payload.success === false && result.message ? result.message : friendly,
      });
      setReloadKey((current) => current + 1);
    } catch (err) {
      applyDialog({ type: 'fail' });
      setDialogError(err.message || 'Unable to update this account.');
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => <span className="font-bold text-slate-900">{row.name || '—'}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => row.email || '—',
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => (
        <div className="space-y-1">
          <p>{roleLabel(row.role)}</p>
          {row.role === 'provider' && (
            <p className="text-[11px] text-slate-500">
              Organization: {row.verificationStatus || 'No verification record'}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Account status',
      render: (row) => {
        const badge = statusBadge(row.status);
        return <StatusBadge status={badge.status} customLabel={badge.label} />;
      },
    },
    {
      key: 'isVerified',
      header: 'Email verification',
      render: (row) => (
        <StatusBadge
          status={row.isVerified ? 'verified' : 'pending'}
          customLabel={row.isVerified ? 'Verified' : 'Unverified'}
        />
      ),
    },
    {
      key: 'isOnboarded',
      header: 'Onboarding',
      render: (row) => (
        <StatusBadge
          status={row.isOnboarded ? 'active' : 'draft'}
          customLabel={row.isOnboarded ? 'Complete' : 'Not complete'}
        />
      ),
    },
    {
      key: 'createdAt',
      header: 'Registered',
      render: (row) => formatRegistered(row.createdAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => {
        const decision = statusActionFor(user, row);
        const verificationPath = row.role === 'provider' ? providerVerificationPath(row.providerId) : null;
        return (
          <div className="flex flex-col items-start gap-2">
            {decision.allowed ? (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setDialogError('');
                  setFeedback(null);
                  applyDialog({
                    type: 'open',
                    action: {
                      user: row,
                      action: decision.action,
                      nextStatus: decision.nextStatus,
                    },
                  });
                }}
                className={`rounded-xl px-3 py-1.5 text-[11px] font-extrabold text-white ${
                  decision.action === 'suspend'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {decision.action === 'suspend' ? 'Suspend' : 'Restore'}
              </button>
            ) : (
              <span className="text-[11px] font-bold text-slate-400">{actionNote(decision.reason)}</span>
            )}
            {verificationPath && (
              <Link
                to={verificationPath}
                className="text-[11px] font-extrabold text-amber-700 hover:text-amber-800"
              >
                Review verification
              </Link>
            )}
          </div>
        );
      },
    },
  ];

  const pendingAction = dialog.phase === 'closed' ? null : dialog.action;
  const isSubmitting = dialog.phase === 'submitting';
  const pendingIsSuspend = pendingAction?.action === 'suspend';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="User Management"
        description="Review registered students, scholarship providers, and administrators. Suspend or restore eligible accounts without changing roles or verification decisions."
        role="admin"
        actionButton={(
          <button
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        )}
      />

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-800 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {feedback && (
        <div role="status" className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 p-3.5 rounded-xl flex items-center gap-2 text-xs font-medium">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{feedback.message}</span>
        </div>
      )}

      <FilterBar
        searchValue={searchQuery}
        onSearchChange={(value) => {
          setSearchQuery(value);
          setPage(1);
        }}
        placeholder="Search by name or email"
        onReset={() => {
          setSearchQuery('');
          setPage(1);
          setSearchParams(directorySearchWithFilters(searchParams, { role: 'all', status: 'all' }), { replace: true });
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        {ROLE_FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => {
              setSearchParams(directorySearchWithFilters(searchParams, {
                role: item.value,
                status: statusFilter,
              }), { replace: true });
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold border ${
              roleFilter === item.value
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {item.label}
          </button>
        ))}
        <span className="text-[11px] font-bold text-slate-500 ml-auto">
          {total} user{total === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {ACCOUNT_STATUS_FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => {
              setSearchParams(directorySearchWithFilters(searchParams, {
                role: roleFilter,
                status: item.value,
              }), { replace: true });
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold border ${
              statusFilter === item.value
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="min-h-[240px] flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200/80 p-6">
          <Loader2 className="h-7 w-7 text-amber-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading users...</p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={users}
          emptyMessage="No users match these filters."
        />
      )}

      <Pagination currentPage={page} totalPages={pages} onPageChange={setPage} />

      <ConfirmModal
        isOpen={Boolean(pendingAction)}
        onClose={closeAction}
        onConfirm={submitStatus}
        title={pendingIsSuspend ? 'Suspend account' : 'Restore account'}
        description={
          pendingAction
            ? pendingIsSuspend
              ? `Suspend ${pendingAction.user.name || pendingAction.user.email}? They will be signed out and cannot use the system until the account is restored. Profiles, applications, saved scholarships, and verification records stay on file.`
              : `Restore ${pendingAction.user.name || pendingAction.user.email}? They can sign in again. Sessions revoked during suspension are not brought back.`
            : ''
        }
        confirmText={
          isSubmitting
            ? (pendingIsSuspend ? 'Suspending...' : 'Restoring...')
            : (pendingIsSuspend ? 'Suspend account' : 'Restore account')
        }
        cancelText="Cancel"
        isDanger={pendingIsSuspend}
        confirmDisabled={isSubmitting}
        closeOnConfirm={false}
      >
        {dialogError && (
          <p className="text-xs font-medium text-rose-700" role="alert">{dialogError}</p>
        )}
      </ConfirmModal>
    </div>
  );
}
