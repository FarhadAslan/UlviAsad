import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    await prisma.material.delete({ where: { id: params.id } });
    return NextResponse.json({ message: "Material silindi" });
  } catch (error) {
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const body = await req.json();
    const { title, category, fileUrl, fileType, visibility, active } = body;
    const material = await prisma.material.update({
      where: { id: params.id },
      data: { title, category, fileUrl, fileType, visibility, active },
    });

    return NextResponse.json(material);
  } catch (error) {
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
