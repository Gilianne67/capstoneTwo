const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

    return res.status(200).json({
      success: true,
      student
    });

  } catch (error) {
    console.error('Consent Verification Error:', error);
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

    // Find user and activate account
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
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Account successfully authorized and activated.'
    });

  } catch (error) {
    console.error('Consent Approval Error:', error);
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid or expired token. Consent could not be granted.' 
    });
  }
};