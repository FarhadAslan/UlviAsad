"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, X, Loader2, Bot, CheckCircle2, AlertCircle } from "lucide-react";
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

// Hər batch üçün maksimum sual sayı
const BATCH_SIZE = 10;
// Paralel göndərilən batch sayı
const PARALLEL_BATCHES = 3;

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
  const [progress, setProgress]           = useState(0);       // 0-100
  const [progressText, setProgressText]   = useState("");
  const [failedBatches, setFailedBatches] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/ai-bots?active=true", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setBots(d); })
      .catch(() => {})
      .finally(() => setBotsLoading(false));
  }, []);

  const selectedBot = bots.find((b) => b.id === botId);

  // Tək batch sorğusu
  const fetchOneBatch = async (
    batchIndex: number,
    batchSize: number,
    avoidTexts: string[],
    signal: AbortSignal,
  ): Promise<any[]> => {
    const res = await fetch("/api/ai/generate-quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        category,
        language,
        botId: botId || undefined,
        batchIndex,
        batchSize,
        avoidTexts,
      }),
      signal,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.questions || [];
  };

  const handleGenerate = async () => {
    if (!title.trim()) { error("Quiz mövzusu daxil edin"); return; }
    if (questionCount < 1 || questionCount > 50) { error("Sual sayı 1-50 arasında olmalıdır"); return; }

    setLoading(true);
    setProgress(0);
    setFailedBatches(0);
    setProgressText("Hazırlanır...");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Batch-ləri hesabla
      const batches: number[] = [];
      let remaining = questionCount;
      while (remaining > 0) {
        batches.push(Math.min(remaining, BATCH_SIZE));
        remaining -= BATCH_SIZE;
      }

      const totalBatches = batches.length;
      const allQuestions: any[] = [];
      let reviewQuestions: any[] = [];
      let completedBatches = 0;
      let failed = 0;

      setProgressText(`0 / ${questionCount} sual yaradılır...`);

      // Batch-ləri PARALLEL_BATCHES qədər paralel işlət
      for (let i = 0; i < totalBatches; i += PARALLEL_BATCHES) {
        if (controller.signal.aborted) break;

        const chunk = batches.slice(i, i + PARALLEL_BATCHES);

        // Bu qrup batch-ləri paralel göndər
        const results = await Promise.allSettled(
          chunk.map((batchSize, offset) => {
            const batchIndex = i + offset;
            // Artıq yaradılmış sualların mətnlərini göndər (dublikat olmasın)
            const avoidTexts = allQuestions
              .slice(0, 40) // max 40 sual göndər (token limit)
              .map((q: any) => q.text?.slice(0, 80))
              .filter(Boolean);

            return fetchOneBatch(batchIndex, batchSize, avoidTexts, controller.signal);
          })
        );

        for (const result of results) {
          if (result.status === "fulfilled") {
            allQuestions.push(...result.value);
            completedBatches++;
          } else {
            // Abort xətasını yenidən throw et
            if (result.reason?.name === "AbortError") throw result.reason;
            console.error("Batch xətası:", result.reason?.message);
            failed++;
            completedBatches++;
          }
        }

        setFailedBatches(failed);
        const pct = Math.round((completedBatches / totalBatches) * 100);
        setProgress(pct);
        setProgressText(`${Math.min(allQuestions.length, questionCount)} / ${questionCount} sual yaradıldı...`);
      }

      // İlk batch-dən reviewQuestions al (əgər bot seçilibsə)
      if (botId) {
        try {
          const firstRes = await fetch("/api/ai/generate-quiz", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title, category, language,
              botId: botId || undefined,
              batchIndex: 0, batchSize: 1,
              avoidTexts: [],
              reviewOnly: true,
            }),
            signal: controller.signal,
          });
          if (firstRes.ok) {
            const d = await firstRes.json();
            reviewQuestions = d.reviewQuestions || [];
          }
        } catch { /* review sualları olmasa da olur */ }
      }

      const finalQuestions = allQuestions.slice(0, questionCount);

      if (finalQuestions.length === 0) {
        error("AI heç bir sual yarada bilmədi. Bir az gözləyib yenidən cəhd edin.");
        return;
      }

      const allFinal = [...finalQuestions, ...reviewQuestions];

      setProgress(100);
      setProgressText(`${allFinal.length} sual hazırdır!`);

      await new Promise((r) => setTimeout(r, 400)); // qısa animasiya

      if (failed > 0 && finalQuestions.length < questionCount) {
        success(`${finalQuestions.length} sual yaradıldı (${failed} batch uğursuz oldu)`);
      } else {
        success(`${allFinal.length} sual yaradıldı!`);
      }

      onGenerate(allFinal, category || undefined);
      onClose();
    } catch (err: any) {
      if (err?.name === "AbortError") {
        error("Əməliyyat ləğv edildi.");
      } else if (!navigator.onLine) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
    >
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh]">

        {/* Drag handle — mobil */}
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

          {/* Progress — yüklənərkən göstər */}
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
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                    background: "linear-gradient(90deg,#667eea,#764ba2)",
                  }}
                />
              </div>
              {failedBatches > 0 && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {failedBatches} batch uğursuz oldu, davam edir...
                </p>
              )}
            </div>
          )}

          {/* AI Bot seçimi */}
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
            {questionCount > 10 && (
              <p className="mt-1 text-xs text-slate-400">
                {Math.ceil(questionCount / BATCH_SIZE)} batch paralel göndəriləcək
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
            <p className="font-medium mb-1">💡 Məsləhət:</p>
            <ul className="space-y-0.5 text-purple-600">
              <li>• Bot seçsəniz — AI yalnız botun bilik bazasından sual yaradacaq</li>
              <li>• 50 sual üçün ~30-60 saniyə lazımdır</li>
              <li>• Suallar batch-batch yaradılır, progress izlənilir</li>
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
