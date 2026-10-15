// backend/src/utils/emailService.js
const { Resend } = require('resend');
const jwt = require('jsonwebtoken');

const resend = new Resend(process.env.RESEND_API_KEY);
const JWT_SECRET = process.env.JWT_SECRET || 'iskolarmatch_fallback_secret_key';

/**
 * Generate parental consent token
 */
const generateConsentToken = (userId, guardianEmail) => {
  return jwt.sign(
    { userId, guardianEmail, purpose: 'parental_consent' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * Send Parental Consent Email via Resend HTTPS API
 */
const sendParentConsentEmail = async ({ guardianEmail, guardianName = 'Parent/Guardian', studentName = 'Student', consentLink, userId }) => {
  try {
    let finalConsentUrl = consentLink;

    if (!finalConsentUrl) {
      if (!userId) {
        throw new Error('Either consentLink or userId must be provided.');
      }
      const token = generateConsentToken(userId, guardianEmail);
      const frontendUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
      finalConsentUrl = `${frontendUrl}/consent/verify?token=${token}`;
    }

    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #4F46E5;">Parental Consent Request</h2>
        <p>Dear ${guardianName},</p>
        <p>Your dependent, <strong>${studentName}</strong>, has requested account verification on <strong>IskolarMatch</strong>.</p>
        <p>To approve their account setup and allow them to apply for scholarships, please click the verification button below:</p>
        <p style="margin: 30px 0; text-align: center;">
          <a href="${finalConsentUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Approve & Verify Account
          </a>
        </p>
        <p style="font-size: 12px; color: #666;">If the button doesn't work, copy and paste this link into your browser:<br/><a href="${finalConsentUrl}">${finalConsentUrl}</a></p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 11px; color: #999;">If you did not request this, please ignore this email.</p>
      </div>
    `;

    const data = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'IskolarMatch Support <onboarding@resend.dev>',
      to: [guardianEmail],
      subject: `Parental Consent Request for ${studentName}`,
      html: htmlTemplate,
    });

    console.log(`✅ Parent Consent Email sent via Resend! ID:`, data);
    return data;
  } catch (error) {
    console.error(`❌ Error sending consent email to ${guardianEmail}:`, error.message);
    throw new Error(`Email delivery failed: ${error.message}`);
  }
};

/**
 * Send Email Verification for Adult Students via Resend HTTPS API
 */
const sendVerificationEmail = async (email, name, verifyUrl) => {
  try {
    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #4F46E5;">Verify Your Email Address</h2>
        <p>Hello ${name},</p>
        <p>Thank you for registering on <strong>IskolarMatch</strong>. Please click the button below to verify your email address:</p>
        <p style="margin: 30px 0; text-align: center;">
          <a href="${verifyUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Verify Email
          </a>
        </p>
        <p style="font-size: 12px; color: #666;">If the button doesn't work, copy and paste this link into your browser:<br/><a href="${verifyUrl}">${verifyUrl}</a></p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 11px; color: #999;">If you did not request this, please ignore this email.</p>
      </div>
    `;

    const data = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'IskolarMatch Support <onboarding@resend.dev>',
      to: [email],
      subject: 'Verify Your IskolarMatch Account',
      html: htmlTemplate,
    });

    console.log(`✅ Verification Email sent via Resend! ID:`, data);
    return data;
  } catch (error) {
    console.error(`❌ Error sending verification email to ${email}:`, error.message);
    throw new Error(`Email delivery failed: ${error.message}`);
  }
};

module.exports = {
  sendParentConsentEmail,
  sendVerificationEmail,
};