const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['student', 'provider', 'admin', 'super_admin'],
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
    isVerified: {
      type: Boolean,
      default: false,
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
// FIXED: Async Mongoose hooks automatically handle completion via Promise.
// Do NOT accept `next` as a parameter or invoke `next()`.
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
  return jwt.sign(
    { 
      id: this._id.toString(), 
      role: this.role,
      status: this.status,
      isOnboarded: this.isOnboarded
    },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
};

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);