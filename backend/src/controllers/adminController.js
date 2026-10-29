const Provider = require('../models/Provider');
const User = require('../models/User');
const ParentalConsent = require('../models/ParentalConsent');
const SystemConfig = require('../models/SystemConfig');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const emailService = require('../utils/emailService');
const { recordAuditLog, withAuditWarning } = require('./auditController');
const crypto = require('crypto');
const {
  parseBooleanFlag,
  resolveRegisteredAccountEmail,
} = require('../utils/providerVerification');
const { revokeUserSessions } = require('../services/tokenService');
const matchCache = require('../services/matchCache');
const { canonicalRole, isSuperadminRole, isAdminRole } = require('../middleware/auth');
const { buildAdminInvitationUrl } = require('../utils/invitationLink');
const {
  loadOperationsDashboard,
  PENDING_PROVIDER_QUERY,
} = require('../services/adminOperationsService');

const MANUAL_ACCOUNT_STATUSES = ['active', 'suspended'];
const USER_LIST_ROLES = ['all', 'student', 'provider', 'administrator'];
const USER_LIST_STATUSES = ['all', 'active', 'suspended', 'pending_consent'];
const USER_LIST_DEFAULT_LIMIT = 20;
const USER_LIST_MAX_LIMIT = 50;
const ADMINISTRATOR_ROLES = ['admin', 'superadmin', 'super_admin', 'super-admin'];
const INVITE_ROLES = new Set(['admin', 'superadmin']);
const OFFICIAL_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DUPLICATE_ADMIN_EMAIL = 'An account with this email address already exists.';

const isDuplicateKeyError = (err) => Boolean(err && (err.code === 11000 || err.code === 11001));

const invitationValidationMessage = (err) => {
  if (err && err.name === 'ValidationError' && err.errors) {
    const first = Object.values(err.errors)[0];
    if (first && first.message) return String(first.message);
  }
  return 'Please provide a valid full name and official email address.';
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parsePositiveInt = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
};

const normalizeListRole = (role) => {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'scholarship provider') return 'provider';
  if (value === 'admin' || value === 'superadmin' || value === 'super_admin' || value === 'super-admin') {
    return 'administrator';
  }
  return value;
};

const parseUserListQuery = (query = {}) => {
  if (query.search !== undefined && typeof query.search !== 'string') {
    return { ok: false, message: 'Search must be a text value.' };
  }
  if (query.role !== undefined && query.role !== '' && typeof query.role !== 'string') {
    return { ok: false, message: 'Role filter must be Student, Scholarship Provider, or Administrator.' };
  }

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search.length > 100) {
    return { ok: false, message: 'Search must be 100 characters or fewer.' };
  }

  const role = normalizeListRole(query.role === undefined || query.role === '' ? 'all' : query.role);
  if (!USER_LIST_ROLES.includes(role)) {
    return { ok: false, message: 'Role filter must be Student, Scholarship Provider, or Administrator.' };
  }

  if (query.status !== undefined && query.status !== '' && typeof query.status !== 'string') {
    return { ok: false, message: 'Status filter must be all, active, suspended, or pending_consent.' };
  }
  const status = query.status === undefined || query.status === ''
    ? 'all'
    : String(query.status).trim();
  if (!USER_LIST_STATUSES.includes(status)) {
    return { ok: false, message: 'Status filter must be all, active, suspended, or pending_consent.' };
  }

  const page = parsePositiveInt(query.page, 1);
  const limit = parsePositiveInt(query.limit, USER_LIST_DEFAULT_LIMIT);
  if (page === null) {
    return { ok: false, message: 'Page must be a positive integer.' };
  }
  if (limit === null) {
    return { ok: false, message: 'Limit must be a positive integer.' };
  }

  return {
    ok: true,
    search,
    role,
    status,
    page,
    limit: Math.min(limit, USER_LIST_MAX_LIMIT),
  };
};

const userListFilter = ({ search, role, status }) => {
  const filter = {};
  if (role === 'student' || role === 'provider') {
    filter.role = role;
  } else if (role === 'administrator') {
    filter.role = { $in: ADMINISTRATOR_ROLES };
  }
  if (status && status !== 'all') {
    filter.status = status;
  }

  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: regex }, { email: regex }];
  }

  return filter;
};

const presentManagedUser = (user, provider) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status,
  isVerified: Boolean(user.isVerified),
  isOnboarded: Boolean(user.isOnboarded),
  createdAt: user.createdAt || null,
  ...(user.role === 'provider'
    ? {
        verificationStatus: provider ? provider.verificationStatus || null : null,
        providerId: provider ? provider._id || null : null,
      }
    : {}),
});

// Safe import for Scholarship
let Scholarship;
try {
  Scholarship = require('../models/Scholarship');
} catch (e) {
  Scholarship = null;
}

// Helper to safely extract user properties when populated or unpopulated
function getUserField(userId, field) {
  if (userId && typeof userId === 'object' && userId[field]) {
    return userId[field];
  }
  return null;
}

const DATABASE_READ_ALERT = {
  id: 'database-read',
  severity: 'critical',
  message: 'Operational data could not be read from the database.',
};

// @desc    Get Admin Dashboard Overview & Queues
// @route   GET /api/v1/admin/dashboard
// @access  Private (Admin / Super Admin)
exports.getAdminDashboard = asyncHandler(async (req, res) => {
  try {
    const dashboard = await loadOperationsDashboard();
    return res.status(200).json({
      success: true,
      ...dashboard,
    });
  } catch (error) {
    console.error('Admin operations dashboard error:', error);
    return res.status(500).json({
      success: false,
      message: DATABASE_READ_ALERT.message,
      alerts: [DATABASE_READ_ALERT],
    });
  }
});

// @desc    Patch Provider Verification Status from Dashboard / Queue
// @route   PATCH /api/v1/admin/providers/:id/verification
// @access  Private (Admin / Super Admin)
exports.updateProviderVerification = asyncHandler(async (req, res, next) => {
  const id = req.params.id || req.params.providerId;
  const { status, rejectionReason, reason } = req.body;

  // Flexible payload key capture
  const finalReason = (rejectionReason || reason || '').trim();

  const provider = await Provider.findById(id).populate('userId', 'email name');
  if (!provider) {
    return next(new ErrorResponse(`Provider profile not found with ID ${id}`, 404));
  }

  const normalizedStatus = String(status || '').toUpperCase();
  const isApproved = ['APPROVED', 'VERIFIED'].includes(normalizedStatus);

  if (!isApproved && !finalReason) {
    return next(new ErrorResponse('A rejection reason is required when rejecting an application.', 400));
  }

  // Set status explicitly to capitalized string for strict frontend tab filter matching
  const finalStatus = isApproved ? 'Verified' : 'Rejected';
  const previousStatus = String(provider.verificationStatus || '');
  const statusChanged = previousStatus !== finalStatus;
  const previousReason = String(provider.rejectionReason || '').trim();
  const reasonChanged = !isApproved && finalReason !== previousReason;
  const requestedFinalRejection = !isApproved && parseBooleanFlag(
    req.body.isFinalRejection ?? req.body.finalRejection
  );
  const previousFinalRejection = Boolean(provider.isFinalRejection);
  const finalFlagChanged = requestedFinalRejection !== previousFinalRejection;

  if (!statusChanged && !reasonChanged && !finalFlagChanged) {
    return res.status(200).json({
      success: true,
      message: `Provider status is already ${finalStatus}`,
      data: {
        ...(typeof provider.toObject === 'function' ? provider.toObject() : provider),
        verificationStatus: finalStatus,
        status: finalStatus,
        rejectionReason: isApproved ? null : previousReason,
        isFinalRejection: isApproved ? false : previousFinalRejection
      },
      notification: {
        sent: false,
        reason: 'unchanged'
      }
    });
  }

  provider.verificationStatus = finalStatus;

  if (isApproved) {
    provider.verifiedAt = new Date();
    provider.rejectionReason = null;
    provider.isFinalRejection = false;
  } else {
    provider.rejectionReason = finalReason;
    provider.verifiedAt = null;
    provider.isFinalRejection = requestedFinalRejection;
  }

  await provider.save();

  if (provider.userId) {
    const targetUserId = provider.userId._id || provider.userId;
    await User.findByIdAndUpdate(targetUserId, { isVerified: isApproved });
  }

  // 📝 AUDIT LOG: Provider Verification Review
  const adminActor = req.user 
    ? `${req.user.firstName || req.user.name || ''} ${req.user.lastName || ''}`.trim() || req.user.email 
    : 'Admin User';

  const verificationAudit = await recordAuditLog({
    actor: adminActor,
    actorId: req.user && (req.user._id || req.user.id),
    role: (req.user && req.user.role) || 'Admin',
    action: isApproved ? 'PROVIDER_VERIFIED' : 'PROVIDER_REJECTED',
    details: isApproved 
      ? `Admin verified provider application for "${provider.institutionName || 'Provider'}" (ID: ${provider._id}).`
      : `Admin rejected provider application for "${provider.institutionName || 'Provider'}" (ID: ${provider._id}). Reason: ${finalReason}`,
    ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
    severity: isApproved ? 'Info' : 'Warning'
  });

  const recipientEmail = await resolveRegisteredAccountEmail(
    provider.userId,
    (userId) => User.findById(userId)
  );

  const recipientName = getUserField(provider.userId, 'name')
    || (provider.representative && provider.representative.name)
    || 'Partner';
  const orgName = provider.institutionName || 'your organization';
  const notification = { sent: false };

  if (!statusChanged && !finalFlagChanged) {
    notification.reason = 'unchanged';
  } else if (!recipientEmail) {
    console.error(`Provider verification email skipped for ${provider._id}: no persisted recipient email.`);
    notification.warning = 'Verification was updated, but no registered email was available to notify the provider.';
  } else {
    try {
      if (isApproved) {
        await emailService.sendProviderApprovalEmail({
          email: recipientEmail,
          recipientName,
          organizationName: orgName
        });
      } else {
        await emailService.sendProviderRejectionEmail({
          email: recipientEmail,
          recipientName,
          organizationName: orgName,
          rejectionReason: finalReason,
          isFinalRejection: Boolean(provider.isFinalRejection)
        });
      }
      notification.sent = true;
    } catch (emailErr) {
      console.error('Failed to dispatch provider verification email:', emailErr.message);
      notification.warning = 'Verification was updated, but the provider notification email could not be sent.';
    }
  }

  res.status(200).json(withAuditWarning({
    success: true,
    message: `Provider status successfully updated to ${finalStatus}`,
    data: {
      ...(typeof provider.toObject === 'function' ? provider.toObject() : provider),
      verificationStatus: finalStatus,
      status: finalStatus,
      rejectionReason: isApproved ? null : finalReason,
      isFinalRejection: isApproved ? false : Boolean(provider.isFinalRejection)
    },
    notification
  }, verificationAudit));
});

// @desc    Patch Scholarship Listing Status (Approve/Reject)
// @route   PATCH /api/v1/admin/scholarships/:id/status
// @access  Private (Admin / Super Admin)
exports.updateScholarshipStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!Scholarship) {
    return next(new ErrorResponse('Scholarship model not configured', 500));
  }

  const isApproved = ['APPROVED', 'PUBLISHED'].includes(String(status).toUpperCase());
  const updatedStatus = isApproved ? 'Published' : 'Rejected';
  const scholarship = await Scholarship.findByIdAndUpdate(id, { status: updatedStatus }, { new: true });

  if (!scholarship) {
    return next(new ErrorResponse(`Scholarship listing not found with ID ${id}`, 404));
  }

  await matchCache.invalidateMatchCache();

  // 📝 AUDIT LOG: Scholarship Moderation Action
  const adminActor = req.user 
    ? `${req.user.firstName || req.user.name || ''} ${req.user.lastName || ''}`.trim() || req.user.email 
    : 'Admin User';

  const moderationAudit = await recordAuditLog({
    actor: adminActor,
    actorId: req.user && (req.user._id || req.user.id),
    role: (req.user && req.user.role) || 'Admin',
    action: 'SCHOLARSHIP_MODERATED',
    details: `Admin set status of scholarship "${scholarship.name || 'Unknown scholarship'}" (ID: ${scholarship._id}) to ${updatedStatus}.`,
    ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
    severity: isApproved ? 'Info' : 'Warning'
  });

  res.status(200).json(withAuditWarning({
    success: true,
    message: `Scholarship listing updated to ${updatedStatus}`,
    data: scholarship
  }, moderationAudit));
});

// @desc    Patch Parental Consent Verification Status
// @route   PATCH /api/v1/admin/parental-consent/:id/status
// @access  Private (Admin / Super Admin)
exports.updateConsentStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  const isApproved = ['APPROVED', 'VERIFIED'].includes(String(status).toUpperCase());
  const updatedStatus = isApproved ? 'Verified' : 'Rejected';
  const consent = await ParentalConsent.findByIdAndUpdate(id, { status: updatedStatus }, { new: true });

  if (!consent) {
    return next(new ErrorResponse(`Consent record not found with ID ${id}`, 404));
  }

  // 📝 AUDIT LOG: Consent Moderation Action
  const adminActor = req.user 
    ? `${req.user.firstName || req.user.name || ''} ${req.user.lastName || ''}`.trim() || req.user.email 
    : 'Admin User';

  const consentAudit = await recordAuditLog({
    actor: adminActor,
    actorId: req.user && (req.user._id || req.user.id),
    role: (req.user && req.user.role) || 'Admin',
    action: 'CONSENT_MODERATED',
    details: `Admin updated parental consent status for Student "${consent.studentName || 'N/A'}" to ${updatedStatus}.`,
    ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
    severity: isApproved ? 'Info' : 'Warning'
  });

  res.status(200).json(withAuditWarning({
    success: true,
    message: `Consent record updated to ${updatedStatus}`,
    data: consent
  }, consentAudit));
});

// @desc    Get all pending or submitted provider applications for review
// @route   GET /api/v1/admin/providers/pending
// @access  Private (Super Admin)
exports.getPendingProviders = asyncHandler(async (req, res, next) => {
  const providers = await Provider.find(PENDING_PROVIDER_QUERY)
    .populate('userId', 'name email createdAt status');

  res.status(200).json({
    success: true,
    count: providers.length,
    data: providers,
  });
});

// @desc    Get single provider application details
// @route   GET /api/v1/admin/providers/:providerId
// @access  Private (Super Admin)
exports.getProviderById = asyncHandler(async (req, res, next) => {
  const provider = await Provider.findById(req.params.providerId).populate(
    'userId',
    'name email createdAt status organization'
  );

  if (!provider) {
    return next(
      new ErrorResponse(`Provider profile not found with ID ${req.params.providerId}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: provider,
  });
});

// @desc    Approve or Reject a provider application
// @route   PUT /api/v1/admin/providers/:providerId/review
// @access  Private (Super Admin)
exports.reviewProviderApplication = exports.updateProviderVerification;

// @desc    Get all provider verifications for queue list
// @route   GET /api/v1/admin/verifications
// @access  Private (Admin / Super Admin)
exports.getVerifications = asyncHandler(async (req, res, next) => {
  const providers = await Provider.find({})
    .populate('userId', 'name email jobTitle title')
    .sort({ createdAt: -1 });

  const verifications = providers.map((p) => {
    const currentStatus = String(p.verificationStatus || p.status || '').toUpperCase();
    
    let statusLabel = 'Pending Review';
    if (['APPROVED', 'VERIFIED'].includes(currentStatus)) {
      statusLabel = 'Verified';
    } else if (['REJECTED', 'DECLINED'].includes(currentStatus)) {
      statusLabel = 'Rejected';
    } else {
      statusLabel = 'Pending Review';
    }

    const rawDocs = Array.isArray(p.verificationDocuments) && p.verificationDocuments.length > 0
      ? p.verificationDocuments
      : (Array.isArray(p.documents) ? p.documents : []);

    const repName = p.representative?.name || p.contactPerson || getUserField(p.userId, 'name') || 'Not Provided';
    const repTitle = p.representative?.title || p.representative?.jobTitle || getUserField(p.userId, 'title') || getUserField(p.userId, 'jobTitle') || 'Not Provided';
    const repEmail = p.representative?.workEmail || p.contactEmail || getUserField(p.userId, 'email') || 'Not Provided';

    return {
      _id: p._id,
      organizationName: p.institutionName || p.organizationName || getUserField(p.userId, 'name') || 'Unnamed Provider',
      institutionType: p.institutionType || p.organizationType || null,
      taxId: p.taxId || p.secRegistrationNumber || null,
      website: p.website || p.officialWebsite || null,
      contactNumber: p.contactNumber || p.phone || p.representative?.phone || null,
      contactEmail: repEmail,
      submittedAt: (p.submittedAt || p.createdAt)
        ? new Date(p.submittedAt || p.createdAt).toLocaleDateString()
        : null,
      status: statusLabel,
      verificationStatus: statusLabel,
      rejectionReason: p.rejectionReason || null,
      isFinalRejection: Boolean(p.isFinalRejection),
      representative: {
        name: repName,
        title: repTitle,
        workEmail: repEmail
      },
      documents: rawDocs.map((doc) => {
        const rawPath = typeof doc === 'string' ? doc : (doc.fileUrl || doc.path || doc.url || '');
        if (!rawPath || rawPath === '#') return null;

        const formattedUrl = !rawPath.startsWith('http') && !rawPath.startsWith('/')
          ? `/${rawPath}`
          : rawPath;
        const storedName = typeof doc === 'object'
          ? (doc.originalName || doc.fileName || doc.filename || doc.name || null)
          : null;

        return {
          _id: typeof doc === 'object' ? (doc._id || doc.fileId || null) : null,
          name: storedName || (typeof doc === 'object' ? doc.documentType : null) || 'Verification document',
          documentType: typeof doc === 'object' ? (doc.documentType || null) : null,
          fileUrl: formattedUrl,
          url: formattedUrl,
          path: formattedUrl,
          filename: storedName,
          uploadedAt: typeof doc === 'object' ? (doc.uploadedAt || null) : null,
        };
      }).filter(Boolean),
    };
  });

  res.status(200).json({
    success: true,
    data: verifications
  });
});

const publicRevocation = (revocation) => ({
  required: Boolean(revocation.required),
  success: Boolean(revocation.success),
  blocklisted: revocation.blocklisted || 0,
  failed: revocation.failed || 0,
  skipped: revocation.skipped || 0,
  reason: revocation.reason || null,
  elapsedMs: typeof revocation.elapsedMs === 'number' ? revocation.elapsedMs : null,
  ...(revocation.indexCleanupFailed ? { indexCleanupFailed: true } : {}),
});

const suspensionMessage = (revocation) => {
  if (!revocation.success) {
    if (revocation.reason === 'redis_unavailable' || revocation.reason === 'redis_read_failed' || revocation.reason === 'redis_unsupported') {
      return 'Account status was updated to suspended. Active sessions are rejected while the account stays suspended. The Redis session index could not be read, so sessions stored only in Redis were not blocklisted.';
    }
    if (revocation.reason === 'revocation_store_unavailable') {
      return 'Account status was updated to suspended. The durable session record could not be updated, so revocation of every session was not confirmed.';
    }
    if (revocation.reason === 'partial_failure') {
      return 'Account status was updated to suspended, but only some sessions were revoked.';
    }
    return 'Account status was updated to suspended, but session revocation was not confirmed.';
  }
  if (revocation.reason === 'no_tracked_sessions') {
    return 'Account status updated to suspended. No tracked sessions were found to revoke.';
  }
  return 'Account status updated to suspended and tracked sessions were revoked.';
};

// @desc    List registered users for admin user management
// @route   GET /api/v1/admin/users
// @access  Private (Admin / Super Admin)
exports.getAdminUsers = asyncHandler(async (req, res, next) => {
  const parsed = parseUserListQuery(req.query || {});
  if (!parsed.ok) {
    return next(new ErrorResponse(parsed.message, 400));
  }

  try {
    const filter = userListFilter(parsed);
    const skip = (parsed.page - 1) * parsed.limit;
    const [users, total] = await Promise.all([
      User.find(filter)
        .select('name email role status isVerified isOnboarded createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsed.limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const providerIds = (users || [])
      .filter((user) => user.role === 'provider')
      .map((user) => user._id)
      .filter(Boolean);
    const providers = providerIds.length === 0
      ? []
      : await Provider.find({ userId: { $in: providerIds } })
          .select('userId verificationStatus')
          .lean();
    const providerByUserId = new Map(
      (providers || []).map((provider) => [
        String(provider.userId && provider.userId._id ? provider.userId._id : provider.userId),
        provider,
      ])
    );

    const data = (users || []).map((user) => presentManagedUser(
      user,
      user.role === 'provider' ? providerByUserId.get(String(user._id)) : null
    ));

    return res.status(200).json({
      success: true,
      count: data.length,
      total,
      page: parsed.page,
      pages: total === 0 ? 0 : Math.ceil(total / parsed.limit),
      data,
    });
  } catch (error) {
    console.error('Admin user list error:', error);
    return next(new ErrorResponse('Unable to load users. Please try again.', 500));
  }
});

// @desc    Update a user account status and revoke sessions when suspending
// @route   PATCH /api/v1/admin/users/:id/status
// @access  Private (Admin / Super Admin)
exports.updateUserAccountStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body || {};

  if (!id) {
    return next(new ErrorResponse('User id is required.', 400));
  }

  if (status === 'pending_consent') {
    return next(new ErrorResponse(
      'Administrators cannot set an account to pending consent. That state is assigned by the student consent workflow.',
      400
    ));
  }

  if (typeof status !== 'string' || !MANUAL_ACCOUNT_STATUSES.includes(status)) {
    return next(new ErrorResponse('Unsupported account status.', 400));
  }

  const user = await User.findById(id);
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  const actorId = req.user && (req.user._id || req.user.id);
  if (actorId && String(user._id) === String(actorId)) {
    return next(new ErrorResponse('You cannot change your own account status.', 403));
  }

  if (isAdminRole(user.role) && !isSuperadminRole(req.user && req.user.role)) {
    return next(new ErrorResponse('Only a super admin can change an administrator account status.', 403));
  }

  const previousStatus = user.status;
  user.status = status;
  await user.save();

  if (canonicalRole(user.role) === 'provider') {
    await matchCache.invalidateMatchCache();
  }

  let revocation = {
    required: false,
    success: true,
    blocklisted: 0,
    failed: 0,
    skipped: 0,
    reason: null,
    elapsedMs: null,
  };

  if (status === 'suspended') {
    const statusChangedAt = process.hrtime.bigint();
    revocation = await revokeUserSessions(user._id, { statusChangedAt });
    revocation.required = true;
  }

  const adminActor = req.user
    ? `${req.user.firstName || req.user.name || ''} ${req.user.lastName || ''}`.trim() || req.user.email
    : 'Admin User';
  const revocationDetail = status !== 'suspended'
    ? 'Session revocation was not required.'
    : revocation.success
      ? `Tracked session revocation completed (${revocation.blocklisted} blocklisted, ${revocation.skipped} expired).`
      : `Tracked session revocation incomplete (${revocation.blocklisted} blocklisted, ${revocation.failed} failed, reason: ${revocation.reason || 'unknown'}).`;

  const statusAudit = await recordAuditLog({
    actor: adminActor,
    actorId: req.user && (req.user._id || req.user.id),
    role: (req.user && req.user.role) || 'Admin',
    action: 'ACCOUNT_STATUS_CHANGE',
    details: `Account status for ${user.email || user._id} (${user._id}) changed from ${previousStatus || 'unknown'} to ${status}. ${revocationDetail}`,
    ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
    severity: status === 'suspended' ? 'Warning' : 'Info',
  });

  const payload = {
    statusUpdated: true,
    data: {
      id: user._id,
      status,
      previousStatus: previousStatus || null,
    },
    revocation: publicRevocation(revocation),
  };

  if (status === 'suspended' && !revocation.success) {
    return res.status(503).json(withAuditWarning({
      success: false,
      message: suspensionMessage(revocation),
      ...payload,
    }, statusAudit));
  }

  return res.status(200).json(withAuditWarning({
    success: true,
    message: status === 'suspended'
      ? suspensionMessage(revocation)
      : `Account status updated to ${status}.`,
    ...payload,
  }, statusAudit));
});

// @desc    Get Global System Configuration
// @route   GET /api/v1/admin/config
// @access  Private (Admin / Super Admin)
exports.getSystemConfig = asyncHandler(async (req, res, next) => {
  let config = await SystemConfig.findOne();
  if (!config) {
    config = await SystemConfig.create({ maintenanceMode: false });
  }

  res.status(200).json({
    success: true,
    data: config,
  });
});

// @desc    Update Global System Configuration
// @route   PUT /api/v1/admin/config
// @access  Private (Admin / Super Admin)
exports.updateSystemConfig = asyncHandler(async (req, res, next) => {
  const { maintenanceMode } = req.body;

  let config = await SystemConfig.findOne();
  if (!config) {
    config = new SystemConfig();
  }

  if (maintenanceMode !== undefined) {
    config.maintenanceMode = maintenanceMode;
  }
  config.updatedBy = req.user._id;

  await config.save();

  const adminActor = req.user 
    ? `${req.user.firstName || req.user.name || ''} ${req.user.lastName || ''}`.trim() || req.user.email 
    : 'Admin User';

  const configAudit = await recordAuditLog({
    actor: adminActor,
    actorId: req.user && (req.user._id || req.user.id),
    role: (req.user && req.user.role) || 'Admin',
    action: 'SYSTEM_CONFIG_UPDATED',
    details: `Updated settings: maintenanceMode=${config.maintenanceMode}`,
    ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
    severity: 'Info'
  });

  res.status(200).json(withAuditWarning({
    success: true,
    data: config,
    message: 'System configuration saved successfully.',
  }, configAudit));
});

// @desc    Invite / Provision New Admin Account
// @route   POST /api/v1/admin/invite
// @access  Private (Admin / Super Admin)
exports.inviteAdmin = asyncHandler(async (req, res, next) => {
  const { fullName, email, adminRole } = req.body;
  const trimmedName = String(fullName || '').trim();
  const normalizedEmail = String(email || '').toLowerCase().trim();

  if (!trimmedName || !normalizedEmail) {
    return next(new ErrorResponse('Please provide full name and official email address.', 400));
  }

  if (!OFFICIAL_EMAIL.test(normalizedEmail)) {
    return next(new ErrorResponse('Please provide a valid official email address.', 400));
  }

  const requestedRole = canonicalRole(adminRole);
  if (!INVITE_ROLES.has(requestedRole)) {
    return next(new ErrorResponse('Select a valid administrator role.', 400));
  }

  if (requestedRole === 'superadmin' && !isSuperadminRole(req.user && req.user.role)) {
    return next(new ErrorResponse('Only a super admin can provision another super admin.', 403));
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return next(new ErrorResponse(DUPLICATE_ADMIN_EMAIL, 409));
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const invitationLink = buildAdminInvitationUrl(resetToken);
  if (!invitationLink.ok) {
    return next(new ErrorResponse(
      'The invitation link could not be created because the application address is not configured for this deployment.',
      500
    ));
  }

  const roleToAssign = requestedRole;
  const placeholderPassword = crypto.randomBytes(32).toString('hex');

  const removeInvitedAccount = async (account) => {
    if (!account || !account._id) return true;
    try {
      await User.findByIdAndDelete(account._id);
      return true;
    } catch (cleanupError) {
      console.error('Failed to roll back admin invitation:', cleanupError.message);
      return false;
    }
  };

  let newAdminUser;
  try {
    newAdminUser = await User.create({
      name: trimmedName,
      email: normalizedEmail,
      password: placeholderPassword,
      role: roleToAssign,
      isVerified: true,
    });

    newAdminUser.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    newAdminUser.resetPasswordExpire = Date.now() + 30 * 60 * 1000;
    await newAdminUser.save({ validateBeforeSave: false });

    if (typeof emailService.sendAdminInvitationEmail !== 'function') {
      throw new Error('Admin invitation email is not configured.');
    }

    await emailService.sendAdminInvitationEmail(
      newAdminUser.email,
      invitationLink.url,
      newAdminUser.name
    );
  } catch (err) {
    const removed = await removeInvitedAccount(newAdminUser);

    if (isDuplicateKeyError(err)) {
      return next(new ErrorResponse(DUPLICATE_ADMIN_EMAIL, 409));
    }

    if (err && err.name === 'ValidationError') {
      return next(new ErrorResponse(invitationValidationMessage(err), 400));
    }

    if (!newAdminUser) {
      return next(new ErrorResponse('The invitation could not be created. No admin account was created.', 500));
    }

    console.error('Admin invitation email failed:', err.message);
    return next(new ErrorResponse(
      removed
        ? 'The invitation email could not be sent. No admin account was created.'
        : 'The invitation email could not be sent, and the new account could not be removed.',
      500
    ));
  }

  const adminActor = req.user 
    ? `${req.user.firstName || req.user.name || ''} ${req.user.lastName || ''}`.trim() || req.user.email 
    : 'Admin User';

  const inviteAudit = await recordAuditLog({
    actor: adminActor,
    actorId: req.user && (req.user._id || req.user.id),
    role: (req.user && req.user.role) || 'Admin',
    action: 'ADMIN_ACCOUNT_PROVISIONED',
    details: `Emailed a password-setup link for a new ${roleToAssign} account at ${normalizedEmail}.`,
    ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
    severity: 'Warning'
  });

  res.status(201).json(withAuditWarning({
    success: true,
    message: `An invitation link was emailed to ${normalizedEmail}. It expires in 30 minutes.`,
    data: {
      id: newAdminUser._id,
      name: newAdminUser.name,
      email: newAdminUser.email,
      role: newAdminUser.role,
    },
  }, inviteAudit));
});

// Alias for queue status updates
exports.updateVerificationQueueStatus = exports.updateProviderVerification;
