const mongoose = require('mongoose');
const Broadcast = require('../models/Broadcast');
const { isAdminRole } = require('../middleware/auth');
const { recordAuditLog, withAuditWarning } = require('./auditController');
const {
  SAVED_MESSAGE,
  audienceTargetsForRole,
  compareBroadcasts,
  serializeBroadcast,
  validateBroadcastPayload,
} = require('../utils/broadcastRules');

const LOAD_FAILED = 'Announcements could not be loaded. Please try again.';
const SAVE_FAILED = 'The announcement could not be saved. Please try again.';
const REVOKE_FAILED = 'The announcement could not be revoked. Please try again.';

const denyUnlessAdmin = (req, res) => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Please log in to continue.' });
    return true;
  }
  if (!isAdminRole(req.user.role)) {
    res.status(403).json({
      success: false,
      message: 'You do not have permission to dispatch announcements.',
    });
    return true;
  }
  return false;
};

const loadBroadcasts = async (filter) => {
  const query = Broadcast.find(filter);
  if (query && typeof query.sort === 'function') {
    const sorted = query.sort({ createdAt: -1 });
    if (sorted && typeof sorted.populate === 'function') {
      return sorted.populate('createdBy', 'name email');
    }
    return sorted;
  }
  return query;
};

const clientIp = (req) => req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1';

// Pull banners. Saving a row does not email users or send a push notification.
// Student and provider dashboards read GET /api/v1/broadcasts/active.

// @desc    List non-revoked announcements for administrators
// @route   GET /api/v1/admin/broadcasts
// @access  Private/Admin
exports.getBroadcasts = async (req, res) => {
  try {
    if (denyUnlessAdmin(req, res)) return;

    const now = new Date();

    await Broadcast.updateMany(
      { expiresAt: { $lt: now }, status: 'Active' },
      { $set: { status: 'Expired' } }
    );

    const rows = await loadBroadcasts({ status: { $ne: 'Revoked' } });
    const broadcasts = rows
      .map((row) => serializeBroadcast(row, now))
      .sort(compareBroadcasts);
    const activeCount = broadcasts.filter((item) => item.isCurrentlyActive).length;

    res.status(200).json({
      success: true,
      count: activeCount,
      activeCount,
      total: broadcasts.length,
      broadcasts,
    });
  } catch (error) {
    console.error('Get Broadcasts Error:', error);
    res.status(500).json({ success: false, message: LOAD_FAILED });
  }
};

// @desc    Live banners for the signed-in student or provider
// @route   GET /api/v1/broadcasts/active
// @access  Private
exports.getActiveUserBroadcasts = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Please log in to continue.' });
    }

    const now = new Date();
    const rows = await loadBroadcasts({
      status: 'Active',
      startDate: { $lte: now },
      expiresAt: { $gte: now },
      target: { $in: audienceTargetsForRole(req.user.role) },
    });

    const broadcasts = rows
      .map((row) => serializeBroadcast(row, now))
      .filter((item) => item.isCurrentlyActive)
      .sort(compareBroadcasts);

    res.status(200).json({
      success: true,
      count: broadcasts.length,
      activeCount: broadcasts.length,
      broadcasts,
    });
  } catch (error) {
    console.error('Get User Broadcasts Error:', error);
    res.status(500).json({ success: false, message: LOAD_FAILED });
  }
};

// @desc    Save a scheduled announcement
// @route   POST /api/v1/admin/broadcast
// @access  Private/Admin
exports.createBroadcast = async (req, res) => {
  try {
    if (denyUnlessAdmin(req, res)) return;

    const actorId = req.user._id || req.user.id;
    if (!actorId) {
      return res.status(401).json({ success: false, message: 'Please log in to continue.' });
    }

    const validated = validateBroadcastPayload(req.body, new Date());
    if (!validated.ok) {
      return res.status(400).json({ success: false, message: validated.message });
    }

    const broadcast = await Broadcast.create({
      ...validated.value,
      status: 'Active',
      createdBy: actorId,
    });

    const audit = await recordAuditLog({
      actor: req.user.name || req.user.email || 'Admin',
      actorId,
      role: req.user.role || 'Admin',
      action: 'BROADCAST_DISPATCHED',
      details: `Saved announcement "${validated.value.title}" for ${validated.value.target}. It expires ${validated.value.expiresAt.toISOString()}.`,
      ipAddress: clientIp(req),
      severity: validated.value.priority === 'Urgent' ? 'Warning' : 'Info',
    });

    res.status(201).json(withAuditWarning({
      success: true,
      message: SAVED_MESSAGE,
      broadcast: serializeBroadcast(broadcast, new Date()),
    }, audit));
  } catch (error) {
    console.error('Create Broadcast Error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'The announcement could not be saved because it is invalid.',
      });
    }
    res.status(500).json({ success: false, message: SAVE_FAILED });
  }
};

// @desc    Revoke an announcement so dashboards stop showing it
// @route   DELETE /api/v1/admin/broadcast/:id
// @access  Private/Admin
exports.revokeBroadcast = async (req, res) => {
  try {
    if (denyUnlessAdmin(req, res)) return;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Broadcast id is not valid.' });
    }

    const broadcast = await Broadcast.findById(req.params.id);
    if (!broadcast) {
      return res.status(404).json({ success: false, message: 'Broadcast not found.' });
    }

    broadcast.status = 'Revoked';
    await broadcast.save();

    const audit = await recordAuditLog({
      actor: req.user.name || req.user.email || 'Admin',
      actorId: req.user._id || req.user.id,
      role: req.user.role || 'Admin',
      action: 'BROADCAST_REVOKED',
      details: `Revoked announcement "${broadcast.title}".`,
      ipAddress: clientIp(req),
      severity: 'Warning',
    });

    res.status(200).json(withAuditWarning({
      success: true,
      message: 'Announcement revoked.',
    }, audit));
  } catch (error) {
    console.error('Revoke Broadcast Error:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: 'Broadcast not found.' });
    }
    res.status(500).json({ success: false, message: REVOKE_FAILED });
  }
};
