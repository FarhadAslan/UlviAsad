"use client";

import { memo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Calendar, ArrowRight, Share2, Check } from "lucide-react";
import { formatDate, truncateText, stripHtml } from "@/lib/utils";
import { GlowCard } from "@/components/ui/glow-card";

function ArticleCard({ article }: { article: any }) {
  const summary   = article.summary || (article.content ? stripHtml(article.content) : "");
  const detailUrl = `/meqaleler/${article.id}`;
  const [copied, setCopied] = useState(false);

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}${detailUrl}`;
    if (navigator.share) {
      try { await navigator.share({ title: article.title, url }); } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        prompt("Linki kopyalayın:", url);
      }
    }
  };

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

      {/* Tarix + paylaş */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Calendar size={12} className="text-[#1a7fe0]" />
          <span>{formatDate(article.createdAt)}</span>
        </div>
        <button
          onClick={handleShare}
          className="p-1.5 rounded-lg text-slate-400 hover:text-[#1a7fe0] hover:bg-blue-50 transition-all"
          title="Paylaş"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Share2 size={14} />}
        </button>
      </div>

      <h3 className="font-bold text-lg text-slate-900 mb-3 leading-snug">{article.title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed mb-5 flex-1">{truncateText(summary, 150)}</p>

      <Link
        href={detailUrl}
        className="btn-primary text-sm flex items-center justify-center gap-2 group"
      >
        Oxu
        <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </GlowCard>
  );
}

export default memo(ArticleCard);
