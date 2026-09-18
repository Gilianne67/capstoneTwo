// POST /api/v1/user/consent/resend
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

    // 1. Generate new consent token
    const consentToken = jwt.sign(
      { 
        userId: user._id, 
        guardianEmail: targetEmail,
        purpose: 'parental_consent' 
      },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    // 2. Direct atomic update without triggering strict save/pre-hooks
    await User.findByIdAndUpdate(
      user._id, 
      { consentToken, guardianEmail: targetEmail },
      { returnDocument: 'after', validateBeforeSave: false }
    );

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