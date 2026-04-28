"use client";

import { memo } from "react";
import Link from "next/link";
import { Lock, Trophy, Clock, HelpCircle } from "lucide-react";
import { getCategoryLabel, getTypeLabel } from "@/lib/utils";
import { GlowCard } from "@/components/ui/glow-card";

function QuizCard({ quiz, userRole }: { quiz: any; userRole?: string }) {
  const isLocked = quiz.visibility === "STUDENT_ONLY" && (!userRole || userRole === "USER");
  const questionCount = quiz._count?.questions ?? quiz.questions?.length ?? 0;
  const topResults = quiz.results?.slice(0, 3) || [];

  return (
    <div className="relative h-full">
      <GlowCard>
        {/* Lock overlay */}
        {isLocked && (
          <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center z-20 backdrop-blur-sm bg-white/80">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <Lock size={22} className="text-slate-400" />
            </div>
            <p className="font-semibold text-sm text-slate-700">Giriş tələb olunur</p>
            <p className="text-xs text-slate-400 mt-1">Tələbə rolu lazımdır</p>
          </div>
        )}

        {/* Badges */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="badge-category">{getCategoryLabel(quiz.category)}</span>
          <span className={quiz.type === "SINAQ" ? "badge-type-sinaq" : "badge-type-test"}>
            {getTypeLabel(quiz.type)}
          </span>
          {quiz.visibility === "STUDENT_ONLY" && (
            <span className="text-[0.65rem] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide bg-amber-50 text-amber-600 border border-amber-200">
              🔒 Tələbə
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-bold text-base text-slate-900 mb-3 flex-1 leading-snug">{quiz.title}</h3>

        {/* Meta */}
        <div className="flex items-center gap-4 text-xs text-slate-400 mb-4">
          <span className="flex items-center gap-1.5">
            <HelpCircle size={13} className="text-[#1a7fe0]" />
            {questionCount} sual
          </span>
          {quiz.type === "SINAQ" && quiz.duration && (
            <span className="flex items-center gap-1.5">
              <Clock size={13} className="text-orange-400" />
              {quiz.duration} dəq
            </span>
          )}
        </div>

        {/* Top 3 */}
        {topResults.length > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1.5 mb-2">
              <Trophy size={12} className="text-amber-500" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Top 3</span>
            </div>
            <div className="space-y-1">
              {topResults.map((r: any, i: number) => (
                <div key={r.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"} {r.user?.name || "İstifadəçi"}
                  </span>
                  <span className="font-semibold text-[#1f6f43]">{r.score} xal</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLocked ? (
          <Link href="/auth/giris" className="btn-secondary text-center text-sm">Giriş et</Link>
        ) : (
          <Link href={`/quizler/${quiz.id}`} className="btn-primary text-center text-sm">Başla</Link>
        )}
      </GlowCard>
    </div>
  );
}

export default memo(QuizCard);
