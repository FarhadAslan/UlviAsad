import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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

    // Parse options for each question
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
    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const body = await req.json();
    const { title, category, type, duration, visibility, questions, active } = body;

    await prisma.question.deleteMany({ where: { quizId: params.id } });

    const quiz = await prisma.quiz.update({
      where: { id: params.id },
      data: {
        title, category, type,
        duration: type === "SINAQ" ? duration : null,
        visibility,
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
    });

    return NextResponse.json(quiz);
  } catch (error) {
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    await prisma.quiz.delete({ where: { id: params.id } });
    return NextResponse.json({ message: "Quiz silindi" });
  } catch (error) {
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
