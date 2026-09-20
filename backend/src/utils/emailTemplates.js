// utils/emailTemplates.js

// 1. Email sent to the IskolarMatch Admin Team
export const adminNotificationTemplate = (providerData, docUrl) => `
  <div style="font-family: Arial, sans-serif; color: #111827; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; rounded-lg: 12px;">
    <h2 style="color: #064e3b; margin-bottom: 8px;">New Provider Verification Request</h2>
    <p style="font-size: 14px; color: #4b5563;">A new scholarship provider has completed their onboarding profile and requires verification.</p>

    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 16px 0;" />

    <h3 style="font-size: 16px; color: #111827; margin-bottom: 8px;">Organization Details</h3>
    <ul style="font-size: 14px; color: #374151; padding-left: 20px; line-height: 1.6;">
      <li><strong>Institution Name:</strong> ${providerData.institutionName}</li>
      <li><strong>Type:</strong> ${providerData.institutionType}</li>
      <li><strong>Website:</strong> <a href="${providerData.website}" target="_blank">${providerData.website}</a></li>
      <li><strong>Contact Number:</strong> ${providerData.contactNumber}</li>
    </ul>

    <h3 style="font-size: 16px; color: #111827; margin-bottom: 8px;">Representative Details</h3>
    <ul style="font-size: 14px; color: #374151; padding-left: 20px; line-height: 1.6;">
      <li><strong>Name:</strong> ${providerData.repName}</li>
      <li><strong>Title:</strong> ${providerData.repTitle}</li>
      <li><strong>Email:</strong> ${providerData.repEmail}</li>
    </ul>

    <h3 style="font-size: 16px; color: #111827; margin-bottom: 8px;">Verification Document</h3>
    <p style="font-size: 14px;"><strong>Document Type:</strong> ${providerData.documentType}</p>
    ${docUrl ? `<p style="font-size: 14px;"><a href="${docUrl}" style="color: #064e3b; font-weight: bold;" target="_blank">📄 View Uploaded Document</a></p>` : ''}

    <div style="margin-top: 24px; padding: 12px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; text-align: center;">
      <p style="font-size: 12px; color: #166534; margin: 0;">Log into the IskolarMatch Admin Dashboard to review and approve or reject this application.</p>
    </div>
  </div>
`;

// 2. Email sent to the Provider as confirmation
export const providerConfirmationTemplate = (repName, institutionName) => `
  <div style="font-family: Arial, sans-serif; color: #111827; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; rounded-lg: 12px;">
    <h2 style="color: #064e3b; margin-bottom: 8px;">We Received Your Verification Documents</h2>
    <p style="font-size: 14px; color: #374151;">Dear ${repName},</p>
    <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">
      Thank you for submitting the verification details for <strong>${institutionName}</strong> on IskolarMatch.
    </p>
    <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">
      Our team is currently reviewing your documents to verify your organization's eligibility. Approval typically takes <strong>1–2 business days</strong>.
    </p>
    <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">
      You will receive another email once your account has been reviewed and activated.
    </p>
    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
    <p style="font-size: 12px; color: #9ca3af;">IskolarMatch Team &copy; ${new Date().getFullYear()}</p>
  </div>
`;