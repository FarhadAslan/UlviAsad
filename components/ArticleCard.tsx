import { memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Calendar, ArrowRight } from "lucide-react";
import { formatDate, truncateText, stripHtml } from "@/lib/utils";
import { GlowCard } from "@/components/ui/glow-card";

function ArticleCard({ article }: { article: any }) {
  const summary = article.summary || stripHtml(article.content);
  return (
    <GlowCard>
      {article.imageUrl && (
        <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 mb-4 -mt-1 relative h-48">
          <Image
            src={article.imageUrl}
            alt={article.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
            loading="lazy"
          />
        </div>
      )}
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
        <Calendar size={12} className="text-[#1a7fe0]" />
        <span>{formatDate(article.createdAt)}</span>
      </div>
      <h3 className="font-bold text-lg text-slate-900 mb-3 leading-snug">{article.title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed mb-5 flex-1">{truncateText(summary, 150)}</p>
      <Link href={`/meqaleler/${article.id}`}
        className="btn-primary text-sm flex items-center justify-center gap-2 group">
        Oxu
        <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </GlowCard>
  );
}

export default memo(ArticleCard);
