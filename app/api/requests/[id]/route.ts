import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Admin sorğunun statusunu dəyişdirir
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;

    if (!session || userRole !== "ADMIN") {
      return NextResponse.json({ error: "Yalnız admin sorğu statusunu dəyişə bilər" }, { status: 403 });
    }

    const body = await req.json();
    const { status, adminNote } = body;

    const validStatuses = ["PENDING", "IN_PROGRESS", "RESOLVED"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Yanlış status" }, { status: 400 });
    }

    const updateData: any = {};
    if (status    !== undefined) updateData.status    = status;
    if (adminNote !== undefined) updateData.adminNote = adminNote;

    const request = await prisma.request.update({
      where: { id: params.id },
      data:  updateData,
      include: {
        teacher: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(request);
  } catch (error) {
    console.error("Request PATCH error:", error);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const userRole    = (session?.user as any)?.role;
    const userId      = (session?.user as any)?.id;

    if (!session) {
      return NextResponse.json({ error: "Giriş tələb olunur" }, { status: 401 });
    }

    const existing = await prisma.request.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Sorğu tapılmadı" }, { status: 404 });
    }

    // Yalnız admin və ya sorğunun sahibi silə bilər
    if (userRole !== "ADMIN" && existing.teacherId !== userId) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    await prisma.request.delete({ where: { id: params.id } });
    return NextResponse.json({ message: "Sorğu silindi" });
  } catch (error) {
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
