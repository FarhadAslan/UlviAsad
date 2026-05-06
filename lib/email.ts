import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string
) {
  const baseUrl   = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const resetLink = `${baseUrl}/auth/parol-yenile?token=${token}`;

  await transporter.sendMail({
    from:    `"${process.env.SMTP_FROM_NAME ?? "Ulvi Asad"}" <${process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER}>`,
    to,
    subject: "Parol Sıfırlama",
    html: `
<!DOCTYPE html>
<html lang="az">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a7fe0,#93ccff);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Ulvi Asad</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">İnteraktiv Təhsil Platforması</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="margin:0 0 12px;color:#0f172a;font-size:20px;font-weight:700;">Salam, ${name}!</h2>
            <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
              Hesabınız üçün parol sıfırlama tələbi aldıq. Aşağıdakı düyməyə klikləyərək yeni parol təyin edə bilərsiniz.
            </p>
            <div style="text-align:center;margin:28px 0;">
              <a href="${resetLink}"
                style="display:inline-block;background:linear-gradient(135deg,#1a7fe0,#1565c0);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:0.2px;">
                Parolu Sıfırla
              </a>
            </div>
            <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;">
              Düymə işləmirsə, bu linki brauzerinizə kopyalayın:
            </p>
            <p style="margin:0 0 24px;word-break:break-all;">
              <a href="${resetLink}" style="color:#1a7fe0;font-size:13px;">${resetLink}</a>
            </p>
            <div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;">
              <p style="margin:0;color:#92400e;font-size:13px;">
                ⚠️ Bu link <strong>1 saat</strong> ərzində etibarlıdır. Əgər bu tələbi siz göndərməmisinizsə, bu emaili nəzərə almayın.
              </p>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">© 2025 Ulvi Asad. Bütün hüquqlar qorunur.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}
