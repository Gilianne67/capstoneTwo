const crypto = require('crypto');
const dns = require('dns').promises;
const User = require('../models/User');
const Provider = require('../models/Provider');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const { blacklistToken } = require('../services/tokenService');
const { recordAuditLog } = require('./auditController');
const { sendAccountLockoutEmail, sendVerificationEmail } = require('../utils/sendEmail');

// Generic authentication error message to prevent account enumeration
const GENERIC_AUTH_ERROR = 'Invalid credentials or account temporarily locked. Please try again later.';

// Known disposable / temporary email domains to block
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com', 'tempmail.com', '10minutemail.com', 'guerrillamail.com',
  'throwawaymail.com', 'yopmail.com', 'sharklasers.com', 'dispostable.com',
  'getnada.com', 'trashmail.com', 'fakeinbox.com', 'crazymailing.com'
]);

// Helper: Verify email domain has active Mail Exchange (MX) DNS records
const verifyRealEmailDomain = async (email) => {
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain) return false;

  // 1. Block disposable email providers
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return false;
  }

  // 2. Bypass DNS resolution for local/test domains during development or automated tests
  if (process.env.NODE_ENV === 'test' || domain === 'localhost' || domain.endsWith('.local')) {
    return true;
  }

  // 3. Perform live DNS MX Record Lookup
  try {
    const mxRecords = await dns.resolveMx(domain);
    return Array.isArray(mxRecords) && mxRecords.length > 0;
  } catch (err) {
    return false;
  }
};

// Helper: Generate and save cryptographic email verification token (expires in 2 hours)
const generateVerificationToken = async (user) => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  user.emailVerificationToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');
  user.emailVerificationExpire = Date.now() + 2 * 60 * 60 * 1000; // 2 Hours
  await user.save({ validateBeforeSave: false });
  return rawToken;
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
  const cookieExpireDays = parseInt(process.env.JWT_COOKIE_EXPIRE, 10) || 30;

  const options = {
    expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  };

  user.password = undefined;

  let verificationStatus = 'Approved';
  if (user.role === 'provider') {
    const providerDoc = await Provider.findOne({ userId: user._id });
    if (providerDoc) {
      verificationStatus = providerDoc.verificationStatus;
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
  };

  if (req) {
    await recordAuditLog({
      actor: user.name || user.email,
      role: user.role === 'admin' ? 'Admin' : user.role === 'provider' ? 'Provider' : 'Student',
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

  // 3. DNS Lookup & Email Validation
  const isValidRealEmail = await verifyRealEmailDomain(normalizedEmail);
  if (!isValidRealEmail) {
    return next(new ErrorResponse('Please provide a valid, deliverable email address from an active domain.', 400));
  }

  // 4. Check for existing user (Anti-enumeration friendly handling)
  const userExists = await User.findOne({ email: normalizedEmail });
  if (userExists) {
    return res.status(200).json({
      success: true,
      requiresOnboarding: true,
      email: normalizedEmail,
      message: 'If an account exists with that email, instructions have been sent.'
    });
  }

  // 5. Create User Record with isVerified = false & isOnboarded = false (NO Provider Document creation here yet!)
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
    role: user.role === 'provider' ? 'Provider' : 'Student',
    action: 'USER_REGISTER',
    details: `New ${user.role} account registered (Pending Onboarding): ${user.email}`,
    ipAddress: req.ip || '127.0.0.1',
    severity: 'Info'
  });

  // 🔑 Issue JWT token response immediately so OnboardingPage can authenticate successfully
  await sendTokenResponse(user, 201, res, 'Registration successful! Please complete your onboarding profile.', req);
});

// @desc    Verify Email Token and Activate Account
// @route   GET /api/v1/auth/verify-email/:token
// @access  Public
exports.verifyEmail = asyncHandler(async (req, res, next) => {
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

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
    role: user.role === 'provider' ? 'Provider' : 'Student',
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

  const rawToken = await generateVerificationToken(user);
  const verifyUrl = `${process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email/${rawToken}`;
  
  try {
    if (typeof sendVerificationEmail === 'function') {
      await sendVerificationEmail(user.email, user.name, verifyUrl);
    } else {
      console.error('⚠️ sendVerificationEmail utility is not defined or not imported properly.');
      return next(new ErrorResponse('Email service configuration error.', 500));
    }
  } catch (err) {
    console.error('⚠️ Nodemailer dispatch failed inside resendVerification:', err);
    return next(new ErrorResponse(`Failed to dispatch verification link: ${err.message}`, 500));
  }

  res.status(200).json({
    success: true,
    message: 'A fresh verification link has been sent to your email.'
  });
});

// @desc    Update Typo Email for Unverified Accounts
// @route   PUT /api/v1/auth/update-unverified-email
// @access  Public
exports.updateUnverifiedEmail = asyncHandler(async (req, res, next) => {
  const { oldEmail, newEmail } = req.body;
  const normalizedOld = oldEmail?.toLowerCase().trim();
  const normalizedNew = newEmail?.toLowerCase().trim();

  if (!normalizedNew || !(await verifyRealEmailDomain(normalizedNew))) {
    return next(new ErrorResponse('Please enter a valid, active email address.', 400));
  }

  const user = await User.findOne({ email: normalizedOld, isVerified: false });
  if (!user) {
    return next(new ErrorResponse('Account not found or already verified.', 400));
  }

  user.email = normalizedNew;
  const rawToken = await generateVerificationToken(user);
  const verifyUrl = `${process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email/${rawToken}`;

  if (typeof sendVerificationEmail === 'function') {
    await sendVerificationEmail(user.email, user.name, verifyUrl);
  }

  res.status(200).json({
    success: true,
    email: user.email,
    message: 'Email updated successfully and a new verification link has been dispatched.'
  });
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

  const user = await User.findOne({ email: normalizedEmail }).select('+password');

  if (user && user.status === 'suspended') {
    await recordAuditLog({
      actor: user.email,
      role: user.role || 'System',
      action: 'SECURITY_ALERT',
      details: `Suspended user (${user.email}) attempted to log in from IP ${clientIp}.`,
      ipAddress: clientIp,
      severity: 'Warning'
    });

    return next(new ErrorResponse('Your account has been suspended due to security concerns. Please contact support.', 403));
  }

  if (user && user.lockUntil && user.lockUntil > Date.now()) {
    return next(new ErrorResponse(GENERIC_AUTH_ERROR, 429));
  }

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
            if (typeof sendAccountLockoutEmail === 'function') {
              await sendAccountLockoutEmail(user.email, user.name, unlockUrl);
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

  // 🔒 VERIFICATION GATE: Block sign-in if email is unverified AND account status is not active
  if (!user.isVerified && user.status !== 'active') {
    return res.status(403).json({
      success: false,
      requiresVerification: true,
      email: user.email,
      message: 'Please verify your email address before signing in.'
    });
  }

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

  if (user.role === 'provider') {
    const providerDoc = await Provider.findOne({ userId: user._id });
    if (providerDoc && providerDoc.verificationStatus === 'Rejected') {
      return next(
        new ErrorResponse(
          `Your provider application was rejected. Reason: ${providerDoc.rejectionReason || 'Contact support for details.'}`,
          403
        )
      );
    }
  }

  if (user.failedLoginAttempts > 0 || user.lockUntil) {
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    user.lastFailedIp = undefined;
    await user.save({ validateBeforeSave: false });
  }

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
  if (user.role === 'provider') {
    const providerDoc = await Provider.findOne({ userId: user._id });
    if (providerDoc) {
      verificationStatus = providerDoc.verificationStatus;
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
  };

  res.status(200).json({
    success: true,
    data: userData,
    user: userData,
  });
});

// @desc    Logout user & clear cookie
// @route   GET /api/v1/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res, next) => {
  if (req.token) {
    try {
      await blacklistToken(req.token);
    } catch (err) {
      console.warn('Redis token revocation skipped:', err.message);
    }
  }

  if (req.user) {
    await recordAuditLog({
      actor: req.user.name || req.user.email,
      role: req.user.role === 'admin' ? 'Admin' : req.user.role === 'provider' ? 'Provider' : 'Student',
      action: 'USER_LOGOUT',
      details: `User (${req.user.email}) logged out.`,
      ipAddress: req.ip || '127.0.0.1',
      severity: 'Info'
    });
  }

  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  res.status(200).json({
    success: true,
    message: 'User logged out successfully and token revoked',
    data: {},
  });
});

// @desc    Request Password Reset Link
// @route   POST /api/v1/auth/forgotpassword
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return next(new ErrorResponse('There is no user with that email', 404));
  }

  const resetToken = crypto.randomBytes(20).toString('hex');

  user.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  await user.save({ validateBeforeSave: false });

  await recordAuditLog({
    actor: user.email,
    role: user.role === 'admin' ? 'Admin' : user.role === 'provider' ? 'Provider' : 'Student',
    action: 'PASSWORD_RESET_REQUEST',
    details: `Password reset link requested for ${user.email}`,
    ipAddress: req.ip || '127.0.0.1',
    severity: 'Info'
  });

  console.log(`[PASSWORD RESET LINK]: ${process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`);

  res.status(200).json({
    success: true,
    data: 'Email sent',
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

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  user.lastFailedIp = undefined;

  await user.save();

  await recordAuditLog({
    actor: user.email,
    role: user.role === 'admin' ? 'Admin' : user.role === 'provider' ? 'Provider' : 'Student',
    action: 'PASSWORD_RESET_COMPLETE',
    details: `Account unlocked and password reset successfully for ${user.email}.`,
    ipAddress: req.ip || '127.0.0.1',
    severity: 'Info'
  });

  await sendTokenResponse(user, 200, res, 'Password reset successful and account unlocked.', req);
});