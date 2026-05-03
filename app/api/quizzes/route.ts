import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const type = searchParams.get("type");
    const search = searchParams.get("search");
    const limit = searchParams.get("limit");

    const userRole = (session?.user as any)?.role;
    const userId = (session?.user as any)?.id;
    const adminAll = searchParams.get("adminAll");

    const where: any = {};

    // Visibility filter based on role
    if (!userRole || userRole === "USER") {
      where.visibility = "PUBLIC";
    }

    // Active filter
    if (userRole === "ADMIN" && adminAll === "true") {
      // admin all — active filter yoxdur
    } else if (userRole === "TEACHER" && adminAll === "true") {
      // TEACHER öz quizlərinin hamısını görür (aktiv + deaktiv)
      where.createdById = userId;
    } else if (!userRole || userRole === "USER" || userRole === "STUDENT") {
      where.active = true;
    }

    if (category && category !== "ALL") {
      where.category = category;
    }

    if (type && type !== "ALL") {
      where.type = type;
    }

    if (search) {
      where.title = { contains: search, mode: "insensitive" };
    }

    const quizzes = await prisma.quiz.findMany({
      where,
      select: {
        id: true,
        title: true,
        category: true,
        type: true,
        duration: true,
        visibility: true,
        active: true,
        createdAt: true,
        createdById: true,
        createdBy: {
          select: { id: true, name: true },
        },
        _count: {
          select: { questions: true, results: true },
        },
        results: {
          orderBy: { score: "desc" },
          take: 3,
          select: {
            id: true,
            score: true,
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      ...(limit ? { take: parseInt(limit) } : {}),
    });

    return NextResponse.json(quizzes, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Quizzes GET error:", error);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    const userId = (session?.user as any)?.id;

    if (!session || (userRole !== "ADMIN" && userRole !== "TEACHER")) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const body = await req.json();
    const { title, category, type, duration, visibility, questions, active } = body;

    if (!title || !category || !type || !questions?.length) {
      return NextResponse.json(
        { error: "Bütün sahələr tələb olunur" },
        { status: 400 }
      );
    }

    const quiz = await prisma.quiz.create({
      data: {
        title,
        category,
        type,
        duration: type === "SINAQ" ? duration : null,
        visibility: visibility || "PUBLIC",
        // Müəllim yaratdıqda default deaktiv, admin yaratdıqda aktiv
        active: userRole === "TEACHER" ? false : (active !== undefined ? active : true),
        createdById: userId,
        questions: {
          create: questions.map((q: any, index: number) => ({
            text: q.text,
            imageUrl: q.imageUrl || null,
            options: JSON.stringify(q.options),
            correctOption: q.correctOption,
            order: index + 1,
          })),
        },
      },
      include: {
        questions: true,
      },
    });

    return NextResponse.json(quiz, { status: 201 });
  } catch (error) {
    console.error("Quiz POST error:", error);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
