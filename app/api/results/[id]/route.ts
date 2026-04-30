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
    const session  = await getServerSession(authOptions);
    const userId   = (session?.user as any)?.id;
    const userRole = (session?.user as any)?.role;

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
          select: { id: true, name: true },
        },
      },
    });

    if (!result) {
      return NextResponse.json({ error: "Nəticə tapılmadı" }, { status: 404 });
    }

    const isOwner = userId && result.userId === userId;
    const isAdmin = userRole === "ADMIN";

    // Sahibi və admin tam məlumat görür (cavablar daxil)
    // Başqaları yalnız ümumi statistikanı görür (cavablar gizli)
    const parsed = {
      ...result,
      answers: (isOwner || isAdmin)
        ? JSON.parse(result.answers as string)
        : null,
      isOwner: !!isOwner,
      quiz: {
        ...result.quiz,
        questions: (isOwner || isAdmin)
          ? result.quiz.questions.map((q) => ({
              ...q,
              options: JSON.parse(q.options),
            }))
          : [], // başqaları sualları görmür
      },
    };

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Result GET error:", error);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
