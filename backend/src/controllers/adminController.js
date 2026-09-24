const Provider = require('../models/Provider');
const User = require('../models/User');
const ParentalConsent = require('../models/ParentalConsent');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const { sendEmail } = require('../utils/sendEmail');

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
      iconKey: 'Emerald',
      color: 'emerald'
    },
    {
      id: 'metric-4',
      label: 'System Uptime',
      value: '99.9%',
      iconKey: 'Activity',
      color: 'blue'
    }
  ];

  res.status(200).json({
    success: true,
    metrics,
    pendingProviders: pendingProviders.map((p) => ({
      id: p._id,
      name: p.institutionName || getUserField(p.userId, 'name') || 'Unassigned Provider',
      email: p.representative?.workEmail || p.contactEmail || getUserField(p.userId, 'email') || 'N/A',
      taxId: p.taxId || p.secRegistrationNumber || 'N/A',
      submitted: formatDateAgo(p.createdAt)
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
  const { id } = req.params;
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
  provider.verificationStatus = finalStatus;

  if (isApproved) {
    provider.verifiedAt = new Date();
    provider.rejectionReason = undefined;
  } else {
    provider.rejectionReason = finalReason;
  }
  
  await provider.save();

  // Mark associated User model as verified if approved
  if (isApproved && provider.userId) {
    const targetUserId = provider.userId._id || provider.userId;
    await User.findByIdAndUpdate(targetUserId, { isVerified: true });
  }

  // Safe recipient email resolution across schema options
  const recipientEmail = provider.representative?.workEmail || provider.contactEmail || getUserField(provider.userId, 'email');
  const recipientName = provider.representative?.name || getUserField(provider.userId, 'name') || 'Partner';
  const orgName = provider.institutionName || provider.organizationName || 'your organization';

  if (recipientEmail) {
    try {
      await sendEmail({
        email: recipientEmail,
        subject: isApproved
          ? '🎉 Your IskolarMatch Provider Account Has Been Approved!'
          : 'Update Regarding Your IskolarMatch Provider Application',
        html: isApproved
          ? `
            <div style="font-family: Arial, sans-serif; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #064e3b; margin-top: 0;">Welcome to IskolarMatch!</h2>
              <p>Dear ${recipientName},</p>
              <p>We are excited to inform you that your verification application for <strong>${orgName}</strong> has been officially approved!</p>
              <p>You can now log in to access your provider dashboard and post scholarship opportunities.</p>
              <div style="margin: 24px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" style="background-color: #064e3b; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Go to Provider Portal</a>
              </div>
            </div>
          `
          : `
            <div style="font-family: Arial, sans-serif; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #991b1b; margin-top: 0;">Verification Application Status Update</h2>
              <p>Dear ${recipientName},</p>
              <p>We reviewed your verification submission for <strong>${orgName}</strong>.</p>
              <p>At this time, your application was not approved for the following reason:</p>
              <blockquote style="background-color: #fef2f2; padding: 16px; border-left: 4px solid #ef4444; color: #991b1b; margin: 16px 0; border-radius: 4px;">
                ${finalReason}
              </blockquote>
              <p>Please log in to your account, review your documentation, and resubmit for review.</p>
            </div>
          `
      });
    } catch (emailErr) {
      console.warn('Failed to dispatch status notification email:', emailErr.message);
    }
  }

  res.status(200).json({
    success: true,
    message: `Provider status successfully updated to ${finalStatus}`,
    data: {
      ...provider.toObject(),
      verificationStatus: finalStatus,
      status: finalStatus,
      rejectionReason: isApproved ? null : finalReason
    }
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
      institutionType: p.institutionType || p.organizationType || 'Educational Institution',
      taxId: p.taxId || p.secRegistrationNumber || 'N/A',
      website: p.website || p.officialWebsite || null,
      contactNumber: p.contactNumber || p.phone || p.representative?.phone || null,
      contactEmail: repEmail,
      submittedAt: p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'N/A',
      status: statusLabel,
      verificationStatus: statusLabel,
      rejectionReason: p.rejectionReason || null,
      representative: {
        name: repName,
        title: repTitle,
        workEmail: repEmail
      },
      documents: rawDocs.map((doc) => {
        const rawPath = typeof doc === 'string' ? doc : (doc.fileUrl || doc.path || doc.url || '#');
        const formattedUrl = rawPath !== '#' && !rawPath.startsWith('http') && !rawPath.startsWith('/')
          ? `/${rawPath}`
          : rawPath;

        return {
          _id: doc._id || doc.fileId || null,
          name: doc.documentType || doc.fileName || doc.originalName || doc.name || 'Verification Document',
          documentType: doc.documentType || 'Verification Document',
          fileUrl: formattedUrl,
          url: formattedUrl,
          path: formattedUrl,
          filename: doc.originalName || doc.fileName || doc.filename || 'Document.pdf',
        };
      }),
    };
  });

  res.status(200).json({
    success: true,
    data: verifications
  });
});

// Alias for queue status updates
exports.updateVerificationQueueStatus = exports.updateProviderVerification;