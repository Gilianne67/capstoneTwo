const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false, // true for port 465, false for port 587
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

async function testEmail() {
  try {
    console.log('Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP Connection Successful!');

    const info = await transporter.sendMail({
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: process.env.SMTP_EMAIL, // Sends test email to yourself
      subject: 'IskolarMatch SMTP Test',
      text: 'If you receive this, your Nodemailer Gmail SMTP setup is working correctly!',
    });

    console.log('✅ Test Email Sent! Message ID:', info.messageId);
  } catch (error) {
    console.error('❌ Email Delivery Failed:', error.message);
  }
}

testEmail();