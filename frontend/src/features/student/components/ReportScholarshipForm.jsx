import { useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { API_BASE_URL, apiErrorText } from '../../../config/api';

export const REPORT_CATEGORIES = [
  'Incorrect or misleading information',
  'Expired or closed scholarship',
  'Suspicious or potentially fraudulent listing',
  'Incorrect eligibility requirements',
  'Other concern',
];

const getCleanToken = (contextToken) => {
  const rawToken = contextToken || localStorage.getItem('token');

  if (!rawToken) return null;

  return String(rawToken)
    .replace(/^"|"$/g, '')
    .replace(/^Bearer\s+/i, '')
    .trim();
};

export default function ReportScholarshipForm({ scholarshipId, scholarshipTitle }) {
  const { token: contextToken } = useAuth();
  const [category, setCategory] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!scholarshipId) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!category) {
      setError('Choose a reason for this report.');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = getCleanToken(contextToken);
      const response = await fetch(
        `${API_BASE_URL}/students/scholarships/${scholarshipId}/reports`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            category,
            details: details.trim(),
            scholarshipId,
          }),
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(apiErrorText(data, 'Unable to submit this report.'));
      }

      setSuccess('Your report was sent to administrators. This listing stays available while they review it.');
      setCategory('');
      setDetails('');
    } catch (err) {
      setError(err.message || 'Unable to submit this report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      onClick={(event) => event.stopPropagation()}
      className="bg-card-bg border border-app-text/10 rounded-2xl p-4 space-y-3"
    >
      <div>
        <h3 className="text-sm font-extrabold text-app-text flex items-center gap-2">
          <Flag className="h-4 w-4 text-primary" />
          Report this scholarship
        </h3>
        <p className="text-xs text-text-muted mt-1">
          {scholarshipTitle
            ? `Listing: ${scholarshipTitle}`
            : 'Tell an administrator what is wrong with this listing.'}
        </p>
      </div>

      <label className="block text-xs font-bold text-app-text">
        Reason
        <select
          required
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="mt-1 w-full rounded-xl border border-app-text/10 bg-app-bg px-3 py-2 text-xs font-semibold text-app-text"
        >
          <option value="">Select a reason</option>
          {REPORT_CATEGORIES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>

      <label className="block text-xs font-bold text-app-text">
        Additional details
        <span className="ml-1 font-medium text-text-muted">(optional)</span>
        <textarea
          value={details}
          maxLength={1000}
          rows={3}
          onChange={(event) => setDetails(event.target.value)}
          className="mt-1 w-full rounded-xl border border-app-text/10 bg-app-bg px-3 py-2 text-xs font-medium text-app-text"
        />
      </label>

      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
      {success ? <p className="text-xs font-medium text-primary">{success}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-extrabold disabled:opacity-60"
      >
        {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        Submit report
      </button>
    </form>
  );
}
