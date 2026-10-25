const Provider = require('../models/Provider');
const User = require('../models/User');
const ParentalConsent = require('../models/ParentalConsent');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const {
  parseBooleanFlag,
  resolveRegisteredAccountEmail,
} = require('../utils/providerVerification');
const emailService = require('../utils/emailService');
const auditController = require('./auditController');

// Safe import for Scholarship
let Scholarship;
try {
  Scholarship = require('../models/Scholarship');
} catch (e) {
  Scholarship = null;
}

// Helper for relative timestamps (e.g., "2 hours ago")
function formatDateAgo(date) {
  if (!date) return 'Recently';
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} mins ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

// Helper to safely extract user properties when populated or unpopulated
function getUserField(userId, field) {
  if (userId && typeof userId === 'object' && userId[field]) {
    return userId[field];
  }
  return null;
}

// Standard pending filter across queries
const PENDING_PROVIDER_QUERY = {
  verificationStatus: { $in: ['Pending Review', 'Submitted', 'Pending', 'PENDING', 'PENDING REVIEW'] }
};

// @desc    Get Admin Dashboard Overview & Queues
// @route   GET /api/v1/admin/dashboard
// @access  Private (Admin / Super Admin)
exports.getAdminDashboard = asyncHandler(async (req, res, next) => {
  const [
    pendingProvidersCount,
    pendingConsentsCount,
    activeProvidersCount,
    pendingProviders,
    pendingListings,
    pendingConsents
  ] = await Promise.all([
    Provider.countDocuments(PENDING_PROVIDER_QUERY),
    ParentalConsent.countDocuments({ status: { $in: ['Submitted', 'Pending', 'Pending Review', 'PENDING'] } }),
    Provider.countDocuments({ verificationStatus: { $in: ['Approved', 'Verified', 'APPROVED', 'VERIFIED'] } }),

    // Fetch top 10 queue items
    Provider.find(PENDING_PROVIDER_QUERY)
      .populate('userId', 'email name')
      .sort({ createdAt: -1 })
      .limit(10),

    Scholarship
      ? Scholarship.find({ status: { $in: ['Pending', 'SUBMITTED', 'Pending Review', 'PENDING'] } })
          .populate('providerId', 'institutionName')
          .sort({ createdAt: -1 })
          .limit(10)
      : [],

    ParentalConsent.find({ status: { $in: ['Pending', 'SUBMITTED', 'Pending Review', 'PENDING'] } })
      .sort({ createdAt: -1 })
      .limit(10)
  ]);

  const metrics = [
    {
      id: 'metric-1',
      label: 'Pending Verifications',
      value: String(pendingProvidersCount),
      iconKey: 'CheckSquare',
      color: 'amber'
    },
    {
      id: 'metric-2',
      label: 'Pending Minor Consents',
      value: String(pendingConsentsCount),
      iconKey: 'ShieldCheck',
      color: 'blue'
    },
    {
      id: 'metric-3',
      label: 'Active Providers',
      value: String(activeProvidersCount),
      iconKey: 'Building2',
      color: 'emerald'
    }
  ];

  res.status(200).json({
    success: true,
    metrics,
    pendingProviders: pendingProviders.map((p) => ({
      id: p._id,
      name: p.institutionName || getUserField(p.userId, 'name') || 'Unassigned Provider',
      email: p.representative?.workEmail || p.contactEmail || getUserField(p.userId, 'email') || null,
      taxId: p.taxId || p.secRegistrationNumber || null,
      submitted: formatDateAgo(p.submittedAt || p.createdAt)
    })),
    pendingListings: pendingListings.map((s) => ({
      id: s._id,
      title: s.title,
      provider: s.providerId?.institutionName || s.providerName || 'Provider',
      value: s.grantValue ? `₱${Number(s.grantValue).toLocaleString()}` : 'N/A',
      submitted: formatDateAgo(s.createdAt)
    })),
    pendingConsents: pendingConsents.map((c) => ({
      id: c._id,
      studentName: c.studentName,
      age: c.age,
      guardianName: c.guardianName,
      guardianEmail: c.guardianEmail,
      documentUrl: c.documentUrl || '#',
      submitted: formatDateAgo(c.createdAt)
    }))
  });
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

  await auditController.recordAuditLog({
    actor: adminActor,
    role: 'Admin',
    action: isApproved ? 'PROVIDER_VERIFIED' : 'PROVIDER_REJECTED',
    details: isApproved 
      ? `Admin verified provider application for "${provider.institutionName || 'Provider'}" (ID: ${provider._id}).`
      : `Admin rejected provider application for "${provider.institutionName || 'Provider'}" (ID: ${provider._id}). Reason: ${finalReason}`,
    ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
    severity: isApproved ? 'Info' : 'Warning'
  });

  const recipientEmail = await resolveRegisteredAccountEmail(
    provider.userId,
    (id) => User.findById(id)
  );
  const recipientName = getUserField(provider.userId, 'name')
    || (provider.representative && provider.representative.name)
    || 'Partner';
  const orgName = provider.institutionName || 'your organization';
  const notification = { sent: false };

  if (!statusChanged && !finalFlagChanged) {
    notification.reason = 'unchanged';
  } else if (!recipientEmail) {
    console.error(
      `Provider verification email skipped for ${provider._id}: no persisted recipient email.`
    );
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

  res.status(200).json({
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
  });
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

  // 📝 AUDIT LOG: Scholarship Moderation Action
  const adminActor = req.user 
    ? `${req.user.firstName || req.user.name || ''} ${req.user.lastName || ''}`.trim() || req.user.email 
    : 'Admin User';

  await auditController.recordAuditLog({
    actor: adminActor,
    role: 'Admin',
    action: 'SCHOLARSHIP_MODERATED',
    details: `Admin set status of scholarship listing "${scholarship.title}" (ID: ${scholarship._id}) to ${updatedStatus}.`,
    ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
    severity: isApproved ? 'Info' : 'Warning'
  });

  res.status(200).json({
    success: true,
    message: `Scholarship listing updated to ${updatedStatus}`,
    data: scholarship
  });
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

  await auditController.recordAuditLog({
    actor: adminActor,
    role: 'Admin',
    action: 'CONSENT_MODERATED',
    details: `Admin updated parental consent status for Student "${consent.studentName || 'N/A'}" to ${updatedStatus}.`,
    ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
    severity: isApproved ? 'Info' : 'Warning'
  });

  res.status(200).json({
    success: true,
    message: `Consent record updated to ${updatedStatus}`,
    data: consent
  });
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

    // Safely resolve Representative Details across populated/unpopulated schemas
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

// Alias for queue status updates
exports.updateVerificationQueueStatus = exports.updateProviderVerification;