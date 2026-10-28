const mongoose = require('mongoose');
const Provider = require('../models/Provider');
const ProviderNotification = require('../models/ProviderNotification');

const isValidObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value) &&
  String(new mongoose.Types.ObjectId(value)) === String(value);

const providerForRequest = async (req) => {
  const userId = req.user?.id || req.user?._id;
  if (!userId) return null;
  return Provider.findOne({ userId });
};

const presentNotification = (notification) => {
  const title = String(notification.title || '');
  const message = String(notification.message || '');
  const marker = 'Admin explanation: ';
  const markerIndex = message.lastIndexOf(marker);
  const suffix = ' was removed';
  const scholarshipTitle = title.endsWith(suffix)
    ? title.slice(0, -suffix.length)
    : title;

  return {
    _id: notification._id,
    type: notification.type,
    title,
    scholarshipTitle,
    message,
    explanation: markerIndex === -1 ? '' : message.slice(markerIndex + marker.length).trim(),
    scholarshipId: notification.scholarshipId || null,
    removedAt: notification.removedAt || null,
    isRead: notification.isRead === true,
    readAt: notification.readAt || null,
    createdAt: notification.createdAt || null
  };
};

const missingProvider = (res) =>
  res.status(404).json({
    success: false,
    message: 'Provider profile not found'
  });

exports.getProviderNotifications = async (req, res) => {
  try {
    const provider = await providerForRequest(req);

    if (!provider) {
      return missingProvider(res);
    }

    const notifications = await ProviderNotification.find({ providerId: provider._id })
      .sort({ createdAt: -1 });
    const unreadCount = await ProviderNotification.countDocuments({
      providerId: provider._id,
      isRead: false
    });

    return res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount,
      notifications: notifications.map(presentNotification)
    });
  } catch (error) {
    console.error('Get provider notifications error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load notifications'
    });
  }
};

exports.getProviderUnreadCount = async (req, res) => {
  try {
    const provider = await providerForRequest(req);

    if (!provider) {
      return missingProvider(res);
    }

    const count = await ProviderNotification.countDocuments({
      providerId: provider._id,
      isRead: false
    });

    return res.status(200).json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Provider unread notification count error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load unread notification count'
    });
  }
};

exports.markProviderNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification id'
      });
    }

    const provider = await providerForRequest(req);

    if (!provider) {
      return missingProvider(res);
    }

    const notification = await ProviderNotification.findOneAndUpdate(
      { _id: id, providerId: provider._id },
      { $set: { isRead: true, readAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    return res.status(200).json({
      success: true,
      notification: presentNotification(notification)
    });
  } catch (error) {
    console.error('Mark provider notification read error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update notification'
    });
  }
};
