const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

const configuredBases = (env) => [env.CLIENT_URL, env.FRONTEND_URL]
  .map((value) => String(value || '').trim())
  .filter(Boolean);

const isLocalHost = (hostname) => {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  return LOCAL_HOSTS.has(host);
};

const parseBase = (candidate) => {
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch (err) {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;
  const path = parsed.pathname.replace(/\/+$/, '');
  const base = `${parsed.origin}${path === '/' ? '' : path}`;
  return { hostname: parsed.hostname, base };
};

/**
 * Invitation links follow the app's frontend base URL:
 * CLIENT_URL, then FRONTEND_URL. Local development may use localhost.
 * A non-local deployment does not fall back to localhost or a hardcoded site.
 */
const resolveInvitationBaseUrl = (env = process.env) => {
  const production = env.NODE_ENV === 'production';
  const configured = configuredBases(env);
  const candidates = configured.length ? configured : (production ? [] : ['http://localhost:5173']);
  let sawLocalhost = false;

  for (const candidate of candidates) {
    const parsed = parseBase(candidate);
    if (!parsed) continue;
    if (production && isLocalHost(parsed.hostname)) {
      sawLocalhost = true;
      continue;
    }
    return { ok: true, base: parsed.base };
  }

  if (!configured.length) return { ok: false, reason: 'missing' };
  if (sawLocalhost) return { ok: false, reason: 'localhost' };
  return { ok: false, reason: 'invalid' };
};

const buildAdminInvitationUrl = (token, env = process.env) => {
  const rawToken = String(token || '').trim();
  if (!rawToken || rawToken.includes('/')) {
    return { ok: false, reason: 'token' };
  }
  const resolved = resolveInvitationBaseUrl(env);
  if (!resolved.ok) return resolved;
  return { ok: true, url: `${resolved.base}/reset-password/${rawToken}` };
};

module.exports = {
  resolveInvitationBaseUrl,
  buildAdminInvitationUrl,
};
