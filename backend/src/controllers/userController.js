const jwt = require('jsonwebtoken');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const ParentalConsent = require('../models/ParentalConsent'); // Explicitly targets 'parentalconsents' collection
const { sendParentConsentEmail } = require('../utils/emailService');

// Shared secret for signing & verifying consent tokens across all functions
const JWT_SECRET = process.env.JWT_SECRET || 'iskolarmatch_fallback_secret_key';

// Helper function to calculate age from Date of Birth string/date
const calculateAge = (dobString) => {
  if (!dobString) return 17;
  const birthDate = new Date(dobString);
  const diff = Date.now() - birthDate.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

// POST /api/v1/user/onboarding
exports.handleOnboarding = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      dob,
      course,
      academicLevel,
      yearLevel,
      gpa,
      region,
      householdIncome,
      guardianName,
      guardianEmail,
      guardianPhone,
      relationship,
      documentUrl,
      isMinor
    } = req.body;

    const studentUser = await User.findById(userId);
    if (!studentUser) {
      return res.status(404).json({ success: false, message: "User account not found." });
    }

    if (isMinor) {
      if (!guardianEmail) {
        return res.status(400).json({ success: false, message: "Guardian email is required for minors." });
      }

      const normalizedGuardianEmail = guardianEmail.trim().toLowerCase();
      const normalizedStudentEmail = studentUser.email.trim().toLowerCase();

      if (normalizedGuardianEmail === normalizedStudentEmail) {
        return res.status(400).json({ 
          success: false, 
          message: "Guardian email cannot be the same as your student account email." 
        });
      }
    }

    let consentToken = null;
    if (isMinor) {
      consentToken = jwt.sign(
        { 
          userId: studentUser._id, 
          guardianEmail: guardianEmail.trim().toLowerCase(),
          purpose: 'parental_consent' 
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
    }

    // Update User record with onboarding state & consent info
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        dob, 
        course, 
        yearLevel, 
        gpa, 
        region, 
        householdIncome,
        guardianName: isMinor ? guardianName.trim() : null,
        guardianEmail: isMinor ? guardianEmail.trim().toLowerCase() : null,
        status: isMinor ? 'pending_consent' : 'active',
        isOnboarded: true,
        ...(consentToken && { consentToken })
      },
      { new: true, runValidators: true }
    );

    // Create or update the StudentProfile using onboarding data
    const studentProfile = await StudentProfile.findOneAndUpdate(
      { userId: userId },
      {
        userId: userId,
        fullName: studentUser.fullName || studentUser.name,
        email: studentUser.email,
        dateOfBirth: dob,
        academicLevel: academicLevel,
        yearLevel: yearLevel,
        course: course,
        gwa: gpa,
        region: region,
        incomeBracket: householdIncome,
        isMinor: !!isMinor
      },
      {
        returnDocument: 'after',
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    // Link profile reference to user
    updatedUser.profileRef = studentProfile._id;
    await updatedUser.save({ validateBeforeSave: false });

    // Handle ParentalConsent collection entry if minor
    if (isMinor) {
      const studentAge = calculateAge(dob);

      await ParentalConsent.findOneAndUpdate(
        { studentId: userId },
        {
          studentId: userId,
          studentName: updatedUser.fullName || updatedUser.name || 'Student',
          age: studentAge,
          guardianName: guardianName ? guardianName.trim() : 'Parent/Guardian',
          guardianEmail: guardianEmail.trim().toLowerCase(),
          guardianPhone: guardianPhone || '',
          relationship: relationship || 'Parent/Legal Guardian',
          documentUrl: documentUrl || 'pending_verification',
          status: 'Pending'
        },
        { upsert: true, new: true, runValidators: true }
      );

      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
      const consentLink = `${clientUrl}/consent/verify?token=${consentToken}`;

      console.log(`[MAILER] Preparing to send consent email to guardian: ${updatedUser.guardianEmail}...`);

      try {
        await sendParentConsentEmail({
          guardianEmail: updatedUser.guardianEmail,
          guardianName: updatedUser.guardianName || 'Parent/Guardian',
          studentName: updatedUser.name || updatedUser.fullName || 'Student',
          consentLink
        });
        console.log(`[MAILER SUCCESS] Consent email dispatched to ${updatedUser.guardianEmail}`);
      } catch (emailErr) {
        console.error(`[MAILER ERROR] Failed to send email to ${updatedUser.guardianEmail}:`, emailErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: isMinor 
        ? 'Onboarding completed. Consent email sent to guardian.' 
        : 'Profile activated successfully.',
      user: updatedUser
    });

  } catch (error) {
    console.error('Onboarding Server Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process onboarding.' });
  }
};

// GET /api/v1/consent/verify?token=...
exports.verifyConsent = async (req, res) => {
  try {
    const { token } = req.query;

    console.log('--- CONSENT VERIFICATION DIAGNOSTICS ---');
    console.log('Received Query Token:', token ? `${token.substring(0, 15)}...` : 'MISSING');

    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification token is missing' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Decoded Token Payload:', decoded);

    if (decoded.purpose !== 'parental_consent') {
      return res.status(400).json({ success: false, message: 'Invalid token purpose' });
    }

    const studentUser = await User.findById(decoded.userId).select('name fullName email course yearLevel region status');

    if (!studentUser) {
      return res.status(404).json({ success: false, message: 'Student account not found.' });
    }

    // Check corresponding ParentalConsent record
    const consentDoc = await ParentalConsent.findOne({ studentId: decoded.userId });

    return res.status(200).json({
      success: true,
      student: studentUser,
      consentStatus: consentDoc ? consentDoc.status : 'Pending'
    });

  } catch (error) {
    console.error('❌ Consent Verification Detailed Error:', error.name, '-', error.message);

    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({ success: false, message: 'Consent token has expired. Please request a new one.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(400).json({ success: false, message: `Invalid consent token signature (${error.message}).` });
    }

    return res.status(400).json({ success: false, message: 'Consent token is invalid or has expired.' });
  }
};

// POST /api/v1/consent/approve
exports.approveConsent = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Token missing.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.purpose !== 'parental_consent') {
      return res.status(400).json({ success: false, message: 'Invalid token purpose' });
    }

    // 1. Update User Status to active
    const updatedUser = await User.findByIdAndUpdate(
      decoded.userId,
      {
        status: 'active',
        consentApprovedAt: new Date(),
        $unset: { consentToken: 1 }
      },
      { returnDocument: 'after' }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // 2. Update record in ParentalConsent (parentalconsents collection)
    const consentDoc = await ParentalConsent.findOneAndUpdate(
      { studentId: decoded.userId },
      {
        status: 'Verified',
        verifiedAt: new Date()
      },
      { new: true }
    );

    // 3. Ensure StudentProfile is created/active
    let studentProfile = await StudentProfile.findOne({ userId: decoded.userId });
    if (!studentProfile) {
      studentProfile = await StudentProfile.create({
        userId: updatedUser._id,
        fullName: updatedUser.fullName || updatedUser.name,
        email: updatedUser.email,
        isMinor: true
      });
    }

    // Maintain profile link on user document
    if (!updatedUser.profileRef) {
      updatedUser.profileRef = studentProfile._id;
      await updatedUser.save({ validateBeforeSave: false });
    }

    return res.status(200).json({
      success: true,
      message: 'Parental consent approved and account verified successfully.',
      data: {
        consent: consentDoc,
        studentProfileId: studentProfile._id
      }
    });
  } catch (error) {
    console.error('Consent Approval Error:', error);
    return res.status(400).json({ success: false, message: 'Failed to process authorization token.' });
  }
};

// POST /api/v1/consent/resend
exports.resendConsentEmail = async (req, res) => {
  try {
    const { userId, guardianEmail } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const targetEmail = (guardianEmail || user.guardianEmail)?.trim().toLowerCase();
    if (!targetEmail) {
      return res.status(400).json({ success: false, message: 'Guardian email missing.' });
    }

    const consentToken = jwt.sign(
      { 
        userId: user._id, 
        guardianEmail: targetEmail,
        purpose: 'parental_consent' 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    user.consentToken = consentToken;
    user.guardianEmail = targetEmail;
    await user.save();

    // Update ParentalConsent document guardian email if modified
    await ParentalConsent.findOneAndUpdate(
      { studentId: user._id },
      { guardianEmail: targetEmail, status: 'Pending' }
    );

    const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
    const consentLink = `${clientUrl}/consent/verify?token=${consentToken}`;

    console.log(`[MAILER] Resending consent email to guardian: ${targetEmail}...`);

    try {
      await sendParentConsentEmail({
        guardianEmail: targetEmail,
        guardianName: user.guardianName || 'Parent/Guardian',
        studentName: user.fullName || user.name || 'Student',
        consentLink
      });
      console.log(`[MAILER SUCCESS] Consent email successfully resent to ${targetEmail}`);
    } catch (mailError) {
      console.error(`[MAILER ERROR] Failed to resend email to ${targetEmail}:`, mailError.message);
      return res.status(500).json({ success: false, message: 'Failed to deliver email through SMTP provider.' });
    }

    return res.status(200).json({ success: true, message: 'Consent email resent.' });
  } catch (error) {
    console.error('Resend Email Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send email.' });
  }
};