"use client";

import { useEffect, useState } from "react";
import { X, CheckCircle, XCircle, MinusCircle, Loader2 } from "lucide-react";
import { getCategoryLabel, getTypeLabel, formatDate } from "@/lib/utils";

interface ResultDetailModalProps {
  resultId: string;
  onClose: () => void;
  userName?: string;
}

export default function ResultDetailModal({ resultId, onClose, userName }: ResultDetailModalProps) {
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    fetch(`/api/results/${resultId}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setData(d); })
      .catch(() => setError("Məlumat yüklənmədi"))
      .finally(() => setLoading(false));
  }, [resultId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    // Scroll-u blokla
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const total      = data?.quiz?.questions?.length ?? 0;
  const percentage = data && total > 0 ? Math.round((data.correct / total) * 100) : 0;
  const scoreColor = percentage >= 60 ? "#22c55e" : percentage >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal — mobilda tam ekran alt sheet, desktopda mərkəzdə */}
      <div
        className="
          w-full sm:w-[95vw] sm:max-w-2xl
          max-h-[92vh] sm:max-h-[88vh]
          flex flex-col
          bg-white
          rounded-t-3xl sm:rounded-2xl
          shadow-2xl
          overflow-hidden
        "
        style={{ border: "1px solid rgba(147,204,255,0.25)" }}
      >
        {/* Drag handle — yalnız mobil */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug truncate">
              {loading ? "Yüklənir..." : (data?.quiz?.title ?? "Nəticə Detayı")}
            </h2>
            {userName && (
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                İstifadəçi: <span className="font-medium text-slate-700">{userName}</span>
              </p>
            )}
            {data && (
              <p className="text-xs text-slate-400 mt-0.5">
                {getCategoryLabel(data.quiz.category)} · {getTypeLabel(data.quiz.type)} · {formatDate(data.createdAt)}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4 sm:py-5">

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={32} className="text-[#1a7fe0] animate-spin" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-center py-12 text-red-500 text-sm">{error}</div>
          )}

          {data && (
            <>
              {/* Score summary — 4 kart */}
              <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-5">
                {[
                  { label: "Xal",      value: data.score,   color: "#1a7fe0" },
                  { label: "Düzgün",   value: data.correct, color: "#22c55e" },
                  { label: "Səhv",     value: data.wrong,   color: "#ef4444" },
                  { label: "Keçilmiş", value: data.skipped, color: "#94a3b8" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-slate-100 bg-slate-50 p-2 sm:p-3 text-center">
                    <p className="text-xl sm:text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 leading-tight">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div className="mb-5 sm:mb-6">
                <div className="flex items-center justify-between text-xs sm:text-sm mb-1.5">
                  <span className="text-slate-500">Ümumi nəticə</span>
                  <span className="font-bold" style={{ color: scoreColor }}>{percentage}%</span>
                </div>
                <div className="h-2 sm:h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${percentage}%`, background: scoreColor }}
                  />
                </div>
              </div>

              {/* Questions */}
              <div className="space-y-3 sm:space-y-4">
                {data.quiz.questions.map((q: any, i: number) => {
                  const answerDetail = data.answers?.find((a: any) => a.questionId === q.id);
                  const selected     = answerDetail?.selected;
                  const isCorrect    = answerDetail?.isCorrect;
                  const correctOpt   = q.correctOption;

                  const statusIcon = !selected
                    ? <MinusCircle size={15} className="text-slate-400 flex-shrink-0" />
                    : isCorrect
                    ? <CheckCircle size={15} className="text-green-500 flex-shrink-0" />
                    : <XCircle    size={15} className="text-red-500 flex-shrink-0" />;

                  return (
                    <div key={q.id} className="rounded-xl border border-slate-200 overflow-hidden">
                      {/* Question header */}
                      <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-slate-50">
                        <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-200 text-slate-600 text-[10px] sm:text-xs font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          {q.imageUrl && (
                            <div className="mb-2 rounded-lg overflow-hidden border border-slate-200">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={q.imageUrl} alt="" className="w-full object-contain max-h-36 sm:max-h-48" />
                            </div>
                          )}
                          {q.text && (
                            <p
                              className="text-xs sm:text-sm font-medium text-slate-800 leading-relaxed quiz-render"
                              dangerouslySetInnerHTML={{ __html: q.text }}
                            />
                          )}
                          {!q.text && q.imageUrl && (
                            <p className="text-xs text-slate-500">(şəkilli sual)</p>
                          )}
                        </div>
                        {statusIcon}
                      </div>

                      {/* Options */}
                      <div className="p-2 sm:p-3 space-y-1.5 sm:space-y-2">
                        {q.options.map((opt: any) => {
                          const isCorrectOpt  = opt.label === correctOpt;
                          const isSelectedOpt = opt.label === selected;
                          const isWrongSelect = isSelectedOpt && !isCorrect;

                          let cls = "flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-lg text-xs sm:text-sm ";
                          if (isCorrectOpt)   cls += "bg-green-50 border border-green-300 text-green-800 font-medium";
                          else if (isWrongSelect) cls += "bg-red-50 border border-red-300 text-red-800 font-medium";
                          else                cls += "bg-white border border-slate-100 text-slate-600";

                          return (
                            <div key={opt.label} className={cls}>
                              <span className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md flex items-center justify-center text-[10px] sm:text-xs font-bold flex-shrink-0 ${
                                isCorrectOpt   ? "bg-green-200 text-green-800" :
                                isWrongSelect  ? "bg-red-200 text-red-800" :
                                                 "bg-slate-100 text-slate-500"
                              }`}>
                                {opt.label}
                              </span>
                              <span className="flex-1 leading-snug">{opt.text}</span>
                              {isCorrectOpt  && <CheckCircle size={13} className="text-green-500 flex-shrink-0" />}
                              {isWrongSelect && <XCircle    size={13} className="text-red-500 flex-shrink-0" />}
                            </div>
                          );
                        })}
                        {!selected && (
                          <p className="text-[10px] sm:text-xs text-slate-400 pl-1 pt-0.5">⏭ Cavablanmamış</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full btn-secondary py-2.5 text-sm"
          >
            Bağla
          </button>
        </div>
      </div>
    </div>
  );
}
