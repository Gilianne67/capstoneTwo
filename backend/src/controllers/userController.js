const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const ParentConsent = require('../models/ParentalConsent'); 
const emailService = require('../utils/emailService');
const {
  buildVerificationUrl,
  claimVerificationToken,
  clientBaseUrl,
  restoreVerificationToken,
} = require('../utils/verificationToken');
const { recordAuditLog, withAuditWarning } = require('./auditController');

// Shared secret for signing & verifying consent tokens across all functions
const JWT_SECRET = process.env.JWT_SECRET || 'iskolarmatch_fallback_secret_key';

const SUPPORTED_GWA_SCALES = ['1.00-5.00', '60-100'];

// Resolve scale onboarding already calculated
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
      guardianEmail
    } = req.body;

    const studentUser = await User.findById(userId);
    if (!studentUser) {
      return res.status(404).json({ success: false, message: "User account not found." });
    }

    // Role Enforcement: Ensure only users with a student role go through student onboarding
    if (studentUser.role !== 'student') {
      return res.status(403).json({ 
        success: false, 
        message: "Onboarding flow is restricted to student accounts." 
      });
    }

    // Guard against re-onboarding or pending consent bypassing
    if (studentUser.status === 'pending_consent') {
      return res.status(403).json({ 
        success: false, 
        message: "Account is pending parental consent. Onboarding cannot be re-submitted." 
      });
    }

    if (studentUser.isOnboarded) {
      return res.status(400).json({ 
        success: false, 
        message: "Account onboarding has already been completed." 
      });
    }

    if (!dob) {
      return res.status(400).json({ success: false, message: "Date of birth is required." });
    }

    // Authoritative Server-Side Age & Minor Computation from DOB
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid date of birth format." });
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    const isMinor = age < 18;

    let normalizedGuardianEmail = null;
    if (isMinor) {
      if (!guardianEmail) {
        return res.status(400).json({ success: false, message: "Guardian email is required for minors." });
      }

      normalizedGuardianEmail = guardianEmail.trim().toLowerCase();
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

    const previousVerificationToken = studentUser.emailVerificationToken;
    const previousVerificationExpire = studentUser.emailVerificationExpire;

    await studentUser.save();

    // 2. Create or update StudentProfile
    const resolvedGwaScale = resolveOnboardingGwaScale(gwaScale, gpa);

    await StudentProfile.findOneAndUpdate(
      { userId: userId },
      {
        userId: userId,
        dateOfBirth: birthDate,
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

    // 3. Create or update ParentConsent record if minor
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

    // AUDIT LOG: Onboarding Completed
    const actorName = studentUser.name || studentUser.email;
    const onboardingAudit = await recordAuditLog({
      actor: actorName,
      actorId: studentUser._id,
      role: 'Student',
      action: 'ONBOARDING_COMPLETE',
      details: `Student ${studentUser._id} completed onboarding profile.${isMinor ? ' Pending guardian consent.' : ''}`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      severity: 'Info'
    });
    const onboardingAuditWarnings = [];

    let emailSent;
    let verificationMessage = 'Profile saved and a verification email has been sent.';

    // Email dispatch for adult students
    if (!isMinor) {
      const claimed = await claimVerificationToken(studentUser._id);

      if (claimed.claimed) {
        console.log(`[MAILER] Preparing verification email for adult student: ${studentUser.email}...`);
        try {
          if (typeof emailService.sendVerificationEmail !== 'function') {
            throw new Error('Email service configuration error.');
          }
          await emailService.sendVerificationEmail(
            studentUser.email,
            studentUser.name || 'Student',
            buildVerificationUrl(claimed.rawToken)
          );
          emailSent = true;
          console.log(`[MAILER SUCCESS] Verification email sent to ${studentUser.email}`);
        } catch (err) {
          console.error(`[MAILER ERROR] Failed to send verification email to ${studentUser.email}:`, err.message);
          await restoreVerificationToken(
            studentUser._id,
            claimed.rawToken,
            previousVerificationToken,
            previousVerificationExpire
          );
          emailSent = false;
          verificationMessage = 'Your profile was saved, but the verification email could not be sent. Please use Resend verification email on the next page.';
        }
      } else if (claimed.reason === 'fresh') {
        emailSent = true;
        verificationMessage = 'Profile saved. A verification email was already sent.';
      } else {
        emailSent = false;
        verificationMessage = 'Your profile was saved, but a verification link could not be issued. Please use Resend verification email on the next page.';
      }
    }

    // Email dispatch for minor students
    if (isMinor) {
      const consentLink = `${clientBaseUrl()}/consent/verify?token=${consentToken}`;
      const safeGuardianName = guardianName ? guardianName.trim() : 'Parent/Guardian';

      console.log(`[MAILER] Preparing to send consent email to guardian: ${normalizedGuardianEmail}...`);

      try {
        await emailService.sendParentConsentEmail({
          guardianEmail: normalizedGuardianEmail,
          guardianName: safeGuardianName,
          studentName: studentUser.name || 'Student',
          consentLink
        });
        console.log(`[MAILER SUCCESS] Consent email dispatched to ${normalizedGuardianEmail}`);

        const consentRequestAudit = await recordAuditLog({
          actor: 'System Consent Guard',
          actorId: studentUser._id,
          role: 'System',
          action: 'CONSENT_REQUESTED',
          details: `Parental consent request dispatched for student ${studentUser._id}.`,
          ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
          severity: 'Info'
        });
        if (consentRequestAudit && consentRequestAudit.ok === false) {
          onboardingAuditWarnings.push(consentRequestAudit);
        }
      } catch (emailErr) {
        console.error(`[MAILER ERROR] Failed to send email to ${normalizedGuardianEmail}:`, emailErr.message);

        const consentFailureAudit = await recordAuditLog({
          actor: 'System Consent Guard',
          actorId: studentUser._id,
          role: 'System',
          action: 'SECURITY_ALERT',
          details: `Failed to deliver the guardian consent email for student ${studentUser._id}.`,
          ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
          severity: 'Warning'
        });
        if (consentFailureAudit && consentFailureAudit.ok === false) {
          onboardingAuditWarnings.push(consentFailureAudit);
        }
      }
    }

    const publicUser = {
      id: studentUser._id,
      _id: studentUser._id,
      name: studentUser.name,
      email: studentUser.email,
      role: studentUser.role,
      isOnboarded: Boolean(studentUser.isOnboarded),
      isVerified: Boolean(studentUser.isVerified),
      status: studentUser.status,
    };

    return res.status(200).json(withAuditWarning({
      success: true,
      emailSent: isMinor ? undefined : emailSent,
      message: isMinor
        ? 'Onboarding completed. Consent email sent to guardian.'
        : verificationMessage,
      user: publicUser
    }, onboardingAudit, ...onboardingAuditWarnings));

  } catch (error) {
    console.error('Onboarding Server Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process onboarding.' });
  }
};

const CONSENT_LINK_INVALID = 'The consent link is invalid or has expired.';

const rejectConsentToken = async (req, res, { statusCode = 400, message = CONSENT_LINK_INVALID, reason, userId }) => {
  const studentId = userId ? String(userId) : '';
  await recordAuditLog({
    actor: 'System Consent Guard',
    actorId: studentId || undefined,
    role: 'System',
    action: 'CONSENT_TOKEN_REJECTED',
    details: studentId
      ? `Guardian consent token was rejected (${reason}) for student ${studentId}.`
      : `Guardian consent token was rejected (${reason}).`,
    ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
    severity: 'Warning',
  });
  // The public body stays the same when the audit insert fails, so a store
  // outage does not add a warning or reveal whether a student account exists.
  return res.status(statusCode).json({ success: false, message });
};

const verifiedConsentUserId = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
    if (decoded && decoded.purpose === 'parental_consent' && decoded.userId) {
      return String(decoded.userId);
    }
  } catch {
    // An invalid signature has no trustworthy student id.
  }
  return '';
};

// GET /api/v1/consent/verify?token=...
exports.verifyConsent = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return rejectConsentToken(req, res, {
        message: 'Verification token is missing',
        reason: 'missing',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.purpose !== 'parental_consent') {
      return rejectConsentToken(req, res, {
        reason: 'wrong purpose',
        userId: decoded.userId,
      });
    }

    const consentRecord = await ParentConsent.findOne({
      studentId: decoded.userId,
      consentToken: token,
      status: 'pending'
    }).populate('studentId', 'name email status');

    if (!consentRecord || !consentRecord.studentId) {
      return rejectConsentToken(req, res, {
        statusCode: 404,
        message: 'Consent request not found or already processed.',
        reason: 'not found or already used',
        userId: decoded.userId,
      });
    }

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

    const audit = await recordAuditLog({
      actor: 'System Consent Guard',
      actorId: studentData._id,
      role: 'System',
      action: 'CONSENT_TOKEN_INSPECTED',
      details: `Parent or guardian inspected the consent page for student ${studentData._id}.`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      severity: 'Info'
    });

    return res.status(200).json(withAuditWarning({
      success: true,
      student: studentData,
      guardianEmail: consentRecord.guardianEmail
    }, audit));

  } catch (error) {
    console.error('❌ Consent Verification Detailed Error:', error.name, '-', error.message);

    if (error.name === 'TokenExpiredError') {
      return rejectConsentToken(req, res, {
        message: 'Consent token has expired. Please request a new one.',
        reason: 'expired',
        userId: verifiedConsentUserId(req.query && req.query.token),
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return rejectConsentToken(req, res, { reason: 'invalid' });
    }

    return rejectConsentToken(req, res, { reason: 'invalid' });
  }
};

// POST /api/v1/consent/approve
exports.approveConsent = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return rejectConsentToken(req, res, {
        message: 'Token missing.',
        reason: 'missing',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.purpose !== 'parental_consent') {
      return rejectConsentToken(req, res, {
        reason: 'wrong purpose',
        userId: decoded.userId,
      });
    }

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
      return rejectConsentToken(req, res, {
        statusCode: 404,
        message: 'Invalid or expired consent token.',
        reason: 'not found or already used',
        userId: decoded.userId,
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      decoded.userId,
      {
        status: 'active',
        consentApprovedAt: new Date()
      },
      { returnDocument: 'after' }
    );

    if (!updatedUser) {
      return rejectConsentToken(req, res, {
        statusCode: 404,
        reason: 'student not found',
        userId: decoded.userId,
      });
    }

    const audit = await recordAuditLog({
      actor: 'System Consent Guard',
      actorId: updatedUser._id,
      role: 'System',
      action: 'CONSENT_VERIFIED',
      details: `Guardian consent verified for student ${updatedUser._id}. Account status set to active.`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      severity: 'Info'
    });

    return res.status(200).json(withAuditWarning({
      success: true,
      message: 'Account verified successfully.'
    }, audit));
  } catch (error) {
    console.error('Consent Approval Error:', error.name);
    if (error.name === 'TokenExpiredError') {
      return rejectConsentToken(req, res, {
        message: 'Consent token has expired. Please request a new one.',
        reason: 'expired',
        userId: verifiedConsentUserId(req.body && req.body.token),
      });
    }
    return rejectConsentToken(req, res, {
      message: 'Failed to process authorization token.',
      reason: 'invalid',
    });
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

    const consentLink = `${clientBaseUrl()}/consent/verify?token=${consentToken}`;

    try {
      await emailService.sendParentConsentEmail({
        guardianEmail: targetEmail,
        guardianName: consentRecord.guardianName || 'Parent/Guardian',
        studentName: user.name || 'Student',
        consentLink
      });

      const audit = await recordAuditLog({
        actor: user.name || user.email,
        actorId: user._id,
        role: 'Student',
        action: 'CONSENT_RESENT',
        details: `Student ${user._id} requested a new guardian consent email.`,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
        severity: 'Info'
      });

      return res.status(200).json(withAuditWarning({ success: true, message: 'Consent email resent.' }, audit));
    } catch (mailError) {
      console.error(`[MAILER ERROR] Failed to resend email to ${targetEmail}:`, mailError.message);
      return res.status(500).json({ success: false, message: 'Failed to deliver email through SMTP provider.' });
    }
  } catch (error) {
    console.error('Resend Email Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send email.' });
  }
};