import { prisma } from "@/lib/prisma";
import HeroSection from "@/components/HeroSection";
import StatsSection from "@/components/StatsSection";
import QuizCard from "@/components/QuizCard";
import MaterialCard from "@/components/MaterialCard";
import ArticleCard from "@/components/ArticleCard";
import CTASection from "@/components/CTASection";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Suspense } from "react";
import CertificatesSection from "@/components/CertificatesSection";

export const dynamic = "force-dynamic";

// Skeleton loader
function CardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="card-static h-64 animate-pulse"
          style={{ background: "rgba(147,204,255,0.06)" }} />
      ))}
    </div>
  );
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

// Stats data - sürətli, xəta olsa default qaytar
async function getStats() {
  try {
    const [qCount, mCount, uCount] = await Promise.all([
      prisma.quiz.count({ where: { active: true } }),
      prisma.material.count({ where: { active: true } }),
      prisma.user.count(),
    ]);
    return { totalQuizzes: qCount, totalMaterials: mCount, totalUsers: uCount };
  } catch {
    return { totalQuizzes: 0, totalMaterials: 0, totalUsers: 0 };
  }
}

// Quizzes - ayrıca yüklənir
async function getQuizzes(userRole?: string, userId?: string) {
  try {
    const isAdmin   = userRole === "ADMIN";
    const isTeacher = userRole === "TEACHER";
    const isStudent = userRole === "STUDENT";
    const isUser    = !userRole || userRole === "USER";

    const where: any = { active: true };

    if (isUser) {
      where.visibility = "PUBLIC";
    }

    if (!isAdmin && !isTeacher) {
      // Admin id-lərini tap
      const admins   = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      const adminIds = admins.map((a) => a.id);

      if (isStudent && userId) {
        const student = await prisma.user.findUnique({ where: { id: userId }, select: { teacherId: true } });
        if (student?.teacherId) {
          where.OR = [{ createdById: null }, { createdById: { in: adminIds } }, { createdById: student.teacherId }];
        } else {
          where.OR = [{ createdById: null }, { createdById: { in: adminIds } }];
        }
      } else if (isUser) {
        where.OR = [{ createdById: null }, { createdById: { in: adminIds } }];
      }
    }

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
      take: 3,
    });
  } catch {
    return [];
  }
}

// Materials - ayrıca yüklənir
async function getMaterials(userRole?: string) {
  try {
    const isAdmin = userRole === "ADMIN";
    const isStudent = userRole === "STUDENT";

    const baseWhere = isAdmin || isStudent
      ? { active: true }
      : { visibility: "PUBLIC" as const, active: true };

    return prisma.material.findMany({
      where: baseWhere,
      select: { id: true, title: true, category: true, fileUrl: true, fileType: true, visibility: true, active: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 3,
    });
  } catch {
    return [];
  }
}

// Articles - ayrıca yüklənir
async function getArticles() {
  try {
    return prisma.article.findMany({
      where: { active: true },
      select: { id: true, title: true, summary: true, content: true, imageUrl: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 3,
    });
  } catch {
    return [];
  }
}

// Quizzes Section Component
async function QuizzesSection({ userRole, userId }: { userRole?: string; userId?: string }) {
  const quizzes = await getQuizzes(userRole, userId);
  
  return (
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
  );
}

// Materials Section Component
async function MaterialsSection({ userRole }: { userRole?: string }) {
  const materials = await getMaterials(userRole);
  
  return (
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
  );
}

// Articles Section Component
async function ArticlesSection() {
  const articles = await getArticles();
  
  return (
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
  );
}

export default async function HomePage() {
  const session  = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const userId   = (session?.user as any)?.id;
  
  // Stats sürətli yüklənir
  const statsData = await getStats();

  return (
    <div>
      {/* Hero — client component, dərhal render olur */}
      <HeroSection />

      {/* Stats — dərhal göstərilir */}
      <StatsSection stats={statsData} />

      {/* Quizzes — streaming ilə yüklənir */}
      <Suspense fallback={
        <section className="py-16" style={{ background: "rgba(255,255,255,0.5)" }}>
          <div className="container mx-auto">
            <SectionHeader title="Son Quizlər" subtitle="Ən yeni quiz və testlər" href="/quizler" />
            <CardSkeleton />
          </div>
        </section>
      }>
        <QuizzesSection userRole={userRole} userId={userId} />
      </Suspense>

      {/* Sertifikatlar — Son Quizlər-dən sonra */}
      <CertificatesSection />

      {/* Materials — streaming ilə yüklənir */}
      <Suspense fallback={
        <section className="py-16" style={{ background: "rgba(191,231,255,0.15)" }}>
          <div className="container mx-auto">
            <SectionHeader title="Son Materiallar" subtitle="Ən yeni tədris materialları" href="/materiallar" />
            <CardSkeleton />
          </div>
        </section>
      }>
        <MaterialsSection userRole={userRole} />
      </Suspense>

      {/* Articles — streaming ilə yüklənir */}
      <Suspense fallback={
        <section className="py-16" style={{ background: "rgba(255,255,255,0.5)" }}>
          <div className="container mx-auto">
            <SectionHeader title="Son Məqalələr" subtitle="Ən yeni məqalə və yazılar" href="/meqaleler" />
            <CardSkeleton />
          </div>
        </section>
      }>
        <ArticlesSection />
      </Suspense>

      {/* CTA */}
      <CTASection />
    </div>
  );
}
