const mongoose = require('mongoose');

const providerNotificationSchema = new mongoose.Schema(
  {
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
      index: true
    },

    type: {
      type: String,
      enum: ['listing_removed'],
      required: true
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    message: {
      type: String,
      required: true,
      trim: true
    },

    scholarshipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scholarship',
      required: true
    },

    removedAt: {
      type: Date,
      required: true
    },

    dedupeKey: {
      type: String,
      required: true
    },

    isRead: {
      type: Boolean,
      default: false
    },

    readAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

providerNotificationSchema.index(
  { providerId: 1, type: 1, dedupeKey: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.ProviderNotification ||
  mongoose.model('ProviderNotification', providerNotificationSchema);
