import { prisma } from "@/lib/prisma";
import ArticleCard from "@/components/ArticleCard";
import ArticleFilters from "@/components/ArticleFilters";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 9;

async function getArticles(search: string, page = 1) {
  const where: any = { active: true };
  if (search) where.title = { contains: search, mode: "insensitive" };

  const [items, total] = await Promise.all([
    prisma.article.findMany({
      where,
      select: { id: true, title: true, summary: true, imageUrl: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.article.count({ where }),
  ]);

  return { items, total, totalPages: Math.ceil(total / PAGE_SIZE) };
}

function buildParams(current: Record<string, string>, overrides: Record<string, string>) {
  const p = new URLSearchParams(current);
  Object.entries(overrides).forEach(([k, v]) => v ? p.set(k, v) : p.delete(k));
  return p.toString();
}

export default async function ArticlesPage({ searchParams }: { searchParams: Record<string, string> }) {
  const search = searchParams.search || "";
  const page   = Math.max(1, parseInt(searchParams.page || "1"));

  const { items: articles, totalPages } = await getArticles(search, page);

  const base = { search };

  return (
    <div className="container mx-auto py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Məqalələr</h1>
        <p className="text-slate-500">Faydalı məqalə və yazılar</p>
      </div>

      <ArticleFilters search={search} />

      {articles.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((a) => <ArticleCard key={a.id} article={a} />)}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-10">
              <Link href={`?${buildParams(base, { page: String(page - 1) })}`}
                className={`w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 transition-all hover:border-[rgb(147,204,255)] hover:text-[#1a7fe0] ${page === 1 ? "pointer-events-none opacity-30" : ""}`}>
                <ChevronLeft size={16} />
              </Link>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link key={p} href={`?${buildParams(base, { page: String(p) })}`}
                  className={`w-9 h-9 rounded-lg text-sm font-medium flex items-center justify-center transition-all ${p === page ? "bg-[#1f6f43] text-white shadow-sm" : "border border-slate-200 text-slate-600 hover:border-[rgb(147,204,255)] hover:text-[#1a7fe0]"}`}>
                  {p}
                </Link>
              ))}
              <Link href={`?${buildParams(base, { page: String(page + 1) })}`}
                className={`w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 transition-all hover:border-[rgb(147,204,255)] hover:text-[#1a7fe0] ${page === totalPages ? "pointer-events-none opacity-30" : ""}`}>
                <ChevronRight size={16} />
              </Link>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📰</div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Məqalə tapılmadı</h3>
          <p className="text-slate-500">Axtarış kriteriyalarınıza uyğun məqalə yoxdur</p>
        </div>
      )}
    </div>
  );
}
