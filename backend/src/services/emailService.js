import { Resend } from 'resend';
import jwt from 'jsonwebtoken';

// Initialize Resend using your API key from Railway environment variables
const resend = new Resend(process.env.RESEND_API_KEY);

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
 * Send Parental Consent Email via Resend HTTPS API (Bypasses Railway SMTP block)
 */
export const sendParentConsentEmail = async ({ 
  guardianEmail, 
  guardianName = 'Parent/Guardian', 
  studentName = 'Student', 
  consentLink,
  userId 
}) => {
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

    const htmlContent = `
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
    `;

    const data = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'IskolarMatch Support <onboarding@resend.dev>',
      to: [guardianEmail],
      subject: `Parental Consent Required for ${studentName}`,
      html: htmlContent,
    });

    console.log(`✅ Parent Consent Email sent via Resend! ID:`, data);
    return data;
  } catch (error) {
    console.error(`❌ Error sending consent email to ${guardianEmail}:`, error.message);
    throw new Error(`Email delivery failed: ${error.message}`);
  }
};