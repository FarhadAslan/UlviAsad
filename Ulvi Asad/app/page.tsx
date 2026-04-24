import { prisma } from "@/lib/prisma";
import HeroSection from "@/components/HeroSection";
import StatsSection from "@/components/StatsSection";
import QuizCard from "@/components/QuizCard";
import MaterialCard from "@/components/MaterialCard";
import ArticleCard from "@/components/ArticleCard";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Suspense } from "react";

async function getHomeData() {
  const session  = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;

  const isAdmin   = userRole === "ADMIN";
  const isStudent = userRole === "STUDENT";

  const baseWhere = isAdmin || isStudent
    ? { active: true }
    : { visibility: "PUBLIC" as const, active: true };

  const [quizzes, materials, articles, qCount, mCount, uCount] = await Promise.all([
    prisma.quiz.findMany({
      where: baseWhere,
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
      take: 3,
    }),
    prisma.material.findMany({
      where: baseWhere,
      select: { id: true, title: true, category: true, fileUrl: true, fileType: true, visibility: true, active: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    prisma.article.findMany({
      where: { active: true },
      select: { id: true, title: true, summary: true, content: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    prisma.quiz.count(),
    prisma.material.count(),
    prisma.user.count(),
  ]);

  return {
    quizzes, materials, articles, userRole,
    statsData: { totalQuizzes: qCount, totalMaterials: mCount, totalUsers: uCount },
  };
}

function SectionHeader({ title, subtitle, href }: { title: string; subtitle: string; href: string }) {
  return (
    <div className="flex items-end justify-between mb-8">
      <div>
        <h2 className="section-title">{title}</h2>
        <p className="section-subtitle">{subtitle}</p>
      </div>
      <Link href={href}
        className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-[#1a7fe0] hover:text-[#1f6f43] transition-colors group">
        Hamısına bax
        <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="card-static h-48 animate-pulse"
          style={{ background: "rgba(147,204,255,0.06)" }} />
      ))}
    </div>
  );
}

export default async function HomePage() {
  const { quizzes, materials, articles, userRole, statsData } = await getHomeData();

  return (
    <div>
      {/* Hero — client component, dərhal render olur */}
      <HeroSection />

      <StatsSection stats={statsData} />

      {/* Quizzes */}
      <section className="py-16" style={{ background: "rgba(255,255,255,0.5)" }}>
        <div className="container mx-auto">
          <SectionHeader title="Son Quizlər" subtitle="Ən yeni quiz və testlər" href="/quizler" />
          {quizzes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quizzes.map((q) => <QuizCard key={q.id} quiz={q} userRole={userRole} />)}
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400">Hələ quiz əlavə edilməyib</div>
          )}
        </div>
      </section>

      {/* Materials */}
      <section className="py-16" style={{ background: "rgba(191,231,255,0.15)" }}>
        <div className="container mx-auto">
          <SectionHeader title="Son Materiallar" subtitle="Ən yeni tədris materialları" href="/materiallar" />
          {materials.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {materials.map((m) => <MaterialCard key={m.id} material={m} userRole={userRole} />)}
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400">Hələ material əlavə edilməyib</div>
          )}
        </div>
      </section>

      {/* Articles */}
      <section className="py-16" style={{ background: "rgba(255,255,255,0.5)" }}>
        <div className="container mx-auto">
          <SectionHeader title="Son Məqalələr" subtitle="Ən yeni məqalə və yazılar" href="/meqaleler" />
          {articles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map((a) => <ArticleCard key={a.id} article={a} />)}
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400">Hələ məqalə əlavə edilməyib</div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg,rgba(191,231,255,0.4) 0%,rgba(232,245,238,0.6) 100%)" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 80% 60% at 50% 50%,rgba(147,204,255,0.15) 0%,transparent 70%)" }} />
        <div className="container mx-auto text-center relative z-10">
          <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
            Hazırsınız? İndi Başlayın!
          </h2>
          <p className="text-slate-500 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Qeydiyyatdan keçin, quizlər işləyin, materiallar yükləyin və biliklərinizi artırın.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/qeydiyyat" className="btn-primary px-10 py-3.5 text-base">Pulsuz Qeydiyyat</Link>
            <Link href="/quizler" className="btn-secondary px-10 py-3.5 text-base">Quizlərə Bax</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
