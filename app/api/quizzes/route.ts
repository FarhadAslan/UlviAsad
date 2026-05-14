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

    // myQuizzes=true — yalnız öz quizlərini gətir (giriş etmiş istənilən istifadəçi)
    if (myQuizzes === "true") {
      if (!session || !userId) {
        return NextResponse.json({ error: "Giriş tələb olunur" }, { status: 401 });
      }
      where.createdById = userId;
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
          _count: { select: { questions: true, results: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(quizzes, {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      });
    }

    // Visibility filter based on role
    if (!userRole || userRole === "USER") {
      // USER: yalnız PUBLIC quizlər, PRIVATE quizlər görünmür
      where.visibility = "PUBLIC";
    } else if (userRole === "STUDENT") {
      // STUDENT: PUBLIC + STUDENT_ONLY, amma PRIVATE deyil
      where.visibility = { in: ["PUBLIC", "STUDENT_ONLY"] };
    }
    // ADMIN/TEACHER: bütün visibility-lər görünür (adminAll=true ilə)

    // Active filter
    if (userRole === "ADMIN" && adminAll === "true") {
      // admin all — active filter yoxdur
    } else if (userRole === "TEACHER" && adminAll === "true") {
      // TEACHER öz quizlərinin hamısını görür (aktiv + deaktiv)
      where.createdById = userId;
    } else if (!userRole || userRole === "USER" || userRole === "STUDENT") {
      where.active = true;
    }

    // STUDENT: yalnız öz müəlliminin + adminin quizlərini görür
    if (userRole === "STUDENT" && userId) {
      const student = await prisma.user.findUnique({
        where: { id: userId },
        select: { teacherId: true },
      });

      // Admin id-lərini tap
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true },
      });
      const adminIds = admins.map((a) => a.id);

      if (student?.teacherId) {
        // Müəllimi var: admin quizləri + öz müəlliminin quizləri
        where.OR = [
          { createdById: null },
          { createdById: { in: adminIds } },
          { createdById: student.teacherId },
        ];
      } else {
        // Müəllimi yoxdur: yalnız admin quizləri
        where.OR = [
          { createdById: null },
          { createdById: { in: adminIds } },
        ];
      }
    }

    // USER və ya giriş etməmiş: yalnız admin quizləri
    if (!userRole || userRole === "USER") {
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true },
      });
      const adminIds = admins.map((a) => a.id);
      where.OR = [
        { createdById: null },
        { createdById: { in: adminIds } },
      ];
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
        visibility: visibility || "PUBLIC",
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
