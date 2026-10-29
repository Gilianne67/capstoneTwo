const mongoose = require('mongoose');
const Provider = require('../models/Provider');
const Scholarship = require('../models/Scholarship');
const { isAdminRole, canonicalRole } = require('../middleware/auth');
const { administrativelyRemoveScholarship } = require('../services/scholarshipArchiveService');
const { resolveAdminArchiveReason } = require('../utils/adminArchiveReason');
const { recordAuditLog, withAuditWarning } = require('./auditController');
const notificationService = require('../services/notificationService');
const {
  closeExpiredScholarships
} = require('../services/scholarshipExpirationService');
const searchSync = require('../services/scholarshipSearchSync');
const matchCache = require('../services/matchCache');
const { isProviderAccountSuspended } = require('../services/suspendedProviderFilter');
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

const isAdministrativelyRemoved = (scholarship) => Boolean(scholarship?.adminRemovedAt);

const isScholarshipId = (value) => {
  const id = String(value || '');
  return mongoose.Types.ObjectId.isValid(id) && /^[a-fA-F0-9]{24}$/.test(id);
};

const adminActorName = (user) => {
  if (!user) return 'Admin User';
  const name = `${user.firstName || user.name || ''} ${user.lastName || ''}`.trim();
  return name || user.email || 'Admin User';
};

const actorLabel = (user, fallback) => {
  if (!user) return fallback;
  const name = `${user.firstName || user.name || ''} ${user.lastName || ''}`.trim();
  return name || user.email || fallback;
};

const requestIp = (req) => req?.ip || req?.headers?.['x-forwarded-for'] || '127.0.0.1';

const noteScholarshipAudit = async (req, entry) => recordAuditLog({
  ipAddress: requestIp(req),
  actorId: req.user && (req.user._id || req.user.id),
  ...entry,
});

const archiveScholarshipAsAdmin = async (req, res) => {
  if (!isScholarshipId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid scholarship ID.',
    });
  }

  const reasonResult = resolveAdminArchiveReason(req.body || {});
  if (!reasonResult.ok) {
    return res.status(400).json({
      success: false,
      message: reasonResult.message,
    });
  }

  const existing = await Scholarship.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({
      success: false,
      message: 'Scholarship not found',
    });
  }

  if (existing.isArchived === true || existing.adminRemovedAt) {
    return res.status(400).json({
      success: false,
      message: 'Scholarship is already archived',
    });
  }

  const followUpErrors = [];
  const scholarship = await administrativelyRemoveScholarship(
    existing._id,
    followUpErrors,
    reasonResult.reason
  );

  if (!scholarship) {
    return res.status(404).json({
      success: false,
      message: 'Scholarship not found',
    });
  }

  try {
    await notificationService.notifyProviderListingRemoved({
      providerId: scholarship.providerId,
      scholarshipId: scholarship._id,
      scholarshipTitle: scholarship.name,
      explanation: reasonResult.reason,
      removedAt: scholarship.adminRemovedAt,
    });
  } catch (notifyError) {
    console.error('Provider removal notification failed:', notifyError.message);
    followUpErrors.push({
      step: 'providerNotification',
      message: 'The scholarship provider could not be notified of this removal.',
    });
  }

  const audit = await noteScholarshipAudit(req, {
    actor: adminActorName(req.user),
    role: (req.user && req.user.role) || 'Admin',
    action: 'SCHOLARSHIP_ARCHIVED',
    details: `Admin archived scholarship "${scholarship.name}" (ID: ${scholarship._id}). Reason: ${reasonResult.reason}.`,
    severity: 'Warning',
  });
  if (audit && audit.ok === false) {
    followUpErrors.push({
      step: 'audit',
      message: 'The archive audit record could not be saved.',
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Scholarship archived successfully',
    scholarship,
    ...(followUpErrors.length > 0 ? { warnings: followUpErrors } : {}),
  });
};

const rejectAdministrativelyRemoved = (res, scholarship) => {
  if (!isAdministrativelyRemoved(scholarship)) return false;

  res.status(403).json({
    success: false,
    message: 'This scholarship was removed by an administrator and cannot be changed.',
  });
  return true;
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

    const audit = await noteScholarshipAudit(req, {
      actor: actorLabel(req.user, provider.institutionName || 'Provider User'),
      role: 'Provider',
      action: 'SCHOLARSHIP_CREATED',
      details: `Provider ${provider._id} created scholarship "${scholarship.name}" (ID: ${scholarship._id}).`,
      severity: 'Info',
    });

    res.status(201).json(withAuditWarning({
      success: true,
      message: 'Scholarship created successfully',
      scholarship,
    }, audit));
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
// or any scholarship when the viewer is a student or an admin.
exports.getScholarshipById = async (req, res) => {
  try {
    if (req.user.role === 'student' || isAdminRole(req.user.role)) {
      const scholarship = await Scholarship.findById(req.params.id);

      if (!scholarship) {
        return res.status(404).json({
          success: false,
          message: 'Scholarship not found',
        });
      }

      if (
        req.user.role === 'student'
        && await isProviderAccountSuspended(scholarship.providerId)
      ) {
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

    if (rejectAdministrativelyRemoved(res, scholarship)) {
      return;
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

    const changedFields = allowedFields.filter((field) => req.body[field] !== undefined);

    await scholarship.save();
    await searchSync.syncScholarshipSearch(scholarship);
    await matchCache.invalidateMatchCache();

    const audit = await noteScholarshipAudit(req, {
      actor: actorLabel(req.user, provider.institutionName || 'Provider User'),
      role: 'Provider',
      action: 'SCHOLARSHIP_UPDATED',
      details: `Provider ${provider._id} updated scholarship "${scholarship.name}" (ID: ${scholarship._id}). Fields: ${changedFields.join(', ') || 'none'}.`,
      severity: 'Info',
    });

    res.status(200).json(withAuditWarning({
      success: true,
      message: 'Scholarship updated successfully',
      scholarship,
    }, audit));
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

    if (rejectAdministrativelyRemoved(res, scholarship)) {
      return;
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

    const audit = await noteScholarshipAudit(req, {
      actor: actorLabel(req.user, provider.institutionName || 'Provider User'),
      role: 'Provider',
      action: status === 'Closed' ? 'SCHOLARSHIP_CLOSED' : 'SCHOLARSHIP_REOPENED',
      details: `Provider ${provider._id} set scholarship "${scholarship.name}" (ID: ${scholarship._id}) to ${status}.`,
      severity: status === 'Closed' ? 'Warning' : 'Info',
    });

    res.status(200).json(withAuditWarning({
      success: true,
      message: 'Scholarship status updated successfully',
      scholarship,
    }, audit));
  } catch (error) {
    return handleScholarshipError(
      res,
      error,
      'Update Scholarship Status Error:',
      UNEXPECTED_ERROR_MESSAGE
    );
  }
};

// Archive a provider's own scholarship, or any eligible scholarship when the caller is an admin.
exports.archiveScholarship = async (req, res) => {
  try {
    if (req.user?.role && !isAdminRole(req.user.role) && canonicalRole(req.user.role) !== 'provider') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this page.',
      });
    }

    if (isAdminRole(req.user?.role)) {
      return await archiveScholarshipAsAdmin(req, res);
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

    if (rejectAdministrativelyRemoved(res, scholarship)) {
      return;
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

    const audit = await noteScholarshipAudit(req, {
      actor: actorLabel(req.user, provider.institutionName || 'Provider User'),
      role: 'Provider',
      action: 'SCHOLARSHIP_ARCHIVED',
      details: `Provider ${provider._id} archived scholarship "${scholarship.name}" (ID: ${scholarship._id}).`,
      severity: 'Warning',
    });

    res.status(200).json(withAuditWarning({
      success: true,
      message: 'Scholarship archived successfully',
      scholarship,
    }, audit));
  } catch (error) {
    return handleScholarshipError(
      res,
      error,
      'Archive Scholarship Error:',
      UNEXPECTED_ERROR_MESSAGE
    );
  }
};