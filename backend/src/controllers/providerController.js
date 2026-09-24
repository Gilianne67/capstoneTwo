const Provider = require('../models/Provider');
const Scholarship = require('../models/Scholarship');
const User = require('../models/User'); 
const { sendProviderAdminNotification, sendProviderConfirmation } = require('../utils/sendEmail');

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

    // 1. Verify file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a valid verification document (PDF, PNG, JPG).',
      });
    }

    // 2. Find or initialize Provider record
    let provider = await Provider.findOne({ userId });

    if (!provider) {
      provider = new Provider({ userId });
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
    provider.submittedAt = new Date();

    if (!Array.isArray(provider.verificationDocuments)) {
      provider.verificationDocuments = [];
    }

    // Reference GridFS file endpoint or fallback to disk upload path
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

    await provider.save();

    // 5. Update User onboarding state
    await User.findByIdAndUpdate(userId, { isOnboarded: true });

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
      await sendProviderAdminNotification(providerData, req.file);
    } catch (emailErr) {
      console.warn('⚠️ Admin email failed:', emailErr.message);
    }

    if (provider.representative.workEmail) {
      try {
        await sendProviderConfirmation(
          provider.representative.workEmail,
          provider.representative.name,
          provider.institutionName
        );
      } catch (emailErr) {
        console.warn('⚠️ Provider confirmation email failed:', emailErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Verification documents submitted successfully. Account pending admin review.',
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