const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const { blacklistToken } = require('../services/tokenService');

// Helper function to send JWT via HttpOnly Cookie + JSON Payload
const sendTokenResponse = (user, statusCode, res, message) => {
  const token = user.getSignedJwtToken();
  const cookieExpireDays = parseInt(process.env.JWT_COOKIE_EXPIRE, 10) || 30;

  const options = {
    expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  };

  user.password = undefined;

  // Format response user payload with explicit onboarding state
  const userData = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    organization: user.organization || '',
    isOnboarded: Boolean(user.isOnboarded),
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

  if (role && ['admin', 'super_admin'].includes(role)) {
    return next(new ErrorResponse('You cannot register directly as an admin role.', 403));
  }

  if (role === 'provider' && !organization) {
    return next(new ErrorResponse('Organization name is required for scholarship providers.', 400));
  }

  const user = await User.create({
    name,
    email,
    password,
    role: role || 'student',
    organization: role === 'provider' ? organization : '',
    isOnboarded: false,
  });

  sendTokenResponse(user, 201, res, 'User registered successfully');
});

// @desc    Login user & return JWT token via HttpOnly Cookie
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ErrorResponse('Please provide an email and password', 400));
  }

  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  sendTokenResponse(user, 200, res, 'Login successful');
});

// @desc    Get currently logged-in user
// @route   GET /api/v1/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  const userData = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    organization: user.organization || '',
    isOnboarded: Boolean(user.isOnboarded),
  };

  res.status(200).json({
    success: true,
    data: userData,
    user: userData,
  });
});

// @desc    Logout user, clear cookie, and revoke JWT in Redis
// @route   GET /api/v1/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res, next) => {
  // 1. Blacklist active JWT token in Redis if service is attached
  if (req.token) {
    try {
      await blacklistToken(req.token);
    } catch (err) {
      console.warn('Redis token revocation skipped:', err.message);
    }
  }

  // 2. Clear HttpOnly Cookie
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
// @route   POST /api/v1/auth/forgot-password
// @access  Public

exports.forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return next(new ErrorResponse('There is no user with that email', 404));
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Hash token and set to expire (e.g., 10 minutes)
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    await user.save({ validateBeforeSave: false });

    // Send email logic here (Nodemailer, SendGrid, etc.)
    console.log(`[PASSWORD RESET LINK]: ${process.env.CLIENT_URL}/reset-password/${resetToken}`);

    res.status(200).json({
      success: true,
      data: 'Email sent',
    });
  } catch (err) {
    next(err);
  }
};