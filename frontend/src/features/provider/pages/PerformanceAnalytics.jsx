import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  BarChart2, 
  Eye, 
  MousePointerClick, 
  Users, 
  GraduationCap, 
  AlertCircle, 
  Loader2,
  Download,
  Filter,
  MapPin,
  DollarSign,
  Award
} from 'lucide-react';

import PageHeader from '../../../components/common/PageHeader';
import MetricCard from '../../../components/common/MetricCard';

// Simulated dynamic backend response that returns metrics based on active scoring weights
const getMockAnalyticsForCriteria = (range) => {
  const mult = range === '7d' ? 0.25 : range === '90d' ? 2.8 : range === '1y' ? 10 : 1;
  
  return {
    overview: {
      totalImpressions: Math.round(18450 * mult),
      impressionsTrend: range === '7d' ? '+4.1% vs last week' : '+14.2% vs last period',
      totalClicks: Math.round(2310 * mult),
      clicksTrend: range === '7d' ? '+2.3% vs last week' : '+8.5% vs last period',
      conversionRate: '12.5%',
      conversionTrend: 'Avg 11.8% benchmark',
      matchedStudents: Math.round(1420 * mult),
      matchedTrend: 'Based on dynamic scoring match'
    },
    monthlyTrends: [
      { label: range === '7d' ? 'Mon' : 'Mar', impressions: Math.round(2100 * mult), clicks: Math.round(240 * mult) },
      { label: range === '7d' ? 'Tue' : 'Apr', impressions: Math.round(3400 * mult), clicks: Math.round(410 * mult) },
      { label: range === '7d' ? 'Wed' : 'May', impressions: Math.round(4800 * mult), clicks: Math.round(620 * mult) },
      { label: range === '7d' ? 'Thu' : 'Jun', impressions: Math.round(3900 * mult), clicks: Math.round(490 * mult) },
      { label: range === '7d' ? 'Fri' : 'Jul', impressions: Math.round(4250 * mult), clicks: Math.round(550 * mult) }
    ],
    // Active scoring criteria configuration returned by API
    activeCriteria: ['income', 'gwa', 'course'], // e.g., 'location', 'course', 'income', 'gwa', 'yearLevel'
    breakdowns: {
      course: [
        { label: 'BS Computer Science / IT', count: Math.round(520 * mult), percentage: '36.6%' },
        { label: 'BS Nursing / Health Sciences', count: Math.round(340 * mult), percentage: '23.9%' },
        { label: 'BS Business Administration', count: Math.round(260 * mult), percentage: '18.3%' },
        { label: 'Others', count: Math.round(300 * mult), percentage: '21.2%' }
      ],
      income: [
        { label: 'Under ₱150,000 / year', count: Math.round(710 * mult), percentage: '50.0%' },
        { label: '₱150,000 - ₱300,000', count: Math.round(490 * mult), percentage: '34.5%' },
        { label: 'Above ₱300,000', count: Math.round(220 * mult), percentage: '15.5%' }
      ],
      gwa: [
        { label: '1.00 - 1.25 (High Honors)', count: Math.round(450 * mult), percentage: '31.7%' },
        { label: '1.26 - 1.50 (Honors)', count: Math.round(620 * mult), percentage: '43.7%' },
        { label: '1.51 - 2.00 (Passing Criteria)', count: Math.round(350 * mult), percentage: '24.6%' }
      ],
      location: [
        { label: 'Region V (Bicol)', count: Math.round(480 * mult), percentage: '33.8%' },
        { label: 'NCR (Metro Manila)', count: Math.round(390 * mult), percentage: '27.4%' },
        { label: 'Region IV-A (CALABARZON)', count: Math.round(280 * mult), percentage: '19.7%' },
        { label: 'Others', count: Math.round(270 * mult), percentage: '19.1%' }
      ]
    }
  };
};

export default function PerformanceAnalytics({ scholarshipId = null }) {
  const [timeRange, setTimeRange] = useState('30d');
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [analytics, setAnalytics] = useState(() => getMockAnalyticsForCriteria('30d'));

  useEffect(() => {
    let isMounted = true;

    const fetchAnalyticsData = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        
        // Include scholarshipId if filtering for a specific scholarship
        const query = `range=${timeRange}${scholarshipId ? `&scholarshipId=${scholarshipId}` : ''}`;
        const res = await fetch(`/api/v1/provider/analytics?${query}`, { headers });

        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setAnalytics(data);
            setIsUsingFallback(false);
          }
        } else {
          throw new Error('API Response Failed');
        }
      } catch (err) {
        if (isMounted) {
          setAnalytics(getMockAnalyticsForCriteria(timeRange));
          setIsUsingFallback(true);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchAnalyticsData();

    return () => {
      isMounted = false;
    };
  }, [timeRange, scholarshipId]);

  const handleExportReport = async () => {
    setIsExporting(true);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/v1/provider/analytics/export?range=${timeRange}`, { headers });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics_${timeRange}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        throw new Error('Export Endpoint Error');
      }
    } catch (err) {
      const csvRows = [
        ['Period', 'Impressions', 'Clicks'],
        ...(analytics.monthlyTrends || []).map(item => [item.label, item.impressions, item.clicks])
      ];
      const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map(e => e.join(',')).join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `analytics_${timeRange}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      setIsExporting(false);
    }
  };

  const metricCards = [
    { 
      label: 'Feed Impressions', 
      value: (analytics.overview?.totalImpressions ?? 0).toLocaleString(), 
      icon: Eye, 
      color: 'blue',
      trend: analytics.overview?.impressionsTrend || 'No data'
    },
    { 
      label: 'Outbound Referral Clicks', 
      value: (analytics.overview?.totalClicks ?? 0).toLocaleString(), 
      icon: MousePointerClick, 
      color: 'indigo',
      trend: analytics.overview?.clicksTrend || 'No data'
    },
    { 
      label: 'Conversion Rate', 
      value: analytics.overview?.conversionRate || '0%', 
      icon: TrendingUp, 
      color: 'emerald',
      trend: analytics.overview?.conversionTrend || 'No benchmark'
    },
    { 
      label: 'Eligible Matched Students', 
      value: (analytics.overview?.matchedStudents ?? 0).toLocaleString(), 
      icon: Users, 
      color: 'violet',
      trend: analytics.overview?.matchedTrend || 'Scoring engine match'
    }
  ];

  // Helper metadata to construct dynamic breakdown UI cards based on active criteria
  const CRITERIA_CONFIG = {
    course: { title: 'Academic Programs', icon: GraduationCap },
    income: { title: 'Household Income Brackets', icon: DollarSign },
    gwa: { title: 'GWA / Grade Distribution', icon: Award },
    location: { title: 'Geographic Reach', icon: MapPin }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <PageHeader 
          title="Performance & Analytics" 
          subtitle="Track engagement and criteria-matched applicant demographics."
        />
        <div className="min-h-[300px] flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200/80 p-6">
          <Loader2 className="h-7 w-7 text-emerald-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Recalculating analytics for range: {timeRange}...</p>
        </div>
      </div>
    );
  }

  const maxImpression = analytics.monthlyTrends?.length 
    ? Math.max(...analytics.monthlyTrends.map(t => t.impressions)) 
    : 1;

  // Determine which dynamic breakdown cards to render
  const activeKeys = analytics.activeCriteria && analytics.activeCriteria.length > 0 
    ? analytics.activeCriteria 
    : ['income', 'course']; // Default fallback criteria

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader 
          title="Performance & Analytics" 
          subtitle="Track engagement and criteria-matched applicant demographics."
        />

        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <select 
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-emerald-500 cursor-pointer shadow-xs"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="1y">Past Year</option>
            </select>
          </div>

          <button 
            type="button"
            onClick={handleExportReport}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>{isExporting ? 'Exporting...' : 'Export Report'}</span>
          </button>
        </div>
      </div>

      {isUsingFallback && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 p-3.5 rounded-xl flex items-center justify-between text-xs font-medium">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            Backend API offline. Showing simulated metrics for range: <strong>{timeRange}</strong>.
          </span>
        </div>
      )}

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((m, idx) => (
          <MetricCard key={idx} {...m} />
        ))}
      </div>

      {/* Engagement Chart Section */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-emerald-600" /> Impressions vs Outbound Clicks
          </h3>
          <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-200 inline-block"></span> Views
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Clicks
            </span>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          {analytics.monthlyTrends?.map((item, idx) => {
            const impWidth = Math.min(100, Math.round((item.impressions / maxImpression) * 100));
            const clickWidth = item.impressions > 0 
              ? Math.min(100, Math.round((item.clicks / item.impressions) * 100)) 
              : 0;

            return (
              <div key={idx} className="space-y-1.5 text-xs">
                <div className="flex justify-between font-semibold text-slate-700">
                  <span>{item.label}</span>
                  <span className="text-slate-400">
                    {item.impressions.toLocaleString()} views • <strong className="text-emerald-600">{item.clicks.toLocaleString()} clicks</strong>
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <div 
                    style={{ width: `${impWidth}%` }} 
                    className="bg-blue-200/80 h-full rounded-full transition-all duration-500 relative overflow-hidden"
                  >
                    <div 
                      style={{ width: `${clickWidth}%` }} 
                      className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DYNAMIC CRITERIA BREAKDOWN GRID */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Applicant Match Breakdown (Active Scoring Rules)
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeKeys.map((key) => {
            const config = CRITERIA_CONFIG[key] || { title: key.toUpperCase(), icon: Users };
            const IconComponent = config.icon;
            const items = analytics.breakdowns?.[key] || [];

            return (
              <div key={key} className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <IconComponent className="w-4 h-4 text-emerald-600" /> {config.title}
                  </h3>
                </div>

                <div className="space-y-3.5">
                  {items.length === 0 ? (
                    <p className="text-xs text-slate-400 font-medium">No criteria data logged.</p>
                  ) : (
                    items.map((row, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs border-b border-slate-50 pb-2 last:border-0">
                        <div className="pr-2">
                          <p className="font-bold text-slate-800">{row.label}</p>
                          <p className="text-[11px] text-slate-400 font-medium">{row.count.toLocaleString()} candidates</p>
                        </div>
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-bold rounded-lg text-[11px] shrink-0">
                          {row.percentage}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}