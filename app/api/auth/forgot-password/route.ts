import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email?.trim() || !email.includes("@")) {
      return NextResponse.json({ error: "Düzgün email daxil edin" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, name: true, email: true, active: true },
    });

    // Təhlükəsizlik: istifadəçi tapılmasa da eyni cavab qaytar
    if (!user || !user.active) {
      return NextResponse.json({ message: "Əgər bu email mövcuddursa, sıfırlama linki göndərildi" });
    }

    // Köhnə tokenləri ləğv et
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data:  { used: true },
    });

    // Yeni token yarat (1 saat etibarlı)
    const token     = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    await sendPasswordResetEmail(user.email, user.name, token);

    return NextResponse.json({ message: "Əgər bu email mövcuddursa, sıfırlama linki göndərildi" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Forgot password error:", msg);

    // SMTP konfiqurasiyası yoxdursa daha aydın mesaj
    if (msg.includes("SMTP konfiqurasiyası çatışmır")) {
      console.error("→ Server-də SMTP_HOST, SMTP_USER, SMTP_PASS environment variable-larını təyin edin.");
      return NextResponse.json(
        { error: "Email xidməti konfiqurasiya edilməyib. Zəhmət olmasa administratorla əlaqə saxlayın." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Email göndərilmədi. Zəhmət olmasa sonra yenidən cəhd edin." },
      { status: 500 }
    );
  }
}
