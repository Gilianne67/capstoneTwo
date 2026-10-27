const mongoose = require('mongoose');

const BroadcastSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a broadcast title'],
      trim: true,
      maxlength: 120,
    },
    message: {
      type: String,
      required: [true, 'Please add broadcast message content'],
      trim: true,
    },
    target: {
      type: String,
      enum: ['All Users', 'Students Only', 'Grant Providers Only'],
      default: 'All Users',
    },
    priority: {
      type: String,
      enum: ['Info', 'Warning', 'Urgent'],
      default: 'Info',
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Please specify an expiration date'],
    },
    status: {
      type: String,
      enum: ['Active', 'Revoked', 'Expired'],
      default: 'Active',
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Virtual check to determine if the broadcast is currently active and unexpired
BroadcastSchema.virtual('isCurrentlyActive').get(function () {
  const now = new Date();
  return (
    this.status === 'Active' &&
    now >= new Date(this.startDate) &&
    now <= new Date(this.expiresAt)
  );
});

module.exports = mongoose.models.Broadcast || mongoose.model('Broadcast', BroadcastSchema);