const StudentProfile = require('../models/StudentProfile');
const { getRankedScholarships } = require('../services/matchingService');

exports.getMatches = async (req, res) => {
  try {
    const studentProfile = await StudentProfile.findOne({
      userId: req.user.id,
    });

    if (!studentProfile) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found',
      });
    }

    const matches = await getRankedScholarships(studentProfile);

    return res.status(200).json({
      success: true,
      count: matches.length,
      matches,
    });
  } catch (error) {
    console.error('Matching error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to generate scholarship matches',
      error: error.message,
    });
  }
};