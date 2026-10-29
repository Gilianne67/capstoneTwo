import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  Building2,
  CheckSquare,
  GraduationCap,
  Loader2,
  ShieldCheck,
  Users,
} from 'lucide-react';

import PageHeader from '../../../components/common/PageHeader';
import MetricCard from '../../../components/common/MetricCard';
import { apiErrorText, apiUrl } from '../../../config/api';
import {
  summaryCards,
  visibleActivity,
  visibleAlerts,
  visiblePendingActions,
} from '../operationsDashboard';

const ICONS = {
  studentAccounts: Users,
  providerAccounts: Building2,
  activeAccounts: CheckSquare,
  suspendedAccounts: AlertTriangle,
  verifiedProviderOrganizations: ShieldCheck,
  openScholarships: GraduationCap,
  archivedScholarships: Archive,
};

const formatWhen = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [pendingActions, setPendingActions] = useState([]);
  const [activity, setActivity] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const fetchAdminData = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(apiUrl('admin/dashboard'), { headers });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        const databaseAlert = Array.isArray(data.alerts)
          ? data.alerts.find((alert) => alert.id === 'database-read')
          : null;
        throw new Error(
          databaseAlert?.message
          || apiErrorText(data, 'Operational data could not be read from the database.')
        );
      }

      setSummary(data.summary || null);
      setPendingActions(visiblePendingActions(data.pendingActions));
      setActivity(visibleActivity(data.activity));
      setAlerts(visibleAlerts(data.alerts));
    } catch (err) {
      console.error('Failed to load admin dashboard data:', err);
      setSummary(null);
      setPendingActions([]);
      setActivity([]);
      setAlerts([]);
      setFetchError(err.message || 'Operational data could not be read from the database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const cards = summaryCards(summary);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <PageHeader
          title={`${getGreeting()}, System Administrator`}
          description="Current platform totals, pending work, and recent operational events."
          role="admin"
        />
        <div className="min-h-[300px] flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <Loader2 className="h-7 w-7 text-amber-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading operational overview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title={`${getGreeting()}, System Administrator`}
        description="Current totals and pending work. Historical trends stay in Analytics & Reports."
        role="admin"
      />

      {fetchError && (
        <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center justify-between gap-3 text-xs font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{fetchError}</span>
          </div>
          <button
            type="button"
            onClick={fetchAdminData}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors font-bold cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {!fetchError && alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <Link
              key={alert.id}
              to={alert.path}
              className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl flex items-center justify-between gap-3 text-xs font-medium"
            >
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
                {alert.message}
              </span>
              <span className="font-bold text-amber-800">Open settings</span>
            </Link>
          ))}
        </div>
      )}

      {!fetchError && cards.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Current totals</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-4xl">
              These counts are current totals, not a date range. Active accounts are user records with status active, across every role. Verified organizations are provider profiles with verification status Approved or Verified, and that count is separate from active accounts. Open scholarships follow the All Scholarships Open filter and include listings from suspended providers. Archived scholarships follow the All Scholarships Archived filter.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {cards.map((card) => {
              const icon = ICONS[card.id] || CheckSquare;
              const body = (
                <MetricCard
                  title={card.label}
                  value={card.value}
                  trend={card.caption}
                  icon={icon}
                  color={card.color}
                />
              );
              if (!card.href) {
                return <div key={card.id}>{body}</div>;
              }
              return (
                <Link key={card.id} to={card.href} className="block h-full rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500">
                  {body}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {!fetchError && (
        <section className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Pending actions</h2>
            <p className="text-xs text-slate-500 mt-1">Counts are current. Open the queue to review the records.</p>
          </div>
          {pendingActions.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No pending-action counts are available.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingActions.map((action) => (
                <Link
                  key={action.id}
                  to={action.path}
                  className="flex items-start justify-between gap-3 p-4 bg-slate-50 border border-slate-200/80 rounded-xl hover:border-amber-300"
                >
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{action.label}</h3>
                    {action.note && <p className="text-xs text-slate-500 mt-1">{action.note}</p>}
                  </div>
                  <span className="text-lg font-black text-slate-900">{action.count}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {!fetchError && (
        <section className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Recent activity</h2>
              <p className="text-xs text-slate-500 mt-1">Latest operational events from the audit log.</p>
            </div>
            <Link to="/dashboard/admin/audit-log" className="text-xs font-bold text-amber-700 hover:text-amber-800">
              Audit & Compliance
            </Link>
          </div>
          {activity.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No recent operational events.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {activity.map((item) => (
                <li key={item.id} className="py-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{item.description}</p>
                    <p className="text-[11px] text-slate-500 mt-1">{item.severity}</p>
                  </div>
                  <time dateTime={item.createdAt} className="text-[11px] font-semibold text-slate-500 shrink-0">
                    {formatWhen(item.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
