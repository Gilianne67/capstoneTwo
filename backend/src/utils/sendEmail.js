const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const user = process.env.SMTP_EMAIL || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASSWORD || process.env.EMAIL_PASS;

  if (!user || !pass) {
    throw new Error('SMTP credentials missing. Please set SMTP_EMAIL and SMTP_PASSWORD in your .env file.');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
    auth: { user, pass },
  });

  const message = {
    from: `${process.env.FROM_NAME || 'IskolarMatch'} <${process.env.FROM_EMAIL || user}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  return await transporter.sendMail(message);
};

module.exports = sendEmail;