import nodemailer from "nodemailer";

/**
 * Sends transactional email automatically via SMTP (Gmail / Outlook) or Resend API.
 */
export async function sendEmail({ to, subject, html }) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const apiKey = process.env.EMAIL_API_KEY;

  // 1. SMTP Transport (Gmail App Password, Outlook, or custom SMTP)
  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || `"My Home Portal" <${smtpUser}>`,
        to: Array.isArray(to) ? to.join(",") : to,
        subject,
        html,
      });

      console.log(`✉️ [REAL SMTP EMAIL SENT] To: ${to} | Message ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error(`⚠️ SMTP Email Error: ${err.message}`);
    }
  }

  // 2. Resend API Transport (if EMAIL_API_KEY is provided in .env)
  if (apiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "My Home Portal <onboarding@resend.dev>",
          to: Array.isArray(to) ? to : [to],
          subject,
          html,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        console.log(`✉️ [RESEND API EMAIL SENT] To: ${to} | ID: ${data.id}`);
        return { success: true, id: data.id };
      } else {
        console.warn(`⚠️ Resend API Warning for ${to}:`, data);
      }
    } catch (err) {
      console.error(`⚠️ Resend Email Error: ${err.message}`);
    }
  }

  // 3. Simulated Fallback (when no SMTP credentials or API key are set in server/.env)
  console.log(`\n==================================================`);
  console.log(`✉️ [SIMULATED BACKEND EMAIL (No SMTP Credentials in .env)]`);
  console.log(`TO: ${to}`);
  console.log(`SUBJECT: ${subject}`);
  console.log(`💡 To send REAL emails directly to inboxes, add SMTP credentials to server/.env:`);
  console.log(`   SMTP_USER=your_email@gmail.com`);
  console.log(`   SMTP_PASS=your_gmail_app_password`);
  console.log(`==================================================\n`);

  return { success: true, simulated: true };
}
