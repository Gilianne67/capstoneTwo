/**
 * One frontend API base.
 * Local development uses the local backend when VITE_API_URL is unset.
 * Staging and production set VITE_API_URL, including the /api/v1 prefix.
 */
export const LOCAL_API_BASE_URL = 'http://localhost:5000/api/v1';

export function resolveApiBaseUrl(configured) {
  const raw = String(configured || LOCAL_API_BASE_URL).trim();
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

const configuredBase =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.VITE_API_URL
    : undefined;

export const API_BASE_URL = resolveApiBaseUrl(configuredBase);

/** Host for paths that already include /api/v1, such as stored document URLs. */
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1$/, '');

export function apiUrl(path) {
  const normalized = String(path || '').replace(/^\//, '');
  return `${API_BASE_URL}/${normalized}`;
}
