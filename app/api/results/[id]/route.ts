import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Giriş tələb olunur" }, { status: 401 });
    }

    const userId      = (session.user as any).id;
    const userRole    = (session.user as any).role;

    const result = await prisma.result.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        userId: true,
        score: true,
        correct: true,
        wrong: true,
        skipped: true,
        answers: true,
        createdAt: true,
        quiz: {
          select: {
            id: true,
            title: true,
            type: true,
            category: true,
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
          },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!result) {
      return NextResponse.json({ error: "Nəticə tapılmadı" }, { status: 404 });
    }

    // Yalnız öz nəticəsini görə bilər, admin hamısını görür
    if (result.userId !== userId && userRole !== "ADMIN") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    // Options-ları parse et
    const parsed = {
      ...result,
      answers: JSON.parse(result.answers as string),
      quiz: {
        ...result.quiz,
        questions: result.quiz.questions.map((q) => ({
          ...q,
          options: JSON.parse(q.options),
        })),
      },
    };

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Result GET error:", error);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
