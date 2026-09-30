const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Provider = require('../models/Provider');
const tokenService = require('../services/tokenService');

const isLogoutRequest = (req) =>
  req.method === 'GET' && String(req.originalUrl || req.url || '').split('?')[0].endsWith('/auth/logout');

const rejectedProviderMessage = (provider) =>
  `Your provider application was rejected. Reason: ${provider?.rejectionReason || 'Contact support for details.'}`;

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
      .json({ success: false, message: 'Not authorized to access this route' });
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
          message: 'Token has been revoked. Please log in again.',
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
        message: 'User belonging to this token no longer exists',
      });
    }

    if (req.user.role === 'provider' && !isLogoutRequest(req)) {
      const provider = await Provider.findOne({ userId: req.user._id }).select(
        'verificationStatus rejectionReason'
      );
      if (provider?.verificationStatus === 'Rejected') {
        return res.status(403).json({
          success: false,
          message: rejectedProviderMessage(provider),
        });
      }
    }

    req.token = token;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, message: 'Token verification failed' });
  }
};

const isStudentPendingConsent = (user) =>
  user?.role === 'student' && user?.status === 'pending_consent';

/**
 * Authorization Middleware
 * Restricts access to specific user roles.
 * A student waiting for guardian consent keeps the existing token, but
 * cannot call student or matching routes until status is active again.
 */
const authorize = (...roles) => {
  function authorizeRequest(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized',
      });
    }

    if (isStudentPendingConsent(req.user) && roles.includes('student')) {
      return res.status(403).json({
        success: false,
        requiresConsent: true,
        message:
          'Your account is pending parental consent. Please ask your parent/guardian to approve the request sent to their email.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'User is not authorized to access this route',
      });
    }

    next();
  }

  return authorizeRequest;
};

module.exports = { protect, authorize, isStudentPendingConsent };
