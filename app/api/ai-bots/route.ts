import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET — bütün botları gətir (admin + teacher)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;

    if (!session || (userRole !== "ADMIN" && userRole !== "TEACHER")) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("active") === "true";

    const bots = await prisma.aiBot.findMany({
      where: activeOnly ? { active: true } : {},
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        category: true,
        active: true,
        createdAt: true,
        ...(searchParams.get("full") === "true"
          ? { content: true, prompt: true }
          : {}),
      },
    });

    return NextResponse.json(bots, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    console.error("AI Bots GET error:", err?.message);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}

// POST — yeni bot yarat (yalnız admin)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;

    if (!session || userRole !== "ADMIN") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const body = await req.json();
    const { name, category, content, prompt, active } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Bot adı tələb olunur" }, { status: 400 });
    }
    if (!content?.trim()) {
      return NextResponse.json({ error: "Öyrətmə mətni tələb olunur" }, { status: 400 });
    }
    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Sistem promptu tələb olunur" }, { status: 400 });
    }

    const bot = await prisma.aiBot.create({
      data: {
        name: name.trim(),
        category: category?.trim() || "",
        content: content.trim(),
        prompt: prompt.trim(),
        active: active !== undefined ? Boolean(active) : true,
      },
    });

    return NextResponse.json(bot, { status: 201 });
  } catch (err: any) {
    console.error("AI Bot POST error:", err?.message);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
