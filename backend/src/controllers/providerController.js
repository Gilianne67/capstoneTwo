const Provider = require('../models/Provider');
const Scholarship = require('../models/Scholarship');
const SavedMatch = require('../models/SavedMatch');
const {
  closeExpiredScholarships
} = require('../services/scholarshipExpirationService');
const {
  resolveAnalyticsPeriod,
  buildProviderAnalytics,
} = require('../services/providerAnalyticsService');
const User = require('../models/User');
const emailService = require('../utils/emailService');
const { recordAuditLog } = require('./auditController');
const {
  isFinalRejection,
  declinedProviderLoginMessage,
  resolveRegisteredAccountEmail,
} = require('../utils/providerVerification');

// Helper to safely resolve user ID from Passport / JWT middleware
const getUserId = (user) => user?._id || user?.id;

// Get the logged-in provider's profile
exports.getProfile = async (req, res) => {
  try {
    const userId = getUserId(req.user);
    const provider = await Provider.findOne({ userId });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found',
      });
    }

    res.status(200).json({
      success: true,
      provider,
    });
  } catch (error) {
    console.error('❌ Get Provider Profile Error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update the logged-in provider's profile
exports.updateProfile = async (req, res) => {
  try {
    const userId = getUserId(req.user);
    const { institutionName, institutionType, website, contactNumber, address, representative } = req.body;

    const provider = await Provider.findOne({ userId });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found',
      });
    }

    const verificationFields = ['verificationStatus', 'rejectionReason', 'isFinalRejection', 'verifiedAt', 'submittedAt', 'verificationDocuments'];
    const attemptedVerificationChange = verificationFields.some((field) =>
      Object.prototype.hasOwnProperty.call(req.body, field)
    );
    
    if (attemptedVerificationChange) {
      // 📝 AUDIT LOG: Unauthorized Verification Alteration Attempt
      const actorName = req.user 
        ? `${req.user.firstName || req.user.name || ''} ${req.user.lastName || ''}`.trim() || req.user.email 
        : provider.institutionName || 'Provider User';

      await recordAuditLog({
        actor: actorName,
        role: 'Provider',
        action: 'SECURITY_ALERT',
        details: `Provider (ID: ${provider._id}) attempted unauthorized self-modification of verification status.`,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
        severity: 'Warning'
      });

      return res.status(403).json({
        success: false,
        message: 'Providers cannot change their own verification status.',
      });
    }

    // Update root profile fields
    if (institutionName !== undefined) provider.institutionName = institutionName;
    if (institutionType !== undefined) provider.institutionType = institutionType;
    if (website !== undefined) provider.website = website;
    if (contactNumber !== undefined) provider.contactNumber = contactNumber;

    // Update nested address object safely
    if (address && typeof address === 'object') {
      provider.address = {
        ...provider.address?.toObject?.() || provider.address,
        ...address,
      };
    }

    // Update nested representative object safely
    if (representative && typeof representative === 'object') {
      provider.representative = {
        ...provider.representative?.toObject?.() || provider.representative,
        ...representative,
      };
    }

    await provider.save();

    // 📝 AUDIT LOG: Provider Profile Updated
    const actorName = req.user 
      ? `${req.user.firstName || req.user.name || ''} ${req.user.lastName || ''}`.trim() || req.user.email 
      : provider.institutionName || 'Provider User';

    await recordAuditLog({
      actor: actorName,
      role: 'Provider',
      action: 'PROVIDER_PROFILE_UPDATE',
      details: `Provider "${provider.institutionName}" updated organization profile details.`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      severity: 'Info'
    });

    res.status(200).json({
      success: true,
      message: 'Provider profile updated successfully',
      provider,
    });
  } catch (error) {
    console.error('❌ Update Provider Profile Error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get the logged-in provider's dashboard
exports.getDashboard = async (req, res) => {
  try {
    const userId = getUserId(req.user);
    const provider = await Provider.findOne({ userId });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found',
      });
    }

    await closeExpiredScholarships();

    const [totalScholarships, openScholarships, closedScholarships, archivedScholarships] =
      await Promise.all([
        Scholarship.countDocuments({
          providerId: provider._id,
          isArchived: false,
        }),

        Scholarship.countDocuments({
          providerId: provider._id,
          status: 'Open',
          isArchived: false,
        }),

        Scholarship.countDocuments({
          providerId: provider._id,
          status: 'Closed',
          isArchived: false,
        }),

        Scholarship.countDocuments({
          providerId: provider._id,
          isArchived: true,
        }),
      ]);

    res.status(200).json({
      success: true,
      dashboard: {
        provider: {
          id: provider._id,
          institutionName: provider.institutionName,
          institutionType: provider.institutionType,
          verificationStatus: provider.verificationStatus,
        },
        statistics: {
          totalScholarships,
          openScholarships,
          closedScholarships,
          archivedScholarships,
        },
      },
    });
  } catch (error) {
    console.error('❌ Get Provider Dashboard Error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET /api/v1/provider/analytics
// Counts and trends for the authenticated provider only.
// Does not close expired scholarships and does not read a client provider id.
async function getAnalytics(req, res) {
  try {
    const periodResult = resolveAnalyticsPeriod(req.query, new Date());
    if (!periodResult.ok) {
      return res.status(400).json({
        success: false,
        message: periodResult.message,
      });
    }

    const userId = getUserId(req.user);
    const provider = await Provider.findOne({ userId });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found',
      });
    }

    const scholarships = await Scholarship.find({
      providerId: provider._id,
    })
      .select('name status isArchived createdAt providerId')
      .lean();

    const scholarshipIds = scholarships.map((scholarship) => scholarship._id);
    const groupedSaves = scholarshipIds.length === 0
      ? []
      : await SavedMatch.aggregate([
          { $match: { scholarshipId: { $in: scholarshipIds } } },
          { $group: { _id: '$scholarshipId', saveCount: { $sum: 1 } } },
        ]);

    const analytics = buildProviderAnalytics({
      providerId: provider._id,
      scholarships,
      saveCounts: groupedSaves.map((entry) => ({
        scholarshipId: entry._id,
        saveCount: entry.saveCount,
      })),
      period: periodResult.period,
    });

    return res.status(200).json({
      success: true,
      analytics,
    });
  } catch (error) {
    console.error('❌ Get Provider Analytics Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

exports.getAnalytics = getAnalytics;

// POST /api/v1/provider/onboarding
exports.handleOnboarding = async (req, res) => {
  try {
    const userId = getUserId(req.user);
    const {
      institutionName,
      institutionType,
      website,
      contactNumber,
      street,
      city,
      province,
      region,
      repName,
      fullName, // Fallback key if frontend sends fullName
      repTitle,
      jobTitle, // Fallback key if frontend sends jobTitle
      repEmail,
      workEmail, // Fallback key if frontend sends workEmail
      documentType,
    } = req.body;

    // 1. Find or initialize the authenticated user's Provider record
    let provider = await Provider.findOne({ userId });

    if (isFinalRejection(provider)) {
      return res.status(403).json({
        success: false,
        verificationDeclined: true,
        message: declinedProviderLoginMessage(provider),
      });
    }

    if (!provider) {
      provider = new Provider({ userId });
    }

    const hasExistingDocuments = Array.isArray(provider.verificationDocuments)
      && provider.verificationDocuments.length > 0;

    if (!req.file && !hasExistingDocuments) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a valid verification document (PDF, PNG, JPG).',
      });
    }

    // 3. Normalize field values
    const finalRepName = repName || fullName || provider.representative?.name;
    const finalRepTitle = repTitle || jobTitle || provider.representative?.title;
    const finalRepEmail = repEmail || workEmail || provider.representative?.workEmail;

    // 4. Update Profile Fields
    provider.institutionName = institutionName || provider.institutionName;
    provider.institutionType = institutionType || provider.institutionType;
    provider.website = website || provider.website;
    provider.contactNumber = contactNumber || provider.contactNumber;

    provider.address = {
      street: street || provider.address?.street,
      city: city || provider.address?.city,
      province: province || provider.address?.province,
      region: region || provider.address?.region,
    };

    provider.representative = {
      name: finalRepName,
      title: finalRepTitle,
      workEmail: finalRepEmail,
    };

    provider.verificationStatus = 'Pending Review';
    provider.isFinalRejection = false;
    provider.rejectionReason = undefined;
    provider.verifiedAt = null;
    provider.submittedAt = new Date();

    if (!Array.isArray(provider.verificationDocuments)) {
      provider.verificationDocuments = [];
    }

    if (req.file) {
      const fileUrl = req.file.filename
        ? `/api/v1/documents/${req.file.filename}`
        : `/uploads/${req.file.originalname}`;

      provider.verificationDocuments.push({
        documentType: documentType || 'SEC / DTI Registration',
        fileUrl,
        fileId: req.file.id,
        originalName: req.file.originalname,
        uploadedAt: new Date(),
      });
    }

    await provider.save();

    // 5. Update User onboarding state
    await User.findByIdAndUpdate(userId, { isOnboarded: true });

    // 📝 AUDIT LOG: Provider Verification Document Submission
    const actorName = req.user 
      ? `${req.user.firstName || req.user.name || ''} ${req.user.lastName || ''}`.trim() || req.user.email 
      : provider.institutionName || 'Provider User';

    await recordAuditLog({
      actor: actorName,
      role: 'Provider',
      action: 'PROVIDER_VERIFICATION_SUBMITTED',
      details: `Provider "${provider.institutionName}" submitted verification documents (${documentType || 'SEC / DTI Registration'}). Status set to Pending Review.`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      severity: 'Info'
    });

    // 6. Send Email Notifications
    const providerData = {
      institutionName: provider.institutionName,
      institutionType: provider.institutionType,
      website: provider.website,
      contactNumber: provider.contactNumber,
      repName: provider.representative.name,
      repTitle: provider.representative.title,
      repEmail: provider.representative.workEmail,
      documentType: documentType || 'SEC / DTI Registration',
    };

    try {
      await emailService.sendProviderAdminNotification(providerData, req.file);
    } catch (emailErr) {
      console.warn('⚠️ Admin email failed:', emailErr.message);
    }

    const confirmationEmail = await resolveRegisteredAccountEmail(
      req.user || { _id: userId },
      (id) => User.findById(id)
    );
    if (confirmationEmail) {
      try {
        await emailService.sendProviderConfirmation(
          confirmationEmail,
          provider.representative.name,
          provider.institutionName
        );
      } catch (emailErr) {
        console.warn('⚠️ Provider confirmation email failed:', emailErr.message);
      }
    } else {
      console.warn(
        `⚠️ Provider confirmation email skipped for ${provider._id || userId}: no registered account email.`
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Verification documents submitted successfully. Account pending admin review.',
      redirectTo: '/provider/dashboard', // 🚀 Routes provider directly into their module/dashboard
      provider,
    });
  } catch (error) {
    console.error('❌ Provider Onboarding Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error during provider onboarding.',
    });
  }
};