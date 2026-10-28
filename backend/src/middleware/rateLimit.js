const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

const GENERAL_RATE_LIMIT_MESSAGE = 'Too many requests, please try again later.';
const AUTH_RATE_LIMIT_MESSAGE = 'Too many attempts from this IP, please try again later.';
const EMAIL_RATE_LIMIT_MESSAGE = 'Too many email requests from this IP, please try again later.';

const AUTH_SENSITIVE_PREFIXES = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/resetpassword',
  '/api/v1/auth/updatepassword',
  '/api/v1/auth/update-unverified-email',
  '/api/v1/auth/verify-email',
];

const EMAIL_SENSITIVE_PREFIXES = [
  '/api/v1/auth/forgotpassword',
  '/api/v1/auth/resend-verification',
];

const positiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const isProduction = () => process.env.NODE_ENV === 'production';

const rateLimitBody = (error) => ({
  success: false,
  error,
  message: error,
});

const clientIpKey = (req) => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return ipKeyGenerator(String(ip));
};

const bearerToken = (req) => {
  const authorization = req.headers?.authorization;
  if (typeof authorization !== 'string') return '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match && match[1].trim() ? match[1].trim() : '';
};

const cookieToken = (req) => {
  const token = req.cookies?.token;
  return typeof token === 'string' && token.trim() ? token.trim() : '';
};

// Only a signature-checked token gets its own bucket. Anything else shares the IP
// bucket, so rotating fake Authorization values cannot multiply the general limit.
const verifiedSessionKey = (token) => {
  try {
    jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
  } catch {
    return '';
  }

  const digest = crypto.createHash('sha256').update(token).digest('hex');
  return `session:${digest}`;
};

const sessionOrIpKey = (req) => {
  const bearerKey = verifiedSessionKey(bearerToken(req));
  if (bearerKey) return bearerKey;

  const cookieKey = verifiedSessionKey(cookieToken(req));
  if (cookieKey) return cookieKey;

  return `ip:${clientIpKey(req)}`;
};

const resolveRateLimitConfig = (overrides = {}) => ({
  windowMs: positiveInt(
    overrides.windowMs ?? process.env.RATE_LIMIT_WINDOW_MS,
    FIFTEEN_MINUTES_MS
  ),
  generalLimit: positiveInt(
    overrides.generalLimit ?? process.env.RATE_LIMIT_MAX,
    isProduction() ? 600 : 1500
  ),
  authLimit: positiveInt(
    overrides.authLimit ?? process.env.AUTH_RATE_LIMIT_MAX,
    isProduction() ? 100 : 200
  ),
  emailLimit: positiveInt(
    overrides.emailLimit ?? process.env.EMAIL_RATE_LIMIT_MAX,
    isProduction() ? 10 : 30
  ),
});

const createLimiter = ({ windowMs, limit, error, keyGenerator }) => rateLimit({
  windowMs,
  limit,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitBody(error),
  keyGenerator,
  validate: {
    keyGeneratorIpFallback: false,
    xForwardedForHeader: false,
  },
});

const createApiLimiters = (overrides = {}) => {
  const config = resolveRateLimitConfig(overrides);

  return {
    config,
    generalLimiter: createLimiter({
      windowMs: config.windowMs,
      limit: config.generalLimit,
      error: GENERAL_RATE_LIMIT_MESSAGE,
      keyGenerator: sessionOrIpKey,
    }),
    authLimiter: createLimiter({
      windowMs: config.windowMs,
      limit: config.authLimit,
      error: AUTH_RATE_LIMIT_MESSAGE,
      keyGenerator: (req) => `ip:${clientIpKey(req)}`,
    }),
    emailLimiter: createLimiter({
      windowMs: config.windowMs,
      limit: config.emailLimit,
      error: EMAIL_RATE_LIMIT_MESSAGE,
      keyGenerator: (req) => `ip:${clientIpKey(req)}`,
    }),
  };
};

const mountRateLimiters = (app, limiters = createApiLimiters()) => {
  app.use('/api/v1', limiters.generalLimiter);
  AUTH_SENSITIVE_PREFIXES.forEach((prefix) => {
    app.use(prefix, limiters.authLimiter);
  });
  EMAIL_SENSITIVE_PREFIXES.forEach((prefix) => {
    app.use(prefix, limiters.emailLimiter);
  });
  return limiters;
};

// Railway's public edge is one reverse proxy. Local development connects directly,
// so forwarded-client headers are untrusted unless TRUST_PROXY_HOPS is set.
const configureTrustProxy = (app) => {
  const raw = process.env.TRUST_PROXY_HOPS;
  if (raw !== undefined && String(raw).trim() !== '') {
    const hops = Number(String(raw).trim());
    if (Number.isInteger(hops) && hops > 0) {
      app.set('trust proxy', hops);
    }
    return;
  }

  if (isProduction()) {
    app.set('trust proxy', 1);
  }
};

module.exports = {
  AUTH_RATE_LIMIT_MESSAGE,
  AUTH_SENSITIVE_PREFIXES,
  EMAIL_RATE_LIMIT_MESSAGE,
  EMAIL_SENSITIVE_PREFIXES,
  GENERAL_RATE_LIMIT_MESSAGE,
  configureTrustProxy,
  createApiLimiters,
  mountRateLimiters,
  resolveRateLimitConfig,
};
