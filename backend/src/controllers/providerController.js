const Provider = require('../models/Provider');
const Scholarship = require('../models/Scholarship');
const User = require('../models/User'); 
const { sendProviderAdminNotification, sendProviderConfirmation } = require('../utils/sendEmail');

// Get the logged-in provider's profile
exports.getProfile = async (req, res) => {
  try {
    const provider = await Provider.findOne({
      userId: req.user.id,
    });

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
    const { institutionName, institutionType, website, contactNumber, address, representative } = req.body;

    const provider = await Provider.findOne({
      userId: req.user.id,
    });

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
    const provider = await Provider.findOne({
      userId: req.user.id,
    });

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
    const userId = req.user.id;
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
      repTitle,
      repEmail,
      documentType,
    } = req.body;

    // 1. Verify file was uploaded via Multer / GridFS
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a valid verification document (PDF, PNG, JPG).',
      });
    }

    // 2. Find existing Provider record created during registration
    let provider = await Provider.findOne({ userId });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found.',
      });
    }

    // 3. Update Provider Profile & Verification Status
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
      name: repName || provider.representative?.name,
      title: repTitle || provider.representative?.title,
      workEmail: repEmail || provider.representative?.workEmail,
    };

    provider.verificationStatus = 'Submitted';
    provider.submittedAt = new Date();

    // Ensure array is initialized before push
    if (!Array.isArray(provider.verificationDocuments)) {
      provider.verificationDocuments = [];
    }

    // Reference GridFS file endpoint or GridFS filename
    const gridFsFileUrl = `/api/v1/documents/${req.file.filename}`;

    provider.verificationDocuments.push({
      documentType: documentType || 'SEC_DTI',
      fileUrl: gridFsFileUrl,
      fileId: req.file.id,
      uploadedAt: new Date(),
    });

    await provider.save();

    // 4. Update User record onboarding status
    await User.findByIdAndUpdate(userId, { isOnboarded: true });

    // 5. Send Email Notifications (Admin + Provider)
    const providerData = {
      institutionName: provider.institutionName,
      institutionType: provider.institutionType,
      website: provider.website,
      contactNumber: provider.contactNumber,
      repName: provider.representative.name,
      repTitle: provider.representative.title,
      repEmail: provider.representative.workEmail,
      documentType: documentType || 'SEC_DTI',
    };

    // Dispatch email to Admin with file attachment
    await sendProviderAdminNotification(providerData, req.file);

    // Dispatch email confirmation to Provider
    if (provider.representative.workEmail) {
      await sendProviderConfirmation(
        provider.representative.workEmail,
        provider.representative.name,
        provider.institutionName
      );
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