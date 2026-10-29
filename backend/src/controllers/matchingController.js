const StudentProfile = require('../models/StudentProfile');
const matchingService = require('../services/matchingService');
const { isProfileComplete } = require('../utils/studentProfileCompletion');

const searchQueryFromRequest = (query) => {
  const value = Array.isArray(query) ? query[0] : query;
  return String(value || '').trim();
};

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

    if (!isProfileComplete(studentProfile)) {
      return res.status(200).json({
        success: true,
        count: 0,
        matches: [],
        profileComplete: false,
      });
    }

    const matches = await matchingService.getRankedScholarships(
      studentProfile,
      { query: searchQueryFromRequest(req.query.q) }
    );

    return res.status(200).json({
      success: true,
      count: matches.length,
      matches,
    });
  } catch (error) {
    if (error && error.code === 'SEARCH_UNAVAILABLE') {
      console.error('Scholarship search unavailable');

      return res.status(503).json({
        success: false,
        code: 'SEARCH_UNAVAILABLE',
        message: error.message,
      });
    }

    console.error('Matching error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Failed to generate scholarship matches',
    });
  }
};