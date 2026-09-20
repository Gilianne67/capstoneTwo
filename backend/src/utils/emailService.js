const sendEmail = require('./sendEmail');

/**
 * Sends parental consent email to guardian
 */
const sendParentConsentEmail = async ({ guardianEmail, guardianName, studentName, consentLink }) => {
  const htmlTemplate = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #4F46E5;">Parental Consent Request</h2>
      <p>Dear ${guardianName},</p>
      <p>Your dependent, <strong>${studentName}</strong>, has requested account verification on <strong>IskolarMatch</strong>.</p>
      <p>To approve their account setup and allow them to apply for scholarships, please click the verification button below:</p>
      <p style="margin: 30px 0; text-align: center;">
        <a href="${consentLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Approve & Verify Account
        </a>
      </p>
      <p style="font-size: 12px; color: #666;">If the button doesn't work, copy and paste this link into your browser:<br/><a href="${consentLink}">${consentLink}</a></p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 11px; color: #999;">If you did not request this, please ignore this email.</p>
    </div>
  `;

  return await sendEmail({
    email: guardianEmail,
    subject: `Parental Consent Request for ${studentName} - IskolarMatch`,
    message: `Dear ${guardianName}, Please verify ${studentName}'s account by visiting: ${consentLink}`,
    html: htmlTemplate,
  });
};

module.exports = {
  sendParentConsentEmail,
};