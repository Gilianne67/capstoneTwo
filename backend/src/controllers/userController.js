const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const emailService = require('../utils/emailService');
const {
  buildVerificationUrl,
  claimVerificationToken,
  restoreVerificationToken,
} = require('../utils/verificationToken');
const { recordAuditLog, withAuditWarning } = require('./auditController');
const { evaluateDateOfBirth } = require('../utils/studentAge');

const SUPPORTED_GWA_SCALES = ['1.00-5.00', '60-100'];

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
      dateOfBirth,
      course,
      academicLevel,
      yearLevel,
      gpa,
      gwaScale,
      region,
      province,
      municipality,
      householdIncome,
    } = req.body;

    const studentUser = await User.findById(userId);
    if (!studentUser) {
      return res.status(404).json({ success: false, message: "User account not found." });
    }

    if (studentUser.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: "Onboarding flow is restricted to student accounts."
      });
    }

    if (studentUser.isOnboarded) {
      return res.status(400).json({
        success: false,
        message: "Account onboarding has already been completed."
      });
    }

    const dobResult = evaluateDateOfBirth(dob || dateOfBirth);
    if (!dobResult.ok) {
      return res.status(400).json({ success: false, message: dobResult.message });
    }

    const birthDate = dobResult.date;

    studentUser.status = 'active';
    studentUser.isOnboarded = true;
    studentUser.dob = birthDate;

    const previousVerificationToken = studentUser.emailVerificationToken;
    const previousVerificationExpire = studentUser.emailVerificationExpire;

    await studentUser.save();

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
        isMinor: false
      },
      {
        returnDocument: 'after',
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    const actorName = studentUser.name || studentUser.email;
    const onboardingAudit = await recordAuditLog({
      actor: actorName,
      actorId: studentUser._id,
      role: 'Student',
      action: 'ONBOARDING_COMPLETE',
      details: `Student ${studentUser._id} completed onboarding profile.`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      severity: 'Info'
    });

    let emailSent;
    let verificationMessage = 'Profile saved and a verification email has been sent.';

    const claimed = await claimVerificationToken(studentUser._id);

    if (claimed.claimed) {
      console.log(`[MAILER] Preparing verification email for student: ${studentUser.email}...`);
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
      emailSent,
      message: verificationMessage,
      user: publicUser
    }, onboardingAudit));

  } catch (error) {
    console.error('Onboarding Server Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process onboarding.' });
  }
};
