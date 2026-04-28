import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import QuizCard from "@/components/QuizCard";
import QuizFilters from "@/components/QuizFilters";

async function getQuizzes(category: string, type: string, search: string, userRole?: string) {
  const isAdmin   = userRole === "ADMIN";
  const isStudent = userRole === "STUDENT";

  const where: any = {};
  if (!isAdmin && !isStudent) where.visibility = "PUBLIC";
  where.active = true;
  if (category && category !== "ALL") where.category = category;
  if (type     && type     !== "ALL") where.type     = type;
  if (search) where.title = { contains: search };

  return prisma.quiz.findMany({
    where,
    select: {
      id: true, title: true, category: true, type: true,
      duration: true, visibility: true, active: true, createdAt: true,
      _count: { select: { questions: true, results: true } },
      results: {
        orderBy: { score: "desc" }, take: 3,
        select: { id: true, score: true, user: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export default async function QuizzesPage({
  searchParams,
}: {
  searchParams: { category?: string; type?: string; search?: string };
}) {
  const session  = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;

  const category = searchParams.category || "ALL";
  const type     = searchParams.type     || "ALL";
  const search   = searchParams.search   || "";

  const quizzes = await getQuizzes(category, type, search, userRole);

  return (
    <div className="container mx-auto py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Quizlər</h1>
        <p className="text-slate-500">Müxtəlif kateqoriyalarda quiz və testlər işləyin</p>
      </div>

      <QuizFilters category={category} type={type} search={search} />

      {quizzes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quizzes.map((quiz) => (
            <QuizCard key={quiz.id} quiz={quiz} userRole={userRole} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Quiz tapılmadı</h3>
          <p className="text-slate-500">Axtarış kriteriyalarınıza uyğun quiz yoxdur</p>
        </div>
      )}
    </div>
  );
}
