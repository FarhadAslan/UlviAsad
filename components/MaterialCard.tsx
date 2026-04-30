"use client";

import { memo } from "react";
import Link from "next/link";
import { Lock, Download, Eye } from "lucide-react";
import { getCategoryLabel, getFileTypeIcon } from "@/lib/utils";
import { GlowCard } from "@/components/ui/glow-card";
import ShareIconButton from "@/components/ShareIconButton";

function MaterialCard({ material, userRole }: { material: any; userRole?: string }) {
  const isLocked    = material.visibility === "STUDENT_ONLY" && (!userRole || userRole === "USER");
  const downloadUrl = `/api/download?url=${encodeURIComponent(material.fileUrl)}&filename=${encodeURIComponent(material.title)}`;
  const detailPath  = `/materiallar/${material.id}`;

  return (
    <div className="relative h-full">
      <GlowCard>
        {isLocked && (
          <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center z-20 backdrop-blur-sm bg-white/80">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <Lock size={22} className="text-slate-400" />
            </div>
            <p className="font-semibold text-sm text-slate-700">Giriş tələb olunur</p>
            <p className="text-xs text-slate-400 mt-1">Tələbə rolu lazımdır</p>
          </div>
        )}

        {/* Icon + paylaş */}
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            style={{ background: "rgba(147,204,255,0.12)", border: "1px solid rgba(147,204,255,0.25)" }}>
            {getFileTypeIcon(material.fileType)}
          </div>
          {!isLocked && (
            <ShareIconButton title={material.title} path={detailPath} />
          )}
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="badge-category">{getCategoryLabel(material.category)}</span>
          <span className="text-[0.65rem] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide bg-slate-100 text-slate-500 border border-slate-200">
            {material.fileType}
          </span>
          {material.visibility === "STUDENT_ONLY" && (
            <span className="text-[0.65rem] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide bg-amber-50 text-amber-600 border border-amber-200">
              🔒 Tələbə
            </span>
          )}
        </div>

        <h3 className="font-bold text-base text-slate-900 mb-4 flex-1 leading-snug">{material.title}</h3>

        {isLocked ? (
          <button className="btn-secondary text-sm flex items-center justify-center gap-2 w-full" disabled>
            <Lock size={13} /> Kilidli
          </button>
        ) : (
          <div className="flex gap-2">
            <Link
              href={detailPath}
              className="flex-1 btn-primary text-sm flex items-center justify-center gap-1.5"
            >
              <Eye size={13} /> Bax
            </Link>
            <a
              href={downloadUrl}
              className="flex-1 btn-secondary text-sm flex items-center justify-center gap-1.5"
            >
              <Download size={13} /> Yüklə
            </a>
          </div>
        )}
      </GlowCard>
    </div>
  );
}

export default memo(MaterialCard);
