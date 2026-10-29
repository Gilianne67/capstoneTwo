const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SystemConfig = require('../models/SystemConfig');
const tokenService = require('../services/tokenService');
const { isAdminRole } = require('./auth');

const MAINTENANCE_CODE = 'MAINTENANCE';
const MAINTENANCE_MESSAGE = 'IskolarMatch is under maintenance. Students and providers cannot use the app right now. Please try again later.';

const normalizePath = (url) => {
  const path = String(url || '/').split('?')[0];
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path || '/';
};

/**
 * Exact exceptions. Admin routes are not on this list: an administrator is
 * recognized from a verified account, and every other caller is blocked.
 */
const isMaintenanceExempt = (method, url) => {
  const verb = String(method || '').toUpperCase();
  if (verb === 'OPTIONS') return true;

  const path = normalizePath(url);
  if (verb === 'GET' && (path === '/' || path === '/api/v1/health')) return true;
  if (verb === 'POST' && path === '/api/v1/auth/login') return true;
  if (verb === 'GET' && path === '/api/v1/auth/logout') return true;
  if (verb === 'POST' && path === '/api/v1/auth/forgotpassword') return true;
  if (verb === 'PUT' && /^\/api\/v1\/auth\/resetpassword\/[^/]+$/.test(path)) return true;
  return false;
};

const tokenFromRequest = (req) => {
  const header = req.headers && req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    if (token) return token;
  }
  if (req.cookies && req.cookies.token) return req.cookies.token;
  return '';
};

const passwordStillMatches = (user, decoded) => {
  if (!user.passwordChangedAt) return true;
  const changedAtMs = new Date(user.passwordChangedAt).getTime();
  const tokenChangedAt = Number(decoded.passwordChangedAt);
  return Number.isFinite(changedAtMs) && tokenChangedAt === changedAtMs;
};

const verifiedAdministrator = async (req) => {
  const token = tokenFromRequest(req);
  if (!token) return false;

  try {
    const blacklisted = await tokenService.isTokenBlacklisted(token);
    if (blacklisted) return false;
  } catch {
    return false;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const user = await User.findById(decoded.id).select('-password');
    if (!user || user.status === 'suspended') return false;
    if (!passwordStillMatches(user, decoded)) return false;
    return isAdminRole(user.role);
  } catch {
    return false;
  }
};

const maintenanceBody = () => ({
  success: false,
  code: MAINTENANCE_CODE,
  message: MAINTENANCE_MESSAGE,
  error: MAINTENANCE_MESSAGE,
});

const enforceMaintenanceMode = async (req, res, next) => {
  if (isMaintenanceExempt(req.method, req.originalUrl || req.url)) return next();

  let maintenanceOn = false;
  try {
    const config = await SystemConfig.findOne().select('maintenanceMode').lean();
    maintenanceOn = Boolean(config && config.maintenanceMode === true);
  } catch {
    console.error('Maintenance configuration could not be read.');
    return res.status(503).json({
      success: false,
      message: 'System configuration could not be read. Please try again shortly.',
      error: 'System configuration could not be read. Please try again shortly.',
    });
  }

  if (!maintenanceOn) return next();
  if (await verifiedAdministrator(req)) return next();
  return res.status(503).json(maintenanceBody());
};

module.exports = {
  MAINTENANCE_CODE,
  MAINTENANCE_MESSAGE,
  isMaintenanceExempt,
  enforceMaintenanceMode,
};
