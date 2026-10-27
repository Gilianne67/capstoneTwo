const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MIN_PASSWORD_LENGTH } = require('../utils/passwordPolicy');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email address',
      ],
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      // Checked on the plaintext before bcrypt runs. Stored hashes are longer
      // than this minimum, so existing accounts do not need a password migration.
      minlength: [
        MIN_PASSWORD_LENGTH,
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
      ],
      select: false,
    },
    // Millisecond credential cutoff. New JWTs carry this value. protect rejects
    // older tokens, including ones issued in the same UTC second, even when
    // the Redis blocklist is unavailable.
    passwordChangedAt: {
      type: Date,
    },
    role: {
      type: String,
      enum: ['student', 'provider', 'admin', 'superadmin'],
      default: 'student',
    },
    status: {
      type: String,
      enum: ['pending_consent', 'active', 'suspended'],
      default: 'active',
    },
    isOnboarded: {
      type: Boolean,
      default: false,
    },
    organization: {
      type: String,
      default: '',
    },

    // Verification Gatekeeper Fields
    isVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
    },
    emailVerificationExpire: {
      type: Date,
    },

    // Password Reset Recovery Fields 
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpire: {
      type: Date,
    },

    // Account Protection & Security Lockout fields
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
    lastFailedIp: {
      type: String,
    },

    // Onboarding & Parental Consent fields
    dob: { type: Date },
    course: { type: String, trim: true },
    yearLevel: { type: String, trim: true },
    gpa: { type: Number },
    region: { type: String, trim: true },
    householdIncome: { type: String },
    guardianName: { type: String, trim: true },
    guardianEmail: { type: String, lowercase: true, trim: true },
    consentToken: { type: String },
    consentApprovedAt: { type: Date },
  },
  { timestamps: true }
);

// Encrypt password using bcrypt before saving
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare user-entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Sign JWT and return token string
UserSchema.methods.getSignedJwtToken = function () {
  const payload = {
    id: this._id.toString(),
    role: this.role,
    status: this.status,
    isOnboarded: this.isOnboarded,
    isVerified: this.isVerified,
  };
  if (this.passwordChangedAt) {
    const changedAtMs = new Date(this.passwordChangedAt).getTime();
    if (Number.isFinite(changedAtMs)) payload.passwordChangedAt = changedAtMs;
  }
  return jwt.sign(
    payload,
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
};

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);