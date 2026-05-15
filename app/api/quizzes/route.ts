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
    const myQuizzes = searchParams.get("myQuizzes");

    const where: any = {};

    // myQuizzes=true — yalnız öz quizlərini gətir
    if (myQuizzes === "true") {
      if (!session || !userId) {
        return NextResponse.json({ error: "Giriş tələb olunur" }, { status: 401 });
      }
      where.createdById = userId;
      const quizzes = await prisma.quiz.findMany({
        where,
        select: {
          id: true, title: true, category: true, type: true,
          duration: true, visibility: true, active: true,
          createdAt: true, createdById: true,
          _count: { select: { questions: true, results: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(quizzes, {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      });
    }

    // adminAll=true — admin panel üçün: bütün quizlər (ADMIN icazəsi tələb olunur)
    if (adminAll === "true" && userRole === "ADMIN") {
      if (category && category !== "ALL") where.category = category;
      if (type && type !== "ALL") where.type = type;
      if (search) where.title = { contains: search, mode: "insensitive" };
      const quizzes = await prisma.quiz.findMany({
        where,
        select: {
          id: true, title: true, category: true, type: true,
          duration: true, visibility: true, active: true,
          createdAt: true, createdById: true,
          createdBy: { select: { id: true, name: true } },
          _count: { select: { questions: true, results: true } },
          results: { orderBy: { score: "desc" }, take: 3, select: { id: true, score: true, user: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        ...(limit ? { take: parseInt(limit) } : {}),
      });
      return NextResponse.json(quizzes, {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      });
    }

    // Visibility filter based on role
    if (!userRole || userRole === "USER") {
      where.visibility = "PUBLIC";
    } else if (userRole === "STUDENT" || userRole === "TEACHER") {
      where.visibility = { in: ["PUBLIC", "STUDENT_ONLY"] };
    }
    // ADMIN: visibility filteri yoxdur

    // Active filter — ADMIN istisna olmaqla yalnız aktiv quizlər
    if (userRole !== "ADMIN") {
      where.active = true;
    }

    // Yalnız ADMIN və TEACHER-ların yaratdığı quizlər görünsün (ADMIN istisna).
    // Heç kimin öz yaratdığı quiz /quizler-də görünməsin.
    if (userRole !== "ADMIN") {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      const adminIds = admins.map((a) => a.id);
      const teachers = await prisma.user.findMany({ where: { role: "TEACHER" }, select: { id: true } });
      const teacherIds = teachers.map((t) => t.id);

      if (userRole === "STUDENT" && userId) {
        // STUDENT: öz müəlliminin + admin quizlərini görür
        const student = await prisma.user.findUnique({
          where: { id: userId },
          select: { teacherId: true },
        });
        if (student?.teacherId) {
          where.OR = [
            { createdById: null },
            { createdById: { in: adminIds } },
            { createdById: student.teacherId },
          ];
        } else {
          where.OR = [{ createdById: null }, { createdById: { in: adminIds } }];
        }
      } else {
        // USER, TEACHER: admin + bütün müəllimlərin quizləri
        where.OR = [
          { createdById: null },
          { createdById: { in: adminIds } },
          { createdById: { in: teacherIds } },
        ];
      }
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

    if (!session || (userRole !== "ADMIN" && userRole !== "TEACHER" && userRole !== "USER" && userRole !== "STUDENT")) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const body = await req.json();
    const { title, category, type, duration, visibility, questions, active,
            passageTitle, passageContent, passageImageUrl } = body;

    if (!title || !category || !type || !questions?.length) {
      return NextResponse.json(
        { error: "Bütün sahələr tələb olunur" },
        { status: 400 }
      );
    }

    // METN tipi üçün passageContent məcburidir
    if (type === "METN" && !passageContent?.trim()) {
      return NextResponse.json(
        { error: "Mətn əsaslı quiz üçün passage mətni tələb olunur" },
        { status: 400 }
      );
    }

    const quiz = await prisma.quiz.create({
      data: {
        title,
        category,
        type,
        duration: type === "SINAQ" ? duration : null,
        // Müəllim yaratdıqda default deaktiv, admin yaratdıqda aktiv, user/student yaratdıqda PRIVATE (yalnız özü görür)
        active: userRole === "TEACHER" ? false : (userRole === "ADMIN" ? (active !== undefined ? active : true) : true),
        // USER/STUDENT yaratdıqda visibility PRIVATE (yalnız özü görür)
        visibility: (userRole === "USER" || userRole === "STUDENT") ? "PRIVATE" : (visibility || "PUBLIC"),
        createdById: userId,
        // Passage sahələri — yalnız METN tipi üçün
        passageTitle:    type === "METN" ? (passageTitle?.trim() || null) : null,
        passageContent:  type === "METN" ? passageContent : null,
        passageImageUrl: type === "METN" ? (passageImageUrl || null) : null,
        questions: {
          create: questions.map((q: any, index: number) => ({
            text: q.text,
            imageUrl: q.imageUrl || null,
            options: JSON.stringify(q.options),
            correctOption: q.correctOption,
            order: index + 1,
            points: q.points ?? 1,
            questionType: q.questionType || "CHOICE",
            openAnswerExample: q.questionType === "OPEN" ? (q.openAnswerExample || null) : null,
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
