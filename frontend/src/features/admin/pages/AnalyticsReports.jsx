import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Bookmark,
  Building2,
  Download,
  GraduationCap,
  Loader2,
  RefreshCw,
  Users,
} from 'lucide-react';

import PageHeader from '../../../components/common/PageHeader';
import MetricCard from '../../../components/common/MetricCard';
import DataTable from '../../../components/common/DataTable';
import { apiErrorText, apiUrl } from '../../../config/api';
import {
  ANALYTICS_RANGES,
  ANALYTICS_REPORTS,
  analyticsQueryString,
  customRangeReady,
  heatIntensity,
  periodCaption,
  reportDownloadName,
} from '../analyticsReports';

const EMPTY = {
  overview: null,
  registrations: null,
  scholarships: null,
  categoryDemand: null,
  students: null,
  providers: null,
};

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const formatCount = (value) => Number(value || 0).toLocaleString();

const formatRatio = (value) => (
  value === null || value === undefined
    ? '—'
    : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })
);

function Panel({ title, description, children }) {
  return (
    <section className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
      <div>
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function SectionState({ loading, error, onRetry, children }) {
  if (loading) {
    return (
      <div className="min-h-28 flex items-center justify-center gap-2 text-xs font-medium text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
        Loading report data
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">
        <span>{error}</span>
        <button type="button" onClick={onRetry} className="rounded-lg bg-rose-600 px-3 py-1 font-bold text-white">
          Retry
        </button>
      </div>
    );
  }
  return children;
}

function MeterList({ rows, tone = 'bg-amber-500', suffix = '' }) {
  const max = Math.max(0, ...rows.map((row) => row.count || 0));
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No records in this selection.</p>;
  }
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const width = max > 0 ? Math.round(((row.count || 0) / max) * 100) : 0;
        return (
          <div key={row.label} className="space-y-1">
            <div className="flex justify-between gap-3 text-xs font-semibold text-slate-700">
              <span className="truncate">{row.label}</span>
              <span className="shrink-0 text-slate-500">{formatCount(row.count)}{suffix}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full ${tone}`} style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CountBars({ series, caption }) {
  const max = Math.max(0, ...series.map((item) => item.count || 0));
  return (
    <div>
      <div className="overflow-x-auto">
        <div className="flex h-36 items-end gap-1" style={{ minWidth: `${Math.max(series.length * 14, 280)}px` }}>
          {series.map((bucket) => {
            const height = max > 0 && bucket.count > 0 ? Math.max(4, Math.round((bucket.count / max) * 132)) : 0;
            return (
              <div key={bucket.key} className="flex h-full min-w-[12px] flex-1 items-end" title={`${bucket.label}: ${bucket.count}`}>
                <div className="w-full rounded-t bg-amber-500" style={{ height }} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-semibold text-slate-400">
        <span>{series[0]?.label}</span>
        <span>{caption}</span>
        <span>{series[series.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function RegistrationChart({ series }) {
  const max = Math.max(0, ...series.map((item) => item.total || 0));
  const layers = [
    ['students', 'bg-amber-500', 'Students'],
    ['providers', 'bg-emerald-500', 'Providers'],
    ['admins', 'bg-blue-500', 'Admins'],
    ['superadmins', 'bg-violet-500', 'Super admins'],
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-[11px] font-bold text-slate-500">
        {layers.map(([key, color, label]) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
            {label}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <div className="flex h-40 items-end gap-1" style={{ minWidth: `${Math.max(series.length * 16, 320)}px` }}>
          {series.map((bucket) => {
            const total = bucket.total || 0;
            const height = max > 0 && total > 0 ? Math.max(4, Math.round((total / max) * 148)) : 0;
            return (
              <div
                key={bucket.key}
                className="flex h-full min-w-[14px] flex-1 items-end"
                title={`${bucket.label}: ${total} registrations (${bucket.students} students, ${bucket.providers} providers)`}
              >
                <div className="flex w-full flex-col justify-end overflow-hidden rounded-t" style={{ height }}>
                  {layers.map(([key, color]) => (
                    bucket[key] > 0 ? (
                      <div key={key} className={color} style={{ height: `${(bucket[key] / total) * 100}%` }} />
                    ) : null
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex justify-between text-[10px] font-semibold text-slate-400">
        <span>{series[0]?.label}</span>
        <span>{series[series.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export default function AnalyticsReports() {
  const [range, setRange] = useState('30d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [providerPage, setProviderPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState(EMPTY);
  const [exporting, setExporting] = useState('');
  const [exportError, setExportError] = useState('');

  const filters = { range, from, to };
  const query = analyticsQueryString(filters);
  const ready = customRangeReady(filters);

  useEffect(() => {
    if (!ready) {
      setLoading(false);
      setSections(EMPTY);
      return undefined;
    }

    let active = true;
    const load = async () => {
      setLoading(true);
      setSections(EMPTY);
      const requests = [
        ['overview', `admin/analytics/overview?${query}`],
        ['registrations', `admin/analytics/registrations?${query}`],
        ['scholarships', `admin/analytics/scholarships?${query}`],
        ['categoryDemand', `admin/analytics/category-demand?${query}`],
        ['students', `admin/analytics/student-insights?${query}`],
        ['providers', `admin/analytics/provider-insights?${query}&page=${providerPage}&limit=20`],
      ];
      const entries = await Promise.all(requests.map(async ([key, path]) => {
        try {
          const response = await fetch(apiUrl(path), { headers: authHeaders() });
          const body = await response.json().catch(() => ({}));
          if (!response.ok || body.success !== true) {
            throw new Error(apiErrorText(body, 'Unable to load this report.'));
          }
          return [key, { data: body, error: '' }];
        } catch (error) {
          return [key, { data: null, error: error.message || 'Unable to load this report.' }];
        }
      }));
      if (!active) return;
      setSections(Object.fromEntries(entries));
      setLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, [query, providerPage, reloadKey, ready]);

  const changeFilter = (setter) => (event) => {
    setter(event.target.value);
    setProviderPage(1);
  };

  const downloadReport = async (reportId) => {
    if (!ready) return;
    setExporting(reportId);
    setExportError('');
    try {
      const params = new URLSearchParams(query);
      params.set('report', reportId);
      if (reportId === 'provider-insights') {
        params.set('page', String(providerPage));
        params.set('limit', '20');
      }
      const response = await fetch(`${apiUrl('admin/analytics/export')}?${params.toString()}`, {
        headers: authHeaders(),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(apiErrorText(body, 'Unable to export this report.'));
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const period = sections.overview?.data?.period;
      link.href = url;
      link.download = reportDownloadName(reportId, period);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error.message || 'Unable to export this report.');
    } finally {
      setExporting('');
    }
  };

  const retry = () => setReloadKey((current) => current + 1);
  const overview = sections.overview?.data?.overview;
  const period = sections.overview?.data?.period || sections.registrations?.data?.period;
  const definitions = sections.overview?.data?.definitions || sections.registrations?.data?.definitions;
  const limitations = sections.overview?.data?.limitations || sections.registrations?.data?.limitations || [];
  const registrationReport = sections.registrations?.data?.registrations;
  const scholarshipReport = sections.scholarships?.data?.scholarships;
  const demandReport = sections.categoryDemand?.data?.categoryDemand;
  const studentReport = sections.students?.data?.studentInsights;
  const providerReport = sections.providers?.data?.providerInsights;
  const savedMax = Math.max(0, ...(demandReport?.rows || []).map((row) => row.savedInterest || 0));
  const providerTotal = providerReport?.scholarshipsByProvider?.total || 0;
  const providerPages = Math.max(1, Math.ceil(providerTotal / 20));

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <PageHeader
        title="Analytics & Reports"
        description="System-wide counts from stored accounts, scholarships, saves, applications, and structured filter events."
        role="admin"
        actionButton={(
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        )}
      />

      <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm md:grid-cols-3">
        <label className="text-xs font-bold text-slate-600">
          Period
          <select value={range} onChange={changeFilter(setRange)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800">
            {ANALYTICS_RANGES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        {range === 'custom' && (
          <>
            <label className="text-xs font-bold text-slate-600">
              From
              <input type="date" value={from} onChange={changeFilter(setFrom)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-800" />
            </label>
            <label className="text-xs font-bold text-slate-600">
              To
              <input type="date" value={to} onChange={changeFilter(setTo)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-800" />
            </label>
          </>
        )}
      </div>

      <p className="text-xs font-medium text-slate-500">
        {ready ? periodCaption(period) : 'Choose a start date and an end date to load the report.'}
      </p>

      <div className="flex flex-wrap gap-2">
        {ANALYTICS_REPORTS.map((report) => (
          <button
            key={report.id}
            type="button"
            disabled={!ready || exporting === report.id}
            onClick={() => downloadReport(report.id)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"
          >
            {exporting === report.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            CSV: {report.label}
          </button>
        ))}
      </div>
      {exportError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {exportError}
        </div>
      )}

      {!ready ? (
        <Panel title="Custom period" description="The dashboard stays blank until both dates are filled in, so it does not show counts for a different period.">
          <p className="text-sm text-slate-500">Select the start and end dates above.</p>
        </Panel>
      ) : (
        <>
          <Panel title="Overview" description="Totals count every stored record. Period figures count only the selected dates. Archived scholarships are not active.">
            <SectionState loading={loading && !overview} error={sections.overview?.error} onRetry={retry}>
              {overview && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard title="Registered users" value={formatCount(overview.totalRegisteredUsers)} trend={`${formatCount(overview.registrationsInPeriod.total)} new in period`} icon={Users} color="amber" />
                  <MetricCard title="Students" value={formatCount(overview.totalStudents)} trend={`${formatCount(overview.registrationsInPeriod.students)} new in period`} icon={GraduationCap} color="blue" />
                  <MetricCard title="Scholarship providers" value={formatCount(overview.totalProviders)} trend={`${formatCount(overview.registrationsInPeriod.providers)} new in period`} icon={Building2} color="emerald" />
                  <MetricCard title="Active accounts" value={formatCount(overview.totalActiveAccounts)} trend={`${formatCount(overview.totalSuspendedAccounts)} suspended · ${formatCount(overview.totalPendingConsentAccounts)} pending consent`} icon={Users} color="indigo" />
                  <MetricCard title="Scholarship listings" value={formatCount(overview.totalScholarshipListings)} trend="Includes archived and suspended-provider listings" icon={GraduationCap} color="amber" />
                  <MetricCard title="Active open scholarships" value={formatCount(overview.activeOpenScholarships)} trend="Open, not archived, provider not suspended" icon={GraduationCap} color="emerald" />
                  <MetricCard title="Archived scholarships" value={formatCount(overview.archivedScholarships)} trend={`${formatCount(overview.administrativelyRemovedScholarships)} administratively removed`} icon={GraduationCap} color="rose" />
                  <MetricCard title="Saved scholarships" value={formatCount(overview.totalSavedScholarships)} trend={`${formatCount(overview.savedScholarshipsInPeriod)} matching filters in period`} icon={Bookmark} color="blue" />
                  <MetricCard title="Recorded applications" value={formatCount(overview.totalRecordedApplications)} trend={`${formatCount(overview.recordedApplicationsInPeriod)} in period · external links are not counted`} icon={GraduationCap} color="indigo" />
                  <MetricCard title="Suspended accounts" value={formatCount(overview.totalSuspendedAccounts)} trend={`${formatCount(overview.suspendedProviderListings)} listings from suspended providers`} icon={Users} color="rose" />
                  <MetricCard title="Structured filter events" value={formatCount(overview.structuredSearchEventsInPeriod)} trend={overview.searchTrackingAvailableFrom ? `Tracking since ${overview.searchTrackingAvailableFrom.slice(0, 10)}` : 'No events recorded yet'} icon={Bookmark} color="amber" />
                  <MetricCard title="Administrators" value={formatCount(overview.totalAdministrators)} trend="Admins and super admins" icon={Users} color="amber" />
                </div>
              )}
            </SectionState>
          </Panel>

          <Panel title="User registration and growth" description="Bars count new accounts created during the selected period. Role and status totals below are the current directory, not a historical snapshot.">
            <SectionState loading={loading && !registrationReport} error={sections.registrations?.error} onRetry={retry}>
              {registrationReport && (
                <>
                  <RegistrationChart series={registrationReport.series} />
                  {registrationReport.inPeriod.total === 0 && (
                    <p className="text-sm text-slate-500">No accounts were created in this period. Days or months with no registrations stay at zero.</p>
                  )}
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Current role distribution</h3>
                      <MeterList rows={registrationReport.roleDistribution.map((row) => ({ label: row.role, count: row.count }))} />
                    </div>
                    <div>
                      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Current account status</h3>
                      <MeterList rows={registrationReport.accountStatus.map((row) => ({ label: row.status, count: row.count }))} tone="bg-blue-500" />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Cumulative accounts created before this period: {formatCount(registrationReport.cumulative.beforePeriod.total)}.
                    Accounts created through the end of the period: {formatCount(registrationReport.cumulative.throughPeriodEnd.total)}.
                    Those cumulative totals are not the height of the chart.
                  </p>
                  <p className="text-xs text-slate-500">
                    Student email verified: {formatCount(registrationReport.current.email.studentsVerified)}. Unverified: {formatCount(registrationReport.current.email.studentsUnverified)}.
                    Provider email verified: {formatCount(registrationReport.current.email.providersVerified)}. Unverified: {formatCount(registrationReport.current.email.providersUnverified)}.
                    Email verification is separate from organization verification.
                  </p>
                </>
              )}
            </SectionState>
          </Panel>

          <Panel title="Scholarship supply and availability" description="Active open counts are the current student-facing snapshot. The creation chart includes listings created in the period even if they were archived later. Each listing is in one category and one geographic bucket.">
            <SectionState loading={loading && !scholarshipReport} error={sections.scholarships?.error} onRetry={retry}>
              {scholarshipReport && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                    <div className="rounded-xl bg-slate-50 p-3"><p className="font-bold text-slate-500">Open, including suspended providers</p><p className="mt-1 text-xl font-black text-slate-900">{formatCount(scholarshipReport.openListingsIncludingSuspendedProviders)}</p></div>
                    <div className="rounded-xl bg-slate-50 p-3"><p className="font-bold text-slate-500">Closed, not archived</p><p className="mt-1 text-xl font-black text-slate-900">{formatCount(scholarshipReport.closedNotArchived)}</p></div>
                    <div className="rounded-xl bg-slate-50 p-3"><p className="font-bold text-slate-500">Deadline within 14 days</p><p className="mt-1 text-xl font-black text-slate-900">{formatCount(scholarshipReport.approachingDeadline)}</p></div>
                    <div className="rounded-xl bg-slate-50 p-3"><p className="font-bold text-slate-500">Past deadline and still open</p><p className="mt-1 text-xl font-black text-slate-900">{formatCount(scholarshipReport.pastDeadlineStillOpen)}</p></div>
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Listings created in the period</h3>
                  <CountBars series={scholarshipReport.createdSeries} caption="Created listings" />
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div>
                      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Listings by category</h3>
                      <MeterList rows={scholarshipReport.byCategory.map((row) => ({ label: row.category, count: row.listings }))} />
                    </div>
                    <div>
                      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">One geographic bucket per listing</h3>
                      <MeterList rows={scholarshipReport.byGeography.map((row) => ({ label: row.bucket, count: row.listings }))} tone="bg-emerald-500" />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Suspended-provider listings: {formatCount(scholarshipReport.suspendedProviderListings)}.
                    Of those, {formatCount(scholarshipReport.suspendedProviderApproachingDeadline)} are open with a deadline in the next 14 days.
                    They are omitted from student-facing availability.
                  </p>
                </>
              )}
            </SectionState>
          </Panel>

          <Panel title="Category demand matrix" description="Each scholarship is counted once, under its scholarship type. Saved interest and recorded applications are separate columns. Scholarship supply is not treated as student demand. Color shows saved interest only.">
            <SectionState loading={loading && !demandReport} error={sections.categoryDemand?.error} onRetry={retry}>
              {demandReport && (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                          <th className="px-2 py-2">Category</th>
                          <th className="px-2 py-2">Available</th>
                          <th className="px-2 py-2">Saved interest</th>
                          <th className="px-2 py-2">Recorded applications</th>
                          <th className="px-2 py-2">Saves per available</th>
                          <th className="px-2 py-2">Total listings</th>
                          <th className="px-2 py-2">Archived</th>
                        </tr>
                      </thead>
                      <tbody>
                        {demandReport.rows.map((row) => (
                          <tr key={row.category} className="border-b border-slate-100">
                            <td className="px-2 py-2 font-bold text-slate-800">{row.category}</td>
                            <td className="px-2 py-2">{formatCount(row.availableScholarships)}</td>
                            <td
                              className="px-2 py-2 font-bold"
                              style={{ backgroundColor: `rgba(217, 119, 6, ${heatIntensity(row.savedInterest, savedMax)})` }}
                              title="Saved scholarships in this category during the selected period. This is not an application."
                            >
                              {formatCount(row.savedInterest)}
                              {row.interestWithoutAvailableSupply ? ' · no available supply' : ''}
                            </td>
                            <td className="px-2 py-2" title="Application documents only. External application links are not included.">{formatCount(row.recordedApplications)}</td>
                            <td className="px-2 py-2">{formatRatio(row.savedInterestPerAvailableScholarship)}</td>
                            <td className="px-2 py-2">{formatCount(row.totalListings)}</td>
                            <td className="px-2 py-2">{formatCount(row.archivedListings)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-500">
                    Structured scholarship-type searches are not recorded, so that column is omitted.
                    Unlinked saves in the period: {formatCount(demandReport.savedMatchesUnlinked)}.
                    Recorded applications linked to a filtered scholarship: {formatCount(demandReport.recordedApplicationsInPeriod)}.
                  </p>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Eligibility tags are not additive</h3>
                  <p className="text-xs text-slate-500">{demandReport.eligibilityTagSupply.note}</p>
                  {demandReport.eligibilityTagComparison.rows.length === 0 ? (
                    <p className="text-sm text-slate-500">No eligibility-tag supply or structured tag filters in this selection.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                            <th className="px-2 py-2">Eligibility tag</th>
                            <th className="px-2 py-2">Available scholarships with tag</th>
                            <th className="px-2 py-2">Structured filter events</th>
                            <th className="px-2 py-2">Events per available scholarship</th>
                          </tr>
                        </thead>
                        <tbody>
                          {demandReport.eligibilityTagComparison.rows.map((row) => (
                            <tr key={row.tag} className="border-b border-slate-100">
                              <td className="px-2 py-2 font-semibold">{row.tag}</td>
                              <td className="px-2 py-2">{formatCount(row.availableScholarships)}</td>
                              <td className="px-2 py-2">{formatCount(row.structuredFilterEvents)}</td>
                              <td className="px-2 py-2">{formatRatio(row.eventsPerAvailableScholarship)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="text-xs text-slate-500">
                    {demandReport.structuredSearch.note}
                    {' '}
                    {demandReport.structuredSearch.availableFrom
                      ? `The oldest stored event is ${demandReport.structuredSearch.availableFrom.slice(0, 10)}.`
                      : 'No structured filter events are stored yet, so historical search demand is not shown.'}
                    {' '}Events are kept for {demandReport.structuredSearch.retentionDays} days.
                  </p>
                </>
              )}
            </SectionState>
          </Panel>

          <Panel title="Student interest" description="Saved scholarships are interest records. They do not mean the student applied, matched successfully, or received an award. Recommendation runs are not stored.">
            <SectionState loading={loading && !studentReport} error={sections.students?.error} onRetry={retry}>
              {studentReport && (
                <>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Saved scholarships in the period</h3>
                  <CountBars series={studentReport.savedSeries} caption="Saves" />
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div>
                      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Categories most saved</h3>
                      <MeterList rows={studentReport.categoriesMostSaved.map((row) => ({ label: row.category, count: row.savedInterest }))} />
                    </div>
                    <div>
                      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Student profiles by academic level</h3>
                      <MeterList rows={studentReport.profiles.academicLevel} tone="bg-blue-500" />
                    </div>
                    <div>
                      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Student profiles by course</h3>
                      <MeterList rows={studentReport.profiles.course} tone="bg-emerald-500" />
                      <p className="mt-2 text-[11px] text-slate-400">{studentReport.profiles.courseNote}</p>
                    </div>
                    <div>
                      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Student profiles by area</h3>
                      <MeterList rows={studentReport.profiles.region} tone="bg-violet-500" />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">{studentReport.savers.note}</p>
                  <div className="grid gap-6 lg:grid-cols-3">
                    <div>
                      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Savers by academic level</h3>
                      <MeterList rows={studentReport.savers.academicLevel} />
                    </div>
                    <div>
                      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Savers by course</h3>
                      <MeterList rows={studentReport.savers.course} />
                    </div>
                    <div>
                      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Savers by area</h3>
                      <MeterList rows={studentReport.savers.region} />
                    </div>
                  </div>
                </>
              )}
            </SectionState>
          </Panel>

          <Panel title="Provider verification" description="Organization verification is the provider application decision. Email verification is the provider account’s verified email. The table does not include representative contact details.">
            <SectionState loading={loading && !providerReport} error={sections.providers?.error} onRetry={retry}>
              {providerReport && (
                <>
                  <div className="grid gap-6 lg:grid-cols-3">
                    <div>
                      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Organization verification</h3>
                      <MeterList rows={providerReport.organizationVerification.map((row) => ({ label: row.status, count: row.count }))} />
                    </div>
                    <div>
                      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Provider email verification</h3>
                      <MeterList rows={[
                        { label: 'Verified email', count: providerReport.emailVerification.verified },
                        { label: 'Unverified email', count: providerReport.emailVerification.unverified },
                      ]} tone="bg-emerald-500" />
                    </div>
                    <div>
                      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Provider account status</h3>
                      <MeterList rows={[
                        { label: 'Active', count: providerReport.accountStatus.active },
                        { label: 'Suspended', count: providerReport.accountStatus.suspended },
                        { label: 'Pending consent', count: providerReport.accountStatus.pending_consent },
                      ]} tone="bg-blue-500" />
                    </div>
                  </div>
                  <DataTable
                    emptyMessage="No provider listings match these filters."
                    data={providerReport.scholarshipsByProvider.rows}
                    columns={[
                      { key: 'institutionName', header: 'Institution' },
                      { key: 'verificationStatus', header: 'Organization verification' },
                      { key: 'accountSuspended', header: 'Account suspended', render: (row) => (row.accountSuspended ? 'Yes' : 'No') },
                      { key: 'totalListings', header: 'Listings', render: (row) => formatCount(row.totalListings) },
                      { key: 'availableScholarships', header: 'Student-facing available', render: (row) => formatCount(row.availableScholarships) },
                      { key: 'archivedListings', header: 'Archived', render: (row) => formatCount(row.archivedListings) },
                      { key: 'createdInPeriod', header: 'Created in period', render: (row) => formatCount(row.createdInPeriod) },
                    ]}
                  />
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>{formatCount(providerTotal)} providers with listings in this filter</span>
                    <div className="flex gap-2">
                      <button type="button" disabled={providerPage <= 1} onClick={() => setProviderPage((page) => page - 1)} className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40">Previous</button>
                      <span>Page {providerPage} of {providerPages}</span>
                      <button type="button" disabled={providerPage >= providerPages} onClick={() => setProviderPage((page) => page + 1)} className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40">Next</button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">{providerReport.note} The CSV for this section uses the same page.</p>
                </>
              )}
            </SectionState>
          </Panel>

          {limitations.length > 0 && (
            <Panel title="What these reports cannot show" description="These limits come from the records the platform actually stores.">
              <ul className="list-disc space-y-1 pl-4 text-xs leading-5 text-slate-600">
                {limitations.map((item) => <li key={item}>{item}</li>)}
              </ul>
              {definitions && (
                <ul className="list-disc space-y-1 pl-4 text-xs leading-5 text-slate-500">
                  {Object.values(definitions).map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
