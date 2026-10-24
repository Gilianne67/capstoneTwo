// backend/src/utils/emailService.js
const { Resend } = require('resend');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const JWT_SECRET = process.env.JWT_SECRET || 'iskolarmatch_fallback_secret_key';

/**
 * 🔑 Safely initialize Resend at runtime (prevents dotenv load order bugs)
 */
const getResendClient = () => {
  const rawKey = process.env.RESEND_API_KEY;

console.log('🔍 [DEBUG KEY INSPECTION]:', {
    hasKey: Boolean(rawKey),
    length: rawKey.length,
    firstChars: rawKey.substring(0, 8), 
    lastChars: rawKey.slice(-4)
  });

  const apiKey = rawKey ? rawKey.trim().replace(/^["']|["']$/g, '') : '';
  
  if (!apiKey) {
    console.error('❌ [Resend Error]: RESEND_API_KEY is missing or empty in environment variables!');
  }
  return new Resend(apiKey);
};

/**
 * 🛡️ Helper to validate Resend API responses and throw errors properly
 */
const handleResendResponse = (response, emailType, targetEmail) => {
  if (response.error) {
    console.error(`❌ [Resend API Error - ${emailType} to ${targetEmail}]:`, response.error);
    throw new Error(`Resend Error (${response.error.name}): ${response.error.message}`);
  }
  console.log(`✅ [Resend Success - ${emailType}]: Dispatched to ${targetEmail} (ID: ${response.data?.id})`);
  return response.data;
};

/**
 * Generate parental consent token helper
 */
const generateConsentToken = (userId, guardianEmail) => {
  return jwt.sign(
    { userId, guardianEmail, purpose: 'parental_consent' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * 1. Send Parental Consent Email
 */
const sendParentConsentEmail = async ({ guardianEmail, guardianName = 'Parent/Guardian', studentName = 'Student', consentLink, userId }) => {
  try {
    const resend = getResendClient();
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

    const response = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'IskolarMatch Support <onboarding@resend.dev>',
      to: [guardianEmail],
      subject: `Parental Consent Request for ${studentName}`,
      html: htmlTemplate,
    });

    return handleResendResponse(response, 'Parental Consent', guardianEmail);
  } catch (error) {
    console.error(`❌ Error sending consent email to ${guardianEmail}:`, error.message);
    throw new Error(`Email delivery failed: ${error.message}`);
  }
};

/**
 * 2. Send Email Verification for Adult Students
 */
const sendVerificationEmail = async (email, name, verifyUrl) => {
  try {
    const resend = getResendClient();
    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #2563eb; margin-top: 0;">Verify Your IskolarMatch Account</h2>
        <p style="color: #334155; font-size: 14px;">Hi ${name || 'Student'},</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Welcome to IskolarMatch! Please click the button below to verify your email address and activate your account.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${verifyUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 14px;">Verify Email Address</a>
        </div>
        <p style="color: #64748b; font-size: 12px; line-height: 1.5;">
          If you did not request this verification, please ignore this email. This link will expire in 2 hours.
        </p>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">&copy; ${new Date().getFullYear()} IskolarMatch. All rights reserved.</p>
      </div>
    `;

    const response = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'IskolarMatch Support <onboarding@resend.dev>',
      to: [email],
      subject: 'Verify Your IskolarMatch Account',
      html: htmlTemplate,
    });

    return handleResendResponse(response, 'Verification Email', email);
  } catch (error) {
    console.error(`❌ Error sending verification email to ${email}:`, error.message);
    throw new Error(`Email delivery failed: ${error.message}`);
  }
};

/**
 * 3. Send Account Security Lockout Notification
 */
const sendAccountLockoutEmail = async (email, name, unlockUrl) => {
  try {
    const resend = getResendClient();
    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #dc2626; margin-top: 0;">Account Security Alert</h2>
        <p style="color: #334155; font-size: 14px;">Hi ${name || 'User'},</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Your IskolarMatch account has been temporarily locked due to multiple consecutive failed login attempts.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${unlockUrl}" style="background-color: #dc2626; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 14px;">Unlock Account</a>
        </div>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">&copy; ${new Date().getFullYear()} IskolarMatch. All rights reserved.</p>
      </div>
    `;

    const response = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'IskolarMatch Security <onboarding@resend.dev>',
      to: [email],
      subject: 'Security Alert: Account Temporarily Locked',
      html: htmlTemplate,
    });

    return handleResendResponse(response, 'Account Lockout', email);
  } catch (error) {
    console.error(`❌ Error sending lockout email to ${email}:`, error.message);
    throw new Error(`Email delivery failed: ${error.message}`);
  }
};

/**
 * 4. Provider Onboarding Notification (Sent TO ADMIN with attachments)
 */
const sendProviderAdminNotification = async (providerData = {}, fileInfo = null) => {
  try {
    const resend = getResendClient();
    const adminEmail = process.env.ADMIN_EMAIL || process.env.FROM_EMAIL || 'onboarding@resend.dev';
    const rawWebsite = providerData.website || '';
    const formattedWebsite = rawWebsite ? (rawWebsite.startsWith('http') ? rawWebsite : `https://${rawWebsite}`) : null;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #064e3b; margin-top: 0; border-bottom: 2px solid #064e3b; padding-bottom: 10px;">
          🏛️ New Scholarship Provider Onboarding
        </h2>
        <p style="color: #475569; font-size: 14px;">A new scholarship provider has submitted verification details and is awaiting review.</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px;">
          <tr><td style="padding: 8px; font-weight: bold;">Institution:</td><td>${providerData.institutionName || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Representative:</td><td>${providerData.repName || 'N/A'} (${providerData.repEmail || 'N/A'})</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Website:</td><td>${formattedWebsite ? `<a href="${formattedWebsite}">${rawWebsite}</a>` : 'N/A'}</td></tr>
        </table>
      </div>
    `;

    const payload = {
      from: process.env.FROM_EMAIL || 'IskolarMatch System <onboarding@resend.dev>',
      to: [adminEmail],
      subject: `🚨 [Action Required] Provider Registration: ${providerData.institutionName || 'New Provider'}`,
      html: htmlContent,
    };

    if (fileInfo && fileInfo.path) {
      const fileBuffer = fs.readFileSync(fileInfo.path);
      payload.attachments = [
        {
          filename: fileInfo.originalname || 'verification-document',
          content: fileBuffer,
        },
      ];
    }

    const response = await resend.emails.send(payload);
    return handleResendResponse(response, 'Provider Admin Notification', adminEmail);
  } catch (error) {
    console.error(`❌ Error sending provider admin notification:`, error.message);
    throw new Error(`Email delivery failed: ${error.message}`);
  }
};

/**
 * 5. Provider Onboarding Confirmation (Sent TO PROVIDER)
 */
const sendProviderConfirmation = async (repEmail, repName, institutionName) => {
  try {
    const resend = getResendClient();
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #064e3b; margin-top: 0;">Verification Details Received</h2>
        <p style="color: #334155; font-size: 14px;">Dear ${repName || 'Partner'},</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Thank you for submitting verification details for <strong>${institutionName || 'your organization'}</strong> on IskolarMatch. Our team is reviewing your application.
        </p>
      </div>
    `;

    const response = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'IskolarMatch Support <onboarding@resend.dev>',
      to: [repEmail],
      subject: 'IskolarMatch - Verification Request Received',
      html: htmlContent,
    });

    return handleResendResponse(response, 'Provider Confirmation', repEmail);
  } catch (error) {
    console.error(`❌ Error sending provider confirmation:`, error.message);
    throw new Error(`Email delivery failed: ${error.message}`);
  }
};

module.exports = {
  generateConsentToken,
  sendParentConsentEmail,
  sendVerificationEmail,
  sendAccountLockoutEmail,
  sendProviderAdminNotification,
  sendProviderConfirmation,
};