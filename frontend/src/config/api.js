/**
 * Detects environment dynamically based on hostname.
 * - Localhost uses local backend.
 * - Any other domain (Railway/Production) uses the backend Railway URL.
 */
const isLocal = 
  typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const DEFAULT_API_BASE_URL = isLocal
  ? 'http://localhost:5000/api/v1'
  : 'https://iskolarmatch-backend.up.railway.app/api/v1';

export function resolveApiBaseUrl(configured) {
  const raw = String(configured || DEFAULT_API_BASE_URL).trim();
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