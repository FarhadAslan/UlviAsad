import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import QuizRunner from "@/components/QuizRunner";

async function getQuiz(id: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { order: "asc" } },
      results: {
        orderBy: { score: "desc" },
        take: 3,
        include: { user: { select: { name: true } } },
      },
    },
  });

  if (!quiz) return null;

  return {
    ...quiz,
    questions: quiz.questions.map((q) => ({
      ...q,
      options: JSON.parse(q.options),
    })),
  };
}

export default async function QuizPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  const quiz = await getQuiz(params.id);

  if (!quiz) notFound();

  const userRole = (session?.user as any)?.role;

  if (
    quiz.visibility === "STUDENT_ONLY" &&
    (!userRole || userRole === "USER")
  ) {
    redirect("/auth/giris");
  }

  return <QuizRunner quiz={quiz} session={session} />;
}
