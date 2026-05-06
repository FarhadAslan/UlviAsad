import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  // Yalnız development-da işləsin
  if (process.env.NODE_ENV === "production") {
    // Production-da da yoxlamaq üçün açıq buraxırıq — test bitdikdən sonra siləcəyik
  }

  const host   = process.env.SMTP_HOST;
  const port   = process.env.SMTP_PORT;
  const secure = process.env.SMTP_SECURE;
  const user   = process.env.SMTP_USER;
  const pass   = process.env.SMTP_PASS;
  const from   = process.env.SMTP_FROM_EMAIL;
  const name   = process.env.SMTP_FROM_NAME;

  const config = {
    SMTP_HOST:       host   ? `✓ ${host}`              : "❌ YOX",
    SMTP_PORT:       port   ? `✓ ${port}`              : "❌ YOX (default: 587)",
    SMTP_SECURE:     secure ? `✓ ${secure}`            : "❌ YOX (default: false)",
    SMTP_USER:       user   ? `✓ ${user}`              : "❌ YOX",
    SMTP_PASS:       pass   ? `✓ (${pass.length} simvol)` : "❌ YOX",
    SMTP_FROM_EMAIL: from   ? `✓ ${from}`              : "❌ YOX",
    SMTP_FROM_NAME:  name   ? `✓ ${name}`              : "❌ YOX",
  };

  // Nodemailer ilə real bağlantı testi
  let connectionTest = "test edilmədi";
  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host:   host,
      port:   Number(port ?? 587),
      secure: secure === "true",
      auth:   { user, pass },
    });
    await transporter.verify();
    connectionTest = "✓ SMTP bağlantısı uğurludur";
  } catch (err: any) {
    connectionTest = `❌ SMTP xətası: ${err.message}`;
  }

  return NextResponse.json({ config, connectionTest });
}
