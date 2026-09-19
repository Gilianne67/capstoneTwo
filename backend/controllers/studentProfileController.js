const StudentProfile = require('../models/StudentProfile');

// Create a new student profile for the logged-in user
exports.createProfile = async (req, res) => {
  try {
    const existingProfile = await StudentProfile.findOne({ userId: req.user.id });
    if (existingProfile) {
      return res.status(400).json({ success: false, message: 'Profile already exists for this user' });
    }

    const profile = await StudentProfile.create({
      ...req.body,
      userId: req.user.id
    });

    res.status(201).json({ success: true, profile });
  } catch (error) {
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update the logged-in user's own profile
exports.updateProfile = async (req, res) => {
  try {
    const profile = await StudentProfile.findOneAndUpdate(
      { userId: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    res.status(200).json({ success: true, profile });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};