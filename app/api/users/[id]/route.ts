import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    const sessionUserId = (session?.user as any)?.id;

    if (!session || (userRole !== "ADMIN" && userRole !== "TEACHER")) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const body = await req.json();
    const { role, active, teacherId } = body;

    // TEACHER yalnız öz tələbəsini yeniləyə bilər
    if (userRole === "TEACHER") {
      const targetUser = await prisma.user.findUnique({
        where: { id: params.id },
        select: { teacherId: true },
      });
      if (!targetUser || targetUser.teacherId !== sessionUserId) {
        return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
      }
      // TEACHER yalnız active dəyişə bilər, rol dəyişdirə bilməz
      const updateData: any = {};
      if (active !== undefined) updateData.active = active;

      const user = await prisma.user.update({
        where: { id: params.id },
        data: updateData,
        select: { id: true, name: true, email: true, role: true, active: true },
      });
      return NextResponse.json(user);
    }

    // ADMIN hər şeyi dəyişə bilər
    const updateData: any = {};
    if (role !== undefined) updateData.role = role;
    if (active !== undefined) updateData.active = active;
    if (teacherId !== undefined) updateData.teacherId = teacherId || null;

    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        teacherId: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Giriş tələb olunur" }, { status: 401 });
    }

    const requesterId = (session.user as any).id;
    const requesterRole = (session.user as any).role;

    // Users can only see their own profile, admins and teachers can see more
    if (requesterId !== params.id && requesterRole !== "ADMIN" && requesterRole !== "TEACHER") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        active: true,
        createdAt: true,
        teacherId: true,
        teacher: { select: { id: true, name: true } },
        results: {
          include: {
            quiz: { select: { title: true, type: true, category: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "İstifadəçi tapılmadı" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
