import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProfileClient from "@/components/ProfileClient";

async function getUserData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      image: true,
      createdAt: true,
      results: {
        select: {
          id: true,
          quizId: true,
          score: true,
          correct: true,
          wrong: true,
          skipped: true,
          createdAt: true,
          quiz: {
            select: {
              title: true,
              type: true,
              category: true,
              _count: { select: { questions: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) return null;

  const results      = user.results;
  const totalQuizzes = results.length;
  const averageScore = totalQuizzes > 0
    ? Math.round(results.reduce((sum: number, r: any) => sum + r.score, 0) / totalQuizzes)
    : 0;
  const bestScore   = totalQuizzes > 0 ? Math.max(...results.map((r: any) => r.score)) : 0;
  const totalPoints = results.reduce((sum: number, r: any) => sum + r.score, 0);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      image: user.image,
      createdAt: user.createdAt,
    },
    stats: { totalQuizzes, averageScore, bestScore, totalPoints },
    results: results.map((r: any) => ({
      id: r.id,
      quizId:         r.quizId,
      quizTitle:      (r.quiz as any).title,
      quizType:       (r.quiz as any).type,
      quizCategory:   (r.quiz as any).category,
      totalQuestions: (r.quiz as any)._count?.questions ?? 0,
      score:   r.score,
      correct: r.correct,
      wrong:   r.wrong,
      skipped: r.skipped,
      createdAt: r.createdAt,
    })),
  };
}

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/giris");

  const userId = (session.user as any).id;
  const data = await getUserData(userId);

  if (!data) redirect("/auth/giris");

  return <ProfileClient data={data} />;
}
