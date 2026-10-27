const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Provider = require('../models/Provider');
const tokenService = require('../services/tokenService');
const {
  isFinalRejection,
  declinedProviderLoginMessage,
} = require('../utils/providerVerification');

const isLogoutRequest = (req) =>
  req.method === 'GET' && String(req.originalUrl || req.url || '').split('?')[0].endsWith('/auth/logout');

const rejectedProviderMessage = (provider) =>
  `Your provider application was declined. Reason: ${provider?.rejectionReason || 'Please contact support for more details.'}`;

/**
 * Authentication Middleware
 */
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: 'Please log in to continue.' });
  }

  // Safe check for token revocation (Redis / Blacklist)
  try {
    const isBlacklistedFn =
      typeof tokenService === 'function'
        ? tokenService
        : tokenService?.isTokenBlacklisted;

    if (typeof isBlacklistedFn === 'function') {
      const blacklisted = await isBlacklistedFn(token);
      if (blacklisted) {
        return res.status(401).json({
          success: false,
          message: 'Your session has been revoked. Please log in again.',
        });
      }
    }
  } catch (err) {
    console.warn('Blacklist check skipped:', err.message);
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'fallback_secret'
    );

    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'We could not find your account. Please sign up or log in again.',
      });
    }

    // passwordChangedAt is stored in milliseconds. JWT iat only has second
    // precision, so a token from the same UTC second is accepted only when it
    // carries this exact cutoff. Redis revocation stays fail-open above.
    // Logout stays available.
    if (req.user.passwordChangedAt && !isLogoutRequest(req)) {
      const changedAtMs = new Date(req.user.passwordChangedAt).getTime();
      const tokenChangedAt = Number(decoded.passwordChangedAt);
      if (!Number.isFinite(changedAtMs) || tokenChangedAt !== changedAtMs) {
        return res.status(401).json({
          success: false,
          message: 'Your session has been revoked. Please log in again.',
        });
      }
    }

    // Suspension is read from the persisted account, not the JWT claim and
    // not Redis. Logout stays available so the presented token can still be
    // blocklisted. The blocklist check above remains fail-open when Redis is
    // down; this status check is fail-closed for suspended accounts.
    if (req.user.status === 'suspended' && !isLogoutRequest(req)) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended due to security concerns. Please contact support.',
      });
    }

    if (req.user.role === 'provider' && !isLogoutRequest(req)) {
      const provider = await Provider.findOne({ userId: req.user._id }).select(
        'verificationStatus rejectionReason isFinalRejection'
      );
      if (isFinalRejection(provider)) {
        return res.status(403).json({
          success: false,
          verificationDeclined: true,
          message: declinedProviderLoginMessage(provider),
        });
      }
    }

    req.token = token;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, message: 'Your session has expired or is invalid. Please log in again.' });
  }
};

const isStudentPendingConsent = (user) =>
  user?.role === 'student' && user?.status === 'pending_consent';

/**
 * Stored super-admin accounts use `superadmin`. Older checks also say
 * `super_admin` or `super-admin`. Those spellings are the same privilege.
 */
const canonicalRole = (role) => {
  const value = String(role || '').trim().toLowerCase().replace(/-/g, '_');
  if (value === 'super_admin' || value === 'superadmin') return 'superadmin';
  return value;
};

const isSuperadminRole = (role) => canonicalRole(role) === 'superadmin';

const isAdminRole = (role) => {
  const value = canonicalRole(role);
  return value === 'admin' || value === 'superadmin';
};

/**
 * Authorization Middleware
 * Restricts access to specific user roles.
 */
const authorize = (...roles) => {
  function authorizeRequest(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Please log in to access this page.',
      });
    }

    if (isStudentPendingConsent(req.user) && roles.includes('student')) {
      return res.status(403).json({
        success: false,
        requiresConsent: true,
        message:
          'Your account is waiting for parental consent. Please check your parent or guardian email for the approval link.',
      });
    }

    const allowed = roles.map((role) => canonicalRole(role));
    if (!allowed.includes(canonicalRole(req.user.role))) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this page.',
      });
    }

    next();
  }

  return authorizeRequest;
};

module.exports = {
  protect,
  authorize,
  isStudentPendingConsent,
  canonicalRole,
  isSuperadminRole,
  isAdminRole,
};