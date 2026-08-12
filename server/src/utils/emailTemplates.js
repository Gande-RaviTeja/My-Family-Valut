/**
 * Generates a modern, responsive HTML email template for email verification.
 */
export function generateVerificationEmailHTML({ name, verificationUrl }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - My Home</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1E293B;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #F8FAFC;
      padding: 40px 0;
    }
    .main-table {
      margin: 0 auto;
      width: 100%;
      max-width: 560px;
      background-color: #FFFFFF;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
      border: 1px solid #E2E8F0;
    }
    .header {
      background: linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%);
      padding: 36px 32px;
      text-align: center;
    }
    .brand-icon {
      display: inline-block;
      width: 56px;
      height: 56px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 14px;
      line-height: 56px;
      font-size: 30px;
      margin-bottom: 12px;
    }
    .header-title {
      color: #FFFFFF;
      font-size: 26px;
      font-weight: 800;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .header-subtitle {
      color: rgba(255, 255, 255, 0.85);
      font-size: 13px;
      font-weight: 600;
      margin: 6px 0 0;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .content {
      padding: 36px 32px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 700;
      color: #0F172A;
      margin-bottom: 12px;
    }
    .text {
      font-size: 15px;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 28px;
    }
    .cta-container {
      text-align: center;
      margin: 32px 0;
    }
    .cta-button {
      display: inline-block;
      background: #7C3AED;
      color: #FFFFFF !important;
      font-weight: 700;
      font-size: 15px;
      padding: 14px 32px;
      border-radius: 12px;
      text-decoration: none;
      box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35);
      transition: all 0.2s ease;
    }
    .info-box {
      background: #F1F5F9;
      border-left: 4px solid #7C3AED;
      padding: 14px 16px;
      border-radius: 8px;
      font-size: 13px;
      color: #475569;
      margin-bottom: 24px;
    }
    .footer {
      background-color: #F8FAFC;
      padding: 24px 32px;
      text-align: center;
      border-top: 1px solid #E2E8F0;
      font-size: 12px;
      color: #94A3B8;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main-table" cellpadding="0" cellspacing="0">
      <tr>
        <td class="header">
          <div class="brand-icon">🏡</div>
          <h1 class="header-title">My Home</h1>
          <p class="header-subtitle">Private Family Digital Vault</p>
        </td>
      </tr>
      <tr>
        <td class="content">
          <div class="greeting">Hello ${name || "Family Member"},</div>
          <p class="text">
            Thank you for creating your household portal! Please verify your email address to activate your account and gain secure access to your private family vault.
          </p>
          
          <div class="cta-container">
            <a href="${verificationUrl}" class="cta-button">Verify Email Address ➔</a>
          </div>

          <div class="info-box">
            <strong>🔒 Security Note:</strong> If you did not sign up for a My Home account, you can safely ignore this email.
          </div>
        </td>
      </tr>
      <tr>
        <td class="footer">
          <p style="margin: 0;">© ${new Date().getFullYear()} My Home — Your Private Family Digital Vault & Finances Portal</p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `;
}

export function generateInvitationEmailHTML({ familyName, inviterName, inviteUrl }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>You're Invited to Join a Family - My Home</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #1E293B;">
  <div style="padding: 40px 0; width: 100%; background-color: #F8FAFC;">
    <table cellpadding="0" cellspacing="0" style="margin: 0 auto; width: 100%; max-width: 560px; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid #E2E8F0;">
      <tr>
        <td style="background: linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%); padding: 36px 32px; text-align: center; color: #FFFFFF;">
          <div style="font-size: 32px; margin-bottom: 8px;">🏡</div>
          <h1 style="font-size: 24px; font-weight: 800; margin: 0;">You're Invited to Join a Family</h1>
          <p style="font-size: 13px; margin: 6px 0 0; opacity: 0.9;">My Home — Private Family Vault</p>
        </td>
      </tr>
      <tr>
        <td style="padding: 36px 32px;">
          <div style="font-size: 18px; font-weight: 700; color: #0F172A; margin-bottom: 12px;">You've Been Invited!</div>
          <p style="font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
            <strong>${inviterName || "A family admin"}</strong> has invited you to join <strong>"${familyName || "their Family Vault"}"</strong> on My Home.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${inviteUrl}" style="background: #7C3AED; color: #FFFFFF !important; font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 12px; text-decoration: none; display: inline-block;">
              Accept Invitation ➔
            </a>
          </div>
          <p style="font-size: 13px; color: #94A3B8; text-align: center;">
            Or copy and paste this link into your browser:<br/>
            <a href="${inviteUrl}" style="color: #7C3AED; word-break: break-all;">${inviteUrl}</a>
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding: 24px 32px; text-align: center; background-color: #F8FAFC; border-top: 1px solid #E2E8F0; font-size: 12px; color: #94A3B8;">
          © ${new Date().getFullYear()} My Home — Private Family Vault
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `;
}
