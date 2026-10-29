import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, Archive, CheckCircle2, Loader2 } from 'lucide-react';

import PageHeader from '../../../components/common/PageHeader';
import DataTable from '../../../components/common/DataTable';
import FilterBar from '../../../components/common/FilterBar';
import StatusBadge from '../../../components/common/StatusBadge';
import Pagination from '../../../components/common/Pagination';
import ConfirmModal from '../../../components/common/ConfirmModal';
import { apiErrorText } from '../../../config/api';
import {
  ARCHIVE_REASONS,
  buildArchiveRequest,
  isArchivedScholarship,
} from '../scholarshipArchive';
import {
  SCHOLARSHIP_STATUS_FILTERS,
  scholarshipSearchWithStatus,
  scholarshipStatusFromSearch,
} from '../operationsDashboard';

const STATUS_FILTERS = SCHOLARSHIP_STATUS_FILTERS;
const REPORT_FILTERS = ['All', 'Reported', 'Unreported'];

const formatDeadline = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const authHeaders = (json = false) => {
  const token = localStorage.getItem('token');
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export default function AllScholarships() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = scholarshipStatusFromSearch(searchParams.get('status'));
  const [scholarships, setScholarships] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [reportFilter, setReportFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [isArchiving, setIsArchiving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    let isMounted = true;

    const loadScholarships = async () => {
      setIsLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: '20',
          status: statusFilter,
          reportStatus: reportFilter,
        });
        if (debouncedSearch) params.set('search', debouncedSearch);

        const res = await fetch(`/api/v1/admin/scholarships?${params.toString()}`, {
          headers: authHeaders(),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(apiErrorText(payload, 'Unable to load scholarships.'));
        }
        if (!isMounted) return;
        setScholarships(Array.isArray(payload.data) ? payload.data : []);
        setPages(Number(payload.pages) || 0);
        setTotal(Number(payload.total) || 0);
      } catch (err) {
        if (!isMounted) return;
        setScholarships([]);
        setError(err.message || 'Unable to load scholarships.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadScholarships();
    return () => {
      isMounted = false;
    };
  }, [page, statusFilter, reportFilter, debouncedSearch, reloadKey]);

  const openArchive = (scholarship) => {
    setArchiveTarget(scholarship);
    setReason('');
    setOtherReason('');
    setDialogError('');
    setFeedback(null);
  };

  const closeArchive = () => {
    if (isArchiving) return;
    setArchiveTarget(null);
    setDialogError('');
  };

  const submitArchive = async () => {
    if (!archiveTarget || isArchiving) return;
    const decision = buildArchiveRequest(reason, otherReason);
    if (!decision.ok) {
      setDialogError(decision.error);
      return;
    }

    setIsArchiving(true);
    setDialogError('');
    try {
      const res = await fetch(`/api/v1/scholarships/${archiveTarget._id}/archive`, {
        method: 'PATCH',
        headers: authHeaders(true),
        body: JSON.stringify(decision.body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(apiErrorText(payload, 'Unable to archive this scholarship.'));
      }

      setArchiveTarget(null);
      setFeedback({
        type: 'success',
        message: `"${archiveTarget.name}" was archived. It no longer appears in active student listings.`,
      });
      setPage(1);
      setReloadKey((current) => current + 1);
    } catch (err) {
      setDialogError(err.message || 'Unable to archive this scholarship.');
    } finally {
      setIsArchiving(false);
    }
  };

  const reasonReady = buildArchiveRequest(reason, otherReason).ok;

  const columns = [
    {
      key: 'name',
      header: 'Scholarship',
      render: (row) => (
        <div className="space-y-1">
          <Link
            to={`/dashboard/admin/scholarships/${row._id}`}
            state={{ backPath: '/dashboard/admin/scholarships' }}
            className="font-bold text-slate-900 hover:text-amber-700"
          >
            {row.name}
          </Link>
          <p className="text-[11px] text-slate-500">{row.providerName || 'Unknown provider'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge
            status={row.status === 'Open' ? 'active' : 'inactive'}
            customLabel={row.status || 'Unknown'}
          />
          <StatusBadge
            status={isArchivedScholarship(row) ? 'archived' : 'verified'}
            customLabel={isArchivedScholarship(row) ? 'Archived' : 'Active'}
          />
        </div>
      ),
    },
    {
      key: 'deadline',
      header: 'Deadline',
      render: (row) => formatDeadline(row.deadline),
    },
    {
      key: 'reportStatus',
      header: 'Reports',
      render: (row) => (
        <div className="space-y-1">
          <StatusBadge
            status={row.reportStatus === 'Reported' ? 'pending_review' : 'draft'}
            customLabel={row.reportStatus || 'Unreported'}
          />
          {row.reportCount > 0 && (
            <p className="text-[11px] text-slate-500">
              {row.reportCount} report{row.reportCount === 1 ? '' : 's'}
              {row.openReportCount > 0 ? `, ${row.openReportCount} open` : ''}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      render: (row) => (
        row.canArchive === false || isArchivedScholarship(row) ? (
          <span className="text-[11px] font-bold text-slate-400">Archived</span>
        ) : (
          <button
            type="button"
            onClick={() => openArchive(row)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-[11px] font-extrabold text-white hover:bg-rose-700"
          >
            <Archive className="h-3.5 w-3.5" />
            Archive
          </button>
        )
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="All Scholarships"
        description="Review every scholarship listing and archive listings that should leave active student search and matching."
        role="admin"
        actionButton={(
          <Link
            to="/dashboard/admin/moderation"
            className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100"
          >
            Reported scholarships
          </Link>
        )}
      />

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-800 p-3.5 rounded-xl flex items-center gap-2 text-xs font-medium">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
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
        placeholder="Search by scholarship or provider"
        onReset={() => {
          setSearchQuery('');
          setReportFilter('All');
          setPage(1);
          setSearchParams(scholarshipSearchWithStatus(searchParams, 'All'), { replace: true });
        }}
      >
        <select
          aria-label="Report status"
          value={reportFilter}
          onChange={(event) => {
            setReportFilter(event.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
        >
          {REPORT_FILTERS.map((item) => (
            <option key={item} value={item}>
              {item === 'All' ? 'All reports' : item}
            </option>
          ))}
        </select>
      </FilterBar>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => {
              setSearchParams(scholarshipSearchWithStatus(searchParams, status), { replace: true });
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold border ${
              statusFilter === status
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {status}
          </button>
        ))}
        <span className="text-[11px] font-bold text-slate-500 ml-auto">
          {total} listing{total === 1 ? '' : 's'}
        </span>
      </div>

      {isLoading ? (
        <div className="min-h-[240px] flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200/80 p-6">
          <Loader2 className="h-7 w-7 text-amber-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading scholarships...</p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={scholarships}
          emptyMessage="No scholarships match these filters."
        />
      )}

      <Pagination currentPage={page} totalPages={pages} onPageChange={setPage} />

      <ConfirmModal
        isOpen={Boolean(archiveTarget)}
        onClose={closeArchive}
        onConfirm={submitArchive}
        title="Archive scholarship"
        description={
          archiveTarget
            ? `Archive "${archiveTarget.name}" from ${archiveTarget.providerName || 'this provider'}? It will leave active student listings, search, and matching. Applications, saved scholarships, and report records stay on file.`
            : ''
        }
        confirmText={isArchiving ? 'Archiving...' : 'Archive scholarship'}
        cancelText="Cancel"
        isDanger
        confirmDisabled={!reasonReady || isArchiving}
        closeOnConfirm={false}
      >
        <div className="space-y-2">
          <label htmlFor="archive-reason" className="block text-xs font-bold text-slate-700">
            Reason
          </label>
          <select
            id="archive-reason"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setDialogError('');
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
          >
            <option value="">Select a reason</option>
            {ARCHIVE_REASONS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          {reason === 'Other' && (
            <textarea
              id="archive-other-reason"
              value={otherReason}
              onChange={(event) => {
                setOtherReason(event.target.value);
                setDialogError('');
              }}
              rows={3}
              maxLength={1000}
              placeholder="Describe why this scholarship should be archived"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800"
            />
          )}
          {dialogError && (
            <p className="text-xs font-medium text-rose-700">{dialogError}</p>
          )}
        </div>
      </ConfirmModal>
    </div>
  );
}
