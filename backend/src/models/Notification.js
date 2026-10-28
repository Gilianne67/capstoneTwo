const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    studentProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentProfile',
      required: true,
      index: true
    },

    type: {
      type: String,
      enum: ['deadline', 'profile_update', 'profile_completion', 'report_decision'],
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
      default: null
    },

    alertWindow: {
      type: String,
      // 3d and 24h remain valid so previously saved reminders still load.
      // New deadline reminders are created only for 7d.
      enum: ['7d', '3d', '24h'],
      default: null
    },

    dedupeKey: {
      type: String,
      default: null
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

notificationSchema.pre('validate', function () {
  if (this.type !== 'deadline') return;

  if (!this.scholarshipId) {
    this.invalidate('scholarshipId', 'Scholarship is required for a deadline notification');
  }

  if (!this.alertWindow) {
    this.invalidate('alertWindow', 'Alert window is required for a deadline notification');
  }

  if (!this.dedupeKey) {
    this.invalidate('dedupeKey', 'Dedupe key is required for a deadline notification');
  }
});

notificationSchema.index(
  { studentProfileId: 1, type: 1, dedupeKey: 1 },
  {
    unique: true,
    partialFilterExpression: { dedupeKey: { $type: 'string' } }
  }
);

module.exports =
  mongoose.models.Notification ||
  mongoose.model('Notification', notificationSchema);
