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

// Helper to resolve severity if not explicitly set by backend
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

export default function AuditCompliance() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('All');

  const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };
  };

  // Fetch Production Audit Logs from Backend API
  const fetchAuditLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/admin/audit-logs', {
        headers: getHeaders()
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to retrieve audit log trails from server.');
      }

      const data = await res.json();
      const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
      setLogs(list);
    } catch (err) {
      console.error('Fetch Audit Logs Error:', err);
      setError(err.message || 'Unable to connect to the audit service.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Safe CSV Exporter using Blob, Proper Escaping, and Backend Audit Trigger
  const handleExportCSV = async () => {
    // 1. Notify backend of export action
    try {
      await fetch('/api/v1/admin/audit-logs/export', {
        method: 'POST',
        headers: getHeaders()
      });
    } catch (exportErr) {
      console.warn('Could not record export audit event on backend:', exportErr);
    }

    // 2. Generate and download CSV locally
    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = ['Timestamp', 'Actor', 'Role', 'Action', 'Details', 'IP Address', 'Severity'];
    const rows = filteredLogs.map(l => [
      escapeCSV(l.createdAt || l.timestamp),
      escapeCSV(l.actor || l.actorName || 'System'),
      escapeCSV(l.role || 'N/A'),
      escapeCSV(l.action),
      escapeCSV(l.details),
      escapeCSV(l.ipAddress || '0.0.0.0'),
      escapeCSV(resolveSeverity(l))
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Audit_Compliance_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // 3. Refresh log feed to reflect the EXPORT_LOGS entry
    fetchAuditLogs();
  };

  const filteredLogs = logs.filter((l) => {
    const searchLower = searchQuery.toLowerCase();
    const actorStr = String(l.actor || l.actorName || '');
    const actionStr = String(l.action || '');
    const detailsStr = String(l.details || '');

    const matchesSearch = actorStr.toLowerCase().includes(searchLower) ||
                          actionStr.toLowerCase().includes(searchLower) ||
                          detailsStr.toLowerCase().includes(searchLower);

    const severity = resolveSeverity(l);
    const matchesSev = severityFilter === 'All' || severity === severityFilter;
    return matchesSearch && matchesSev;
  });

  // Calculate Real-Time Compliance Metrics using resolveSeverity
  const infoCount = logs.filter(l => resolveSeverity(l) === 'Info').length;
  const warningCount = logs.filter(l => resolveSeverity(l) === 'Warning').length;
  const criticalCount = logs.filter(l => resolveSeverity(l) === 'Critical').length;

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <PageHeader 
          title="Audit & Compliance Logs" 
          subtitle="Inspect system action trails, security events, and export regulatory compliance reports."
        />
        <div className="min-h-[300px] flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <Loader2 className="h-7 w-7 text-emerald-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Retrieving security audit log trails...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader 
          title="Audit & Compliance Logs" 
          subtitle="Inspect system action trails, security events, and export regulatory compliance reports."
        />

        <button
          type="button"
          onClick={handleExportCSV}
          disabled={filteredLogs.length === 0}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs shrink-0 self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-emerald-400" /> Export Compliance CSV
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

      {/* Compliance Overview Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Total System Events</p>
            <p className="text-sm font-bold text-slate-900">{logs.length} Log Entries</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Standard & Warning Events</p>
            <p className="text-sm font-bold text-slate-900">{infoCount} Info / {warningCount} Warnings</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Security & Critical Alerts</p>
            <p className="text-sm font-bold text-slate-900">
              {criticalCount > 0 ? (
                <span className="text-rose-600">{criticalCount} Critical Events</span>
              ) : (
                <span className="text-emerald-600">0 Critical Breaches</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Audit Log Table Workbench */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            {['All', 'Info', 'Warning', 'Critical'].map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSeverityFilter(sev)}
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

          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input 
              type="text"
              placeholder="Search action, actor, or details..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Audit Log Entries */}
        <div className="space-y-3 pt-2">
          {filteredLogs.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No compliance audit logs found matching criteria.</p>
          ) : (
            filteredLogs.map((log) => {
              const formattedDate = log.createdAt 
                ? new Date(log.createdAt).toLocaleString() 
                : log.timestamp || 'N/A';
              const severity = resolveSeverity(log);

              return (
                <div key={log._id || Math.random()} className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2">
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
      </div>
    </div>
  );
}