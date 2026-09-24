const nodemailer = require('nodemailer');


/**
 * Core transporter helper function
 */
const createTransporter = () => {
  const user = process.env.SMTP_EMAIL || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASSWORD || process.env.EMAIL_PASS;

  if (!user || !pass) {
    throw new Error('SMTP credentials missing. Please set SMTP_EMAIL and SMTP_PASSWORD in your .env file.');
  }

  const port = parseInt(process.env.SMTP_PORT || '587', 10);

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: port,
    secure: port === 465, // True for 465, false for 587
    auth: { user, pass },
  });
};

/**
 * 1. General Purpose / Student Email Sender
 */
const sendEmail = async (options) => {
  const transporter = createTransporter();
  const user = process.env.SMTP_EMAIL || process.env.EMAIL_USER;

  const message = {
    from: `${process.env.FROM_NAME || 'IskolarMatch'} <${process.env.FROM_EMAIL || user}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  return await transporter.sendMail(message);
};

/**
 * 2. Provider Onboarding Notification (Sent TO ADMIN)
 */
const sendProviderAdminNotification = async (providerData = {}, fileInfo = null) => {
  const transporter = createTransporter();
  const user = process.env.SMTP_EMAIL || process.env.EMAIL_USER;
  const adminEmail = process.env.ADMIN_EMAIL || user;

  const rawWebsite = providerData.website || '';
  const formattedWebsite = rawWebsite
    ? (rawWebsite.startsWith('http') ? rawWebsite : `https://${rawWebsite}`)
    : null;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #064e3b; margin-top: 0; border-bottom: 2px solid #064e3b; padding-bottom: 10px;">
        🏛️ New Scholarship Provider Onboarding
      </h2>
      <p style="color: #475569; font-size: 14px;">
        A new scholarship provider has submitted their verification details and is awaiting your approval.
      </p>

      <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px;">
        <tr style="background-color: #f8fafc;">
          <th colspan="2" style="text-align: left; padding: 8px 12px; color: #064e3b; font-size: 15px;">1. Organization Details</th>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; width: 40%; border-bottom: 1px solid #f1f5f9;">Institution Name:</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9;">${providerData.institutionName || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #f1f5f9;">Type:</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9;">${providerData.institutionType || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #f1f5f9;">Website:</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9;">
            ${formattedWebsite ? `<a href="${formattedWebsite}" target="_blank" style="color: #2563eb;">${rawWebsite}</a>` : 'N/A'}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #f1f5f9;">Contact Number:</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9;">${providerData.contactNumber || 'N/A'}</td>
        </tr>

        <tr style="background-color: #f8fafc;">
          <th colspan="2" style="text-align: left; padding: 8px 12px; color: #064e3b; font-size: 15px;">2. Authorized Representative</th>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #f1f5f9;">Representative Name:</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9;">${providerData.repName || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #f1f5f9;">Job Title:</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9;">${providerData.repTitle || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #f1f5f9;">Work Email:</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9;">${providerData.repEmail || 'N/A'}</td>
        </tr>

        <tr style="background-color: #f8fafc;">
          <th colspan="2" style="text-align: left; padding: 8px 12px; color: #064e3b; font-size: 15px;">3. Submitted Documents</th>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #f1f5f9;">Document Type:</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9;">${providerData.documentType || 'N/A'}</td>
        </tr>
      </table>

      <div style="margin-top: 24px; padding: 16px; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; text-align: center;">
        <p style="margin: 0; font-size: 13px; color: #065f46;">
          Please log into your <strong>IskolarMatch Admin Dashboard</strong> to review these details and approve or reject this organization.
        </p>
      </div>
    </div>
  `;

  const mailOptions = {
    from: `${process.env.FROM_NAME || 'IskolarMatch System'} <${process.env.FROM_EMAIL || user}>`,
    to: adminEmail,
    subject: `🚨 [Action Required] Provider Registration: ${providerData.institutionName || 'New Provider'}`,
    html: htmlContent,
  };

  if (fileInfo && fileInfo.path) {
    mailOptions.attachments = [
      {
        filename: fileInfo.originalname || 'verification-document',
        path: fileInfo.path,
      },
    ];
  }

  return await transporter.sendMail(mailOptions);
};

/**
 * 3. Provider Onboarding Confirmation (Sent TO PROVIDER)
 */
const sendProviderConfirmation = async (repEmail, repName, institutionName) => {
  const transporter = createTransporter();
  const user = process.env.SMTP_EMAIL || process.env.EMAIL_USER;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #064e3b; margin-top: 0;">Verification Details Received</h2>
      <p style="color: #334155; font-size: 14px;">Dear ${repName || 'Partner'},</p>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">
        Thank you for submitting the verification details for <strong>${institutionName || 'your organization'}</strong> on IskolarMatch.
      </p>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">
        Our administration team is currently reviewing your application and verification documents. Verification usually takes <strong>1–2 business days</strong>.
      </p>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">
        You will receive another email once your account has been reviewed and activated.
      </p>
      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">&copy; ${new Date().getFullYear()} IskolarMatch. All rights reserved.</p>
    </div>
  `;

  return await transporter.sendMail({
    from: `${process.env.FROM_NAME || 'IskolarMatch'} <${process.env.FROM_EMAIL || user}>`,
    to: repEmail,
    subject: 'IskolarMatch - Verification Request Received',
    html: htmlContent,
  });
};

module.exports = {
  sendEmail,
  sendProviderAdminNotification,
  sendProviderConfirmation,
};