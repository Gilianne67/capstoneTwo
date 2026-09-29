const Provider = require('../models/Provider');
const EligibilityCriterionRequest = require('../models/EligibilityCriterionRequest');
const { CRITERION_TYPES } = EligibilityCriterionRequest;

const SUPPORTED_CRITERION_NAMES = [
  '4Ps Beneficiary',
  'Indigenous Peoples (IP)',
  'Person with Disability (PWD)',
  'Solo Parent Dependent',
  'Orphan Status',
  'Child of Farmer / Fisherfolk',
  'Disaster-Affected Family',
  'Working Student',
];

const normalizeName = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findAuthenticatedProvider = async (userId) =>
  Provider.findOne({ userId });

exports.getMyEligibilityCriterionRequests = async (req, res) => {
  try {
    const provider = await findAuthenticatedProvider(req.user.id);

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found',
      });
    }

    const requests = await EligibilityCriterionRequest.find({
      providerId: provider._id,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (error) {
    console.error('Get Eligibility Criterion Requests Error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.createEligibilityCriterionRequest = async (req, res) => {
  try {
    const provider = await findAuthenticatedProvider(req.user.id);

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found',
      });
    }

    const criterionName = String(req.body.criterionName || '')
      .trim()
      .replace(/\s+/g, ' ');
    const criterionType = String(req.body.criterionType || '').trim();
    const description = String(req.body.description || '').trim();

    if (!criterionName) {
      return res.status(400).json({
        success: false,
        message: 'Criterion name is required.',
      });
    }

    if (criterionName.length > 120) {
      return res.status(400).json({
        success: false,
        message: 'Criterion name must be 120 characters or fewer.',
      });
    }

    if (!CRITERION_TYPES.includes(criterionType)) {
      return res.status(400).json({
        success: false,
        message:
          'Criterion type must be Required Eligibility, Preferred Eligibility, or Hard Requirement.',
      });
    }

    if (!description) {
      return res.status(400).json({
        success: false,
        message:
          'Description is required. Explain what the criterion means and why it is needed.',
      });
    }

    if (description.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Description must be 2000 characters or fewer.',
      });
    }

    const alreadySupported = SUPPORTED_CRITERION_NAMES.some(
      (name) => normalizeName(name) === normalizeName(criterionName)
    );

    if (alreadySupported) {
      return res.status(400).json({
        success: false,
        message:
          'This eligibility criterion is already supported. Select it from the standard tags instead of requesting it.',
      });
    }

    const pendingDuplicate = await EligibilityCriterionRequest.findOne({
      providerId: provider._id,
      status: 'Pending',
      criterionName: new RegExp(`^${escapeRegex(criterionName)}$`, 'i'),
    });

    if (pendingDuplicate) {
      return res.status(409).json({
        success: false,
        message:
          'You already have a pending request for this criterion. An administrator still needs to review it.',
      });
    }

    const request = await EligibilityCriterionRequest.create({
      providerId: provider._id,
      criterionName,
      criterionType,
      description,
      status: 'Pending',
    });

    res.status(201).json({
      success: true,
      message:
        'Eligibility criterion request submitted successfully. An administrator will review this request before it can be used for scholarship matching.',
      request,
    });
  } catch (error) {
    console.error('Create Eligibility Criterion Request Error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
