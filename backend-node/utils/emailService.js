const nodemailer = require('nodemailer');

/**
 * Creates and returns a Nodemailer transporter configured via environment variables.
 */
const createTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (!user || !pass) {
    console.warn('⚠️ SMTP credentials not fully configured in .env (SMTP_USER/SMTP_PASS).');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    tls: {
      rejectUnauthorized: false,
    },
  });
};

/**
 * Sends a 6-digit verification OTP email to the user.
 * 
 * @param {string} toEmail - Recipient email address
 * @param {string} otp - 6-digit numeric OTP
 * @returns {Promise<object>} Send result info
 */
const sendVerificationOtpEmail = async (toEmail, otp) => {
  const transporter = createTransporter();
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'CollabNotes <no-reply@collabnotes.com>';

  const mailOptions = {
    from: fromAddress,
    to: toEmail,
    subject: 'Your CollabNotes Verification Code',
    text: `Your CollabNotes email verification code is: ${otp}. This code will expire in 10 minutes. If you did not request this code, please ignore this email.`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 15px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" max-width="520" style="max-width: 520px; background-color: #ffffff; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #e2e8f0;">
                <!-- Header -->
                <tr>
                  <td style="padding: 36px 32px 24px; text-align: center; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);">
                    <span style="font-size: 32px; color: #ffffff;">✦</span>
                    <h1 style="margin: 8px 0 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">CollabNotes</h1>
                    <p style="margin: 4px 0 0; color: #e0e7ff; font-size: 13px;">Real-time Collaborative Workspace</p>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding: 32px;">
                    <h2 style="margin: 0 0 12px; color: #1e293b; font-size: 18px; font-weight: 600;">Verify your email address</h2>
                    <p style="margin: 0 0 24px; color: #64748b; font-size: 14px; line-height: 1.6;">
                      Thank you for joining CollabNotes! Enter the 6-digit verification code below to confirm your email and complete your registration.
                    </p>
                    <!-- OTP Box -->
                    <div style="text-align: center; margin: 28px 0; padding: 20px; background-color: #f1f5f9; border-radius: 12px; border: 1px dashed #cbd5e1;">
                      <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #4f46e5; display: inline-block;">
                        ${otp}
                      </span>
                    </div>
                    <p style="margin: 0 0 16px; color: #dc2626; font-size: 13px; font-weight: 500; text-align: center;">
                      ⏱ This code expires in 10 minutes.
                    </p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                    <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                      If you did not attempt to sign up for CollabNotes, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding: 16px 32px 24px; text-align: center; background-color: #f8fafc; border-top: 1px solid #f1f5f9;">
                    <p style="margin: 0; color: #94a3b8; font-size: 11px;">
                      © ${new Date().getFullYear()} CollabNotes. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };

  return transporter.sendMail(mailOptions);
};

module.exports = {
  sendVerificationOtpEmail,
};
