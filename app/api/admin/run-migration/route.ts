import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    // sourceBotId sütununu əlavə et
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "sourceBotId" TEXT;`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Quiz_sourceBotId_idx" ON "Quiz"("sourceBotId");`
    );

    return NextResponse.json({ success: true, message: "Migration uğurla tətbiq edildi" });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Xəta baş verdi" }, { status: 500 });
  }
}
