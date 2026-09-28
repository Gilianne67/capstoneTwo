const mongoose = require('mongoose');
const SavedMatch = require('../models/SavedMatch');
const StudentProfile = require('../models/StudentProfile');
const Scholarship = require('../models/Scholarship');
const { getRankedScholarships } = require('../services/matchingService');
const { safeSyncDeadlineNotifications } = require('../services/notificationService');

const isValidObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value) &&
  String(new mongoose.Types.ObjectId(value)) === String(value);

const findStudentProfile = (userId) =>
  StudentProfile.findOne({ userId });

const loadMatchScores = async (studentProfile) => {
  try {
    const matches = await getRankedScholarships(studentProfile);
    return new Map(
      (matches || []).map((match) => [
        String(match?.scholarship?._id),
        match.totalScore
      ])
    );
  } catch (error) {
    console.error('Saved scholarship score lookup failed:', error);
    return new Map();
  }
};

const mapSavedScholarship = (saved, scoreByScholarshipId) => {
  const scholarship = saved.scholarshipId;

  if (!scholarship || typeof scholarship !== 'object' || !scholarship._id) {
    return null;
  }

  const scholarshipId = String(scholarship._id);
  const matchScore = scoreByScholarshipId.get(scholarshipId);

  return {
    _id: scholarship._id,
    title: scholarship.name || '',
    provider: scholarship.scholarshipType || '',
    amount: scholarship.grantValue,
    deadline: scholarship.deadline,
    category: scholarship.scholarshipType || '',
    externalUrl: scholarship.applicationURL || '',
    dateSaved: saved.dateSaved,
    ...(matchScore !== undefined ? { matchScore } : {})
  };
};

exports.getSavedScholarships = async (req, res) => {
  try {
    const studentProfile = await findStudentProfile(req.user.id);

    if (!studentProfile) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    const [saved, scoreByScholarshipId] = await Promise.all([
      SavedMatch.find({ studentProfileId: studentProfile._id })
        .populate(
          'scholarshipId',
          'name scholarshipType grantValue deadline applicationURL'
        )
        .sort({ dateSaved: -1 }),
      loadMatchScores(studentProfile)
    ]);

    const savedScholarships = saved
      .map((item) => mapSavedScholarship(item, scoreByScholarshipId))
      .filter(Boolean);

    await safeSyncDeadlineNotifications(studentProfile._id, saved);

    return res.status(200).json({
      success: true,
      count: savedScholarships.length,
      savedScholarships
    });
  } catch (error) {
    console.error('Get saved scholarships error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load saved scholarships'
    });
  }
};

exports.saveScholarship = async (req, res) => {
  try {
    const { scholarshipId } = req.params;

    if (!isValidObjectId(scholarshipId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid scholarship id'
      });
    }

    const studentProfile = await findStudentProfile(req.user.id);

    if (!studentProfile) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    const scholarship = await Scholarship.findById(scholarshipId).select('_id');

    if (!scholarship) {
      return res.status(404).json({
        success: false,
        message: 'Scholarship not found'
      });
    }

    const existing = await SavedMatch.findOne({
      studentProfileId: studentProfile._id,
      scholarshipId: scholarship._id
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        alreadySaved: true,
        saved: {
          _id: scholarship._id,
          dateSaved: existing.dateSaved
        }
      });
    }

    try {
      const saved = await SavedMatch.create({
        studentProfileId: studentProfile._id,
        scholarshipId: scholarship._id
      });

      await safeSyncDeadlineNotifications(studentProfile._id);

      return res.status(201).json({
        success: true,
        saved: {
          _id: scholarship._id,
          dateSaved: saved.dateSaved
        }
      });
    } catch (error) {
      if (error.code === 11000) {
        const duplicate = await SavedMatch.findOne({
          studentProfileId: studentProfile._id,
          scholarshipId: scholarship._id
        });

        return res.status(200).json({
          success: true,
          alreadySaved: true,
          saved: {
            _id: scholarship._id,
            dateSaved: duplicate?.dateSaved
          }
        });
      }

      throw error;
    }
  } catch (error) {
    console.error('Save scholarship error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save scholarship'
    });
  }
};

exports.removeSavedScholarship = async (req, res) => {
  try {
    const { scholarshipId } = req.params;

    if (!isValidObjectId(scholarshipId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid scholarship id'
      });
    }

    const studentProfile = await findStudentProfile(req.user.id);

    if (!studentProfile) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    const removed = await SavedMatch.findOneAndDelete({
      studentProfileId: studentProfile._id,
      scholarshipId
    });

    if (!removed) {
      return res.status(404).json({
        success: false,
        message: 'Saved scholarship not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Scholarship removed from saved list'
    });
  } catch (error) {
    console.error('Remove saved scholarship error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove saved scholarship'
    });
  }
};
