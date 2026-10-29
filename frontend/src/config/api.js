import axios from 'axios';
import { endedSessionReason, SESSION_ENDED_EVENT, shouldIgnoreSessionEnd } from '../context/sessionEnded.js';
import { isMaintenanceResponse, publishMaintenance } from '../context/maintenanceMode.js';

axios.defaults.withCredentials = true;

/**
 * Automatically detects environment based on hostname.
 * - Localhost / 127.0.0.1 -> Uses local backend (http://localhost:5000)
 * - Production (iskolarmatch.website) -> Uses production backend (https://api.iskolarmatch.website)
 */
const isLocal = 
  typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const DEFAULT_API_BASE_URL = isLocal
  ? 'http://localhost:5000/api/v1'
  : 'https://api.iskolarmatch.website/api/v1';

export function resolveApiBaseUrl(configured) {
  const raw = String(configured || DEFAULT_API_BASE_URL).trim();
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

// Allow manual override via VITE_API_URL environment variable if needed
const configuredBase =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.VITE_API_URL
    : undefined;

export const API_BASE_URL = resolveApiBaseUrl(configuredBase);

/** Host for paths that already include /api/v1, such as stored document URLs. */
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1$/, '');

export function apiErrorText(data, fallback) {
  const message = data?.message || data?.error;
  return message ? String(message) : fallback;
}

export function apiUrl(path) {
  const normalized = String(path || '').replace(/^\//, '');
  return `${API_BASE_URL}/${normalized}`;
}

/**
 * HELPER: Formats any relative URL to point to the correct backend
 * HELPER: Formats any relative URL to point to the backend
 */
function rewriteUrl(url) {
  if (typeof url === 'string' && url.startsWith('/')) {
    const cleanPath = url
      .replace(/^\/api\/v1/, '')
      .replace(/^\//, '');
    return `${API_BASE_URL}/${cleanPath}`;
  }
  return url;
}

/**
 * 1. AXIOS INTERCEPTOR
 */
axios.interceptors.request.use((config) => {
  config.url = rewriteUrl(config.url);
  return config;
}, (error) => Promise.reject(error));

axios.interceptors.response.use((response) => response, (error) => {
  const status = error?.response?.status;
  const url = error?.config?.url || '';
  if (isMaintenanceResponse(status, error?.response?.data)) {
    publishMaintenance(error.response.data);
  } else if (
    typeof window !== 'undefined'
    && !shouldIgnoreSessionEnd(url)
    && endedSessionReason(status, error?.response?.data)
  ) {
    window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
  }
  return Promise.reject(error);
});

/**
 * 2. WINDOW.FETCH INTERCEPTOR (Catches standard fetch calls)
 */
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async function (resource, init) {
    if (typeof resource === 'string') {
      resource = rewriteUrl(resource);
    } else if (resource instanceof Request) {
      const newUrl = rewriteUrl(resource.url);
      if (newUrl !== resource.url) {
        resource = new Request(newUrl, resource);
      }
    }
    return originalFetch.call(this, resource, init).then(async (response) => {
      const url = typeof resource === 'string'
        ? resource
        : (resource instanceof Request ? resource.url : '');
      if (response.status === 503 || response.status === 401 || response.status === 403) {
        try {
          const data = await response.clone().json();
          if (isMaintenanceResponse(response.status, data)) {
            publishMaintenance(data);
          } else if (
            !shouldIgnoreSessionEnd(url)
            && endedSessionReason(response.status, data)
          ) {
            window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
          }
        } catch {
          // A non-JSON body is not a session-ending or maintenance response.
        }
      }
      return response;
    });
  };
}