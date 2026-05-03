import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Müəllimin quizə sahibliyini yoxla
async function checkQuizOwnership(
  quizId: string,
  userId: string,
  role: string
): Promise<{ allowed: boolean; quiz: any }> {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true, createdById: true },
  });
  if (!quiz) return { allowed: false, quiz: null };
  if (role === "ADMIN") return { allowed: true, quiz };
  // TEACHER yalnız öz quizini dəyişə bilər
  if (role === "TEACHER" && quiz.createdById === userId) return { allowed: true, quiz };
  return { allowed: false, quiz };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;

    const quiz = await prisma.quiz.findUnique({
      where: { id: params.id },
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
        createdBy: { select: { id: true, name: true } },
        questions: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            text: true,
            imageUrl: true,
            options: true,
            correctOption: true,
            order: true,
          },
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
        _count: {
          select: { questions: true, results: true },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz tapılmadı" }, { status: 404 });
    }

    if (quiz.visibility === "STUDENT_ONLY" && (!userRole || userRole === "USER")) {
      return NextResponse.json({ error: "Bu quizə giriş icazəniz yoxdur" }, { status: 403 });
    }

    const quizWithParsedOptions = {
      ...quiz,
      questions: quiz.questions.map((q) => ({
        ...q,
        options: JSON.parse(q.options),
      })),
    };

    return NextResponse.json(quizWithParsedOptions);
  } catch (error) {
    console.error("Quiz GET error:", error);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    const userId = (session?.user as any)?.id;

    if (!session || (userRole !== "ADMIN" && userRole !== "TEACHER")) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const { allowed } = await checkQuizOwnership(params.id, userId, userRole);
    if (!allowed) {
      return NextResponse.json({ error: "Bu quizi dəyişdirmək icazəniz yoxdur" }, { status: 403 });
    }

    const body = await req.json();
    const { title, category, type, duration, visibility, questions, active } = body;

    if (!title || !category || !type || !questions?.length) {
      return NextResponse.json({ error: "Bütün sahələr tələb olunur" }, { status: 400 });
    }

    const quiz = await prisma.$transaction(async (tx) => {
      await tx.question.deleteMany({ where: { quizId: params.id } });
      return tx.quiz.update({
        where: { id: params.id },
        data: {
          title, category, type,
          duration: type === "SINAQ" ? (duration || null) : null,
          visibility,
          active: active !== undefined ? Boolean(active) : true,
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
      });
    });

    return NextResponse.json(quiz, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    console.error("Quiz PUT error:", err?.message ?? err);
    return NextResponse.json({ error: "Server xətası: " + (err?.message ?? "bilinməyən xəta") }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    const userId = (session?.user as any)?.id;

    if (!session || (userRole !== "ADMIN" && userRole !== "TEACHER")) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const { allowed } = await checkQuizOwnership(params.id, userId, userRole);
    if (!allowed) {
      return NextResponse.json({ error: "Bu quizi dəyişdirmək icazəniz yoxdur" }, { status: 403 });
    }

    const body = await req.json();
    const updateData: any = {};

    if (body.active !== undefined) updateData.active = Boolean(body.active);
    if (body.visibility !== undefined) updateData.visibility = body.visibility;
    if (body.title !== undefined) updateData.title = body.title;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Yenilənəcək sahə yoxdur" }, { status: 400 });
    }

    const quiz = await prisma.quiz.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json(quiz, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    console.error("Quiz PATCH error:", err?.message ?? err);
    return NextResponse.json({ error: "Server xətası: " + (err?.message ?? "bilinməyən xəta") }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    const userId = (session?.user as any)?.id;

    if (!session || (userRole !== "ADMIN" && userRole !== "TEACHER")) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const { allowed, quiz: existing } = await checkQuizOwnership(params.id, userId, userRole);
    if (!existing) {
      return NextResponse.json({ error: "Quiz tapılmadı" }, { status: 404 });
    }
    if (!allowed) {
      return NextResponse.json({ error: "Bu quizi silmək icazəniz yoxdur" }, { status: 403 });
    }

    await prisma.$transaction([
      prisma.result.deleteMany({ where: { quizId: params.id } }),
      prisma.question.deleteMany({ where: { quizId: params.id } }),
      prisma.quiz.delete({ where: { id: params.id } }),
    ]);

    return NextResponse.json(
      { message: "Quiz silindi" },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("Quiz DELETE error:", err?.message ?? err);
    return NextResponse.json(
      { error: "Server xətası: " + (err?.message ?? "bilinməyən xəta") },
      { status: 500 }
    );
  }
}
