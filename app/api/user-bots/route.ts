import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_USER_PROMPT = `Sən verilmiş bilik bazasına əsasən sual yaradan bir AI assistentsən.
Yalnız bilik bazasındakı məlumatlardan istifadə edərək suallar yarat.
Suallar Azərbaycan dilində olmalıdır.
Hər sual aydın, birmənalı və bilik bazasına uyğun olmalıdır.`;

// GET — istifadəçinin öz botlarını gətir
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Giriş tələb olunur" }, { status: 401 });
    }
    const userId = (session.user as any)?.id;

    const bots = await prisma.aiBot.findMany({
      where: { createdById: userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        category: true,
        active: true,
        createdAt: true,
        description: true,
      },
    });

    return NextResponse.json(bots, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    console.error("User bots GET error:", err?.message);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}

// POST — yeni bot yarat
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Giriş tələb olunur" }, { status: 401 });
    }
    const userId = (session.user as any)?.id;

    const body = await req.json();
    const { name, category, content } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Bot adı tələb olunur" }, { status: 400 });
    }
    if (!content?.trim()) {
      return NextResponse.json({ error: "Bilik bazası mətni tələb olunur" }, { status: 400 });
    }
    if (content.trim().length < 50) {
      return NextResponse.json({ error: "Bilik bazası ən az 50 simvol olmalıdır" }, { status: 400 });
    }

    // Bir istifadəçi maksimum 10 bot yarada bilər
    const count = await prisma.aiBot.count({ where: { createdById: userId } });
    if (count >= 10) {
      return NextResponse.json(
        { error: "Maksimum 10 bot yarada bilərsiniz" },
        { status: 400 }
      );
    }

    const bot = await prisma.aiBot.create({
      data: {
        name: name.trim(),
        category: category?.trim() || "",
        content: content.trim(),
        prompt: DEFAULT_USER_PROMPT,
        active: true,
        createdById: userId,
      },
    });

    return NextResponse.json(bot, { status: 201 });
  } catch (err: any) {
    console.error("User bot POST error:", err?.message);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
