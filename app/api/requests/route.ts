import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    const userId   = (session?.user as any)?.id;

    if (!session || (userRole !== "ADMIN" && userRole !== "TEACHER")) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status"); // filter by status

    const where: any = {};

    // TEACHER yalnız öz sorğularını görür
    if (userRole === "TEACHER") {
      where.teacherId = userId;
    }

    if (status && status !== "ALL") {
      where.status = status;
    }

    const requests = await prisma.request.findMany({
      where,
      include: {
        teacher: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Requests GET error:", error);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    const userId   = (session?.user as any)?.id;

    if (!session || userRole !== "TEACHER") {
      return NextResponse.json({ error: "Yalnız müəllimlər sorğu yarada bilər" }, { status: 403 });
    }

    const body = await req.json();
    const { title, message, type, relatedQuizId, relatedUserId } = body;

    if (!title?.trim() || !message?.trim()) {
      return NextResponse.json({ error: "Başlıq və mesaj tələb olunur" }, { status: 400 });
    }

    const request = await prisma.request.create({
      data: {
        teacherId: userId,
        title:     title.trim(),
        message:   message.trim(),
        type:      type || "GENERAL",
        status:    "PENDING",
        relatedQuizId: relatedQuizId || null,
        relatedUserId: relatedUserId || null,
      },
      include: {
        teacher: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(request, { status: 201 });
  } catch (error) {
    console.error("Request POST error:", error);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
