const Provider = require('../models/Provider');
const Scholarship = require('../models/Scholarship');

// Create a scholarship for the logged-in provider
exports.createScholarship = async (req, res) => {
  try {
    // Find the Provider profile linked to the authenticated user
    const provider = await Provider.findOne({
      userId: req.user.id,
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found',
      });
    }

    // Only verified providers can create scholarships
    if (provider.verificationStatus !== 'Verified') {
      return res.status(403).json({
        success: false,
        message: 'Only verified providers can create scholarships',
      });
    }

    // Create scholarship using the authenticated provider's ID
    const scholarship = await Scholarship.create({
      ...req.body,
      providerId: provider._id,
    });

    res.status(201).json({
      success: true,
      message: 'Scholarship created successfully',
      scholarship,
    });
  } catch (error) {
    console.error(' Create Scholarship Error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};