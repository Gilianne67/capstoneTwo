const Provider = require('../models/Provider');
const Scholarship = require('../models/Scholarship');

// Create a scholarship for the logged-in provider
exports.createScholarship = async (req, res) => {
  try {
    // Find the Provider profile linked to the authenticated user
    const provider = await Provider.findOne({
      userId: req.user.id || req.user._id,
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

    // Create scholarship using the updated Schema structure
    const scholarship = await Scholarship.create({
      ...req.body,
      provider: provider._id, // Updated reference field to match model
    });

    res.status(201).json({
      success: true,
      message: 'Scholarship created successfully',
      scholarship,
    });
  } catch (error) {
    console.error('❌ Create Scholarship Error:', error);

    // Capture Mongoose weight validation & schema errors
    if (error.name === 'ValidationError' || error.message.includes('100%')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all scholarships belonging to the logged-in provider
exports.getMyScholarships = async (req, res) => {
  try {
    const provider = await Provider.findOne({
      userId: req.user.id || req.user._id,
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found',
      });
    }

    const scholarships = await Scholarship.find({
      provider: provider._id,
      isPublished: true, // Filters active listings matching updated schema
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: scholarships.length,
      scholarships,
    });
  } catch (error) {
    console.error('❌ Get My Scholarships Error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get a specific scholarship belonging to the logged-in provider
exports.getScholarshipById = async (req, res) => {
  try {
    const provider = await Provider.findOne({
      userId: req.user.id || req.user._id,
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found',
      });
    }

    const scholarship = await Scholarship.findOne({
      _id: req.params.id,
      provider: provider._id,
    });

    if (!scholarship) {
      return res.status(404).json({
        success: false,
        message: 'Scholarship not found',
      });
    }

    res.status(200).json({
      success: true,
      scholarship,
    });
  } catch (error) {
    console.error('❌ Get Scholarship Error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update a scholarship belonging to the logged-in provider
exports.updateScholarship = async (req, res) => {
  try {
    const provider = await Provider.findOne({
      userId: req.user.id || req.user._id,
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found',
      });
    }

    // Find scholarship and verify ownership
    const scholarship = await Scholarship.findOne({
      _id: req.params.id,
      provider: provider._id,
    });

    if (!scholarship) {
      return res.status(404).json({
        success: false,
        message: 'Scholarship not found',
      });
    }

    // Fields allowed according to updated Scholarship Schema
    const allowedFields = [
      'title',
      'grantValue',
      'category',
      'applicationDeadline',
      'externalUrl',
      'overview',
      'contactDetails',
      'hardRequirements',
      'specialEligibilityTags',
      'rankingWeights',
      'isPublished',
    ];

    // Update allowed fields
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        scholarship[field] = req.body[field];
      }
    });

    await scholarship.save();

    res.status(200).json({
      success: true,
      message: 'Scholarship updated successfully',
      scholarship,
    });
  } catch (error) {
    console.error('❌ Update Scholarship Error:', error);

    if (error.name === 'ValidationError' || error.message.includes('100%')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Toggle or update published status of a scholarship
exports.updateScholarshipStatus = async (req, res) => {
  try {
    const provider = await Provider.findOne({
      userId: req.user.id || req.user._id,
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found',
      });
    }

    const scholarship = await Scholarship.findOne({
      _id: req.params.id,
      provider: provider._id,
    });

    if (!scholarship) {
      return res.status(404).json({
        success: false,
        message: 'Scholarship not found',
      });
    }

    const { isPublished } = req.body;

    if (typeof isPublished !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isPublished must be a boolean value (true or false)',
      });
    }

    scholarship.isPublished = isPublished;
    await scholarship.save();

    res.status(200).json({
      success: true,
      message: 'Scholarship status updated successfully',
      scholarship,
    });
  } catch (error) {
    console.error('❌ Update Scholarship Status Error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Archive / Unpublish a scholarship belonging to the logged-in provider
exports.archiveScholarship = async (req, res) => {
  try {
    const provider = await Provider.findOne({
      userId: req.user.id || req.user._id,
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found',
      });
    }

    const scholarship = await Scholarship.findOne({
      _id: req.params.id,
      provider: provider._id,
    });

    if (!scholarship) {
      return res.status(404).json({
        success: false,
        message: 'Scholarship not found',
      });
    }

    if (!scholarship.isPublished) {
      return res.status(400).json({
        success: false,
        message: 'Scholarship is already unpublished/archived',
      });
    }

    scholarship.isPublished = false;
    await scholarship.save();

    res.status(200).json({
      success: true,
      message: 'Scholarship archived successfully',
      scholarship,
    });
  } catch (error) {
    console.error('❌ Archive Scholarship Error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};