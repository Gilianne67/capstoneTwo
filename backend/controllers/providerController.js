const Provider = require('../models/Provider');
const Scholarship = require('../models/Scholarship');

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
    const { institutionName, institutionType } = req.body;

    const provider = await Provider.findOne({
      userId: req.user.id,
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found',
      });
    }

    // Update only allowed profile fields
    if (institutionName !== undefined) {
      provider.institutionName = institutionName;
    }

    if (institutionType !== undefined) {
      provider.institutionType = institutionType;
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
    console.error('Get Provider Dashboard Error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};