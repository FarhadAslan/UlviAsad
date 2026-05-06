import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Token-in etibarlılığını yoxla (GET)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token tələb olunur" }, { status: 400 });
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    select: { used: true, expiresAt: true },
  });

  if (!record || record.used || record.expiresAt < new Date()) {
    return NextResponse.json({ error: "Link etibarsız və ya müddəti bitib" }, { status: 400 });
  }

  return NextResponse.json({ valid: true });
}

// Yeni parol təyin et (POST)
export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: "Token və parol tələb olunur" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Parol ən az 6 simvol olmalıdır" }, { status: 400 });
    }

    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
      select: { id: true, userId: true, used: true, expiresAt: true },
    });

    if (!record || record.used || record.expiresAt < new Date()) {
      return NextResponse.json({ error: "Link etibarsız və ya müddəti bitib" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 10);

    // Parolu yenilə və tokeni istifadə edilmiş kimi işarələ
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data:  { password: hashed },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data:  { used: true },
      }),
    ]);

    return NextResponse.json({ message: "Parol uğurla yeniləndi" });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
