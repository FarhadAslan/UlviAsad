import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const limit = searchParams.get("limit");

    const userRole = (session?.user as any)?.role;
    const adminAll = searchParams.get("adminAll");

    const where: any = {};

    if (userRole === "ADMIN" && adminAll === "true") {
      // admin all — heç bir filter yoxdur
    } else if (!userRole || userRole === "USER") {
      where.visibility = "PUBLIC";
      where.active = true;
    } else if (userRole === "STUDENT") {
      where.active = true;
    }

    if (category && category !== "ALL") {
      where.category = category;
    }

    if (search) {
      where.title = { contains: search };
    }

    const materials = await prisma.material.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...(limit ? { take: parseInt(limit) } : {}),
    });

    return NextResponse.json(materials);
  } catch (error) {
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const body = await req.json();
    const { title, category, fileUrl, fileType, visibility, active } = body;

    if (!title || !category || !fileUrl || !fileType) {
      return NextResponse.json(
        { error: "Bütün sahələr tələb olunur" },
        { status: 400 }
      );
    }

    const material = await prisma.material.create({
      data: {
        title,
        category,
        fileUrl,
        fileType,
        visibility: visibility || "PUBLIC",
        active: active !== undefined ? active : true,
      },
    });

    return NextResponse.json(material, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
