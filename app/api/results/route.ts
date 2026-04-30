import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Giriş tələb olunur" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { quizId, correct, wrong, skipped, answers, timeBonus } = body;

    const score = correct * 1; // hər düzgün cavab 1 xal

    const result = await prisma.result.create({
      data: {
        userId,
        quizId,
        score,
        correct,
        wrong,
        skipped,
        answers: JSON.stringify(answers),
      },
      select: {
        id: true,
        score: true,
        correct: true,
        wrong: true,
        skipped: true,
        createdAt: true,
        quiz: { select: { title: true, type: true } },
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Result POST error:", error);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Giriş tələb olunur" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId");

    // Admin can see all results, users can only see their own
    const queryUserId =
      userRole === "ADMIN" && targetUserId ? targetUserId : userId;

    const results = await prisma.result.findMany({
      where: { userId: queryUserId },
      select: {
        id: true,
        quizId: true,
        score: true,
        correct: true,
        wrong: true,
        skipped: true,
        createdAt: true,
        quiz: { select: { title: true, type: true, category: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
