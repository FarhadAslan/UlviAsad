"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, X, Loader2, Bot, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/toast-1";

interface AiBot {
  id: string;
  name: string;
  category: string;
  active: boolean;
}

interface AIQuizGeneratorProps {
  onGenerate: (questions: any[], category?: string) => void;
  onClose: () => void;
  categories: { value: string; label: string }[];
}

// Server özü paralel işləyir — frontend tək sorğu göndərir
// Yalnız 50 sual üçün 2 sorğuya böl (hər biri 25, server retry ilə tamamlayır)
const SPLIT_THRESHOLD = 49;

export default function AIQuizGenerator({ onGenerate, onClose, categories }: AIQuizGeneratorProps) {
  const { success, error } = useToast();
  const [title, setTitle]                 = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [category, setCategory]           = useState("");
  const [language, setLanguage]           = useState("az");
  const [botId, setBotId]                 = useState<string>("");
  const [bots, setBots]                   = useState<AiBot[]>([]);
  const [botsLoading, setBotsLoading]     = useState(true);
  const [loading, setLoading]             = useState(false);
  const [progress, setProgress]           = useState(0);
  const [progressText, setProgressText]   = useState("");
  const [failedCount, setFailedCount]     = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/ai-bots?active=true", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setBots(d); })
      .catch(() => {})
      .finally(() => setBotsLoading(false));
  }, []);

  const selectedBot = bots.find((b) => b.id === botId);

  // Tək API sorğusu
  const fetchQuestions = async (
    count: number,
    avoidTexts: string[],
    signal: AbortSignal,
  ): Promise<{ questions: any[]; reviewQuestions: any[] }> => {
    const res = await fetch("/api/ai/generate-quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        questionCount: count,
        category,
        language,
        botId: botId || undefined,
        avoidTexts,
      }),
      signal,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    return res.json();
  };

  const handleGenerate = async () => {
    if (!title.trim()) { error("Quiz mövzusu daxil edin"); return; }
    if (questionCount < 1 || questionCount > 50) { error("Sual sayı 1-50 arasında olmalıdır"); return; }

    setLoading(true);
    setProgress(5);
    setFailedCount(0);
    setProgressText("AI modellər işə başlayır...");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let allQuestions: any[] = [];
      let reviewQuestions: any[] = [];

      if (questionCount <= SPLIT_THRESHOLD) {
        // ── Tək sorğu — server içəridə bütün modelləri paralel işlədir ──
        setProgressText(`${questionCount} sual üçün paralel sorğu göndərilir...`);
        setProgress(20);

        const data = await fetchQuestions(questionCount, [], controller.signal);
        allQuestions    = data.questions       || [];
        reviewQuestions = data.reviewQuestions || [];
        setProgress(90);

      } else {
        // ── İki paralel sorğu: hər biri yarısını alır ──
        const half1 = Math.ceil(questionCount / 2);
        const half2 = questionCount - half1;

        setProgressText(`${questionCount} sual — 2 paralel sorğu göndərilir...`);
        setProgress(15);

        const [res1, res2] = await Promise.allSettled([
          fetchQuestions(half1, [], controller.signal),
          fetchQuestions(half2, [], controller.signal),
        ]);

        let failed = 0;

        if (res1.status === "fulfilled") {
          allQuestions.push(...(res1.value.questions || []));
          reviewQuestions = res1.value.reviewQuestions || [];
        } else {
          if (res1.reason?.name === "AbortError") throw res1.reason;
          console.error("Sorğu 1 uğursuz:", res1.reason?.message);
          failed++;
        }

        if (res2.status === "fulfilled") {
          // Dublikatları sil
          const existingTexts = new Set(allQuestions.map((q: any) => q.text?.trim().toLowerCase()));
          for (const q of (res2.value.questions || [])) {
            const key = q.text?.trim().toLowerCase();
            if (key && !existingTexts.has(key)) {
              existingTexts.add(key);
              allQuestions.push(q);
            }
          }
          if (reviewQuestions.length === 0) {
            reviewQuestions = res2.value.reviewQuestions || [];
          }
        } else {
          if (res2.reason?.name === "AbortError") throw res2.reason;
          console.error("Sorğu 2 uğursuz:", res2.reason?.message);
          failed++;
        }

        setFailedCount(failed);
        setProgress(90);
      }

      if (allQuestions.length === 0) {
        error("AI heç bir sual yarada bilmədi. Bir az gözləyib yenidən cəhd edin.");
        return;
      }

      const finalQuestions = allQuestions.slice(0, questionCount);
      const allFinal = [...finalQuestions, ...reviewQuestions];

      setProgress(100);
      setProgressText(`${allFinal.length} sual hazırdır!`);
      await new Promise((r) => setTimeout(r, 350));

      if (failedCount > 0) {
        success(`${finalQuestions.length} sual yaradıldı (bəzi sorğular uğursuz oldu)`);
      } else {
        success(`${allFinal.length} sual yaradıldı!`);
      }

      onGenerate(allFinal, category || undefined);
      onClose();

    } catch (err: any) {
      if (err?.name === "AbortError") {
        error("Əməliyyat ləğv edildi.");
      } else if (typeof navigator !== "undefined" && !navigator.onLine) {
        error("İnternet bağlantısı yoxdur.");
      } else {
        error(err?.message || "Xəta baş verdi. Yenidən cəhd edin.");
      }
    } finally {
      setLoading(false);
      setProgress(0);
      setProgressText("");
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  // Neçə model paralel işləyəcəyini göstər
  const workerCount = questionCount <= SPLIT_THRESHOLD ? 4 : 8;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
    >
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh]">

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)" }}
        >
          <div className="flex items-center gap-2 text-white">
            <Sparkles size={18} />
            <h2 className="text-base sm:text-lg font-bold">AI ilə Quiz Yarat</h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">

          {/* Progress */}
          {loading && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-purple-700 font-medium flex items-center gap-1.5">
                  <Loader2 size={14} className="animate-spin" />
                  {progressText}
                </span>
                <span className="text-purple-500 text-xs">{progress}%</span>
              </div>
              <div className="w-full bg-purple-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full transition-all duration-700"
                  style={{
                    width: `${progress}%`,
                    background: "linear-gradient(90deg,#667eea,#764ba2)",
                  }}
                />
              </div>
              {failedCount > 0 && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle size={12} />
                  Bəzi sorğular uğursuz oldu, mövcud nəticələr qaytarılır...
                </p>
              )}
            </div>
          )}

          {/* AI Bot */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              AI Bot <span className="text-slate-400 text-xs">(isteğe bağlı)</span>
            </label>
            {botsLoading ? (
              <div className="input-field flex items-center gap-2 text-slate-400 text-sm">
                <Loader2 size={14} className="animate-spin" /> Botlar yüklənir...
              </div>
            ) : bots.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-3 text-center text-sm text-slate-400">
                <Bot size={18} className="mx-auto mb-1 opacity-40" />
                Hələ AI bot yaradılmayıb.{" "}
                <a href="/admin/ai-botlar" target="_blank" className="text-[#1a7fe0] hover:underline font-medium">
                  Bot yarat →
                </a>
              </div>
            ) : (
              <select
                value={botId}
                onChange={(e) => {
                  const val = e.target.value;
                  setBotId(val);
                  if (val === "") {
                    setCategory("");
                  } else {
                    const bot = bots.find((b) => b.id === val);
                    if (bot?.category) setCategory(bot.category);
                  }
                }}
                className="select-field"
                disabled={loading}
              >
                <option value="">Ümumi AI (Bot olmadan)</option>
                {bots.map((bot) => (
                  <option key={bot.id} value={bot.id}>
                    {bot.name} {bot.category ? `(${bot.category})` : ""}
                  </option>
                ))}
              </select>
            )}
            {selectedBot && (
              <div className="mt-2 rounded-lg p-2.5 text-xs text-purple-700 bg-purple-50 border border-purple-100">
                🤖 <strong>{selectedBot.name}</strong> — suallar yalnız bu botun bilik bazasından yaradılacaq
              </div>
            )}
          </div>

          {/* Mövzu */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Quiz Mövzusu <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Məs: Azərbaycan Konstitusiyası, Cəbr..."
              className="input-field"
              disabled={loading}
            />
          </div>

          {/* Sual sayı */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Sual Sayı <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={questionCount}
              onChange={(e) => setQuestionCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
              min={1}
              max={50}
              className="input-field"
              disabled={loading}
            />
            {!loading && questionCount > 0 && (
              <p className="mt-1 text-xs text-slate-400">
                {questionCount <= SPLIT_THRESHOLD
                  ? `~4 model eyni anda işləyəcək`
                  : `~8 model 2 paralel sorğu ilə işləyəcək`}
              </p>
            )}
          </div>

          {/* Kateqoriya */}
          {categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Kateqoriya <span className="text-slate-400 text-xs">(isteğe bağlı)</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="select-field"
                disabled={loading}
              >
                <option value="">Avtomatik seç</option>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Məsləhət */}
          <div className="rounded-xl p-3 text-xs text-purple-700 border border-purple-200 bg-purple-50">
            <p className="font-medium mb-1">⚡ Necə işləyir:</p>
            <ul className="space-y-0.5 text-purple-600">
              <li>• Groq + OpenRouter modelləri eyni anda paralel işləyir</li>
              <li>• Hər model öz payını alır, nəticələr birləşdirilir</li>
              <li>• 50 sual üçün ~15-25 saniyə kifayətdir</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50 flex-shrink-0">
          {loading ? (
            <>
              <div
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 opacity-80 cursor-not-allowed"
                style={{ background: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)" }}
              >
                <Loader2 size={16} className="animate-spin" />
                Yaradılır... {progress}%
              </div>
              <button
                onClick={handleCancel}
                className="btn-secondary px-4 sm:px-6 text-sm text-red-500 border-red-200 hover:bg-red-50"
              >
                Dayandır
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleGenerate}
                disabled={!title.trim()}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                style={{ background: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)" }}
              >
                <Sparkles size={16} />
                Quiz Yarat
              </button>
              <button
                onClick={onClose}
                className="btn-secondary px-4 sm:px-6 text-sm"
              >
                Ləğv et
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
