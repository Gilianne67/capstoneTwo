const mongoose = require('mongoose');
const { broadcastPhase } = require('../utils/broadcastRules');

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
      maxlength: [2000, 'Broadcast message cannot exceed 2000 characters'],
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

// Same rule as broadcastPhase: Active, started, and not yet expired.
BroadcastSchema.virtual('isCurrentlyActive').get(function () {
  return broadcastPhase(this) === 'live';
});

module.exports = mongoose.models.Broadcast || mongoose.model('Broadcast', BroadcastSchema);