const StudentProfile = require('../models/StudentProfile');
const User = require('../models/User');

// Helper function to transform incoming request body into StudentProfile schema format
const formatProfileData = (body, user = {}) => {
  const {
    fullName,
    email,
    dob,
    academicLevel,
    yearLevel,
    course,
    gpa,
    gwaScale,
    region,
    householdIncome,
    schoolName,
    schoolType,
    province,
    municipalityCity,
    citizenship,
    guardianName,
    guardianEmail,
    // Flat eligibility flags from OnboardingForm
    isIndigenous,
    isPWD,
    isSoloParentChild,
    isOrphan,
    isFarmerfolkChild,
    isFarmerFisherfolkChild,
    isDisasterAffected,
    isWorkingStudent,
    isOFWChild,
    is4psBeneficiary,
    is4PsBeneficiary,
    isMinor,
  } = body;

  return {
    // Identity fields (prioritize authenticated user account details)
    fullName: user.fullName || user.name || fullName || '',
    email: user.email || email || '',

    // Onboarding fields
    dateOfBirth: dob ? new Date(dob) : undefined,
    academicLevel,
    yearLevel,
    course,
    gwa: gpa !== undefined ? parseFloat(gpa) : undefined,
    gwaScale,
    incomeBracket: householdIncome,
    region,

    // Profile detail fields
    schoolName,
    schoolType,
    province,
    municipalityCity,
    citizenship,

    // Minor / Guardian
    isMinor: Boolean(isMinor),

    // Nesting special eligibility flags according to schema
    specialEligibilityFlags: {
      isIndigenous: Boolean(isIndigenous),
      isPWD: Boolean(isPWD),
      isSoloParentChild: Boolean(isSoloParentChild),
      isOrphan: Boolean(isOrphan),
      isFarmerFisherfolkChild: Boolean(isFarmerfolkChild || isFarmerfolkChild),
      isDisasterAffected: Boolean(isDisasterAffected),
      isWorkingStudent: Boolean(isWorkingStudent),
      isOFWChild: Boolean(isOFWChild),
      is4PsBeneficiary: Boolean(is4PsBeneficiary || is4psBeneficiary),
    },
  };
};

// Create or update student profile
exports.createProfile = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const profilePayload = formatProfileData(req.body, req.user);

    const profile = await StudentProfile.findOneAndUpdate(
      { userId },
      { $set: { ...profilePayload, userId } },
      { new: true, upsert: true, runValidators: true }
    );

    // Update central User status
    const isMinorStudent = Boolean(req.body.isMinor);
    const userUpdates = { isOnboarded: true };

    if (isMinorStudent && req.body.guardianEmail) {
      userUpdates.status = 'pending_consent';
      userUpdates.guardianName = req.body.guardianName;
      userUpdates.guardianEmail = req.body.guardianEmail;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, userUpdates, { new: true });

    res.status(201).json({
      success: true,
      profile,
      data: profile,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Create Profile Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get the logged-in user's profile
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const profile = await StudentProfile.findOne({ userId });

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    res.status(200).json({ success: true, profile, data: profile });
  } catch (error) {
    console.error('Get Profile Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update existing student profile / Complete Onboarding
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const profilePayload = formatProfileData(req.body, req.user);

    const profile = await StudentProfile.findOneAndUpdate(
      { userId },
      { $set: profilePayload },
      { new: true, upsert: true, runValidators: true }
    );

    // Update user status in primary collection
    const isMinorStudent = Boolean(req.body.isMinor);
    const userUpdates = { isOnboarded: true };

    if (isMinorStudent && req.body.guardianEmail) {
      userUpdates.status = 'pending_consent';
      userUpdates.guardianName = req.body.guardianName;
      userUpdates.guardianEmail = req.body.guardianEmail;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, userUpdates, { new: true });

    res.status(200).json({
      success: true,
      profile,
      data: profile,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};