const Provider = require('../models/Provider');
const User = require('../models/User');
const EligibilityCriterionRequest = require('../models/EligibilityCriterionRequest');
const { recordAuditLog, withAuditWarning } = require('./auditController');
const emailService = require('../utils/emailService');
const { isAdminRole } = require('../middleware/auth');
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

const CANONICAL_CRITERION_TYPES = {
  'preferred tag': 'Preferred Tag',
  'preferred eligibility': 'Preferred Tag',
  'exclusive tag': 'Exclusive Tag',
  'required eligibility': 'Exclusive Tag',
  'hard eligibility tag': 'Hard Eligibility Tag',
  'hard eligibility': 'Hard Eligibility Tag',
  'hard requirement': 'Hard Eligibility Tag',
};

const FULFILLMENT_TRANSITIONS = {
  Pending: new Set(['In Progress']),
  'In Progress': new Set(['Done']),
  Done: new Set(['Done']),
};

const normalizeName = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const userIdOf = (user) => (user && (user.id || user._id)) || null;

const actorNameFrom = (user, fallback) => {
  if (!user) return fallback;
  return (
    `${user.firstName || user.name || ''} ${user.lastName || ''}`.trim() ||
    user.email ||
    fallback
  );
};

const canonicalCriterionType = (value) =>
  CANONICAL_CRITERION_TYPES[normalizeName(value)] || null;

const normalizeDecision = (value) => {
  const text = normalizeName(value);
  if (text === 'approved' || text === 'approve') return 'Approved';
  if (text === 'rejected' || text === 'reject') return 'Rejected';
  return null;
};

const normalizeFulfillment = (value) => {
  const text = normalizeName(value).replace(/[_-]+/g, ' ');
  if (text === 'pending') return 'Pending';
  if (text === 'in progress') return 'In Progress';
  if (text === 'done') return 'Done';
  return null;
};

const isCastError = (error) =>
  Boolean(error && (error.name === 'CastError' || error.kind === 'ObjectId'));

const loadUser = async (userId) => {
  if (!userId) return null;
  const query = User.findById(userId);
  if (query && typeof query.select === 'function') {
    return query.select('email name');
  }
  return query;
};

const loadProvider = async (providerId) => {
  if (!providerId) return null;
  const query = Provider.findById(providerId);
  if (query && typeof query.populate === 'function') {
    return query.populate('userId', 'email name');
  }
  return query;
};

const loadRequests = async (filter) => {
  const query = EligibilityCriterionRequest.find(filter);
  if (query && typeof query.sort === 'function') {
    return query.sort({ createdAt: -1 });
  }
  return query;
};

const findAuthenticatedProvider = async (user) => {
  const userId = userIdOf(user);
  if (!userId) return null;
  return Provider.findOne({ userId });
};

/**
 * Registered account email only. Representative work email is not a fallback.
 */
const resolveRegisteredAccount = async (provider) => {
  if (!provider) return null;

  const linked = provider.userId;
  if (linked && typeof linked === 'object') {
    const populatedEmail = String(linked.email || '').trim();
    if (populatedEmail) {
      return {
        email: populatedEmail,
        name: linked.name || provider.institutionName || 'Provider',
      };
    }

    if (linked._id) {
      const user = await loadUser(linked._id);
      const email = String(user?.email || '').trim();
      if (!email) return null;
      return {
        email,
        name: user.name || provider.institutionName || 'Provider',
      };
    }

    return null;
  }

  if (!linked) return null;

  const user = await loadUser(linked);
  const email = String(user?.email || '').trim();
  if (!email) return null;
  return {
    email,
    name: user.name || provider.institutionName || 'Provider',
  };
};

const toProviderRequest = (request) => {
  const doc = typeof request.toObject === 'function' ? request.toObject() : request;
  const status = doc.status || 'Pending';

  return {
    _id: doc._id,
    criterionName: doc.criterionName,
    criterionType: canonicalCriterionType(doc.criterionType) || doc.criterionType,
    description: doc.description,
    status,
    fulfillmentStatus: status === 'Approved' ? doc.fulfillmentStatus || 'Pending' : null,
    rejectionReason: status === 'Rejected' ? doc.rejectionReason || null : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    reviewedAt: doc.reviewedAt || null,
  };
};

const toAdminRequest = async (request, provider) => {
  const doc = typeof request.toObject === 'function' ? request.toObject() : request;
  const account = await resolveRegisteredAccount(provider);

  return {
    _id: doc._id,
    criterionName: doc.criterionName,
    criterionType: canonicalCriterionType(doc.criterionType) || doc.criterionType,
    description: doc.description,
    status: doc.status || 'Pending',
    fulfillmentStatus: doc.fulfillmentStatus || 'Pending',
    rejectionReason: doc.rejectionReason || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    reviewedAt: doc.reviewedAt || null,
    provider: {
      _id: provider?._id || doc.providerId,
      institutionName: provider?.institutionName || 'Unknown provider',
      accountEmail: account?.email || null,
    },
  };
};

const requireAdmin = (req, res) => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Please log in to continue.',
    });
    return false;
  }

  if (!isAdminRole(req.user.role)) {
    res.status(403).json({
      success: false,
      message: 'You do not have permission to review eligibility criterion requests.',
    });
    return false;
  }

  return true;
};

const auditRequest = async (req, action, details, severity = 'Info') => recordAuditLog({
  actor: actorNameFrom(req.user, 'Admin User'),
  actorId: req.user && (req.user._id || req.user.id),
  role: (req.user && req.user.role) || 'Admin',
  action,
  details,
  ipAddress: req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1',
  severity,
});

const deliverCompletionEmail = async (request, provider) => {
  if (request.completionEmailSentAt) {
    return { sent: false, skipped: 'already-sent' };
  }

  const account = await resolveRegisteredAccount(provider);
  if (!account) {
    console.error(
      'Eligibility criterion completion email skipped: registered account email is missing.'
    );
    return { sent: false, skipped: 'missing-account-email' };
  }

  const claimedAt = new Date();
  request.completionEmailSentAt = claimedAt;

  try {
    await request.save();
  } catch (error) {
    request.completionEmailSentAt = null;
    console.error(
      'Eligibility criterion completion email was not sent because the send marker could not be saved:',
      error.message
    );
    return { sent: false, error: error.message };
  }

  try {
    await emailService.sendEligibilityCriterionCompletedEmail({
      email: account.email,
      recipientName: account.name,
      criterionName: request.criterionName,
      criterionType: canonicalCriterionType(request.criterionType) || request.criterionType,
    });
    return { sent: true, email: account.email };
  } catch (error) {
    console.error('Eligibility criterion completion email failed:', error.message);
    request.completionEmailSentAt = null;
    try {
      await request.save();
    } catch (saveError) {
      console.error(
        'Saved Done status, but the completion email timestamp could not be cleared:',
        saveError.message
      );
    }
    return { sent: false, error: error.message };
  }
};

exports.getMyEligibilityCriterionRequests = async (req, res) => {
  try {
    if (!userIdOf(req.user)) {
      return res.status(401).json({
        success: false,
        message: 'Please log in to continue.',
      });
    }

    const provider = await findAuthenticatedProvider(req.user);

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found',
      });
    }

    const requests = await loadRequests({ providerId: provider._id });

    res.status(200).json({
      success: true,
      count: requests.length,
      requests: requests.map(toProviderRequest),
    });
  } catch (error) {
    console.error('Get Eligibility Criterion Requests Error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getMyEligibilityCriterionRequest = async (req, res) => {
  try {
    if (!userIdOf(req.user)) {
      return res.status(401).json({
        success: false,
        message: 'Please log in to continue.',
      });
    }

    const provider = await findAuthenticatedProvider(req.user);

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found',
      });
    }

    const request = await EligibilityCriterionRequest.findOne({
      _id: req.params.id,
      providerId: provider._id,
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Eligibility criterion request not found',
      });
    }

    res.status(200).json({
      success: true,
      request: toProviderRequest(request),
    });
  } catch (error) {
    if (isCastError(error)) {
      return res.status(404).json({
        success: false,
        message: 'Eligibility criterion request not found',
      });
    }

    console.error('Get Eligibility Criterion Request Error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.createEligibilityCriterionRequest = async (req, res) => {
  try {
    if (!userIdOf(req.user)) {
      return res.status(401).json({
        success: false,
        message: 'Please log in to continue.',
      });
    }

    const provider = await findAuthenticatedProvider(req.user);

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found',
      });
    }

    const criterionName = String(req.body.criterionName || '')
      .trim()
      .replace(/\s+/g, ' ');
    const criterionType = canonicalCriterionType(req.body.criterionType);
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

    if (!criterionType || !CRITERION_TYPES.includes(criterionType)) {
      return res.status(400).json({
        success: false,
        message:
          'Criterion type must be Preferred Tag, Exclusive Tag, or Hard Eligibility Tag.',
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
      fulfillmentStatus: 'Pending',
    });

    const actorName = actorNameFrom(req.user, provider.institutionName || 'Provider User');

    const audit = await recordAuditLog({
      actor: actorName,
      role: 'Provider',
      action: 'ELIGIBILITY_REQUEST_SUBMIT',
      details: `Provider requested custom eligibility criterion: "${criterionName}" (${criterionType})`,
      ipAddress: req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1',
      severity: 'Info',
    });

    res.status(201).json(withAuditWarning({
      success: true,
      message:
        'Eligibility criterion request submitted successfully. An administrator will review this request before it can be used for scholarship matching.',
      request: toProviderRequest(request),
    }, audit));
  } catch (error) {
    console.error('Create Eligibility Criterion Request Error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getEligibilityCriterionRequests = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const requests = await loadRequests({});
    const visible = [];

    for (const request of requests) {
      const provider = await loadProvider(request.providerId);
      visible.push(await toAdminRequest(request, provider));
    }

    res.status(200).json({
      success: true,
      count: visible.length,
      requests: visible,
    });
  } catch (error) {
    console.error('Get Admin Eligibility Criterion Requests Error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.reviewEligibilityCriterionRequest = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const decision = normalizeDecision(req.body.decision || req.body.status);
    if (!decision) {
      return res.status(400).json({
        success: false,
        message: 'Decision must be Approved or Rejected.',
      });
    }

    const request = await EligibilityCriterionRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Eligibility criterion request not found',
      });
    }

    if (request.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `This request is already ${request.status} and cannot be reviewed again.`,
      });
    }

    const rejectionReason = String(req.body.rejectionReason || req.body.reason || '').trim();

    if (decision === 'Rejected' && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'A rejection reason is required.',
      });
    }

    if (decision === 'Rejected' && rejectionReason.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason must be 2000 characters or fewer.',
      });
    }

    request.status = decision;
    request.reviewedAt = new Date();
    request.reviewedBy = userIdOf(req.user);

    if (decision === 'Approved') {
      request.fulfillmentStatus = 'Pending';
      request.rejectionReason = null;
    } else {
      request.rejectionReason = rejectionReason;
    }

    await request.save();

    const audit = await auditRequest(
      req,
      decision === 'Approved' ? 'ELIGIBILITY_REQUEST_APPROVE' : 'ELIGIBILITY_REQUEST_REJECT',
      decision === 'Approved'
        ? `Admin approved eligibility criterion "${request.criterionName}" (${request.criterionType}). Fulfillment remains Pending.`
        : `Admin rejected eligibility criterion "${request.criterionName}". Reason: ${rejectionReason}`,
      decision === 'Approved' ? 'Info' : 'Warning'
    );

    const provider = await loadProvider(request.providerId);

    res.status(200).json(withAuditWarning({
      success: true,
      message:
        decision === 'Approved'
          ? 'Eligibility criterion request approved. It remains Pending until an administrator moves it to In Progress or Done.'
          : 'Eligibility criterion request rejected.',
      request: await toAdminRequest(request, provider),
    }, audit));
  } catch (error) {
    if (isCastError(error)) {
      return res.status(404).json({
        success: false,
        message: 'Eligibility criterion request not found',
      });
    }

    console.error('Review Eligibility Criterion Request Error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateEligibilityCriterionFulfillment = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const nextStatus = normalizeFulfillment(
      req.body.fulfillmentStatus || req.body.status
    );

    if (!nextStatus) {
      return res.status(400).json({
        success: false,
        message: 'Fulfillment status must be Pending, In Progress, or Done.',
      });
    }

    const request = await EligibilityCriterionRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Eligibility criterion request not found',
      });
    }

    if (request.status !== 'Approved') {
      return res.status(400).json({
        success: false,
        message: 'Fulfillment status can change only after the request is approved.',
      });
    }

    const currentStatus = request.fulfillmentStatus || 'Pending';
    const allowed = FULFILLMENT_TRANSITIONS[currentStatus] || new Set();
    const repeatingDone = currentStatus === 'Done' && nextStatus === 'Done';

    if (!repeatingDone && (currentStatus === nextStatus || !allowed.has(nextStatus))) {
      return res.status(400).json({
        success: false,
        message: `Cannot change fulfillment status from ${currentStatus} to ${nextStatus}.`,
      });
    }

    let fulfillmentAudit = null;
    if (!repeatingDone) {
      request.fulfillmentStatus = nextStatus;
      await request.save();

      fulfillmentAudit = await auditRequest(
        req,
        'ELIGIBILITY_REQUEST_STATUS',
        `Admin moved eligibility criterion "${request.criterionName}" from ${currentStatus} to ${nextStatus}.`
      );
    }

    let email = { sent: false };
    if (nextStatus === 'Done') {
      const provider = await loadProvider(request.providerId);
      email = await deliverCompletionEmail(request, provider);
      const visible = await toAdminRequest(request, provider);

      return res.status(200).json(withAuditWarning({
        success: true,
        message: email.sent
          ? 'Eligibility criterion request marked Done. The provider was emailed at the registered account address.'
          : 'Eligibility criterion request is Done.',
        request: visible,
        email,
      }, fulfillmentAudit));
    }

    const provider = await loadProvider(request.providerId);

    res.status(200).json(withAuditWarning({
      success: true,
      message: `Eligibility criterion request is now ${nextStatus}.`,
      request: await toAdminRequest(request, provider),
      email,
    }, fulfillmentAudit));
  } catch (error) {
    if (isCastError(error)) {
      return res.status(404).json({
        success: false,
        message: 'Eligibility criterion request not found',
      });
    }

    console.error('Update Eligibility Criterion Fulfillment Error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
