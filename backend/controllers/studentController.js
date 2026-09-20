const StudentProfile = require('../models/StudentProfile');

const calculateIsMinor = (dateOfBirth) => {
  const dob = new Date(dateOfBirth);
  const today = new Date();

  let age = today.getFullYear() - dob.getFullYear();

  const monthDifference = today.getMonth() - dob.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < dob.getDate())
  ) {
    age--;
  }

  return age < 18;
};

// GET STUDENT PROFILE
exports.getStudentProfile = async (req, res) => {
  try {
    const profile = await StudentProfile.findOne({
      userId: req.user._id,
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found',
      });
    }

    res.status(200).json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error('Get Student Profile Error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve student profile',
    });
  }
};

// CREATE STUDENT PROFILE
exports.createStudentProfile = async (req, res) => {
  try {
    const existingProfile = await StudentProfile.findOne({
      userId: req.user._id,
    });

    if (existingProfile) {
      return res.status(409).json({
        success: false,
        message: 'Student profile already exists',
      });
    }

    const {
      personal,
      academic,
      financial,
      location,
      eligibilityFlags,
    } = req.body;

    if (
      !personal ||
      !academic ||
      !financial ||
      !location ||
      !eligibilityFlags
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please complete all profile sections',
      });
    }

    const profile = await StudentProfile.create({
      userId: req.user._id,
      personal: {
        ...personal,
        dateOfBirth: new Date(personal.dateOfBirth),
      },
      academic,
      financial,
      location,
      eligibilityFlags,
      onboardingCompleted: true,
    });

    res.status(201).json({
      success: true,
      message: 'Student profile created successfully',
      profile,
    });
  } catch (error) {
    console.error('Create Student Profile Error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// UPDATE STUDENT PROFILE
exports.updateStudentProfile = async (req, res) => {
  try {
    const {
      personal,
      academic,
      financial,
      location,
      eligibilityFlags,
    } = req.body;

    const existingProfile = await StudentProfile.findOne({
      userId: req.user._id,
    });

    if (!existingProfile) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found',
      });
    }

    existingProfile.personal = {
      ...existingProfile.personal.toObject(),
      ...personal,
    };

    if (personal?.dateOfBirth) {
      existingProfile.personal.dateOfBirth = new Date(
        personal.dateOfBirth
      );
    }

    existingProfile.academic = {
      ...existingProfile.academic.toObject(),
      ...academic,
    };

    existingProfile.financial = {
      ...existingProfile.financial.toObject(),
      ...financial,
    };

    existingProfile.location = {
      ...existingProfile.location.toObject(),
      ...location,
    };

    existingProfile.eligibilityFlags = {
      ...existingProfile.eligibilityFlags.toObject(),
      ...eligibilityFlags,
    };

    existingProfile.onboardingCompleted = true;

    const updatedProfile = await existingProfile.save();

    res.status(200).json({
      success: true,
      message: 'Student profile updated successfully',
      profile: updatedProfile,
    });
  } catch (error) {
    console.error('Update Student Profile Error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// CHECK PROFILE STATUS
exports.getProfileStatus = async (req, res) => {
  try {
    const profile = await StudentProfile.findOne({
      userId: req.user._id,
    });

    res.status(200).json({
      success: true,
      completed: Boolean(profile?.onboardingCompleted),
      profile: profile || null,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Unable to check profile status',
    });
  }
};