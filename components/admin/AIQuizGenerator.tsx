"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, X, Loader2, Bot, AlertCircle, CheckCircle2, Zap } from "lucide-react";
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

// ── Animasiya CSS ──────────────────────────────────────────────────────────────
const LOADER_CSS = `
.ai-lw { position:relative;display:flex;align-items:center;justify-content:center;
  width:160px;height:160px;font-family:"Inter",sans-serif;font-size:1.1em;font-weight:300;
  color:white;border-radius:50%;background:transparent;user-select:none; }
.ai-lc { position:absolute;top:0;left:0;width:100%;aspect-ratio:1/1;border-radius:50%;
  background:transparent;animation:ai-rot 2s linear infinite;z-index:0; }
@keyframes ai-rot {
  0%  {transform:rotate(90deg); box-shadow:0 10px 20px 0 #fff inset,0 20px 30px 0 #ad5fff inset,0 60px 60px 0 #471eec inset;}
  50% {transform:rotate(270deg);box-shadow:0 10px 20px 0 #fff inset,0 20px 10px 0 #d60a47 inset,0 40px 60px 0 #311e80 inset;}
  100%{transform:rotate(450deg);box-shadow:0 10px 20px 0 #fff inset,0 20px 30px 0 #ad5fff inset,0 60px 60px 0 #471eec inset;}
}
.ai-ll { display:inline-block;opacity:.4;transform:translateY(0);animation:ai-la 2s infinite;z-index:1; }
.ai-ll:nth-child(1){animation-delay:0s}.ai-ll:nth-child(2){animation-delay:.1s}
.ai-ll:nth-child(3){animation-delay:.2s}.ai-ll:nth-child(4){animation-delay:.3s}
.ai-ll:nth-child(5){animation-delay:.4s}.ai-ll:nth-child(6){animation-delay:.5s}
.ai-ll:nth-child(7){animation-delay:.6s}.ai-ll:nth-child(8){animation-delay:.7s}
.ai-ll:nth-child(9){animation-delay:.8s}.ai-ll:nth-child(10){animation-delay:.9s}
@keyframes ai-la {
  0%,100%{opacity:.4;transform:translateY(0)}
  20%{opacity:1;transform:scale(1.15)}
  40%{opacity:.7;transform:translateY(0)}
}`;

// Frontend timeout — 30 saniyə
const FRONTEND_TIMEOUT_MS = 30_000;

export default function AIQuizGenerator({ onGenerate, onClose, categories }: AIQuizGeneratorProps) {
  const { success, error } = useToast();

  const [title,         setTitle]         = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [category,      setCategory]      = useState("");
  const [language,      setLanguage]      = useState("az");
  const [botId,         setBotId]         = useState("");
  const [bots,          setBots]          = useState<AiBot[]>([]);
  const [botsLoading,   setBotsLoading]   = useState(true);
  const [loading,       setLoading]       = useState(false);
  const [progress,      setProgress]      = useState(0);
  const [progressText,  setProgressText]  = useState("");
  const [elapsed,       setElapsed]       = useState(0);

  const abortRef    = useRef<AbortController | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const fakeRef     = useRef(0);

  // Botları yüklə
  useEffect(() => {
    fetch("/api/ai-bots?active=true", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setBots(d); })
      .catch(() => {})
      .finally(() => setBotsLoading(false));
  }, []);

  // Cleanup
  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timerRef.current)    clearInterval(timerRef.current);
  }, []);

  const selectedBot = bots.find(b => b.id === botId);

  // ── Fake progress animasiyası ──
  const startProgress = () => {
    fakeRef.current = 0;
    setElapsed(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timerRef.current)    clearInterval(timerRef.current);

    // Progress bar: ilk 20 saniyədə ~85%-ə qədər gedir, sonra yavaşlayır
    intervalRef.current = setInterval(() => {
      fakeRef.current = Math.min(
        88,
        fakeRef.current + (fakeRef.current < 50 ? 3 : fakeRef.current < 75 ? 1.5 : 0.4)
      );
      setProgress(Math.round(fakeRef.current));
    }, 350);

    // Saniyə sayacı
    let sec = 0;
    timerRef.current = setInterval(() => {
      sec++;
      setElapsed(sec);
    }, 1000);
  };

  const stopProgress = (val = 100) => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timerRef.current)    { clearInterval(timerRef.current);    timerRef.current    = null; }
    setProgress(val);
  };

  // ── Əsas generasiya funksiyası ──
  const handleGenerate = async () => {
    if (!title.trim()) { error("Quiz mövzusu daxil edin"); return; }
    if (questionCount < 1 || questionCount > 50) { error("Sual sayı 1-50 arasında olmalıdır"); return; }

    setLoading(true);
    setProgress(0);
    setProgressText(`${questionCount} sual yaradılır...`);
    await new Promise(r => setTimeout(r, 50)); // render üçün
    startProgress();

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // Frontend timeout — 30 saniyə
    const frontendTimeout = setTimeout(() => {
      ctrl.abort();
    }, FRONTEND_TIMEOUT_MS);

    try {
      const res = await fetch("/api/ai/generate-quiz", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          title:         title.trim(),
          questionCount,
          category:      category || undefined,
          language,
          botId:         botId || undefined,
        }),
        signal: ctrl.signal,
      });

      clearTimeout(frontendTimeout);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const errorMsg = data.error || `HTTP ${res.status} xətası`;
        const suggestion = data.suggestion || "";
        
        throw new Error(suggestion ? `${errorMsg}\n\n${suggestion}` : errorMsg);
      }

      const data = await res.json();
      const questions: any[] = data.questions || [];

      if (questions.length === 0) {
        throw new Error("AI heç bir sual yarada bilmədi. API limitləri dolmuş ola bilər, bir az gözləyib yenidən cəhd edin.");
      }

      stopProgress(100);
      setProgressText(`${questions.length} sual hazırdır!`);
      await new Promise(r => setTimeout(r, 500));

      // Meta məlumat — əgər tam deyilsə istifadəçiyə bildiriş
      const meta = data.meta || {};
      if (meta.warning) {
        success(`${questions.length} sual yaradıldı (${questionCount} istənilmişdi — limitə görə az gəldi)`);
      } else {
        success(`${questions.length} sual uğurla yaradıldı! ✓`);
      }
      
      // Qalan hüquq sayını göstər
      if (typeof meta.remaining === 'number') {
        console.log(`[AI Quiz] Saatda qalan hüquq: ${meta.remaining}`);
      }

      onGenerate(questions, category || undefined);
      onClose();

    } catch (e: any) {
      clearTimeout(frontendTimeout);
      if (e?.name === "AbortError") {
        error("Vaxt aşıldı (30s). Sual sayını azaldın (5-10 sual) və yenidən cəhd edin.");
      } else if (typeof navigator !== "undefined" && !navigator.onLine) {
        error("İnternet bağlantısı yoxdur.");
      } else {
        const errorMsg = e?.message || "Xəta baş verdi. Yenidən cəhd edin.";
        // Uzun mesajları toast-da göstər
        if (errorMsg.length > 100) {
          error(errorMsg.split('\n')[0]); // İlk sətri göstər
          console.error("Tam xəta:", errorMsg);
        } else {
          error(errorMsg);
        }
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

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{LOADER_CSS}</style>

      {/* Tam ekran loading overlay */}
      {loading && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-8"
          style={{ background: "linear-gradient(135deg,#0f0020 0%,#1a0533 40%,#2d1060 70%,#1a0533 100%)" }}
        >
          {/* Animasiyalı dairə */}
          <div className="ai-lw">
            {"Generating".split("").map((ch, i) => (
              <span key={i} className="ai-ll">{ch}</span>
            ))}
            <div className="ai-lc" />
          </div>

          {/* Progress məlumatı */}
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

            {/* Model statusu */}
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/50 space-y-1">
              <div className="flex items-center gap-1.5 text-purple-300">
                <Zap size={11} />
                <span>2 model paralel işləyir (rate limit qorunması)</span>
              </div>
              <div>Groq: llama-3.3-70b · llama-3.1-8b · gemma2</div>
              <div>OpenRouter: llama-4 · qwen3 · gemma-3 · deepseek-r1</div>
            </div>
          </div>

          {/* Dayandır düyməsi */}
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
        <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh]">

          {/* Mobil çəkəc */}
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

          {/* Məzmun */}
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">

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
                  onChange={e => {
                    const v = e.target.value;
                    setBotId(v);
                    if (!v) {
                      setCategory("");
                    } else {
                      const b = bots.find(x => x.id === v);
                      if (b?.category) setCategory(b.category);
                    }
                  }}
                  className="select-field"
                  disabled={loading}
                >
                  <option value="">Ümumi AI (Bot olmadan)</option>
                  {bots.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}{b.category ? ` (${b.category})` : ""}
                    </option>
                  ))}
                </select>
              )}
              {selectedBot && (
                <div className="mt-2 rounded-lg p-2.5 text-xs text-purple-700 bg-purple-50 border border-purple-100 flex items-center gap-2">
                  <Bot size={13} className="flex-shrink-0" />
                  <span>
                    <strong>{selectedBot.name}</strong> — suallar yalnız bu botun bilik bazasından yaradılacaq
                  </span>
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
                placeholder="Məs: Azərbaycan Konstitusiyası, Cəbr, Hüquq..."
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
                  onChange={e => setQuestionCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                  min={1}
                  max={50}
                  className="input-field w-28"
                  disabled={loading}
                />
                {/* Sürətli seçim düymələri */}
                <div className="flex gap-1.5">
                  {[5, 10, 15, 20].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setQuestionCount(n)}
                      disabled={loading}
                      className={`px-2.5 py-1.5 text-xs rounded-lg font-medium transition-all border ${
                        questionCount === n
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
                Maksimum 50 sual · Tövsiyə: 5-15 sual · Saatda 10 quiz limiti
              </p>
            </div>

            {/* Kateqoriya */}
            {categories.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Kateqoriya <span className="text-slate-400 text-xs">(isteğe bağlı)</span>
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="select-field"
                  disabled={loading}
                >
                  <option value="">Avtomatik seç</option>
                  {categories.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Dil seçimi */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Dil</label>
              <div className="flex gap-2">
                {[
                  { value: "az", label: "🇦🇿 Azərbaycanca" },
                  { value: "ru", label: "🇷🇺 Rusca" },
                  { value: "en", label: "🇬🇧 İngiliscə" },
                ].map(l => (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => setLanguage(l.value)}
                    disabled={loading}
                    className={`flex-1 py-2 text-xs rounded-xl font-medium transition-all border ${
                      language === l.value
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-white text-slate-500 border-slate-200 hover:border-purple-300"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Məlumat bloku */}
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
                  <span>Hər model <strong>3 dəfə retry</strong> edir (exponential backoff)</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 size={11} className="mt-0.5 flex-shrink-0 text-purple-500" />
                  <span>Bir model limit alsa, avtomatik digəri işə düşür</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 size={11} className="mt-0.5 flex-shrink-0 text-purple-500" />
                  <span>Təkrar suallar avtomatik silinir, unikal suallar qalır</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <AlertCircle size={11} className="mt-0.5 flex-shrink-0 text-amber-500" />
                  <span className="text-amber-700">Saatda max 10 quiz · Tövsiyə: 5-15 sual (daha etibarlı)</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50 flex-shrink-0 rounded-b-2xl">
            <button
              onClick={handleGenerate}
              disabled={loading || !title.trim()}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)" }}
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Yaradılır...</>
              ) : (
                <><Sparkles size={16} /> Quiz Yarat</>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="btn-secondary px-4 sm:px-6 text-sm disabled:opacity-50"
            >
              Ləğv et
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
