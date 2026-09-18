const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendParentConsentEmail } = require('../utils/emailService');

// Shared secret for signing & verifying consent tokens across all functions
const JWT_SECRET = process.env.JWT_SECRET || 'iskolarmatch_fallback_secret_key';

// POST /api/v1/user/onboarding
exports.handleOnboarding = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      dob, course, yearLevel, gpa, region, 
      householdIncome, guardianName, guardianEmail, isMinor 
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

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        dob, course, yearLevel, gpa, region, householdIncome,
        guardianName: isMinor ? guardianName.trim() : null,
        guardianEmail: isMinor ? guardianEmail.trim().toLowerCase() : null,
        status: isMinor ? 'pending_consent' : 'active',
        isOnboarded: true,
        ...(consentToken && { consentToken })
      },
      { new: true, runValidators: true }
    );

    if (isMinor) {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
      const consentLink = `${clientUrl}/consent/verify?token=${consentToken}`;

      console.log(`[MAILER] Preparing to send consent email to guardian: ${updatedUser.guardianEmail}...`);

      try {
        await sendParentConsentEmail({
          guardianEmail: updatedUser.guardianEmail,
          guardianName: updatedUser.guardianName || 'Parent/Guardian',
          studentName: updatedUser.name || 'Student',
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

    const studentUser = await User.findById(decoded.userId).select('name email course yearLevel region status');

    if (!studentUser) {
      return res.status(404).json({ success: false, message: 'Student account not found.' });
    }

    return res.status(200).json({
      success: true,
      student: studentUser
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

    return res.status(200).json({
      success: true,
      message: 'Account verified successfully.'
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
    await user.save();

    const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
    const consentLink = `${clientUrl}/consent/verify?token=${consentToken}`;

    console.log(`[MAILER] Resending consent email to guardian: ${targetEmail}...`);

    try {
      await sendParentConsentEmail({
        guardianEmail: targetEmail,
        guardianName: user.guardianName || 'Parent/Guardian',
        studentName: user.name || 'Student',
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