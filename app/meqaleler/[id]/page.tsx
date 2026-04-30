import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Calendar } from "lucide-react";
import ShareButton from "@/components/ShareButton";

export const dynamic = "force-dynamic";

async function getArticle(id: string) {
  return prisma.article.findUnique({ where: { id } });
}

export default async function ArticleDetailPage({ params }: { params: { id: string } }) {
  const article = await getArticle(params.id);
  if (!article) notFound();

  return (
    <div className="container mx-auto py-12 max-w-4xl">
      <Link href="/meqaleler"
        className="inline-flex items-center gap-2 text-slate-500 hover:text-[#1a7fe0] transition-colors mb-8 text-sm font-medium">
        <ArrowLeft size={16} />
        Məqalələrə qayıt
      </Link>

      <div className="card-static mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
          <Calendar size={14} className="text-[#1a7fe0]" />
          <span>{formatDate(article.createdAt)}</span>
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-4">{article.title}</h1>
        {article.summary && (
          <p className="text-slate-600 text-lg leading-relaxed border-l-4 pl-4 mb-4"
            style={{ borderColor: "rgb(147,204,255)" }}>
            {article.summary}
          </p>
        )}
        {article.imageUrl && (
          <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 mt-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.imageUrl}
              alt={article.title}
              className="w-full object-cover max-h-96"
            />
          </div>
        )}
      </div>

      <div className="card-static mb-6">
        <div className="rich-content" dangerouslySetInnerHTML={{ __html: article.content }} />
      </div>

      <div className="flex items-center justify-between">
        <Link href="/meqaleler" className="btn-secondary flex items-center gap-2">
          <ArrowLeft size={15} /> Geri
        </Link>
        <ShareButton title={article.title} />
      </div>
    </div>
  );
}
