const jwt = require('jsonwebtoken');
const User = require('../models/User');
const tokenService = require('../services/tokenService');

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

    req.token = token;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, message: 'Token verification failed' });
  }
};

/**
 * Authorization Middleware
 * Restricts access to specific user roles.
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'User is not authorized to access this route',
      });
    }

    next();
  };
};

module.exports = { protect, authorize };
