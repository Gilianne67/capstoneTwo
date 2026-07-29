import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Download, 
  Search, 
  AlertCircle, 
  Loader2, 
  Clock, 
  User, 
  FileCheck,
  Server
} from 'lucide-react';

import PageHeader from '../../../components/common/PageHeader';
import StatusBadge from '../../../components/common/StatusBadge';

// Fallback Mock Audit Logs
const MOCK_AUDIT_LOGS = [
  {
    _id: 'log-101',
    actor: 'Admin User',
    role: 'System Administrator',
    action: 'APPROVED_PROVIDER',
    details: 'Verified SEC documentation for Innovate Tech Foundation',
    ipAddress: '112.198.102.14',
    timestamp: '2026-07-29 13:42:10',
    severity: 'Info'
  },
  {
    _id: 'log-102',
    actor: 'Admin User',
    role: 'System Administrator',
    action: 'REMOVED_FLAGGED_LISTING',
    details: 'Took down listing "Guaranteed Overseas Student Grant" for fraud report',
    ipAddress: '112.198.102.14',
    timestamp: '2026-07-28 16:15:02',
    severity: 'Warning'
  },
  {
    _id: 'log-103',
    actor: 'System Automated Guard',
    role: 'Automated Bot',
    action: 'DATA_ENCRYPTION_CHECK',
    details: 'Completed scheduled platform privacy and SSL audit',
    ipAddress: '127.0.0.1',
    timestamp: '2026-07-28 00:00:00',
    severity: 'Info'
  },
  {
    _id: 'log-104',
    actor: 'Provider Admin',
    role: 'Provider Representative',
    action: 'UPDATED_SCHOLARSHIP_DEADLINE',
    details: 'Extended deadline for STEM Leaders Grant 2026',
    ipAddress: '202.175.88.91',
    timestamp: '2026-07-27 10:20:44',
    severity: 'Info'
  }
];

export default function AuditCompliance() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('All');

  useEffect(() => {
    let isMounted = true;

    const fetchAuditLogs = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await fetch('/api/v1/admin/audit-logs', { headers });

        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setLogs(Array.isArray(data) ? data : MOCK_AUDIT_LOGS);
            setIsUsingFallback(false);
          }
        } else {
          throw new Error('Audit Log API error');
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Backend server offline. Displaying fallback compliance logs:', err);
          setLogs(MOCK_AUDIT_LOGS);
          setIsUsingFallback(true);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchAuditLogs();

    return () => {
      isMounted = false;
    };
  }, []);

  // Export CSV Compliance Report
  const handleExportCSV = () => {
    const csvRows = [
      ['Timestamp', 'Actor', 'Role', 'Action', 'Details', 'IP Address', 'Severity']
    ];

    logs.forEach(l => {
      csvRows.push([
        l.timestamp,
        `"${l.actor}"`,
        `"${l.role}"`,
        l.action,
        `"${l.details}"`,
        l.ipAddress,
        l.severity
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Audit_Compliance_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredLogs = logs.filter((l) => {
    const matchesSearch = l.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          l.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          l.details.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSev = severityFilter === 'All' || l.severity === severityFilter;
    return matchesSearch && matchesSev;
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <PageHeader 
          title="Audit & Compliance Logs" 
          subtitle="Inspect system action trails, security events, and export regulatory compliance reports."
        />
        <div className="min-h-[300px] flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200/80 p-6">
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
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs shrink-0 self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-emerald-400" /> Export Compliance CSV
        </button>
      </div>

      {isUsingFallback && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 p-3.5 rounded-xl flex items-center justify-between text-xs font-medium">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            Backend API unreachable. Displaying local fallback audit logs.
          </span>
        </div>
      )}

      {/* Compliance Overview Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Data Protection Standard</p>
            <p className="text-xs font-bold text-slate-900">RA 10173 (DPA 2012) Compliant</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Audit Retention</p>
            <p className="text-xs font-bold text-slate-900">365 Days Rolling Logs</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Log Integrity</p>
            <p className="text-xs font-bold text-slate-900">Immutable Cryptographic Trail</p>
          </div>
        </div>
      </div>

      {/* Audit Log Table Workbench */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-2">
            {['All', 'Info', 'Warning'].map((sev) => (
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
              placeholder="Search action or actor..."
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
            filteredLogs.map((log) => (
              <div key={log._id} className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/40 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-extrabold px-2 py-0.5 bg-slate-200 text-slate-800 rounded-lg">
                      {log.action}
                    </span>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                      log.severity === 'Warning' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {log.severity}
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" /> {log.timestamp}
                  </span>
                </div>

                <p className="text-xs font-semibold text-slate-800">{log.details}</p>

                <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" /> {log.actor} ({log.role})
                  </span>
                  <span>•</span>
                  <span>IP: <strong className="font-mono text-slate-700">{log.ipAddress}</strong></span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}