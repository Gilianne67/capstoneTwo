const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { recordAuditLog } = require('./auditController');
const { sendVerificationEmail } = require('../utils/sendEmail');

// Helper: Generate and save cryptographic email verification token (expires in 2 hours)
const generateVerificationToken = async (user) => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  user.emailVerificationToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');
  user.emailVerificationExpire = Date.now() + 2 * 60 * 60 * 1000; // 2 Hours
  await user.save({ validateBeforeSave: false });
  return rawToken;
};

// GET /api/v1/consent/verify?token=...
exports.verifyConsentToken = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ 
        success: false, 
        message: 'Verification token is missing.' 
      });
    }

    // Verify and decode JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.purpose !== 'parental_consent') {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid token purpose.' 
      });
    }

    // Find student by ID embedded in token payload
    const student = await User.findById(decoded.userId).select('name email course yearLevel region status');

    if (!student) {
      return res.status(404).json({ 
        success: false, 
        message: 'Associated student account not found.' 
      });
    }

    // 📝 AUDIT LOG: Consent Token Inspected
    await recordAuditLog({
      actor: 'System Consent Guard',
      role: 'System',
      action: 'CONSENT_TOKEN_INSPECTED',
      details: `Parent/Guardian initiated verification for Student ID #${student._id}`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      severity: 'Info'
    });

    return res.status(200).json({
      success: true,
      student
    });

  } catch (error) {
    console.error('Consent Verification Error:', error);

    await recordAuditLog({
      actor: 'System Consent Guard',
      role: 'System',
      action: 'SECURITY_ALERT',
      details: 'Attempted parental consent verification with an invalid or expired token.',
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      severity: 'Warning'
    });

    return res.status(400).json({ 
      success: false, 
      message: 'Token is invalid or has expired.' 
    });
  }
};

// POST /api/v1/consent/approve
exports.approveConsent = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ 
        success: false, 
        message: 'Consent token is required.' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.purpose !== 'parental_consent') {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid token purpose.' 
      });
    }

    // Find user and activate account status, then trigger email verification
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User account not found.' 
      });
    }

    user.status = 'active';
    user.consentApprovedAt = new Date();
    user.consentToken = null; // Invalidate used token
    
    // Generate email verification token and trigger student inbox verification
    const rawVerificationToken = await generateVerificationToken(user);
    const verifyUrl = `${process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email/${rawVerificationToken}`;

    try {
      if (typeof sendVerificationEmail === 'function') {
        await sendVerificationEmail(user.email, user.name, verifyUrl);
      } else {
        console.warn('⚠️ sendVerificationEmail utility function is missing.');
      }
    } catch (emailErr) {
      console.error('⚠️ Failed to dispatch post-consent verification email:', emailErr.message);
    }

    await user.save();

    // 📝 AUDIT LOG: Minor Consent Verified & Granted + Verification Dispatched
    await recordAuditLog({
      actor: 'System Consent Guard',
      role: 'System',
      action: 'CONSENT_VERIFIED',
      details: `Minor Consent verified, account activated, and email verification sent for Student ID #${user._id} (${user.email}).`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      severity: 'Info'
    });

    return res.status(200).json({
      success: true,
      message: 'Account successfully authorized and email verification link sent.'
    });

  } catch (error) {
    console.error('Consent Approval Error:', error);

    await recordAuditLog({
      actor: 'System Consent Guard',
      role: 'System',
      action: 'SECURITY_ALERT',
      details: 'Failed consent approval attempt due to invalid or expired token.',
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      severity: 'Warning'
    });

    return res.status(400).json({ 
      success: false, 
      message: 'Invalid or expired token. Consent could not be granted.' 
    });
  }
};