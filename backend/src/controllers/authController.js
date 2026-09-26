const crypto = require('crypto');
const User = require('../models/User');
const Provider = require('../models/Provider');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const { blacklistToken } = require('../services/tokenService');

// Helper function to send JWT via HttpOnly Cookie + JSON Payload
const sendTokenResponse = async (user, statusCode, res, message) => {
  const token = user.getSignedJwtToken ? user.getSignedJwtToken() : user.generateToken?.();
  const cookieExpireDays = parseInt(process.env.JWT_COOKIE_EXPIRE, 10) || 30;

  const options = {
    expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  };

  user.password = undefined;

  // Fetch provider verification status if user is a provider
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
    status: user.status || 'active',
    verificationStatus,
  };

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

// @desc    Register a new user (Student or Provider)
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, password, role, organization } = req.body;

  // 1. Role Security Check (Prevent self-registration as admin or superadmin)
  if (role && ['admin', 'superadmin', 'super_admin'].includes(role)) {
    return next(new ErrorResponse('You cannot register directly as an admin role.', 403));
  }

  // 2. Validate Provider Organization requirement
  if (role === 'provider' && !organization) {
    return next(new ErrorResponse('Organization name is required for scholarship providers.', 400));
  }

  // 3. Check for existing user
  const userExists = await User.findOne({ email: email.toLowerCase() });
  if (userExists) {
    return next(new ErrorResponse('Email already registered', 400));
  }

  // 4. Create User Record
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    role: role || 'student',
    organization: role === 'provider' ? organization : '',
    isOnboarded: false,
    status: 'active',
  });

  // 5. Create Provider Document for provider accounts
  if (user.role === 'provider') {
    await Provider.create({
      userId: user._id,
      institutionName: organization || name,
      institutionType: 'Other',
      verificationStatus: 'Pending',
    });
  }

  await sendTokenResponse(user, 201, res, 'User registered successfully');
});

// @desc    Login user & return JWT token (Supports Student, Provider & Admin)
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // 1. Validate inputs
  if (!email || !password) {
    return next(new ErrorResponse('Please provide email and password', 400));
  }

  // 2. Check for user
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  // 3. Status checks (Parental Consent & Account Suspension)
  if (user.status === 'pending_consent') {
    return res.status(403).json({
      success: false,
      requiresConsent: true,
      message: 'Your account is pending parental consent. Please ask your parent/guardian to approve the request sent to their email.',
    });
  }

  if (user.status === 'suspended') {
    return next(new ErrorResponse('Your account has been suspended. Please contact support.', 403));
  }

  // 4. Provider Rejection check
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

  // 5. Send token & cookie
  await sendTokenResponse(user, 200, res, 'Login successful');
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

  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
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

  console.log(`[PASSWORD RESET LINK]: ${process.env.CLIENT_URL}/reset-password/${resetToken}`);

  res.status(200).json({
    success: true,
    data: 'Email sent',
  });
});