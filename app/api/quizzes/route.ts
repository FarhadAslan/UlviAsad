import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const type = searchParams.get("type");
    const search = searchParams.get("search");
    const limit = searchParams.get("limit");

    const userRole = (session?.user as any)?.role;
    const adminAll = searchParams.get("adminAll");

    const where: any = {};

    // Visibility filter based on role
    if (!userRole || userRole === "USER") {
      where.visibility = "PUBLIC";
    }

    // Active filter — admin "adminAll=true" ilə hamısını görür
    if (userRole === "ADMIN" && adminAll === "true") {
      // admin all — active filter yoxdur
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
      where.title = { contains: search };
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
        // Public quizlər üçün 60 saniyə browser cache, 300 saniyə CDN cache
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
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
    if (!session || (session.user as any)?.role !== "ADMIN") {
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
        active: active !== undefined ? active : true,
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
