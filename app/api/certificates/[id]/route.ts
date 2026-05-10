import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }
    await prisma.certificate.delete({ where: { id: params.id } });
    return NextResponse.json({ message: "Silindi" });
  } catch {
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }
    const body = await req.json();
    const cert = await prisma.certificate.update({
      where: { id: params.id },
      data: {
        ...(body.title    !== undefined && { title:  body.title }),
        ...(body.active   !== undefined && { active: body.active }),
        ...(body.order    !== undefined && { order:  body.order }),
      },
    });
    return NextResponse.json(cert);
  } catch {
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
