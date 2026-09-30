const crypto = require('crypto');
const User = require('../models/User');
const Provider = require('../models/Provider');
const StudentProfile = require('../models/StudentProfile');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const { blacklistToken } = require('../services/tokenService');
const ParentalConsent = require('../models/ParentalConsent');

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

  const displayName = user.fullName || user.name || '';

  const userData = {
    id: user._id,
    name: displayName,
    fullName: displayName,
    email: user.email,
    role: user.role,
    organization: user.organization || '',
    isOnboarded: Boolean(user.isOnboarded),
    status: user.status || 'active',
    verificationStatus,
    profileRef: user.profileRef || null,
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
  const { 
    name, 
    fullName, 
    email, 
    password, 
    role, 
    organization,
    age,
    guardianName,
    guardianEmail,
    guardianPhone,
    relationship,
    documentUrl 
  } = req.body;

  const userFullName = (fullName || name || '').trim();
  const normalizedEmail = email ? email.toLowerCase().trim() : '';

  if (!userFullName || !normalizedEmail || !password) {
    return next(new ErrorResponse('Please provide full name, email, and password.', 400));
  }

  if (role && ['admin', 'superadmin', 'super_admin'].includes(role)) {
    return next(new ErrorResponse('You cannot register directly as an admin role.', 403));
  }

  if (role === 'provider' && !organization) {
    return next(new ErrorResponse('Organization name is required for scholarship providers.', 400));
  }

  const userExists = await User.findOne({ email: normalizedEmail });
  if (userExists) {
    return next(new ErrorResponse('Email already registered', 400));
  }

  // Calculate or evaluate minor status
  const parsedAge = age !== undefined && age !== null ? Number(age) : null;
  const hasGuardianEmail = Boolean(guardianEmail && guardianEmail.trim());
  const isStudentRole = !role || role === 'student';
  
  // Determine if parental consent applies
  const isMinor = isStudentRole && ((parsedAge !== null && parsedAge < 18) || hasGuardianEmail);
  const initialStatus = isMinor ? 'pending_consent' : 'active';

  console.log('--- REGISTRATION DIAGNOSTICS ---');
  console.log(`User: ${normalizedEmail} | Role: ${role || 'student'}`);
  console.log(`Parsed Age: ${parsedAge} | Guardian Email: ${guardianEmail} | isMinor: ${isMinor}`);

  // 1. Create Base User
  const user = await User.create({
    name: userFullName,
    fullName: userFullName,
    email: normalizedEmail,
    password,
    role: role || 'student',
    organization: role === 'provider' ? organization : '',
    isOnboarded: false,
    status: initialStatus,
  });

  // 2. Link Role Profile / Parental Consent
  try {
    if (user.role === 'provider') {
      const providerDoc = await Provider.create({
        userId: user._id,
        institutionName: organization || userFullName,
        institutionType: 'Other',
        verificationStatus: 'Pending',
      });
      user.profileRef = providerDoc._id;
      await user.save({ validateBeforeSave: false });

    } else if (user.role === 'student') {
      // Always create StudentProfile record
      const studentDoc = await StudentProfile.create({
        userId: user._id,
        fullName: userFullName,
        email: normalizedEmail,
        isMinor: Boolean(isMinor),
      });
      
      user.profileRef = studentDoc._id;
      await user.save({ validateBeforeSave: false });

      if (isMinor) {
        // Create entry in 'parentalconsents' collection
        const consentDoc = await ParentalConsent.create({
          studentId: user._id,
          studentName: userFullName,
          age: parsedAge || 17,
          guardianName: guardianName ? guardianName.trim() : 'Parent/Guardian',
          guardianEmail: guardianEmail ? guardianEmail.toLowerCase().trim() : '',
          guardianPhone: guardianPhone ? guardianPhone.trim() : '',
          relationship: relationship || 'Parent/Legal Guardian',
          documentUrl: documentUrl || 'pending_upload',
          status: 'Pending',
        });

        console.log(`[SUCCESS] Created ParentalConsent Record ID: ${consentDoc._id} in 'parentalconsents'`);

        return res.status(201).json({
          success: true,
          requiresConsent: true,
          message: 'Account created. Parental consent request sent to guardian email.',
          data: {
            userId: user._id,
            consentId: consentDoc._id
          }
        });
      }
    }
  } catch (error) {
    console.error('Registration profile initialization error:', error);
    await User.findByIdAndDelete(user._id);
    return next(
      new ErrorResponse(`Registration failed while initializing profile: ${error.message}`, 500)
    );
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

  const normalizedEmail = email.toLowerCase().trim();

  // 2. Check for user
  const user = await User.findOne({ email: normalizedEmail }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  // 3. Status checks (Parental Consent & Account Suspension)
  if (user.status === 'pending_consent') {
    return res.status(403).json({
      success: false,
      requiresConsent: true,
      message:
        'Your account is pending parental consent. Please ask your parent/guardian to approve the request sent to their email.',
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
          `Your provider application was rejected. Reason: ${
            providerDoc.rejectionReason || 'Contact support for details.'
          }`,
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

  const displayName = user.fullName || user.name || '';

  const userData = {
    id: user._id,
    name: displayName,
    fullName: displayName,
    email: user.email,
    role: user.role,
    organization: user.organization || '',
    isOnboarded: Boolean(user.isOnboarded),
    status: user.status || 'active',
    verificationStatus,
    profileRef: user.profileRef || null,
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

  if (!email) {
    return next(new ErrorResponse('Please provide an email address.', 400));
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
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