import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const article = await prisma.article.findUnique({
      where: { id: params.id },
    });

    if (!article) {
      return NextResponse.json({ error: "Məqalə tapılmadı" }, { status: 404 });
    }

    return NextResponse.json(article);
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
    const { title, content, summary, imageUrl, active } = body;
    const article = await prisma.article.update({
      where: { id: params.id },
      data: { title, content, summary, imageUrl: imageUrl || null, active },
    });

    return NextResponse.json(article);
  } catch (error) {
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    await prisma.article.delete({ where: { id: params.id } });
    return NextResponse.json({ message: "Məqalə silindi" });
  } catch (error) {
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
