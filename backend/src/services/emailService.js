import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';

// 1. Configure SMTP Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: Number(process.env.SMTP_PORT) === 465 || true, // SSL for 465, TLS for 587
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

// Verify connection configuration on server startup
transporter.verify((error) => {
  if (error) {
    console.error('❌ SMTP Connection Error:', error.message);
  } else {
    console.log('✅ SMTP Transporter is ready to send emails');
  }
});

/**
 * Optional Helper: Generate token directly inside email module if needed.
 */
export const generateConsentToken = (userId, guardianEmail) => {
  return jwt.sign(
    { userId, guardianEmail, purpose: 'parental_consent' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * Send Parental Consent Email
 * Accepts consentLink generated from the controller, or falls back to creating one.
 */
export const sendParentConsentEmail = async ({ 
  guardianEmail, 
  guardianName = 'Parent/Guardian', 
  studentName = 'Student', 
  consentLink,
  userId 
}) => {
  try {
    // Determine link: use passed consentLink or compute fallback using JWT helper
    let finalConsentUrl = consentLink;

    if (!finalConsentUrl) {
      if (!userId) {
        throw new Error('Either consentLink or userId must be provided.');
      }
      const token = generateConsentToken(userId, guardianEmail);
      const frontendUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
      finalConsentUrl = `${frontendUrl}/consent/verify?token=${token}`;
    }

    const mailOptions = {
      from: `"${process.env.FROM_NAME || 'IskolarMatch Support'}" <${process.env.FROM_EMAIL || process.env.SMTP_EMAIL}>`,
      to: guardianEmail,
      subject: `Parental Consent Required for ${studentName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
          <h2 style="color: #2563eb;">Parental Consent Verification</h2>
          <p>Hello ${guardianName},</p>
          <p>Your child, <strong>${studentName}</strong>, registered an account on <strong>IskolarMatch</strong>.</p>
          <p>In compliance with Republic Act No. 10173 (Data Privacy Act), we require parental consent to activate their profile and match them with scholarship opportunities.</p>
          
          <div style="margin: 30px 0;">
            <a href="${finalConsentUrl}" 
               style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Approve & Grant Consent
            </a>
          </div>

          <p style="font-size: 12px; color: #666;">
            This link will expire in 7 days. If you did not request this, you can safely ignore this email.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Parent Consent Email sent! Message ID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`❌ Error sending consent email to ${guardianEmail}:`, error.message);
    throw new Error(`Email delivery failed: ${error.message}`);
  }
};