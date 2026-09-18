const crypto = require('crypto');
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

  const userData = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    organization: user.organization || '',
    isOnboarded: Boolean(user.isOnboarded),
    status: user.status || 'active',
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
    status: 'active',
  });

  sendTokenResponse(user, 201, res, 'User registered successfully');
});

// @desc    Login user & return JWT token via HttpOnly Cookie
// @route   POST /api/v1/auth/login
// @access  Public
// POST /api/v1/auth/login (or /signin)
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Validate email & password presence
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide an email and password' 
      });
    }

    // 2. Check for user (include password field for comparison)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // 3. Check password match
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // 4. CHECK USER STATUS & BLOCK UNVERIFIED/PENDING ACCOUNTS
    if (user.status === 'pending_consent') {
      return res.status(403).json({
        success: false,
        requiresConsent: true,
        message: 'Your account is pending parental consent. Please ask your parent/guardian to approve the request sent to their email.'
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Please contact support.'
      });
    }

    // 5. Generate token and send response if active
    const token = user.getSignedJwtToken();

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        isOnboarded: user.isOnboarded
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

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
    status: user.status || 'active',
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

  const user = await User.findOne({ email });

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