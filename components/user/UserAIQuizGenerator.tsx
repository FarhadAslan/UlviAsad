"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, X, Loader2, Bot, CheckCircle2, Zap, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/toast-1";

interface AiBot { id: string; name: string; category: string; active: boolean; isUserBot?: boolean; }

interface UserAIQuizGeneratorProps {
  onGenerate: (questions: any[], usedBotId?: string) => void;
  onClose: () => void;
  preselectedBotId?: string;
}

const LOADER_CSS = `
.uai-lw { position:relative;display:flex;align-items:center;justify-content:center;
  width:160px;height:160px;font-family:"Inter",sans-serif;font-size:1.1em;font-weight:300;
  color:white;border-radius:50%;background:transparent;user-select:none; }
.uai-lc { position:absolute;top:0;left:0;width:100%;aspect-ratio:1/1;border-radius:50%;
  background:transparent;animation:uai-rot 2s linear infinite;z-index:0; }
@keyframes uai-rot {
  0%  {transform:rotate(90deg); box-shadow:0 10px 20px 0 #fff inset,0 20px 30px 0 #ad5fff inset,0 60px 60px 0 #471eec inset;}
  50% {transform:rotate(270deg);box-shadow:0 10px 20px 0 #fff inset,0 20px 10px 0 #d60a47 inset,0 40px 60px 0 #311e80 inset;}
  100%{transform:rotate(450deg);box-shadow:0 10px 20px 0 #fff inset,0 20px 30px 0 #ad5fff inset,0 60px 60px 0 #471eec inset;}
}
.uai-ll { display:inline-block;opacity:.4;transform:translateY(0);animation:uai-la 2s infinite;z-index:1; }
.uai-ll:nth-child(1){animation-delay:0s}.uai-ll:nth-child(2){animation-delay:.1s}
.uai-ll:nth-child(3){animation-delay:.2s}.uai-ll:nth-child(4){animation-delay:.3s}
.uai-ll:nth-child(5){animation-delay:.4s}.uai-ll:nth-child(6){animation-delay:.5s}
.uai-ll:nth-child(7){animation-delay:.6s}.uai-ll:nth-child(8){animation-delay:.7s}
.uai-ll:nth-child(9){animation-delay:.8s}.uai-ll:nth-child(10){animation-delay:.9s}
@keyframes uai-la {
  0%,100%{opacity:.4;transform:translateY(0)}
  20%{opacity:1;transform:scale(1.15)}
  40%{opacity:.7;transform:translateY(0)}
}`;

// Frontend timeout backend-dən 5s artıq olsun ki, backend hər zaman əvvəl cavab qaytarsın
const FRONTEND_TIMEOUT_MS = 55_000;

export default function UserAIQuizGenerator({ onGenerate, onClose, preselectedBotId }: UserAIQuizGeneratorProps) {
  const { success, error, warning } = useToast();

  const [title,         setTitle]         = useState("");
  const [questionCount, setQuestionCount] = useState("10");
  const [botId,         setBotId]         = useState(preselectedBotId || "");
  const [userBots,      setUserBots]      = useState<AiBot[]>([]);
  const [botsLoading,   setBotsLoading]   = useState(true);
  const [loading,       setLoading]       = useState(false);
  const [progress,      setProgress]      = useState(0);
  const [progressText,  setProgressText]  = useState("");
  const [elapsed,       setElapsed]       = useState(0);

  const abortRef    = useRef<AbortController | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const fakeRef     = useRef(0);

  useEffect(() => {
    fetch("/api/user-bots", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setUserBots(d.map((b: AiBot) => ({ ...b, isUserBot: true }))); })
      .catch(() => {})
      .finally(() => setBotsLoading(false));
  }, []);

  useEffect(() => { if (preselectedBotId) setBotId(preselectedBotId); }, [preselectedBotId]);

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timerRef.current)    clearInterval(timerRef.current);
  }, []);

  const selectedBot = userBots.find(b => b.id === botId);

  const startProgress = () => {
    fakeRef.current = 0;
    setElapsed(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timerRef.current)    clearInterval(timerRef.current);

    intervalRef.current = setInterval(() => {
      fakeRef.current = Math.min(
        90,
        fakeRef.current + (fakeRef.current < 40 ? 4 : fakeRef.current < 70 ? 2 : fakeRef.current < 85 ? 0.8 : 0.2)
      );
      setProgress(Math.round(fakeRef.current));
    }, 400);

    let sec = 0;
    timerRef.current = setInterval(() => { sec++; setElapsed(sec); }, 1000);
  };

  const stopProgress = (val = 100) => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timerRef.current)    { clearInterval(timerRef.current);    timerRef.current    = null; }
    setProgress(val);
  };

  const handleGenerate = async () => {
    const count = parseInt(questionCount) || 0;
    if (!title.trim()) { error("Quiz mövzusu daxil edin"); return; }
    if (count < 1 || count > 50) { error("Sual sayı 1-50 arasında olmalıdır"); return; }

    setLoading(true);
    setProgress(0);
    setProgressText(`${count} sual yaradılır...`);
    await new Promise(r => setTimeout(r, 50));
    startProgress();

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const frontendTimeout = setTimeout(() => ctrl.abort(), FRONTEND_TIMEOUT_MS);

    try {
      const res = await fetch("/api/ai/generate-quiz", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          title:         title.trim(),
          questionCount: count,
          language:      "az",
          botId:         botId || undefined,
        }),
        signal: ctrl.signal,
      });

      clearTimeout(frontendTimeout);

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status} xətası`);
      }

      const data = await res.json();
      const questions: any[] = data.questions || [];
      const meta = data.meta || {};

      if (questions.length === 0) {
        throw new Error("AI heç bir sual yarada bilmədi. Mövzunu dəqiqləşdirərək yenidən cəhd edin.");
      }

      stopProgress(100);
      setProgressText(`${questions.length} sual hazırdır!`);
      await new Promise(r => setTimeout(r, 500));

      // Tam sual sayı gəlibsə — uğur
      if (!meta.warning) {
        success(`${questions.length} sual uğurla yaradıldı! ✓`);
      } else {
        // Qismən uğur — warning göstər amma davam et
        warning(`${questions.length} sual yaradıldı (${count} istənilmişdi). API limiti səbəbindən az gəldi.`);
      }
      
      // Qalan hüquq sayını göstər
      if (typeof meta.remaining === 'number') {
        console.log(`[AI Quiz] Saatda qalan hüquq: ${meta.remaining}`);
      }

      onGenerate(questions, botId || undefined);
      onClose();

    } catch (e: any) {
      clearTimeout(frontendTimeout);
      stopProgress(0);
      
      if (e?.name === "AbortError") {
        error("Vaxt aşıldı. Mövzunu qısaldın və ya sual sayını azaldın, yenidən cəhd edin.");
      } else if (typeof navigator !== "undefined" && !navigator.onLine) {
        error("İnternet bağlantısı yoxdur.");
      } else {
        error(e?.message || "Xəta baş verdi. Yenidən cəhd edin.");
      }
    } finally {
      clearTimeout(frontendTimeout);
      stopProgress(0);
      setLoading(false);
      setProgress(0);
      setProgressText("");
      setElapsed(0);
      abortRef.current = null;
    }
  };

  return (
    <>
      <style>{LOADER_CSS}</style>

      {/* Tam ekran loading overlay */}
      {loading && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-8"
          style={{ background: "linear-gradient(135deg,#0f0020 0%,#1a0533 40%,#2d1060 70%,#1a0533 100%)" }}
        >
          <div className="uai-lw">
            {"Generating".split("").map((ch, i) => (
              <span key={i} className="uai-ll">{ch}</span>
            ))}
            <div className="uai-lc" />
          </div>

          <div className="w-72 space-y-3">
            <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: "linear-gradient(90deg,#ad5fff,#667eea,#06b6d4)" }}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <p className="text-white/70">{progressText}</p>
              <p className="text-white/40 tabular-nums">{elapsed}s</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/50 space-y-1">
              <div className="flex items-center gap-1.5 text-purple-300">
                <Zap size={11} />
                <span>2 model paralel işləyir (rate limit qorunması)</span>
              </div>
              <div>Groq + OpenRouter modellərindən ən sürətlisi seçilir</div>
            </div>
          </div>

          <button
            onClick={() => abortRef.current?.abort()}
            className="px-6 py-2.5 rounded-xl text-sm font-medium text-white/60 border border-white/15 hover:text-white hover:border-white/35 transition-all"
          >
            Dayandır
          </button>
        </div>
      )}

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        onClick={e => { if (e.target === e.currentTarget && !loading) onClose(); }}
      >
        <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh]">

          <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-slate-200" />
          </div>

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
                  Hələ bot yaratmamısınız. &ldquo;Botlarım&rdquo; bölməsindən bot yaradın.
                </div>
              ) : (
                <select
                  value={botId}
                  onChange={e => setBotId(e.target.value)}
                  className="select-field"
                  disabled={loading}
                >
                  <option value="">Ümumi AI (Bot olmadan)</option>
                  {userBots.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}{b.category ? ` (${b.category})` : ""}
                    </option>
                  ))}
                </select>
              )}
              {selectedBot && (
                <div className="mt-2 rounded-lg p-2.5 text-xs bg-purple-50 border border-purple-100 text-purple-700 flex items-center gap-2">
                  <Bot size={13} className="flex-shrink-0" />
                  <span><strong>{selectedBot.name}</strong> — yalnız bu botun bilik bazasından sual yaradılacaq</span>
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
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !loading && title.trim()) handleGenerate(); }}
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
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={questionCount}
                  onChange={e => setQuestionCount(e.target.value)}
                  onBlur={() => {
                    const n = parseInt(questionCount) || 1;
                    setQuestionCount(String(Math.min(50, Math.max(1, n))));
                  }}
                  min={1}
                  max={50}
                  className="input-field w-24"
                  disabled={loading}
                />
                <div className="flex gap-1.5">
                  {[5, 10, 20, 30].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setQuestionCount(String(n))}
                      disabled={loading}
                      className={`px-2.5 py-1.5 text-xs rounded-lg font-medium transition-all border ${
                        questionCount === String(n)
                          ? "bg-purple-600 text-white border-purple-600"
                          : "bg-white text-slate-500 border-slate-200 hover:border-purple-300 hover:text-purple-600"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Maksimum 50 sual · Tövsiyə: 10-20 sual · Saatda 10 quiz limiti
              </p>
            </div>

            {/* Məlumat */}
            <div className="rounded-xl p-3 text-xs border border-purple-200 bg-purple-50">
              <p className="font-semibold text-purple-800 mb-1.5 flex items-center gap-1.5">
                <Zap size={12} /> Necə işləyir:
              </p>
              <ul className="space-y-1 text-purple-700">
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 size={11} className="mt-0.5 flex-shrink-0 text-purple-500" />
                  <span>Hər dəfə <strong>2 model paralel</strong> işləyir (API limit riski azalır)</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 size={11} className="mt-0.5 flex-shrink-0 text-purple-500" />
                  <span>Bir model limit alsa, avtomatik digəri işə düşür</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 size={11} className="mt-0.5 flex-shrink-0 text-purple-500" />
                  <span>Dəqiq mövzu adı daxil edin — daha yaxşı nəticə üçün</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <AlertTriangle size={11} className="mt-0.5 flex-shrink-0 text-amber-500" />
                  <span className="text-amber-700">Saatda max 10 quiz yarada bilərsiniz</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <AlertTriangle size={11} className="mt-0.5 flex-shrink-0 text-amber-500" />
                  <span className="text-amber-700">Limit xətası alarsan: bir neçə saniyə gözlə, yenidən cəhd et</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50 flex-shrink-0 rounded-b-2xl">
            <button
              onClick={handleGenerate}
              disabled={loading || !title.trim()}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)" }}
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Yaradılır...</> : <><Sparkles size={16} /> Quiz Yarat</>}
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
