import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const certs = await prisma.certificate.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      select: { id: true, imageUrl: true, title: true, order: true, active: true, createdAt: true },
    });
    return NextResponse.json(certs);
  } catch {
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }
    const { imageUrl, title } = await req.json();
    if (!imageUrl) {
      return NextResponse.json({ error: "Şəkil URL-i tələb olunur" }, { status: 400 });
    }
    const last = await prisma.certificate.findFirst({ orderBy: { order: "desc" } });
    const cert = await prisma.certificate.create({
      data: { imageUrl, title: title || "", order: (last?.order ?? 0) + 1 },
    });
    return NextResponse.json(cert, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
