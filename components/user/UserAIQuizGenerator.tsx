"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, X, Loader2, Bot, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/toast-1";

interface AiBot {
  id: string;
  name: string;
  category: string;
  active: boolean;
  isUserBot?: boolean;
}

interface UserAIQuizGeneratorProps {
  onGenerate: (questions: any[], reviewQuestions?: any[], usedBotId?: string) => void;
  onClose: () => void;
  preselectedBotId?: string;
}

/* ─── Loader CSS ─────────────────────────────────────────────────────────── */
const LOADER_CSS = `
.uai-loader-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 160px;
  height: 160px;
  font-family: "Inter", sans-serif;
  font-size: 1.1em;
  font-weight: 300;
  color: white;
  border-radius: 50%;
  background-color: transparent;
  user-select: none;
}
.uai-loader {
  position: absolute;
  top: 0; left: 0;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  background-color: transparent;
  animation: uai-loader-rotate 2s linear infinite;
  z-index: 0;
}
@keyframes uai-loader-rotate {
  0%   { transform: rotate(90deg);  box-shadow: 0 10px 20px 0 #fff inset, 0 20px 30px 0 #ad5fff inset, 0 60px 60px 0 #471eec inset; }
  50%  { transform: rotate(270deg); box-shadow: 0 10px 20px 0 #fff inset, 0 20px 10px 0 #d60a47 inset, 0 40px 60px 0 #311e80 inset; }
  100% { transform: rotate(450deg); box-shadow: 0 10px 20px 0 #fff inset, 0 20px 30px 0 #ad5fff inset, 0 60px 60px 0 #471eec inset; }
}
.uai-loader-letter {
  display: inline-block;
  opacity: 0.4;
  transform: translateY(0);
  animation: uai-loader-letter-anim 2s infinite;
  z-index: 1;
}
.uai-loader-letter:nth-child(1)  { animation-delay: 0s;   }
.uai-loader-letter:nth-child(2)  { animation-delay: 0.1s; }
.uai-loader-letter:nth-child(3)  { animation-delay: 0.2s; }
.uai-loader-letter:nth-child(4)  { animation-delay: 0.3s; }
.uai-loader-letter:nth-child(5)  { animation-delay: 0.4s; }
.uai-loader-letter:nth-child(6)  { animation-delay: 0.5s; }
.uai-loader-letter:nth-child(7)  { animation-delay: 0.6s; }
.uai-loader-letter:nth-child(8)  { animation-delay: 0.7s; }
.uai-loader-letter:nth-child(9)  { animation-delay: 0.8s; }
.uai-loader-letter:nth-child(10) { animation-delay: 0.9s; }
@keyframes uai-loader-letter-anim {
  0%,100% { opacity: 0.4; transform: translateY(0);  }
  20%     { opacity: 1;   transform: scale(1.15);    }
  40%     { opacity: 0.7; transform: translateY(0);  }
}
`;

export default function UserAIQuizGenerator({
  onGenerate,
  onClose,
  preselectedBotId,
}: UserAIQuizGeneratorProps) {
  const { success, error } = useToast();
  const [title, setTitle]               = useState("");
  const [questionCount, setQuestionCount] = useState<string>("10");
  const [botId, setBotId]               = useState<string>(preselectedBotId || "");
  const [userBots, setUserBots]         = useState<AiBot[]>([]);
  const [botsLoading, setBotsLoading]   = useState(true);
  const [loading, setLoading]           = useState(false);
  const [progress, setProgress]         = useState(0);
  const [progressText, setProgressText] = useState("");
  const [failedCount, setFailedCount]   = useState(0);

  const abortRef        = useRef<AbortController | null>(null);
  const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const fakeProgressRef = useRef(0);

  useEffect(() => {
    fetch("/api/user-bots", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setUserBots(d.map((b: AiBot) => ({ ...b, isUserBot: true })));
      })
      .catch(() => {})
      .finally(() => setBotsLoading(false));
  }, []);

  useEffect(() => {
    if (preselectedBotId) setBotId(preselectedBotId);
  }, [preselectedBotId]);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const selectedBot = userBots.find((b) => b.id === botId);

  const startFakeProgress = () => {
    fakeProgressRef.current = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      fakeProgressRef.current += Math.random() * 2.5 + 0.5;
      if (fakeProgressRef.current > 88) fakeProgressRef.current = 88;
      setProgress(Math.round(fakeProgressRef.current));
    }, 350);
  };

  const stopFakeProgress = (final = 100) => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setProgress(final);
  };

  const fetchQuestions = async (
    count: number,
    signal: AbortSignal,
  ): Promise<{ questions: any[]; reviewQuestions: any[] }> => {
    const res = await fetch("/api/ai/generate-quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        questionCount: count,
        language: "az",
        botId: botId || undefined,
        avoidTexts: [],
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
    const count = parseInt(questionCount) || 0;
    if (!title.trim()) { error("Quiz mövzusu daxil edin"); return; }
    if (count < 1 || count > 50) { error("Sual sayı 1-50 arasında olmalıdır"); return; }

    setLoading(true);
    setProgress(0);
    setFailedCount(0);
    setProgressText(`${count} sual yaradılır...`);

    // React-ın render etməsi üçün bir tick gözlə
    await new Promise((r) => setTimeout(r, 50));

    startFakeProgress();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Həmişə 2 paralel sorğu — hər biri server-daxili 3 worker ilə işləyir
      const half1 = Math.ceil(count / 2);
      const half2 = count - half1;

      const [res1, res2] = await Promise.allSettled([
        fetchQuestions(half1, controller.signal),
        fetchQuestions(half2, controller.signal),
      ]);

      let allQuestions: any[] = [];
      let reviewQuestions: any[] = [];
      let failed = 0;

      if (res1.status === "fulfilled") {
        allQuestions.push(...(res1.value.questions || []));
        reviewQuestions = res1.value.reviewQuestions || [];
      } else {
        if (res1.reason?.name === "AbortError") throw res1.reason;
        failed++;
      }

      if (res2.status === "fulfilled") {
        const existingTexts = new Set(
          allQuestions.map((q: any) => q.text?.trim().toLowerCase())
        );
        for (const q of (res2.value.questions || [])) {
          const key = q.text?.trim().toLowerCase();
          if (!key || !existingTexts.has(key)) {
            if (key) existingTexts.add(key);
            allQuestions.push(q);
          }
        }
        if (reviewQuestions.length === 0) {
          reviewQuestions = res2.value.reviewQuestions || [];
        }
      } else {
        if (res2.reason?.name === "AbortError") throw res2.reason;
        failed++;
      }

      setFailedCount(failed);

      if (allQuestions.length === 0) {
        error("AI heç bir sual yarada bilmədi. Bir az gözləyib yenidən cəhd edin.");
        return;
      }

      const finalQuestions = allQuestions.slice(0, count);

      stopFakeProgress(100);
      setProgressText(`${finalQuestions.length + reviewQuestions.length} sual hazırdır!`);
      await new Promise((r) => setTimeout(r, 600));

      const totalMsg = reviewQuestions.length > 0
        ? `${finalQuestions.length} yeni + ${reviewQuestions.length} təkrar sual əlavə edildi!`
        : `${finalQuestions.length} sual yaradıldı!`;
      success(totalMsg);

      onGenerate(finalQuestions, reviewQuestions, botId || undefined);
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
      stopFakeProgress(0);
      setLoading(false);
      setProgress(0);
      setProgressText("");
      abortRef.current = null;
    }
  };

  const handleCancel = () => { abortRef.current?.abort(); };

  return (
    <>
      <style>{LOADER_CSS}</style>

      {/* ── Loading overlay — fixed, modal-dan kənarda ── */}
      {loading && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-8"
          style={{ background: "linear-gradient(135deg, #0f0020 0%, #1a0533 40%, #2d1060 70%, #1a0533 100%)" }}
        >
          <div className="uai-loader-wrapper">
            <span className="uai-loader-letter">G</span>
            <span className="uai-loader-letter">e</span>
            <span className="uai-loader-letter">n</span>
            <span className="uai-loader-letter">e</span>
            <span className="uai-loader-letter">r</span>
            <span className="uai-loader-letter">a</span>
            <span className="uai-loader-letter">t</span>
            <span className="uai-loader-letter">i</span>
            <span className="uai-loader-letter">n</span>
            <span className="uai-loader-letter">g</span>
            <div className="uai-loader" />
          </div>

          <div className="w-64 space-y-3">
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, #ad5fff, #667eea)",
                }}
              />
            </div>
            <p className="text-center text-white/60 text-sm">{progressText}</p>
          </div>

          <button
            onClick={handleCancel}
            className="px-6 py-2.5 rounded-xl text-sm font-medium text-white/60 border border-white/15 hover:text-white hover:border-white/35 transition-all"
          >
            Dayandır
          </button>

          {failedCount > 0 && (
            <p className="text-xs text-amber-400 flex items-center gap-1.5">
              <AlertCircle size={13} />
              Bəzi sorğular uğursuz oldu, davam edir...
            </p>
          )}
        </div>
      )}

      {/* ── Modal ── */}
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
      >
        <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh]">

          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-slate-200" />
          </div>

          {/* Header */}
          <div
            className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex-shrink-0 rounded-t-2xl"
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

            {/* Bot seçimi */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Bot <span className="text-slate-400 text-xs">(isteğe bağlı)</span>
              </label>
              {botsLoading ? (
                <div className="input-field flex items-center gap-2 text-slate-400 text-sm">
                  <Loader2 size={14} className="animate-spin" /> Botlar yüklənir...
                </div>
              ) : userBots.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-3 text-center text-sm text-slate-400">
                  <Bot size={18} className="mx-auto mb-1 opacity-40" />
                  Hələ bot yaratmamısınız. "Botlarım" bölməsindən bot yaradın.
                </div>
              ) : (
                <select
                  value={botId}
                  onChange={(e) => setBotId(e.target.value)}
                  className="select-field"
                  disabled={loading}
                >
                  <option value="">Ümumi AI (Bot olmadan)</option>
                  {userBots.map((bot) => (
                    <option key={bot.id} value={bot.id}>
                      {bot.name}{bot.category ? ` (${bot.category})` : ""}
                    </option>
                  ))}
                </select>
              )}
              {selectedBot && (
                <div className="mt-2 rounded-lg p-2.5 text-xs bg-purple-50 border border-purple-100 text-purple-700">
                  🤖 <strong>{selectedBot.name}</strong> — yalnız bu PDF-in məzmunundan sual yaradılacaq
                  <p className="mt-1 text-purple-600">♻️ Əvvəlki quizlərinizdə <strong>səhv cavabladığınız suallar</strong> da avtomatik əlavə ediləcək</p>
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
                placeholder="Məs: Azərbaycan Tarixi, Riyaziyyat..."
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
                onChange={(e) => setQuestionCount(e.target.value)}
                onBlur={() => {
                  const n = parseInt(questionCount) || 1;
                  setQuestionCount(String(Math.min(50, Math.max(1, n))));
                }}
                min={1}
                max={50}
                className="input-field"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-slate-400">
                Groq + OpenRouter modelləri paralel işləyir
              </p>
            </div>

            <div className="rounded-xl p-3 text-xs text-purple-700 border border-purple-200 bg-purple-50">
              <p className="font-medium mb-1">💡 Məsləhət:</p>
              <ul className="space-y-0.5 text-purple-600">
                <li>• "Botlarım" bölməsindən öz PDF botunuzu seçin</li>
                <li>• Dəqiq mövzu adı daxil edin</li>
                <li>• 50 sual üçün ~20-40 saniyə kifayətdir</li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50 flex-shrink-0 rounded-b-2xl">
            <button
              onClick={handleGenerate}
              disabled={loading || !title.trim()}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)" }}
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Yaradılır...</>
                : <><Sparkles size={16} /> Quiz Yarat</>}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="btn-secondary px-4 sm:px-6 disabled:opacity-50 text-sm"
            >
              Ləğv et
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
