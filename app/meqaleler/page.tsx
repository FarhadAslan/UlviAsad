import { prisma } from "@/lib/prisma";
import ArticleCard from "@/components/ArticleCard";
import ArticleFilters from "@/components/ArticleFilters";

async function getArticles(search: string) {
  const where: any = { active: true };
  if (search) where.title = { contains: search };
  return prisma.article.findMany({
    where,
    select: { id: true, title: true, summary: true, imageUrl: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: { search?: string };
}) {
  const search   = searchParams.search || "";
  const articles = await getArticles(search);

  return (
    <div className="container mx-auto py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Məqalələr</h1>
        <p className="text-slate-500">Faydalı məqalə və yazılar</p>
      </div>

      <ArticleFilters search={search} />

      {articles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((a) => <ArticleCard key={a.id} article={a} />)}
        </div>
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
