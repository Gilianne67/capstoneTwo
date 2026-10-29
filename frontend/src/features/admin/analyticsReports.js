export const ANALYTICS_RANGES = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom range' },
];

export const ANALYTICS_REPORTS = [
  { id: 'registrations', label: 'Registration trends' },
  { id: 'scholarships', label: 'Scholarship supply' },
  { id: 'category-demand', label: 'Category demand' },
  { id: 'student-insights', label: 'Student interest' },
  { id: 'provider-insights', label: 'Provider verification' },
];

export function analyticsQueryString({
  range = '30d',
  from = '',
  to = '',
} = {}) {
  const params = new URLSearchParams();
  if (range === 'custom') {
    if (from) params.set('from', from);
    if (to) params.set('to', to);
  } else if (range) {
    params.set('range', range);
  }
  return params.toString();
}

export function customRangeReady({ range, from, to } = {}) {
  if (range !== 'custom') return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(from || '')) && /^\d{4}-\d{2}-\d{2}$/.test(String(to || ''));
}

export function heatIntensity(value, max) {
  const amount = Number(value) || 0;
  const peak = Number(max) || 0;
  if (amount <= 0 || peak <= 0) return 0;
  return Math.max(0.15, Math.min(1, amount / peak));
}

export function reportDownloadName(reportId, period) {
  const from = period?.from || 'period';
  const to = period?.to || 'period';
  return `iskolarmatch-${reportId}-${from}-to-${to}.csv`;
}

export function periodCaption(period) {
  if (!period?.from || !period?.to) return 'Selected period';
  const range = period.from === period.to ? period.from : `${period.from} to ${period.to}`;
  const grouping = period.grouping === 'month' ? 'monthly' : 'daily';
  return `${range} · ${grouping} · ${period.timeZone || 'Asia/Manila'}`;
}
