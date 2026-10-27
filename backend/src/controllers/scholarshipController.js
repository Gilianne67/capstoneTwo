const Provider = require('../models/Provider');
const Scholarship = require('../models/Scholarship');
const {
  closeExpiredScholarships
} = require('../services/scholarshipExpirationService');
const searchSync = require('../services/scholarshipSearchSync');
const matchCache = require('../services/matchCache');
const {
  validateScholarshipInput
} = require('../utils/scholarshipInputValidation');

const normalizeBenefits = (benefits) => {
  if (!Array.isArray(benefits)) {
    return benefits;
  }

  return benefits
    .filter((benefit) => typeof benefit === 'string')
    .map((benefit) => benefit.trim())
    .filter(Boolean);
};

const SAVE_FAILED_MESSAGE = 'Unable to save scholarship. Please try again.';
const UNEXPECTED_ERROR_MESSAGE = 'Unable to complete this request. Please try again.';

const clientValidationMessage = (error) => {
  if (!error) return '';

  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors || {})
      .map((item) => item && item.message)
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join(' ');
    }
  }

  const message = String(error.message || '');

  if (
    message.includes('academic grading scale requirement is required') ||
    message.includes('must total 100%')
  ) {
    return message;
  }

  return '';
};

const rejectInvalidScholarship = (res, input, options) => {
  const result = validateScholarshipInput(input, options);

  if (result.valid) {
    return false;
  }

  res.status(400).json({
    success: false,
    message: result.message
  });

  return true;
};

const handleScholarshipError = (res, error, label, fallbackMessage) => {
  console.error(label, error);

  const validationMessage = clientValidationMessage(error);

  if (validationMessage) {
    return res.status(400).json({
      success: false,
      message: validationMessage
    });
  }

  return res.status(500).json({
    success: false,
    message: fallbackMessage
  });
};

const handleScholarshipSaveError = (res, error, label) =>
  handleScholarshipError(res, error, label, SAVE_FAILED_MESSAGE);

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

    if (rejectInvalidScholarship(res, req.body, { required: true })) {
      return;
    }

    // Create scholarship using the authenticated provider's ID
    const scholarshipData = {
      ...req.body,
      providerId: provider._id,
    };

    if (scholarshipData.benefits !== undefined) {
      scholarshipData.benefits = normalizeBenefits(scholarshipData.benefits);
    }

    const scholarship = await Scholarship.create(scholarshipData);
    await searchSync.syncScholarshipSearch(scholarship);
    await matchCache.invalidateMatchCache();

    res.status(201).json({
      success: true,
      message: 'Scholarship created successfully',
      scholarship,
    });
  } catch (error) {
    return handleScholarshipSaveError(res, error, 'Create Scholarship Error:');
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

    await closeExpiredScholarships();

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
    return handleScholarshipError(
      res,
      error,
      'Get My Scholarships Error:',
      UNEXPECTED_ERROR_MESSAGE
    );
  }
};

// Get a specific scholarship belonging to the logged-in provider,
// or any scholarship when the viewer is a student.
exports.getScholarshipById = async (req, res) => {
  try {
    if (req.user.role === 'student') {
      const scholarship = await Scholarship.findById(req.params.id);

      if (!scholarship) {
        return res.status(404).json({
          success: false,
          message: 'Scholarship not found',
        });
      }

      return res.status(200).json({
        success: true,
        scholarship,
      });
    }

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
    return handleScholarshipError(
      res,
      error,
      'Get Scholarship Error:',
      UNEXPECTED_ERROR_MESSAGE
    );
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

    if (rejectInvalidScholarship(res, req.body, { required: false })) {
      return;
    }

    // Fields that providers are allowed to edit
    const allowedFields = [
      'name',
      'scholarshipType',
      'description',
      'benefits',
      'grantValue',
      'academicRequirement',
      'academicRequirements',
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
        scholarship[field] =
          field === 'benefits'
            ? normalizeBenefits(req.body[field])
            : req.body[field];
      }
    });

    await scholarship.save();
    await searchSync.syncScholarshipSearch(scholarship);
    await matchCache.invalidateMatchCache();

    res.status(200).json({
      success: true,
      message: 'Scholarship updated successfully',
      scholarship,
    });
  } catch (error) {
    return handleScholarshipSaveError(res, error, 'Update Scholarship Error:');
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
    await searchSync.syncScholarshipSearch(scholarship);
    await matchCache.invalidateMatchCache();

    res.status(200).json({
      success: true,
      message: 'Scholarship status updated successfully',
      scholarship,
    });
  } catch (error) {
    return handleScholarshipError(
      res,
      error,
      'Update Scholarship Status Error:',
      UNEXPECTED_ERROR_MESSAGE
    );
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
    await searchSync.syncScholarshipSearch(scholarship);
    await matchCache.invalidateMatchCache();

    res.status(200).json({
      success: true,
      message: 'Scholarship archived successfully',
      scholarship,
    });
  } catch (error) {
    return handleScholarshipError(
      res,
      error,
      'Archive Scholarship Error:',
      UNEXPECTED_ERROR_MESSAGE
    );
  }
};