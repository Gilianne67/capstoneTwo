const Provider = require('../models/Provider');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const { sendEmail } = require('../utils/sendEmail');

// @desc    Get all pending or submitted provider applications for review
// @route   GET /api/v1/admin/providers/pending
// @access  Private (Super Admin)
exports.getPendingProviders = asyncHandler(async (req, res, next) => {
  const providers = await Provider.find({
    verificationStatus: { $in: ['Submitted', 'Pending'] },
  }).populate('userId', 'name email createdAt status');

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
exports.reviewProviderApplication = asyncHandler(async (req, res, next) => {
  const { providerId } = req.params;
  const { action, rejectionReason } = req.body; // action must be 'APPROVE' or 'REJECT'

  if (!['APPROVE', 'REJECT'].includes(action)) {
    return next(new ErrorResponse('Action must be either APPROVE or REJECT', 400));
  }

  const provider = await Provider.findById(providerId).populate('userId', 'email name');
  if (!provider) {
    return next(new ErrorResponse(`Provider application not found`, 404));
  }

  const recipientEmail = provider.representative?.workEmail || provider.userId?.email;

  if (action === 'APPROVE') {
    provider.verificationStatus = 'Approved';
    provider.verifiedAt = new Date();
    provider.rejectionReason = undefined;
    await provider.save();

    // Optionally ensure User record reflects active status
    if (provider.userId) {
      await User.findByIdAndUpdate(provider.userId._id, { isVerified: true });
    }

    // Send Approval Email
    if (recipientEmail) {
      try {
        await sendEmail({
          email: recipientEmail,
          subject: '🎉 Your IskolarMatch Provider Account Has Been Approved!',
          html: `
            <div style="font-family: Arial, sans-serif; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #064e3b; margin-top: 0;">Welcome to IskolarMatch!</h2>
              <p>Dear ${provider.representative?.name || provider.userId?.name || 'Partner'},</p>
              <p>We are excited to inform you that your verification application for <strong>${provider.institutionName}</strong> has been officially approved by our administrative team!</p>
              <p>You can now log into your provider portal to publish scholarships, manage applications, and connect with deserving students across the Philippines.</p>
              <div style="margin: 24px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" style="background-color: #064e3b; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Go to Provider Portal</a>
              </div>
              <p style="color: #64748b; font-size: 14px;">If you have any questions, feel free to reply to this email.</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.warn('Failed to dispatch approval email:', emailErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Provider application approved successfully.',
      data: provider,
    });
  }

  if (action === 'REJECT') {
    if (!rejectionReason) {
      return next(new ErrorResponse('A rejection reason is required when rejecting an application.', 400));
    }

    provider.verificationStatus = 'Rejected';
    provider.rejectionReason = rejectionReason;
    await provider.save();

    // Send Rejection Email
    if (recipientEmail) {
      try {
        await sendEmail({
          email: recipientEmail,
          subject: 'Update Regarding Your IskolarMatch Provider Application',
          html: `
            <div style="font-family: Arial, sans-serif; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #991b1b; margin-top: 0;">Verification Status Update</h2>
              <p>Dear ${provider.representative?.name || provider.userId?.name || 'Partner'},</p>
              <p>Thank you for your interest in partnering with IskolarMatch for <strong>${provider.institutionName}</strong>.</p>
              <p>After reviewing your application and submitted documentation, we are unable to approve your provider account at this time due to the following reason:</p>
              <blockquote style="background-color: #fef2f2; padding: 16px; border-left: 4px solid #ef4444; color: #991b1b; margin: 16px 0; border-radius: 4px;">
                ${rejectionReason}
              </blockquote>
              <p>Please review the feedback above and log in to update your details or re-upload the necessary verification documents.</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.warn('Failed to dispatch rejection email:', emailErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Provider application rejected and notice email sent.',
      data: provider,
    });
  }
});