const mongoose = require('mongoose');
const StudentProfile = require('../models/StudentProfile');
const Notification = require('../models/Notification');
const {
  safeSyncDeadlineNotifications,
  countUnreadDeadlineAlerts
} = require('../services/notificationService');

const isValidObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value) &&
  String(new mongoose.Types.ObjectId(value)) === String(value);

const findStudentProfile = (userId) =>
  StudentProfile.findOne({ userId });

const profileRequired = (res) =>
  res.status(404).json({
    success: false,
    message: 'Student profile not found'
  });

exports.getNotifications = async (req, res) => {
  try {
    const studentProfile = await findStudentProfile(req.user.id);

    if (!studentProfile) {
      return profileRequired(res);
    }

    await safeSyncDeadlineNotifications(studentProfile._id);

    const filter = { studentProfileId: studentProfile._id };

    if (req.query.unread === 'true') {
      filter.isRead = false;
    }

    const notifications = await Notification.find(filter).sort({ createdAt: -1 });
    const unreadCount = await Notification.countDocuments({
      studentProfileId: studentProfile._id,
      isRead: false
    });

    return res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount,
      notifications
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load notifications'
    });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const studentProfile = await findStudentProfile(req.user.id);

    if (!studentProfile) {
      return profileRequired(res);
    }

    await safeSyncDeadlineNotifications(studentProfile._id);

    const count = await Notification.countDocuments({
      studentProfileId: studentProfile._id,
      isRead: false
    });

    return res.status(200).json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Unread notification count error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load unread notification count'
    });
  }
};

exports.getUnreadDeadlineCount = async (req, res) => {
  try {
    const studentProfile = await findStudentProfile(req.user.id);

    if (!studentProfile) {
      return profileRequired(res);
    }

    await safeSyncDeadlineNotifications(studentProfile._id);

    const count = await countUnreadDeadlineAlerts(studentProfile._id);

    return res.status(200).json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Unread deadline notification count error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load unread deadline notification count'
    });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification id'
      });
    }

    const studentProfile = await findStudentProfile(req.user.id);

    if (!studentProfile) {
      return profileRequired(res);
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, studentProfileId: studentProfile._id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    return res.status(200).json({
      success: true,
      notification
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update notification'
    });
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  try {
    const studentProfile = await findStudentProfile(req.user.id);

    if (!studentProfile) {
      return profileRequired(res);
    }

    const result = await Notification.updateMany(
      { studentProfileId: studentProfile._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    return res.status(200).json({
      success: true,
      updated: result.modifiedCount
    });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update notifications'
    });
  }
};
