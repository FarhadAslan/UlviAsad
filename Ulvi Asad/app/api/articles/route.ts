import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const limit  = searchParams.get("limit");
    const all    = searchParams.get("all"); // admin üçün hamısını göstər

    const where: any = {};
    if (search) where.title = { contains: search };

    // Admin "all=true" ilə bütün məqalələri görür
    if (userRole !== "ADMIN" || all !== "true") {
      where.active = true;
    }

    const articles = await prisma.article.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...(limit ? { take: parseInt(limit) } : {}),
    });

    return NextResponse.json(articles);
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
    const { title, content, summary, active } = body;

    if (!title || !content) {
      return NextResponse.json({ error: "Başlıq və məzmun tələb olunur" }, { status: 400 });
    }

    const article = await prisma.article.create({
      data: { title, content, summary: summary || "", active: active !== undefined ? active : true },
    });

    return NextResponse.json(article, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
