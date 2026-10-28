const mongoose = require('mongoose');

/**
 * Durable index of issued session hashes. The raw JWT is never stored.
 * Redis remains a cache of the same sessions.
 */
const issuedSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: false }
);

issuedSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('IssuedSession', issuedSessionSchema);
