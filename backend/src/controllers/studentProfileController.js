const StudentProfile = require('../models/StudentProfile');
const { safeNotifyProfileChange } = require('../services/notificationService');
const { recordAuditLog, withAuditWarning } = require('./auditController');

const profileUpdatesFromRequest = (body) => {
  const source = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const updates = { ...source };
  delete updates.userId;
  delete updates._id;
  return updates;
};

// Create a new student profile for the logged-in user
exports.createProfile = async (req, res) => {
  try {
    const existingProfile = await StudentProfile.findOne({ userId: req.user.id });
    if (existingProfile) {
      return res.status(400).json({ success: false, message: 'Profile already exists for this user' });
    }

    const profile = await StudentProfile.create({
      ...profileUpdatesFromRequest(req.body),
      userId: req.user.id
    });

    await safeNotifyProfileChange(null, profile);

    // 📝 AUDIT LOG: Student Profile Created
    const actorName = req.user 
      ? `${req.user.firstName || req.user.name || ''} ${req.user.lastName || ''}`.trim() || req.user.email 
      : 'Student User';

    const audit = await recordAuditLog({
      actor: actorName,
      actorId: req.user.id || req.user._id,
      role: 'Student',
      action: 'PROFILE_CREATE',
      details: `Student (${req.user.email}) created their profile. Course: ${profile.course || 'N/A'}, Year: ${profile.yearLevel || 'N/A'}.`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      severity: 'Info'
    });

    res.status(201).json(withAuditWarning({ success: true, profile }, audit));
  } catch (error) {
    console.error('Error creating student profile:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get the logged-in user's own profile
exports.getProfile = async (req, res) => {
  try {
    const profile = await StudentProfile.findOne({ userId: req.user.id });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    res.status(200).json({ success: true, profile });
  } catch (error) {
    console.error('Error fetching student profile:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update the logged-in user's own profile
exports.updateProfile = async (req, res) => {
  try {
    const existingProfile = await StudentProfile.findOne({ userId: req.user.id });

    if (!existingProfile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    const profile = await StudentProfile.findOneAndUpdate(
      { userId: req.user.id },
      profileUpdatesFromRequest(req.body),
      { new: true, runValidators: true }
    );

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    await safeNotifyProfileChange(existingProfile, profile);

    // 📝 AUDIT LOG: Student Profile Updated
    const actorName = req.user 
      ? `${req.user.firstName || req.user.name || ''} ${req.user.lastName || ''}`.trim() || req.user.email 
      : 'Student User';

    const audit = await recordAuditLog({
      actor: actorName,
      actorId: req.user.id || req.user._id,
      role: 'Student',
      action: 'PROFILE_UPDATE',
      details: `Student ${req.user.id || req.user._id} updated their profile.`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      severity: 'Info'
    });

    res.status(200).json(withAuditWarning({ success: true, profile }, audit));
  } catch (error) {
    console.error('Error updating student profile:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};