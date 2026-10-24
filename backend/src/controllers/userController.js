const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const ParentConsent = require('../models/ParentalConsent'); 
const { sendParentConsentEmail, sendVerificationEmail } = require('../utils/emailService');
const { recordAuditLog } = require('./auditController');

// Shared secret for signing & verifying consent tokens across all functions
const JWT_SECRET = process.env.JWT_SECRET || 'iskolarmatch_fallback_secret_key';

const SUPPORTED_GWA_SCALES = ['1.00-5.00', '60-100'];

// Persist the scale onboarding already calculated. Fall back to the same
// numeric ranges the form uses when a valid scale was not sent.
const resolveOnboardingGwaScale = (gwaScale, gwa) => {
  if (SUPPORTED_GWA_SCALES.includes(gwaScale)) {
    return gwaScale;
  }

  const value = Number(gwa);

  if (!Number.isFinite(value)) {
    return null;
  }

  if (value >= 1 && value <= 5) {
    return '1.00-5.00';
  }

  if (value >= 60 && value <= 100) {
    return '60-100';
  }

  return null;
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
      gwaScale,
      region,
      province,
      municipality,
      householdIncome,
      guardianName,
      guardianEmail,
      isMinor
    } = req.body;

    const studentUser = await User.findById(userId);
    if (!studentUser) {
      return res.status(404).json({ success: false, message: "User account not found." });
    }

    // 🔒 Role Enforcement: Ensure only users with a student role go through student onboarding
    if (studentUser.role !== 'student') {
      return res.status(403).json({ 
        success: false, 
        message: "Onboarding flow is restricted to student accounts." 
      });
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
    let normalizedGuardianEmail = null;

    if (isMinor) {
      normalizedGuardianEmail = guardianEmail.trim().toLowerCase();
      consentToken = jwt.sign(
        { 
          userId: studentUser._id, 
          guardianEmail: normalizedGuardianEmail,
          purpose: 'parental_consent' 
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
    }

    // 1. Update Core User Account State
    studentUser.status = isMinor ? 'pending_consent' : 'active';
    studentUser.isOnboarded = true;

    // 🔒 Generate Email Verification Token post-onboarding for adult students
    let rawVerifyToken = null;
    if (!isMinor) {
      rawVerifyToken = crypto.randomBytes(32).toString('hex');
      studentUser.emailVerificationToken = crypto
        .createHash('sha256')
        .update(rawVerifyToken)
        .digest('hex');
      studentUser.emailVerificationExpire = Date.now() + 2 * 60 * 60 * 1000; // 2 Hours
    }

    await studentUser.save();

    // 2. Create or update the StudentProfile using designated model (Aligned to schema: gwa & municipalityCity)
    const resolvedGwaScale = resolveOnboardingGwaScale(gwaScale, gpa);

    await StudentProfile.findOneAndUpdate(
      { userId: userId },
      {
        userId: userId,
        dateOfBirth: dob,
        academicLevel: academicLevel,
        yearLevel: yearLevel,
        course: course,
        gwa: gpa,
        ...(resolvedGwaScale ? { gwaScale: resolvedGwaScale } : {}),
        region: region,
        province: province || '',
        municipalityCity: municipality,
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

    // 3. Create or update record in designated ParentConsent model if minor (Safe guardianName handling)
    if (isMinor) {
      const safeGuardianName = guardianName ? guardianName.trim() : 'Parent/Guardian';

      await ParentConsent.findOneAndUpdate(
        { studentId: userId },
        {
          studentId: userId,
          guardianName: safeGuardianName,
          guardianEmail: normalizedGuardianEmail,
          consentToken: consentToken,
          status: 'pending'
        },
        {
          upsert: true,
          new: true,
          runValidators: true
        }
      );
    }

    // 📝 AUDIT LOG: Onboarding Completed
    const actorName = studentUser.name || studentUser.email;
    await recordAuditLog({
      actor: actorName,
      role: 'Student',
      action: 'ONBOARDING_COMPLETE',
      details: `Student (${studentUser.email}) completed onboarding profile.${isMinor ? ' Pending guardian consent.' : ' Verification email dispatched.'}`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      severity: 'Info'
    });

    // 📧 Dispatch Verification Email for Adult Students
    if (!isMinor && rawVerifyToken) {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
      const verifyUrl = `${clientUrl}/verify-email/${rawVerifyToken}`;

      console.log(`[MAILER] Preparing verification email for adult student: ${studentUser.email}...`);
      try {
        if (typeof sendVerificationEmail === 'function') {
          await sendVerificationEmail(studentUser.email, studentUser.name || 'Student', verifyUrl);
          console.log(`[MAILER SUCCESS] Verification email sent to ${studentUser.email}`);
        }
      } catch (err) {
        console.error(`[MAILER ERROR] Failed to send verification email to ${studentUser.email}:`, err.message);
      }
    }

    // 📧 Dispatch Consent Email for Minor Students using Designated Model attributes
    if (isMinor) {
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
      const consentLink = `${clientUrl}/consent/verify?token=${consentToken}`;
      const safeGuardianName = guardianName ? guardianName.trim() : 'Parent/Guardian';

      console.log(`[MAILER] Preparing to send consent email to guardian: ${normalizedGuardianEmail}...`);

      try {
        await sendParentConsentEmail({
          guardianEmail: normalizedGuardianEmail,
          guardianName: safeGuardianName,
          studentName: studentUser.name || 'Student',
          consentLink
        });
        console.log(`[MAILER SUCCESS] Consent email dispatched to ${normalizedGuardianEmail}`);

        await recordAuditLog({
          actor: 'System Consent Guard',
          role: 'System',
          action: 'CONSENT_REQUESTED',
          details: `Parental consent request dispatched to ${normalizedGuardianEmail} for minor Student ID #${studentUser._id}`,
          ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
          severity: 'Info'
        });
      } catch (emailErr) {
        console.error(`[MAILER ERROR] Failed to send email to ${normalizedGuardianEmail}:`, emailErr.message);

        await recordAuditLog({
          actor: 'System Consent Guard',
          role: 'System',
          action: 'SECURITY_ALERT',
          details: `Failed to deliver guardian consent email to ${normalizedGuardianEmail}: ${emailErr.message}`,
          ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
          severity: 'Warning'
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: isMinor 
        ? 'Onboarding completed. Consent email sent to guardian.' 
        : 'Profile activated and verification email sent successfully.',
      user: studentUser
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

    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification token is missing' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.purpose !== 'parental_consent') {
      return res.status(400).json({ success: false, message: 'Invalid token purpose' });
    }

    // Query designated ParentConsent collection
    const consentRecord = await ParentConsent.findOne({
      studentId: decoded.userId,
      consentToken: token,
      status: 'pending'
    }).populate('studentId', 'name email status');

    if (!consentRecord || !consentRecord.studentId) {
      return res.status(404).json({ success: false, message: 'Consent request not found or already processed.' });
    }

    // Fetch StudentProfile so academic & location data populate correctly for ParentConsentPage
    const studentProfile = await StudentProfile.findOne({ userId: consentRecord.studentId._id });

    const studentData = {
      _id: consentRecord.studentId._id,
      name: consentRecord.studentId.name,
      email: consentRecord.studentId.email,
      status: consentRecord.studentId.status,
      course: studentProfile?.course || 'N/A',
      yearLevel: studentProfile?.yearLevel || 'N/A',
      region: studentProfile?.region || 'N/A',
      province: studentProfile?.province || 'N/A',
      municipality: studentProfile?.municipalityCity || 'N/A'
    };

    await recordAuditLog({
      actor: 'System Consent Guard',
      role: 'System',
      action: 'CONSENT_TOKEN_INSPECTED',
      details: `Parent/Guardian inspected consent verification page for Student ID #${studentData._id} (${studentData.email})`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      severity: 'Info'
    });

    return res.status(200).json({
      success: true,
      student: studentData,
      guardianEmail: consentRecord.guardianEmail
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

    // 1. Update designated ParentConsent model record status
    const consentRecord = await ParentConsent.findOneAndUpdate(
      { studentId: decoded.userId, consentToken: token },
      {
        status: 'approved',
        approvedAt: new Date(),
        $unset: { consentToken: 1 }
      },
      { new: true }
    );

    if (!consentRecord) {
      return res.status(404).json({ success: false, message: 'Invalid or expired consent token.' });
    }

    // 2. Activate corresponding User account
    const updatedUser = await User.findByIdAndUpdate(
      decoded.userId,
      {
        status: 'active',
        consentApprovedAt: new Date()
      },
      { returnDocument: 'after' }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await recordAuditLog({
      actor: 'System Consent Guard',
      role: 'System',
      action: 'CONSENT_VERIFIED',
      details: `Minor Consent verified for Student ID #${updatedUser._id} (${updatedUser.email}). Account status set to active.`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      severity: 'Info'
    });

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
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }

    if (req.user.role !== 'student' || req.user.status !== 'pending_consent') {
      return res.status(403).json({
        success: false,
        message: 'Only a student awaiting guardian consent can resend the consent email.',
      });
    }

    const currentId = String(req.user._id || req.user.id);
    const requestedId = req.body?.userId ? String(req.body.userId) : currentId;
    if (requestedId !== currentId) {
      return res.status(403).json({
        success: false,
        message: 'You can only resend consent for your own account.',
      });
    }

    const user = await User.findById(currentId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Fetch designated ParentConsent record
    const consentRecord = await ParentConsent.findOne({ studentId: currentId, status: 'pending' });
    if (!consentRecord) {
      return res.status(404).json({ success: false, message: 'No pending parental consent record found.' });
    }

    const targetEmail = consentRecord.guardianEmail?.trim().toLowerCase();
    const requestedEmail = req.body?.guardianEmail?.trim().toLowerCase();
    if (!targetEmail) {
      return res.status(400).json({ success: false, message: 'Guardian email missing.' });
    }
    if (requestedEmail && requestedEmail !== targetEmail) {
      return res.status(400).json({
        success: false,
        message: 'Guardian email does not match the address on this account.',
      });
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

    consentRecord.consentToken = consentToken;
    await consentRecord.save();

    const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
    const consentLink = `${clientUrl}/consent/verify?token=${consentToken}`;

    try {
      await sendParentConsentEmail({
        guardianEmail: targetEmail,
        guardianName: consentRecord.guardianName || 'Parent/Guardian',
        studentName: user.name || 'Student',
        consentLink
      });

      await recordAuditLog({
        actor: user.name || user.email,
        role: 'Student',
        action: 'CONSENT_RESENT',
        details: `Student (${user.email}) requested a new consent email to be sent to ${targetEmail}`,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
        severity: 'Info'
      });
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