import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Ad və email yeniləmə
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Giriş tələb olunur" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body   = await req.json();
    const { name, email } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Ad tələb olunur" }, { status: 400 });
    }
    if (!email?.trim() || !email.includes("@")) {
      return NextResponse.json({ error: "Düzgün email daxil edin" }, { status: 400 });
    }

    const trimmedName  = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    // Email başqa istifadəçidə var ya yox yoxla
    const existing = await prisma.user.findFirst({
      where: { email: trimmedEmail, NOT: { id: userId } },
    });
    if (existing) {
      return NextResponse.json({ error: "Bu email artıq istifadə olunur" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data:  { name: trimmedName, email: trimmedEmail },
      select: { id: true, name: true, email: true, role: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Profile PATCH error:", error);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
