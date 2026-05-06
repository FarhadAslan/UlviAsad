import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isValidEmail } from "@/lib/utils";

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

    // Ad yoxlaması
    const trimmedName = (name ?? "").trim();
    if (!trimmedName) {
      return NextResponse.json({ error: "Ad tələb olunur" }, { status: 400 });
    }
    if (trimmedName.length < 2) {
      return NextResponse.json({ error: "Ad ən az 2 simvol olmalıdır" }, { status: 400 });
    }
    if (trimmedName.length > 100) {
      return NextResponse.json({ error: "Ad 100 simvoldan çox ola bilməz" }, { status: 400 });
    }

    // Email format yoxlaması
    const trimmedEmail = (email ?? "").trim().toLowerCase();
    if (!trimmedEmail) {
      return NextResponse.json({ error: "Email tələb olunur" }, { status: 400 });
    }
    if (!isValidEmail(trimmedEmail)) {
      return NextResponse.json({ error: "Email formatı düzgün deyil (nümunə: ad@domen.az)" }, { status: 400 });
    }

    // Email unikallıq yoxlaması
    const existing = await prisma.user.findFirst({
      where: { email: trimmedEmail, NOT: { id: userId } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "Bu email artıq başqa hesabda istifadə olunur" }, { status: 409 });
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
