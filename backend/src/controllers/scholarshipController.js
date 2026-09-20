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
    console.error('❌ Create Scholarship Error:', error);

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
      userId: req.user.id,
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found',
      });
    }

    const scholarships = await Scholarship.find({
      providerId: provider._id,
      isArchived: false,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: scholarships.length,
      scholarships,
    });
  } catch (error) {
    console.error(' Get My Scholarships Error:', error);

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
      userId: req.user.id,
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found',
      });
    }

    const scholarship = await Scholarship.findOne({
      _id: req.params.id,
      providerId: provider._id,
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
    console.error(' Get Scholarship Error:', error);

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
      userId: req.user.id,
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
      providerId: provider._id,
    });

    if (!scholarship) {
      return res.status(404).json({
        success: false,
        message: 'Scholarship not found',
      });
    }

    // Fields that providers are allowed to edit
    const allowedFields = [
      'name',
      'scholarshipType',
      'description',
      'benefits',
      'grantValue',
      'academicRequirement',
      'hardFilters',
      'incomeRequirement',
      'specialTags',
      'criteriaWeights',
      'rankingMode',
      'deadline',
      'applicationURL',
    ];

    // Update only allowed fields
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
    console.error('Update Scholarship Error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update the status of a scholarship belonging to the logged-in provider
exports.updateScholarshipStatus = async (req, res) => {
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

    const scholarship = await Scholarship.findOne({
      _id: req.params.id,
      providerId: provider._id,
    });

    if (!scholarship) {
      return res.status(404).json({
        success: false,
        message: 'Scholarship not found',
      });
    }

    const { status } = req.body;

    // Only allow valid scholarship statuses
    if (!['Open', 'Closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either Open or Closed',
      });
    }

    scholarship.status = status;

    await scholarship.save();

    res.status(200).json({
      success: true,
      message: 'Scholarship status updated successfully',
      scholarship,
    });
  } catch (error) {
    console.error('Update Scholarship Status Error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Archive a scholarship belonging to the logged-in provider
exports.archiveScholarship = async (req, res) => {
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

    // Find scholarship and verify ownership
    const scholarship = await Scholarship.findOne({
      _id: req.params.id,
      providerId: provider._id,
    });

    if (!scholarship) {
      return res.status(404).json({
        success: false,
        message: 'Scholarship not found',
      });
    }

    // Prevent archiving an already archived scholarship
    if (scholarship.isArchived) {
      return res.status(400).json({
        success: false,
        message: 'Scholarship is already archived',
      });
    }

    scholarship.isArchived = true;

    await scholarship.save();

    res.status(200).json({
      success: true,
      message: 'Scholarship archived successfully',
      scholarship,
    });
  } catch (error) {
    console.error('Archive Scholarship Error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};