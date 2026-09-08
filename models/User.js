const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['Student', 'Provider', 'Admin'],
    required: true
  },
  accountStatus: {
    type: String,
    enum: ['Pending', 'Active-Approved', 'Suspended', 'Rejected'],
    default: 'Pending'
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

module.exports = mongoose.model('User', userSchema);