import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Sahibliyi yoxla
async function checkOwnership(botId: string, userId: string) {
  const bot = await prisma.aiBot.findUnique({
    where: { id: botId },
    select: { id: true, createdById: true },
  });
  if (!bot) return { allowed: false, found: false };
  if (bot.createdById !== userId) return { allowed: false, found: true };
  return { allowed: true, found: true };
}

// DELETE — botu sil
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Giriş tələb olunur" }, { status: 401 });
    }
    const userId = (session.user as any)?.id;

    const { allowed, found } = await checkOwnership(params.id, userId);
    if (!found) return NextResponse.json({ error: "Bot tapılmadı" }, { status: 404 });
    if (!allowed) return NextResponse.json({ error: "Bu botu silmək icazəniz yoxdur" }, { status: 403 });

    await prisma.aiBot.delete({ where: { id: params.id } });
    return NextResponse.json({ message: "Bot silindi" }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    console.error("User bot DELETE error:", err?.message);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
