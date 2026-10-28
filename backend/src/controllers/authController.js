const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const dns = require('dns').promises;
const User = require('../models/User');
const Provider = require('../models/Provider');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const {
  blacklistToken,
  isTokenBlacklisted,
  registerIssuedToken,
  forgetIssuedToken,
  revokeUserSessions,
} = require('../services/tokenService');
const { MIN_PASSWORD_LENGTH } = require('../utils/passwordPolicy');
const { recordAuditLog } = require('./auditController');
const emailService = require('../utils/emailService');
const {
  hashToken,
  buildVerificationUrl,
  claimVerificationToken,
  restoreVerificationToken,
} = require('../utils/verificationToken');
const {
  isFinalRejection,
  canResubmitVerification,
  declinedProviderLoginMessage,
  FINAL_REJECTION_REGISTRATION_MESSAGE,
  RESUBMIT_REGISTRATION_MESSAGE,
} = require('../utils/providerVerification');

// Generic authentication error message to prevent account enumeration
const GENERIC_AUTH_ERROR = 'Invalid credentials or account temporarily locked. Please try again later.';

const unconfirmedSessionMessage = (revocation, lead) => {
  const reason = revocation && revocation.reason;
  if (reason === 'redis_unavailable' || reason === 'redis_read_failed' || reason === 'redis_unsupported') {
    return `${lead} Older sessions are rejected from the account record. The Redis session index could not be read, so sessions stored only in Redis were not confirmed blocklisted.`;
  }
  if (reason === 'revocation_store_unavailable') {
    return `${lead} The durable session record could not be updated, so not every session was confirmed revoked.`;
  }
  if (reason === 'partial_failure') {
    return `${lead} Only some sessions were revoked.`;
  }
  return `${lead} Session revocation was not confirmed (${reason || 'unknown'}).`;
};
const formatAuditRole = (role) => {
  if (!role) return 'Student';
  const lower = String(role).toLowerCase();
  if (lower.includes('admin')) return 'Admin';
  if (lower.includes('provider')) return 'Provider';
  if (lower.includes('system')) return 'System';
  return 'Student';
};

// Helper: Calculate exponential backoff lockout duration (in milliseconds)
const calculateLockoutDuration = (attempts) => {
  if (attempts < 4) return 0; // Attempts 1-3: Silent (0 delay)
  if (attempts === 4) return 30 * 1000; // Attempt 4: 30-second soft lock
  if (attempts === 5) return 5 * 60 * 1000; // Attempt 5: 5-minute soft lock
  if (attempts === 6) return 15 * 60 * 1000; // Attempt 6: 15-minute soft lock
  return 30 * 60 * 1000; // Attempt 7+: Hard cap at 30 minutes
};

// Helper function to send JWT via HttpOnly Cookie + JSON Payload
const sendTokenResponse = async (user, statusCode, res, message, req) => {
  const token = user.getSignedJwtToken ? user.getSignedJwtToken() : user.generateToken?.();
  if (token && user && user._id) {
    let indexed = { ok: false, reason: 'missing_token', durableRequired: false };
    try {
      indexed = await registerIssuedToken(user._id, token);
    } catch (err) {
      console.warn('Session index update skipped.');
      indexed = { ok: false, reason: 'revocation_store_unavailable', durableRequired: false };
    }
    if (indexed && indexed.ok === false && indexed.durableRequired) {
      return res.status(503).json({
        success: false,
        message: 'Sign-in could not record this session for later revocation. Please try again.',
      });
    }
  }
  const cookieExpireDays = parseInt(process.env.JWT_COOKIE_EXPIRE, 10) || 30;

  const options = {
    expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  };

  user.password = undefined;

  let verificationStatus = 'Approved';
  let isFinalRejectionFlag = false;
  let representativeName = '';
  if (user.role === 'provider') {
    const providerDoc = await Provider.findOne({ userId: user._id });
    if (providerDoc) {
      verificationStatus = providerDoc.verificationStatus;
      isFinalRejectionFlag = Boolean(providerDoc.isFinalRejection);
      representativeName = String(providerDoc.representative?.name || '').trim();
    }
  }

  const userData = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    organization: user.organization || '',
    isOnboarded: Boolean(user.isOnboarded),
    isVerified: Boolean(user.isVerified),
    status: user.status || 'active',
    verificationStatus,
    ...(user.role === 'provider' ? { isFinalRejection: isFinalRejectionFlag, representativeName } : {}),
  };

  if (req) {
    await recordAuditLog({
      actor: user.name || user.email,
      role: formatAuditRole(user.role),
      action: 'USER_LOGIN',
      details: `User (${user.email}) authenticated successfully as ${user.role}.`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      severity: 'Info'
    });
  }

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      message,
      token,
      user: userData,
      data: userData,
    });
};

// @desc    Register a new user & immediately issue JWT token for Onboarding authentication
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, password, role, organization } = req.body;

  // 1. Role Security Check
  const requestedRole = typeof role === 'string' ? role.trim().toLowerCase().replace(/-/g, '_') : '';
  if (['admin', 'superadmin', 'super_admin'].includes(requestedRole)) {
    await recordAuditLog({
      actor: email || 'Unknown Registrant',
      role: 'System',
      action: 'SECURITY_ALERT',
      details: `Attempted illegal self-registration as admin role (${role}).`,
      ipAddress: req.ip || '127.0.0.1',
      severity: 'Warning'
    });
    return next(new ErrorResponse('You cannot register directly as an admin role.', 403));
  }

  // 2. Validate Provider Organization requirement
  if (role === 'provider' && !organization) {
    return next(new ErrorResponse('Organization name is required for scholarship providers.', 400));
  }

  const normalizedEmail = email ? email.toLowerCase().trim() : '';

  // 3. Check for existing user (Anti-enumeration friendly handling)
  const userExists = await User.findOne({ email: normalizedEmail });
  if (userExists) {
    if (userExists.role === 'provider') {
      const existingProvider = await Provider.findOne({ userId: userExists._id });
      if (isFinalRejection(existingProvider)) {
        return res.status(409).json({
          success: false,
          verificationDeclined: true,
          message: FINAL_REJECTION_REGISTRATION_MESSAGE,
        });
      }
      if (canResubmitVerification(existingProvider)) {
        return res.status(409).json({
          success: false,
          canResubmit: true,
          message: RESUBMIT_REGISTRATION_MESSAGE,
        });
      }
    }

    return res.status(200).json({
      success: true,
      requiresOnboarding: true,
      email: normalizedEmail,
      message: 'If an account exists with that email, instructions have been sent.'
    });
  }

  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return next(new ErrorResponse(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`, 400));
  }

  // 4. Create User Record with isVerified = false & isOnboarded = false
  const user = await User.create({
    name,
    email: normalizedEmail,
    password,
    role: role || 'student',
    organization: role === 'provider' ? organization : '',
    isOnboarded: false,
    isVerified: false,
    status: 'active',
  });

  // 📝 AUDIT LOG: Registration Event
  await recordAuditLog({
    actor: user.name || user.email,
    role: formatAuditRole(user.role),
    action: 'USER_REGISTER',
    details: `New ${user.role} account registered (Pending Onboarding): ${user.email}`,
    ipAddress: req.ip || '127.0.0.1',
    severity: 'Info'
  });

  // 🔑 Issue JWT token response immediately
  await sendTokenResponse(user, 201, res, 'Registration successful! Please complete your onboarding profile.', req);
});

// @desc    Verify Email Token and Activate Account
// @route   GET /api/v1/auth/verify-email/:token
// @access  Public
exports.verifyEmail = asyncHandler(async (req, res, next) => {
  const hashedToken = hashToken(req.params.token);

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpire: { $gt: Date.now() }
  });

  if (!user) {
    return next(new ErrorResponse('Verification token is invalid or has expired. Please request a new link.', 400));
  }

  user.isVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpire = undefined;
  await user.save();

  await recordAuditLog({
    actor: user.email,
    role: formatAuditRole(user.role),
    action: 'EMAIL_VERIFIED',
    details: `Email verified successfully for ${user.email}.`,
    ipAddress: req.ip || '127.0.0.1',
    severity: 'Info'
  });

  res.status(200).json({
    success: true,
    message: 'Your email address has been verified successfully! You can now log in.'
  });
});

// @desc    Resend Verification Email (Rate Limited)
// @route   POST /api/v1/auth/resend-verification
// @access  Public
exports.resendVerification = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  const normalizedEmail = email ? email.toLowerCase().trim() : '';

  if (!normalizedEmail) {
    return next(new ErrorResponse('Email address is required.', 400));
  }

  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    return next(new ErrorResponse('User account not found with this email.', 404));
  }

  if (user.isVerified) {
    return next(new ErrorResponse('This account is already verified.', 400));
  }

  const previousToken = user.emailVerificationToken;
  const previousExpire = user.emailVerificationExpire;
  const claimed = await claimVerificationToken(user._id);

  if (!claimed.claimed) {
    if (claimed.reason === 'verified') {
      return next(new ErrorResponse('This account is already verified.', 400));
    }
    if (claimed.reason === 'fresh') {
      return res.status(200).json({
        success: true,
        message: 'A verification link was just sent. Please use that email. You can request another link shortly.',
      });
    }
    return next(new ErrorResponse('Unable to issue a verification link for this account.', 400));
  }

  try {
    if (typeof emailService.sendVerificationEmail !== 'function') {
      console.error('⚠️ sendVerificationEmail utility is not defined or not imported properly.');
      await restoreVerificationToken(user._id, claimed.rawToken, previousToken, previousExpire);
      return next(new ErrorResponse('Email service configuration error.', 500));
    }
    await emailService.sendVerificationEmail(
      user.email,
      user.name,
      buildVerificationUrl(claimed.rawToken)
    );
  } catch (err) {
    console.error('⚠️ Verification email failed inside resendVerification:', err.message);
    await restoreVerificationToken(user._id, claimed.rawToken, previousToken, previousExpire);
    return next(new ErrorResponse('Failed to dispatch verification link. Please try again.', 500));
  }

  res.status(200).json({
    success: true,
    message: 'A fresh verification link has been sent to your email.'
  });
});

// @desc    Update Typo Email for Unverified Accounts (Authenticated & Password-Protected)
// @route   PUT /api/v1/auth/update-unverified-email
// @access  Private or Semi-Public fallback for unverified holding page
exports.updateUnverifiedEmail = asyncHandler(async (req, res, next) => {
  try {
    const { password, newEmail, oldEmail } = req.body;
    const normalizedNew = newEmail ? newEmail.toLowerCase().trim() : '';

    // 1. Strict Email Format Validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!normalizedNew || !emailRegex.test(normalizedNew)) {
      return next(new ErrorResponse('Please enter a valid, active email address.', 400));
    }

    if (!password) {
      return next(new ErrorResponse('Current password is required to change your email address.', 400));
    }

    // 2. Safely find user
    let user = null;
    if (req.user && req.user.id) {
      user = await User.findById(req.user.id).select('+password');
    } else if (oldEmail) {
      user = await User.findOne({ email: oldEmail.toLowerCase().trim() }).select('+password');
    }

    if (!user) {
      return next(new ErrorResponse('User session not found. Please log in again.', 401));
    }

    if (user.isVerified) {
      return next(new ErrorResponse('Account is already verified. Email updates must be done through profile settings.', 400));
    }

    // 3. Check if new email is already taken by ANOTHER user
    const emailConflict = await User.findOne({ email: normalizedNew });
    if (emailConflict && emailConflict._id.toString() !== user._id.toString()) {
      return next(new ErrorResponse('This email address is already registered to another account.', 400));
    }

    // 4. Re-verify Password Match to prevent hijacking
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      await recordAuditLog({
        actor: user.email,
        role: formatAuditRole(user.role),
        action: 'SECURITY_ALERT',
        details: `Failed email update attempt for ${user.email}: Invalid password provided.`,
        ipAddress: req.ip || '127.0.0.1',
        severity: 'Warning'
      });
      return next(new ErrorResponse('Incorrect password provided.', 401));
    }

    // 5. Update Email & Reset Verification State
    const previousEmail = user.email;
    const previousToken = user.emailVerificationToken;
    const previousExpire = user.emailVerificationExpire;

    user.email = normalizedNew;
    user.isVerified = false;
    await user.save({ validateBeforeSave: false });

    const claimed = await claimVerificationToken(user._id, { force: true });
    if (!claimed.claimed) {
      return next(new ErrorResponse('Unable to issue a verification link for this account.', 400));
    }

    try {
      if (typeof emailService.sendVerificationEmail !== 'function') {
        throw new Error('Email service configuration error.');
      }
      await emailService.sendVerificationEmail(
        user.email,
        user.name,
        buildVerificationUrl(claimed.rawToken)
      );
    } catch (err) {
      console.error('⚠️ Verification email failed after address update:', err.message);
      await restoreVerificationToken(user._id, claimed.rawToken, previousToken, previousExpire);
      return next(new ErrorResponse('Email address was updated, but the verification email could not be sent. Please use resend.', 500));
    }

    // 📝 Audit Log
    await recordAuditLog({
      actor: user.email,
      role: formatAuditRole(user.role),
      action: 'EMAIL_UPDATED',
      details: `Unverified account email changed from ${previousEmail} to ${user.email}.`,
      ipAddress: req.ip || '127.0.0.1',
      severity: 'Info'
    });

    return res.status(200).json({
      success: true,
      email: user.email,
      message: 'Email updated successfully and a new verification link has been dispatched to your new inbox.'
    });

  } catch (err) {
    console.error('🔥 CRITICAL ERROR IN UPDATE_UNVERIFIED_EMAIL:', err);
    return next(new ErrorResponse(err.message || 'Server error updating email address.', 500));
  }
});

// @desc    Login user & return JWT token (Blocks Unverified Accounts)
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

  if (!email || !password) {
    return next(new ErrorResponse(GENERIC_AUTH_ERROR, 400));
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Find user and select password
  const user = await User.findOne({ email: normalizedEmail }).select('+password');

  // 1. Account Suspended Check
  if (user && user.status === 'suspended') {
    await recordAuditLog({
      actor: user.email,
      role: formatAuditRole(user.role),
      action: 'SECURITY_ALERT',
      details: `Suspended user (${user.email}) attempted to log in from IP ${clientIp}.`,
      ipAddress: clientIp,
      severity: 'Warning'
    });

    return next(new ErrorResponse('Your account has been suspended due to security concerns. Please contact support.', 403));
  }

  // 2. Soft/Hard Lockout Check
  if (user && user.lockUntil && user.lockUntil > Date.now()) {
    return next(new ErrorResponse(GENERIC_AUTH_ERROR, 429));
  }

  // 3. Password Match Verification
  if (!user || !(await user.matchPassword(password))) {
    if (user) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      user.lastFailedIp = clientIp;

      const lockDurationMs = calculateLockoutDuration(user.failedLoginAttempts);

      if (lockDurationMs > 0) {
        user.lockUntil = new Date(Date.now() + lockDurationMs);

        const isCritical = user.failedLoginAttempts >= 5;
        const severity = isCritical ? 'Critical' : 'Warning';
        const actionCode = isCritical ? 'ACCOUNT_LOCKOUT' : 'SECURITY_ALERT';

        await user.save({ validateBeforeSave: false });

        if (user.failedLoginAttempts >= 5) {
          const resetToken = crypto.randomBytes(20).toString('hex');
          user.resetPasswordToken = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');
          user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
          await user.save({ validateBeforeSave: false });

          const unlockUrl = `${process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;
          try {
            if (typeof emailService.sendAccountLockoutEmail === 'function') {
              await emailService.sendAccountLockoutEmail(user.email, user.name, unlockUrl);
            }
          } catch (emailErr) {
            console.error('⚠️ Account lockout email failed to send:', emailErr.message);
          }
        }

        await recordAuditLog({
          actor: normalizedEmail,
          role: 'System',
          action: actionCode,
          details: `Lockout triggered for ${normalizedEmail} from IP ${clientIp} after ${user.failedLoginAttempts} failed attempts. Duration: ${lockDurationMs / 1000}s.`,
          ipAddress: clientIp,
          severity
        });

        return next(new ErrorResponse(GENERIC_AUTH_ERROR, 429));
      }

      await user.save({ validateBeforeSave: false });
    }

    return next(new ErrorResponse(GENERIC_AUTH_ERROR, 401));
  }

  // 🔒 STRICT VERIFICATION GATE
  const isVerified = user.isVerified ?? user.is_verified ?? false;
  if (!isVerified) {
    await recordAuditLog({
      actor: user.email,
      role: formatAuditRole(user.role),
      action: 'LOGIN_BLOCKED',
      details: `Login blocked for ${user.email}: Email address is not verified. Redirecting to verification holding page.`,
      ipAddress: clientIp,
      severity: 'Info'
    });

    return res.status(403).json({
      success: false,
      requiresVerification: true,
      email: user.email,
      message: 'Please verify your email address before signing in.'
    });
  }

  // 4. Check Parental Consent Status (For Students)
  if (user.status === 'pending_consent') {
    await recordAuditLog({
      actor: user.email,
      role: 'Student',
      action: 'LOGIN_BLOCKED',
      details: `Login blocked for ${user.email}: Account pending parental consent.`,
      ipAddress: clientIp,
      severity: 'Info'
    });

    return res.status(403).json({
      success: false,
      requiresConsent: true,
      message: 'Your account is pending parental consent. Please ask your parent/guardian to approve the request sent to their email.',
    });
  }

  // 5. Provider Status Check
  if (user.role === 'provider') {
    const providerDoc = await Provider.findOne({ userId: user._id });
    if (isFinalRejection(providerDoc)) {
      return res.status(403).json({
        success: false,
        verificationDeclined: true,
        message: declinedProviderLoginMessage(providerDoc),
      });
    }
  }

  // Reset failed login counters on successful authentication
  if (user.failedLoginAttempts > 0 || user.lockUntil) {
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    user.lastFailedIp = undefined;
    await user.save({ validateBeforeSave: false });
  }

  // Issue Token Response
  await sendTokenResponse(user, 200, res, 'Login successful', req);
});

// @desc    Get currently logged-in user
// @route   GET /api/v1/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  let verificationStatus = 'Approved';
  let isFinalRejectionFlag = false;
  let representativeName = '';
  if (user.role === 'provider') {
    const providerDoc = await Provider.findOne({ userId: user._id });
    if (providerDoc) {
      verificationStatus = providerDoc.verificationStatus;
      isFinalRejectionFlag = Boolean(providerDoc.isFinalRejection);
      representativeName = String(providerDoc.representative?.name || '').trim();
    }
  }

  const userData = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    organization: user.organization || '',
    isOnboarded: Boolean(user.isOnboarded),
    isVerified: Boolean(user.isVerified),
    status: user.status || 'active',
    verificationStatus,
    ...(user.role === 'provider' ? { isFinalRejection: isFinalRejectionFlag, representativeName } : {}),
  };

  res.status(200).json({
    success: true,
    data: userData,
    user: userData,
  });
});

// @desc    Logout user & clear cookie
// @route   POST /api/v1/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res, next) => {
  let revocationFailed = false;

  if (req.token) {
    let alreadyRevoked = false;
    let failureReason = 'revocation_store_unavailable';
    try {
      const revoked = await blacklistToken(req.token);
      alreadyRevoked = Boolean(revoked && revoked.ok === true);
      if (!alreadyRevoked) {
        failureReason = (revoked && revoked.reason) || failureReason;
        alreadyRevoked = await isTokenBlacklisted(req.token);
      }
    } catch (err) {
      failureReason = err.message;
      try {
        alreadyRevoked = await isTokenBlacklisted(req.token);
      } catch (lookupErr) {
        alreadyRevoked = false;
      }
    }
    if (!alreadyRevoked) {
      revocationFailed = true;
      console.warn('Token revocation was not stored:', failureReason);
    }
  }

  if (!revocationFailed && req.token && req.user) {
    await forgetIssuedToken(req.user.id || req.user._id, req.token);
  }

  if (req.user) {
    await recordAuditLog({
      actor: req.user.name || req.user.email,
      role: formatAuditRole(req.user.role),
      action: 'USER_LOGOUT',
      details: revocationFailed
        ? `User (${req.user.email}) logged out, but the session revocation was not stored.`
        : `User (${req.user.email}) logged out.`,
      ipAddress: req.ip || '127.0.0.1',
      severity: revocationFailed ? 'Warning' : 'Info'
    });
  }

  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  if (revocationFailed) {
    return res.status(503).json({
      success: false,
      message: 'Logout could not revoke this session. Please try again.',
    });
  }

  res.status(200).json({
    success: true,
    message: 'User logged out successfully and token revoked',
    data: {},
  });
});

// @desc    Change the signed-in user's password
// @route   PUT /api/v1/auth/updatepassword
// @access  Private
exports.updatePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body || {};

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
    return next(new ErrorResponse('Current password and new password are required.', 400));
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return next(new ErrorResponse(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`, 400));
  }

  const userId = req.user && (req.user._id || req.user.id);
  const user = await User.findById(userId).select('+password');

  if (!user) {
    return next(new ErrorResponse('User not found.', 404));
  }

  const matches = await user.matchPassword(currentPassword);
  if (!matches) {
    return next(new ErrorResponse('Current password is incorrect.', 401));
  }

  user.password = newPassword;
  user.passwordChangedAt = new Date();
  await user.save();

  const revocation = await revokeUserSessions(user._id);
  let token;
  let indexed = { ok: true, durableRequired: false };
  if (typeof user.getSignedJwtToken === 'function') {
    token = user.getSignedJwtToken();
    try {
      indexed = await registerIssuedToken(user._id, token);
    } catch (err) {
      console.warn('Session index update skipped.');
      indexed = { ok: false, reason: 'revocation_store_unavailable', durableRequired: false };
    }
  }

  const issuedUntracked = Boolean(indexed && indexed.ok === false && indexed.durableRequired);

  await recordAuditLog({
    actor: user.email,
    role: formatAuditRole(user.role),
    action: 'PASSWORD_CHANGED',
    details: revocation.success && !issuedUntracked
      ? `Password changed for ${user.email}. Previously issued sessions were revoked.`
      : `Password changed for ${user.email}. Older sessions are rejected from the account record. Session revocation was not confirmed (${issuedUntracked ? 'revocation_store_unavailable' : (revocation.reason || 'unknown')}).`,
    ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
    severity: 'Info'
  });

  if (!revocation.success || issuedUntracked) {
    return res.status(503).json({
      success: false,
      message: unconfirmedSessionMessage(
        issuedUntracked ? { reason: 'revocation_store_unavailable' } : revocation,
        'Password was updated.'
      ),
      ...(issuedUntracked ? {} : { token }),
      revocation: {
        success: false,
        reason: issuedUntracked ? 'revocation_store_unavailable' : (revocation.reason || 'unknown'),
      },
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Password updated successfully.',
    token,
  });
});

// @desc    Request Password Reset Link
// @route   POST /api/v1/auth/forgotpassword
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  const normalizedEmail = email ? email.toLowerCase().trim() : '';

  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    await bcrypt.compare('dummyPassword', '$2a$10$abcdefghijklmnopqrstuuu');
    return res.status(200).json({
      success: true,
      message: 'If an account exists with that email, password reset instructions have been dispatched.'
    });
  }

  const resetToken = crypto.randomBytes(32).toString('hex');

  user.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  user.resetPasswordExpire = Date.now() + 30 * 60 * 1000;

  await user.save({ validateBeforeSave: false });

  const clientUrl = 
    process.env.CLIENT_URL || 
    (process.env.NODE_ENV === 'production' 
      ? 'https://iskolarmatch.website' 
      : 'http://localhost:5173');

  await recordAuditLog({
    actor: user.email,
    role: formatAuditRole(user.role),
    action: 'PASSWORD_RESET_REQUEST',
    details: `Password reset link requested for ${user.email}`,
    ipAddress: req.ip || '127.0.0.1',
    severity: 'Info'
  });

  const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

  try {
    if (typeof emailService.sendResetPasswordEmail === 'function') {
      await emailService.sendResetPasswordEmail(user.email, resetUrl);
    }
  } catch (err) {
    console.error('❌ Password Reset Email Dispatch Failed:', err.message);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new ErrorResponse('Email could not be sent. Please try again later.', 500));
  }

  return res.status(200).json({
    success: true,
    message: 'If an account exists with that email, password reset instructions have been dispatched.'
  });
});

// @desc    Reset Password
// @route   PUT /api/v1/auth/resetpassword/:resettoken
// @access  Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(req.params.resettoken)
    .digest('hex');

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    return next(new ErrorResponse('Invalid or expired password reset token.', 400));
  }

  const { password } = req.body;
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return next(new ErrorResponse(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`, 400));
  }

  user.password = password;
  user.passwordChangedAt = new Date();
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  user.lastFailedIp = undefined;

  await user.save();
  const revocation = await revokeUserSessions(user._id);
  let replacementToken;
  let indexed = { ok: true, durableRequired: false };
  if (!revocation.success && typeof user.getSignedJwtToken === 'function') {
    replacementToken = user.getSignedJwtToken();
    try {
      indexed = await registerIssuedToken(user._id, replacementToken);
    } catch (err) {
      console.warn('Session index update skipped.');
      indexed = { ok: false, reason: 'revocation_store_unavailable', durableRequired: false };
    }
  }
  const issuedUntracked = Boolean(indexed && indexed.ok === false && indexed.durableRequired);

  await recordAuditLog({
    actor: user.email,
    role: formatAuditRole(user.role),
    action: 'PASSWORD_RESET_COMPLETE',
    details: revocation.success && !issuedUntracked
      ? `Account unlocked and password reset successfully for ${user.email}. Previously issued sessions were revoked.`
      : `Password reset for ${user.email}. Older sessions are rejected from the account record. Session revocation was not confirmed (${issuedUntracked ? 'revocation_store_unavailable' : (revocation.reason || 'unknown')}).`,
    ipAddress: req.ip || '127.0.0.1',
    severity: 'Info'
  });

  if (!revocation.success || issuedUntracked) {
    return res.status(503).json({
      success: false,
      message: unconfirmedSessionMessage(
        issuedUntracked ? { reason: 'revocation_store_unavailable' } : revocation,
        'Password was reset.'
      ),
      ...(issuedUntracked ? {} : { token: replacementToken }),
      revocation: {
        success: false,
        reason: issuedUntracked ? 'revocation_store_unavailable' : (revocation.reason || 'unknown'),
      },
    });
  }

  await sendTokenResponse(user, 200, res, 'Password reset successful and account unlocked.', req);
});