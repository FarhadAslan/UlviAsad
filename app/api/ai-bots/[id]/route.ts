import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET — tək bot (content + prompt ilə)
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;

    if (!session || (userRole !== "ADMIN" && userRole !== "TEACHER")) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const bot = await prisma.aiBot.findUnique({ where: { id: params.id } });
    if (!bot) return NextResponse.json({ error: "Bot tapılmadı" }, { status: 404 });

    return NextResponse.json(bot);
  } catch (err: any) {
    console.error("AI Bot GET error:", err?.message);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}

// PUT — botu yenilə (yalnız admin)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;

    if (!session || userRole !== "ADMIN") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, category, content, prompt, active } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Bot adı tələb olunur" }, { status: 400 });
    }
    if (!content?.trim()) {
      return NextResponse.json({ error: "Öyrətmə mətni tələb olunur" }, { status: 400 });
    }
    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Sistem promptu tələb olunur" }, { status: 400 });
    }

    const bot = await prisma.aiBot.update({
      where: { id: params.id },
      data: {
        name: name.trim(),
        description: description?.trim() || "",
        category: category?.trim() || "",
        content: content.trim(),
        prompt: prompt.trim(),
        active: active !== undefined ? Boolean(active) : true,
      },
    });

    return NextResponse.json(bot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    console.error("AI Bot PUT error:", err?.message);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}

// DELETE — botu sil (yalnız admin)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;

    if (!session || userRole !== "ADMIN") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    await prisma.aiBot.delete({ where: { id: params.id } });
    return NextResponse.json({ message: "Bot silindi" }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    console.error("AI Bot DELETE error:", err?.message);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
