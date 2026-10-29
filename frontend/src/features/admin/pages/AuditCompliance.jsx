import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Download,
  Search,
  AlertCircle,
  Loader2,
  Clock,
  User,
  FileCheck,
  Server,
  AlertTriangle,
  Info
} from 'lucide-react';

import PageHeader from '../../../components/common/PageHeader';
import Pagination from '../../../components/common/Pagination';
import { apiErrorText, apiUrl } from '../../../config/api';
import {
  AUDIT_EVENT_TYPES,
  AUDIT_PAGE_SIZE,
  auditExportFilters,
  auditListParams,
  auditResultRange,
  readAuditPage,
  shouldDownloadAuditCsv,
} from '../auditCompliance';

const resolveSeverity = (log) => {
  if (log.severity) return log.severity;
  const actionUpper = String(log.action || '').toUpperCase();
  if (actionUpper.includes('CRITICAL') || actionUpper.includes('PURGE') || actionUpper.includes('SUSPENDED') || actionUpper.includes('DELETED')) {
    return 'Critical';
  }
  if (actionUpper.includes('ALERT') || actionUpper.includes('REJECTED') || actionUpper.includes('FAILED')) {
    return 'Warning';
  }
  return 'Info';
};

const authHeaders = (json = false) => {
  const token = localStorage.getItem('token');
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export default function AuditCompliance() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exportError, setExportError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [eventFilter, setEventFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(AUDIT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [summary, setSummary] = useState({ info: 0, warning: 0, critical: 0, total: 0 });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchAuditLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = auditListParams({
        page,
        pageSize,
        search: debouncedSearch,
        severity: severityFilter,
        action: eventFilter,
        from: fromDate,
        to: toDate,
      });
      const res = await fetch(`${apiUrl('admin/audit-logs')}?${params.toString()}`, {
        headers: authHeaders(),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(apiErrorText(payload, 'Failed to retrieve audit log trails from server.'));
      }

      const result = readAuditPage(payload);
      setLogs(result.records);
      setTotal(result.total);
      setPages(result.pages);
      setSummary(result.summary);
    } catch (err) {
      console.error('Fetch Audit Logs Error:', err);
      setLogs([]);
      setTotal(0);
      setPages(0);
      setSummary({ info: 0, warning: 0, critical: 0, total: 0 });
      setError(err.message || 'Unable to connect to the audit service.');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, debouncedSearch, severityFilter, eventFilter, fromDate, toDate]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const handleExportCSV = async () => {
    setIsExporting(true);
    setExportError('');
    try {
      const res = await fetch(apiUrl('admin/audit-logs/export'), {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify(auditExportFilters({
          search: debouncedSearch,
          severity: severityFilter,
          action: eventFilter,
          from: fromDate,
          to: toDate,
        })),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!shouldDownloadAuditCsv({ ok: res.ok, contentType })) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(apiErrorText(
          payload,
          'The compliance report was not downloaded because the export could not be recorded.'
        ));
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Audit_Compliance_Report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      fetchAuditLogs();
    } catch (err) {
      setExportError(err.message || 'The compliance report was not downloaded.');
    } finally {
      setIsExporting(false);
    }
  };

  const range = auditResultRange(page, pageSize, total);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Audit & Compliance Logs"
          description="Inspect system action trails, security events, and export regulatory compliance reports."
        />

        <button
          type="button"
          onClick={handleExportCSV}
          disabled={isExporting || isLoading || total === 0}
          title="Exports every record matching these filters, not only this page."
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs shrink-0 self-start sm:self-auto"
        >
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-emerald-400" />}
          Export Compliance CSV
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center justify-between text-xs font-medium">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            {error}
          </span>
          <button
            type="button"
            onClick={fetchAuditLogs}
            className="underline text-rose-700 hover:text-rose-900 font-bold cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      )}

      {exportError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center gap-2 text-xs font-medium">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          {exportError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Matching Events</p>
            <p className="text-sm font-bold text-slate-900">{total} Log Entries</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Standard & Warning Events</p>
            <p className="text-sm font-bold text-slate-900">{summary.info} Info / {summary.warning} Warnings</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Security & Critical Alerts</p>
            <p className="text-sm font-bold text-slate-900">
              {summary.critical > 0 ? (
                <span className="text-rose-600">{summary.critical} Critical Events</span>
              ) : (
                <span className="text-emerald-600">0 Critical Breaches</span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            {['All', 'Info', 'Warning', 'Critical'].map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => {
                  setSeverityFilter(sev);
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                  severityFilter === sev
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="relative w-full lg:max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search action, actor, or details..."
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-emerald-500"
              />
            </div>
            <select
              aria-label="Event type"
              value={eventFilter}
              onChange={(event) => {
                setEventFilter(event.target.value);
                setPage(1);
              }}
              className="w-full lg:w-56 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
            >
              <option value="">All events</option>
              {AUDIT_EVENT_TYPES.map((action) => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
              From
              <input
                type="date"
                aria-label="From date"
                value={fromDate}
                onChange={(event) => {
                  setFromDate(event.target.value);
                  setPage(1);
                }}
                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
              />
            </label>
            <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
              To
              <input
                type="date"
                aria-label="To date"
                value={toDate}
                onChange={(event) => {
                  setToDate(event.target.value);
                  setPage(1);
                }}
                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
              />
            </label>
            <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 lg:ml-auto">
              Page size
              <select
                aria-label="Page size"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
              >
                {[20, 50, 100].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <p className="text-[11px] font-semibold text-slate-500">
          Showing {range.start}–{range.end} of {range.total} matching records.
          {' '}Export includes every match, not only this page. Dates use the Asia/Manila calendar.
        </p>

        <div className="space-y-3 pt-2">
          {isLoading ? (
            <div className="min-h-[220px] flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-7 w-7 text-emerald-600 animate-spin" />
              <p className="text-xs text-slate-500 font-medium">Retrieving security audit log trails...</p>
            </div>
          ) : logs.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No compliance audit logs found matching criteria.</p>
          ) : (
            logs.map((log) => {
              const formattedDate = log.createdAt
                ? new Date(log.createdAt).toLocaleString()
                : log.timestamp || 'N/A';
              const severity = resolveSeverity(log);

              return (
                <div key={log._id} className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/40 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-extrabold px-2 py-0.5 bg-slate-200 text-slate-800 rounded-lg">
                        {log.action}
                      </span>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                        severity === 'Critical'
                          ? 'bg-rose-100 text-rose-800'
                          : severity === 'Warning'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {severity === 'Critical' && <AlertTriangle className="w-3 h-3" />}
                        {severity === 'Warning' && <AlertCircle className="w-3 h-3" />}
                        {severity === 'Info' && <Info className="w-3 h-3" />}
                        {severity}
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" /> {formattedDate}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-800">{log.details}</p>

                  <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" />
                      {log.actor || log.actorName || 'System'} {log.role ? `(${log.role})` : ''}
                    </span>
                    <span>•</span>
                    <span>IP: <strong className="font-mono text-slate-700">{log.ipAddress || '127.0.0.1'}</strong></span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <Pagination currentPage={page} totalPages={pages} onPageChange={setPage} />
      </div>
    </div>
  );
}
