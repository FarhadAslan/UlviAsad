"use client";

import { useState, useMemo } from "react";
import { formatDate, getCategoryLabel, getTypeLabel, getRoleLabel } from "@/lib/utils";
import Link from "next/link";
import { User, Trophy, Target, Star, Zap, Calendar, Eye, Share2, Check } from "lucide-react";
import ResultDetailModal from "@/components/ResultDetailModal";
import Pagination from "@/components/Pagination";

interface ProfileData {
  user: any;
  stats: any;
  results: any[];
}

const RESULTS_PAGE_SIZE = 8;

const roleBadge: Record<string, { bg: string; color: string; border: string }> = {
  ADMIN:   { bg: "#fee2e2", color: "#dc2626", border: "#fecaca" },
  STUDENT: { bg: "rgba(147,204,255,0.15)", color: "#1a7fe0", border: "rgba(147,204,255,0.35)" },
  USER:    { bg: "#f1f5f9", color: "#475569", border: "#e2e8f0" },
};

export default function ProfileClient({ data }: { data: ProfileData }) {
  const { user, stats, results } = data;
  const rb = roleBadge[user.role] || roleBadge.USER;
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [copiedId,          setCopiedId]         = useState<string | null>(null);
  const [resultsPage,       setResultsPage]       = useState(1);

  const totalResultPages = Math.ceil(results.length / RESULTS_PAGE_SIZE);
  const paginatedResults = useMemo(
    () => results.slice((resultsPage - 1) * RESULTS_PAGE_SIZE, resultsPage * RESULTS_PAGE_SIZE),
    [results, resultsPage]
  );

  const copyResultLink = async (e: React.MouseEvent, resultId: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}/neticeler/${resultId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(resultId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      prompt("Linki kopyalayın:", url);
    }
  };

  const statCards = [
    { icon: Target, label: "İşlənən Quiz",    value: stats.totalQuizzes,  color: "#1a7fe0", bg: "rgba(147,204,255,0.1)" },
    { icon: Star,   label: "Ortalama Xal",    value: stats.averageScore,  color: "#1f6f43", bg: "rgba(31,111,67,0.1)" },
    { icon: Trophy, label: "Ən Yaxşı Nəticə", value: stats.bestScore,     color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
    { icon: Zap,    label: "Ümumi Xal",       value: stats.totalPoints,   color: "#7c3aed", bg: "rgba(124,58,237,0.1)" },
  ];

  return (
    <div className="container mx-auto py-12 max-w-5xl">
      <h1 className="text-4xl font-bold text-slate-900 mb-8">Profilim</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Profile card */}
        <div className="card-static flex flex-col items-center text-center py-8">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg,#1a7fe0,rgb(147,204,255))" }}>
            {user.image
              ? <img src={user.image} alt={user.name} className="w-full h-full rounded-2xl object-cover" />
              : <User size={36} className="text-white" />}
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">{user.name}</h2>
          <p className="text-slate-500 text-sm mb-3">{user.email}</p>
          <span className="text-xs px-3 py-1 rounded-full font-semibold"
            style={{ background: rb.bg, color: rb.color, border: `1px solid ${rb.border}` }}>
            {getRoleLabel(user.role)}
          </span>
          <p className="text-slate-400 text-xs mt-4 flex items-center gap-1.5">
            <Calendar size={12} />
            {formatDate(user.createdAt)} tarixindən üzv
          </p>
        </div>

        {/* Stats */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          {statCards.map((s) => (
            <div key={s.label} className="card-static">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
                style={{ background: s.bg }}>
                <s.icon size={22} style={{ color: s.color }} />
              </div>
              <p className="text-3xl font-bold mb-1" style={{ color: s.color }}>{s.value}</p>
              <p className="text-sm text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      <div className="card-static">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-900">Quiz Tarixçəsi</h3>
          {results.length > 0 && (
            <span className="text-sm text-slate-400">{results.length} nəticə</span>
          )}
        </div>

        {results.length > 0 ? (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {["Quiz Adı", "Tip", "Nəticə", "Tarix", "Əməliyyatlar"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedResults.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedResultId(r.id)}
                    >
                      <td className="py-3 pr-4">
                        <p className="font-medium text-sm text-slate-800">{r.quizTitle}</p>
                        <p className="text-xs text-slate-400">{getCategoryLabel(r.quizCategory)}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={r.quizType === "SINAQ" ? "badge-type-sinaq" : "badge-type-test"}>
                          {getTypeLabel(r.quizType)}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-bold text-[#1f6f43]">{r.correct}/{r.totalQuestions}</span>
                        <span className="text-xs text-slate-400 ml-1.5">({r.score} bal)</span>
                      </td>
                      <td className="py-3 pr-4 text-sm text-slate-400">{formatDate(r.createdAt)}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedResultId(r.id); }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#1a7fe0] hover:bg-blue-50 border border-[rgba(147,204,255,0.4)] transition-all"
                            title="Detaylı bax"
                          >
                            <Eye size={13} /> Detay
                          </button>
                          <button
                            onClick={(e) => copyResultLink(e, r.id)}
                            className="p-1.5 rounded-lg text-[#1a7fe0] hover:bg-blue-50 transition-all"
                            title="Nəticə linkini kopyala"
                          >
                            {copiedId === r.id
                              ? <Check size={13} className="text-green-500" />
                              : <Share2 size={13} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {paginatedResults.map((r) => (
                <div
                  key={r.id}
                  className="p-4 rounded-xl border border-slate-100 bg-slate-50 cursor-pointer hover:border-[rgba(147,204,255,0.4)] transition-all"
                  onClick={() => setSelectedResultId(r.id)}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-800 truncate">{r.quizTitle}</p>
                      <p className="text-xs text-slate-400">{getCategoryLabel(r.quizCategory)}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedResultId(r.id); }}
                        className="p-1.5 rounded-lg text-[#1a7fe0] hover:bg-blue-50 transition-all"
                        title="Detaylı bax"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={(e) => copyResultLink(e, r.id)}
                        className="p-1.5 rounded-lg text-[#1a7fe0] hover:bg-blue-50 transition-all"
                        title="Paylaş"
                      >
                        {copiedId === r.id
                          ? <Check size={14} className="text-green-500" />
                          : <Share2 size={14} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={r.quizType === "SINAQ" ? "badge-type-sinaq" : "badge-type-test"}>
                      {getTypeLabel(r.quizType)}
                    </span>
                    <span className="font-bold text-sm text-[#1f6f43]">{r.correct}/{r.totalQuestions}</span>
                    <span className="text-xs text-slate-400">({r.score} bal)</span>
                    <span className="text-xs text-slate-400 ml-auto">{formatDate(r.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>

            <Pagination
              page={resultsPage}
              totalPages={totalResultPages}
              onPageChange={(p) => setResultsPage(p)}
            />
          </>
        ) : (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-slate-500 mb-4">Hələ heç bir quiz işləməmisiniz</p>
            <Link href="/quizler" className="btn-primary inline-flex">Quizlərə Bax</Link>
          </div>
        )}
      </div>

      {/* Result Detail Modal */}
      {selectedResultId && (
        <ResultDetailModal
          resultId={selectedResultId}
          onClose={() => setSelectedResultId(null)}
        />
      )}
    </div>
  );
}
