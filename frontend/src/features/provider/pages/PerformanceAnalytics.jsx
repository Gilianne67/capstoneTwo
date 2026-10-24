import React, { useState, useEffect } from 'react';
import {
  BarChart2,
  Bookmark,
  CalendarDays,
  Layers,
  Award,
  AlertCircle,
  Loader2,
  Download,
  Filter,
} from 'lucide-react';

import PageHeader from '../../../components/common/PageHeader';
import MetricCard from '../../../components/common/MetricCard';
import DataTable from '../../../components/common/DataTable';
import { API_BASE_URL } from '../../../config/api';

const RANGE_OPTIONS = [
  { value: '3m', label: 'Last 3 months' },
  { value: '6m', label: 'Last 6 months' },
  { value: '12m', label: 'Last 12 months' },
];

const escapeCsv = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const periodLabel = (analytics) => {
  const trend = analytics?.creationTrend || [];
  if (trend.length > 0) {
    const first = trend[0].label;
    const last = trend[trend.length - 1].label;
    return first === last ? first : `${first} to ${last}`;
  }
  if (analytics?.period?.from && analytics?.period?.to) {
    return analytics.period.from === analytics.period.to
      ? analytics.period.from
      : `${analytics.period.from} to ${analytics.period.to}`;
  }
  return 'Selected period';
};

const downloadAnalyticsCsv = (analytics) => {
  const rows = [
    ['Section', 'Label', 'Value'],
    ['Overview', 'Total scholarships created', analytics.overview?.totalCreated ?? 0],
    ['Overview', 'Open scholarships', analytics.overview?.openScholarships ?? 0],
    ['Overview', 'Student saves', analytics.overview?.totalSaves ?? 0],
    ['Overview', 'Created in period', analytics.overview?.createdInPeriod ?? 0],
    ['Period', 'From', analytics.period?.from || ''],
    ['Period', 'To', analytics.period?.to || ''],
    [],
    ['Month', 'Scholarships created'],
    ...(analytics.creationTrend || []).map((month) => [month.label, month.count]),
    [],
    ['Scholarship', 'Status', 'Archived', 'Student saves'],
    ...(analytics.scholarships || []).map((scholarship) => [
      scholarship.name,
      scholarship.status,
      scholarship.isArchived ? 'Yes' : 'No',
      scholarship.saveCount,
    ]),
  ];

  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `scholarship-analytics-${analytics.period?.from || 'period'}-to-${analytics.period?.to || 'period'}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

function BarRow({ label, value, max, suffix }) {
  const width = max > 0 ? Math.round((value / max) * 100) : 0;

  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex justify-between gap-3 font-semibold text-slate-700">
        <span className="truncate">{label}</span>
        <span className="text-slate-500 shrink-0">
          {Number(value).toLocaleString()} {suffix}
        </span>
      </div>
      <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
        <div
          style={{ width: `${width}%` }}
          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
        />
      </div>
    </div>
  );
}

function MostSavedPanel({ mostSaved }) {
  if (!mostSaved) {
    return (
      <p className="text-sm text-slate-500">
        You have not created any scholarships yet.
      </p>
    );
  }

  if (mostSaved.saveCount === 0) {
    return (
      <p className="text-sm text-slate-500">
        Students have not saved any of your scholarships yet.
      </p>
    );
  }

  const names = (mostSaved.scholarships || []).map((scholarship) => scholarship.name);
  const tied = names.length > 1;

  return (
    <div className="space-y-2">
      <p className="text-lg font-bold text-slate-900">
        {tied ? `${names.length} scholarships tied` : names[0]}
      </p>
      <p className="text-sm text-slate-600">
        {mostSaved.saveCount.toLocaleString()} student {mostSaved.saveCount === 1 ? 'save' : 'saves'}
        {tied ? `. Tied: ${names.join(', ')}` : ''}
      </p>
    </div>
  );
}

export default function PerformanceAnalytics() {
  const [range, setRange] = useState('6m');
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchAnalytics = async () => {
      setIsLoading(true);
      setError('');
      setAnalytics(null);

      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Authentication token not found. Please log in again.');
        }

        const response = await fetch(`${API_BASE_URL}/provider/analytics?range=${range}`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success !== true || !data.analytics) {
          throw new Error(data.message || 'Failed to load analytics.');
        }

        if (isMounted) {
          setAnalytics(data.analytics);
        }
      } catch (err) {
        if (isMounted) {
          setAnalytics(null);
          setError(err.message || 'Failed to load analytics.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchAnalytics();

    return () => {
      isMounted = false;
    };
  }, [range, reloadKey]);

  const overview = analytics?.overview || {};
  const creationMax = Math.max(
    0,
    ...(analytics?.creationTrend || []).map((month) => month.count)
  );
  const engagementMax = Math.max(
    0,
    ...(analytics?.topScholarships || []).map((scholarship) => scholarship.saveCount)
  );
  const selectedRangeLabel = RANGE_OPTIONS.find((option) => option.value === range)?.label || 'Selected period';

  const metricCards = [
    {
      label: 'Total scholarships',
      value: (overview.totalCreated ?? 0).toLocaleString(),
      icon: Layers,
      color: 'blue',
      trend: 'Includes archived listings',
    },
    {
      label: 'Open scholarships',
      value: (overview.openScholarships ?? 0).toLocaleString(),
      icon: CalendarDays,
      color: 'emerald',
      trend: 'Open and not archived',
    },
    {
      label: 'Student saves',
      value: (overview.totalSaves ?? 0).toLocaleString(),
      icon: Bookmark,
      color: 'indigo',
      trend: 'Saves across your listings',
    },
    {
      label: 'Created in period',
      value: (overview.createdInPeriod ?? 0).toLocaleString(),
      icon: BarChart2,
      color: 'amber',
      trend: analytics ? periodLabel(analytics) : selectedRangeLabel,
    },
  ];

  const columns = [
    {
      header: 'Scholarship',
      accessor: 'name',
      cell: (row) => <span className="font-bold text-slate-900">{row.name}</span>,
    },
    {
      header: 'Status',
      accessor: 'status',
    },
    {
      header: 'Archived',
      accessor: 'isArchived',
      cell: (row) => (row.isArchived ? 'Yes' : 'No'),
    },
    {
      header: 'Student saves',
      accessor: 'saveCount',
      cell: (row) => row.saveCount.toLocaleString(),
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Performance & Analytics"
        description="Scholarship creation and student saves for your listings."
        role="provider"
        actionButton={(
          <>
            <div className="relative flex items-center">
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
              <select
                value={range}
                onChange={(event) => setRange(event.target.value)}
                aria-label="Analytics period"
                className="pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-emerald-500 cursor-pointer shadow-xs"
              >
                {RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => downloadAnalyticsCsv(analytics)}
              disabled={!analytics || isLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Report</span>
            </button>
          </>
        )}
      />

      {isLoading && (
        <div className="min-h-[300px] flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200/80 p-6">
          <Loader2 className="h-7 w-7 text-emerald-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">
            Loading analytics for {selectedRangeLabel.toLowerCase()}...
          </p>
        </div>
      )}

      {!isLoading && error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </span>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-xs font-bold cursor-pointer"
          >
            Try again
          </button>
        </div>
      )}

      {!isLoading && analytics && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {metricCards.map((card) => (
              <MetricCard key={card.label} {...card} />
            ))}
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <Award className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">Most saved scholarship</h3>
                <MostSavedPanel mostSaved={analytics.mostSaved} />
                <p className="text-[11px] text-slate-400">
                  A save is a student bookmark. It is not an application, view, or click.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-emerald-600" />
                  Scholarships created by month
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  {periodLabel(analytics)} · Asia/Manila · months with no new listings stay at zero
                </p>
              </div>
              <div className="space-y-4 pt-1 max-h-96 overflow-y-auto pr-1">
                {(analytics.creationTrend || []).map((month) => (
                  <BarRow
                    key={month.label}
                    label={month.label}
                    value={month.count}
                    max={creationMax}
                    suffix={month.count === 1 ? 'scholarship' : 'scholarships'}
                  />
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-emerald-600" />
                  Student saves by scholarship
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  {analytics.topScholarships?.length
                    ? `Top ${analytics.topScholarships.length} by saves. Ties at the cutoff are included.`
                    : 'Save counts appear here after you create a scholarship.'}
                </p>
              </div>
              {analytics.topScholarships?.length ? (
                <div className="space-y-4 pt-1 max-h-96 overflow-y-auto pr-1">
                  {analytics.topScholarships.map((scholarship) => (
                    <BarRow
                      key={scholarship.id}
                      label={scholarship.name}
                      value={scholarship.saveCount}
                      max={engagementMax}
                      suffix={scholarship.saveCount === 1 ? 'save' : 'saves'}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-medium">No scholarships to compare yet.</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Scholarship performance</h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Every listing you created, including archived scholarships and listings with zero saves.
              </p>
            </div>
            <DataTable
              columns={columns}
              data={analytics.scholarships || []}
              emptyMessage="No scholarships yet. Create a listing to see it here."
            />
          </div>
        </>
      )}
    </div>
  );
}
