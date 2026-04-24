import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [totalQuizzes, totalMaterials, totalUsers] = await Promise.all([
      prisma.quiz.count(),
      prisma.material.count(),
      prisma.user.count(),
    ]);

    return NextResponse.json({ totalQuizzes, totalMaterials, totalUsers });
  } catch (error) {
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
