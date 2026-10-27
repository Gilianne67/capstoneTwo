const Broadcast = require('../models/Broadcast');
const { recordAuditLog } = require('./auditController');

// @desc    Get active and non-expired broadcasts (Admin view)
// @route   GET /api/v1/admin/broadcasts
// @access  Private/Admin
exports.getBroadcasts = async (req, res) => {
  try {
    const now = new Date();

    // Auto-update status for expired records
    await Broadcast.updateMany(
      { expiresAt: { $lt: now }, status: 'Active' },
      { $set: { status: 'Expired' } }
    );

    const broadcasts = await Broadcast.find({ status: { $ne: 'Revoked' } })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      count: broadcasts.length,
      broadcasts,
    });
  } catch (error) {
    console.error('❌ Get Broadcasts Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get live broadcasts for user dashboard feeds (Student / Provider view)
// @route   GET /api/v1/broadcasts/active
// @access  Private
exports.getActiveUserBroadcasts = async (req, res) => {
  try {
    const now = new Date();
    const userRole = req.user?.role; // 'student' or 'provider'

    let targetFilter = ['All Users'];
    if (userRole === 'student') targetFilter.push('Students Only');
    if (userRole === 'provider') targetFilter.push('Grant Providers Only');

    const broadcasts = await Broadcast.find({
      status: 'Active',
      startDate: { $lte: now },
      expiresAt: { $gte: now },
      target: { $in: targetFilter },
    }).sort({ priority: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: broadcasts.length,
      broadcasts,
    });
  } catch (error) {
    console.error('❌ Get User Broadcasts Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new broadcast with schedule & expiration
// @route   POST /api/v1/admin/broadcast
// @access  Private/Admin
exports.createBroadcast = async (req, res) => {
  try {
    const { title, message, target, priority, startDate, expiresAt } = req.body;

    if (!title || !message || !expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'Title, message, and expiration date are required.',
      });
    }

    if (new Date(expiresAt) <= new Date(startDate || Date.now())) {
      return res.status(400).json({
        success: false,
        message: 'Expiration date must be after the start date.',
      });
    }

    const broadcast = await Broadcast.create({
      title,
      message,
      target: target || 'All Users',
      priority: priority || 'Info',
      startDate: startDate || new Date(),
      expiresAt,
      createdBy: req.user._id || req.user.id,
    });

    await recordAuditLog({
      actor: req.user.name || req.user.email || 'Admin',
      role: 'Admin',
      action: 'BROADCAST_DISPATCHED',
      details: `Dispatched announcement "${title}" (Expires: ${new Date(expiresAt).toLocaleDateString()}).`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      severity: 'Info',
    });

    res.status(201).json({
      success: true,
      message: 'Broadcast scheduled/dispatched successfully',
      broadcast,
    });
  } catch (error) {
    console.error('❌ Create Broadcast Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Revoke/Delete a broadcast
// @route   DELETE /api/v1/admin/broadcast/:id
// @access  Private/Admin
exports.revokeBroadcast = async (req, res) => {
  try {
    const broadcast = await Broadcast.findById(req.params.id);

    if (!broadcast) {
      return res.status(404).json({ success: false, message: 'Broadcast not found.' });
    }

    broadcast.status = 'Revoked';
    await broadcast.save();

    await recordAuditLog({
      actor: req.user.name || req.user.email || 'Admin',
      role: 'Admin',
      action: 'BROADCAST_REVOKED',
      details: `Revoked announcement "${broadcast.title}".`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      severity: 'Warning',
    });

    res.status(200).json({
      success: true,
      message: 'Broadcast revoked successfully',
    });
  } catch (error) {
    console.error('❌ Revoke Broadcast Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};