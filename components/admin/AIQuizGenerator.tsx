"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, X, Loader2, Bot, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/toast-1";

interface AiBot { id: string; name: string; category: string; active: boolean; }

interface AIQuizGeneratorProps {
  onGenerate: (questions: any[], category?: string) => void;
  onClose: () => void;
  categories: { value: string; label: string }[];
}

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

// 2 paralel sorğu — hər biri 25 sual, hər biri 55s-ə sığır
// Server içəridə Groq→OR fallback ilə işləyir
const PARTS = 2;

export default function AIQuizGenerator({ onGenerate, onClose, categories }: AIQuizGeneratorProps) {
  const { success, error } = useToast();
  const [title, setTitle]                 = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [category, setCategory]           = useState("");
  const [language, setLanguage]           = useState("az");
  const [botId, setBotId]                 = useState("");
  const [bots, setBots]                   = useState<AiBot[]>([]);
  const [botsLoading, setBotsLoading]     = useState(true);
  const [loading, setLoading]             = useState(false);
  const [progress, setProgress]           = useState(0);
  const [progressText, setProgressText]   = useState("");
  const [failedParts, setFailedParts]     = useState(0);
  const abortRef    = useRef<AbortController | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fakeRef     = useRef(0);

  useEffect(() => {
    fetch("/api/ai-bots?active=true", { cache: "no-store" })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setBots(d); })
      .catch(() => {}).finally(() => setBotsLoading(false));
  }, []);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const selectedBot = bots.find(b => b.id === botId);

  const startProgress = () => {
    fakeRef.current = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      fakeRef.current = Math.min(88, fakeRef.current + Math.random() * 2.5 + 0.5);
      setProgress(Math.round(fakeRef.current));
    }, 350);
  };

  const stopProgress = (val = 100) => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setProgress(val);
  };

  const fetchPart = async (count: number, signal: AbortSignal) => {
    const res = await fetch("/api/ai/generate-quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, questionCount: count, category, language, botId: botId || undefined, avoidTexts: [] }),
      signal,
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `HTTP ${res.status}`); }
    return res.json() as Promise<{ questions: any[]; reviewQuestions: any[] }>;
  };

  const handleGenerate = async () => {
    if (!title.trim()) { error("Quiz mövzusu daxil edin"); return; }
    if (questionCount < 1 || questionCount > 50) { error("Sual sayı 1-50 arasında olmalıdır"); return; }

    setLoading(true); setProgress(0); setFailedParts(0);
    setProgressText(`${questionCount} sual yaradılır...`);
    await new Promise(r => setTimeout(r, 50));
    startProgress();

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      // Sualları PARTS hissəyə böl, hamısını eyni anda göndər
      const base = Math.floor(questionCount / PARTS);
      const rem  = questionCount % PARTS;
      const parts = Array.from({ length: PARTS }, (_, i) => base + (i < rem ? 1 : 0)).filter(n => n > 0);

      const settled = await Promise.allSettled(parts.map(n => fetchPart(n, ctrl.signal)));

      const allQs: any[] = [];
      let reviewQs: any[] = [];
      let failed = 0;
      const seen = new Set<string>();

      for (const r of settled) {
        if (r.status === "fulfilled") {
          for (const q of (r.value.questions || [])) {
            const k = q.text?.trim().toLowerCase();
            if (k && !seen.has(k)) { seen.add(k); allQs.push(q); }
          }
          if (!reviewQs.length) reviewQs = r.value.reviewQuestions || [];
        } else {
          if (r.reason?.name === "AbortError") throw r.reason;
          failed++;
        }
      }

      setFailedParts(failed);

      if (allQs.length === 0) { error("AI heç bir sual yarada bilmədi. Yenidən cəhd edin."); return; }

      const final = [...allQs.slice(0, questionCount), ...reviewQs];
      stopProgress(100);
      setProgressText(`${final.length} sual hazırdır!`);
      await new Promise(r => setTimeout(r, 600));

      success(`${final.length} sual yaradıldı!`);
      onGenerate(final, category || undefined);
      onClose();

    } catch (e: any) {
      if (e?.name === "AbortError") error("Əməliyyat ləğv edildi.");
      else if (typeof navigator !== "undefined" && !navigator.onLine) error("İnternet bağlantısı yoxdur.");
      else error(e?.message || "Xəta baş verdi. Yenidən cəhd edin.");
    } finally {
      stopProgress(0); setLoading(false); setProgress(0); setProgressText(""); abortRef.current = null;
    }
  };

  return (
    <>
      <style>{LOADER_CSS}</style>

      {/* Full-screen loading overlay */}
      {loading && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-8"
          style={{ background: "linear-gradient(135deg,#0f0020 0%,#1a0533 40%,#2d1060 70%,#1a0533 100%)" }}>
          <div className="ai-lw">
            {"Generating".split("").map((ch, i) => <span key={i} className="ai-ll">{ch}</span>)}
            <div className="ai-lc" />
          </div>
          <div className="w-64 space-y-3">
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div className="h-2 rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: "linear-gradient(90deg,#ad5fff,#667eea)" }} />
            </div>
            <p className="text-center text-white/60 text-sm">{progressText}</p>
          </div>
          <button onClick={() => abortRef.current?.abort()}
            className="px-6 py-2.5 rounded-xl text-sm font-medium text-white/60 border border-white/15 hover:text-white hover:border-white/35 transition-all">
            Dayandır
          </button>
          {failedParts > 0 && (
            <p className="text-xs text-amber-400 flex items-center gap-1.5">
              <AlertCircle size={13} /> {failedParts} sorğu uğursuz oldu, davam edir...
            </p>
          )}
        </div>
      )}

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        onClick={e => { if (e.target === e.currentTarget && !loading) onClose(); }}>
        <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh]">

          <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-slate-200" />
          </div>

          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)" }}>
            <div className="flex items-center gap-2 text-white">
              <Sparkles size={18} />
              <h2 className="text-base sm:text-lg font-bold">AI ilə Quiz Yarat</h2>
            </div>
            <button onClick={onClose} disabled={loading}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50">
              <X size={18} />
            </button>
          </div>

          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
            {/* Bot */}
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
                  <a href="/admin/ai-botlar" target="_blank" className="text-[#1a7fe0] hover:underline font-medium">Bot yarat →</a>
                </div>
              ) : (
                <select value={botId} onChange={e => {
                  const v = e.target.value; setBotId(v);
                  if (!v) setCategory(""); else { const b = bots.find(x => x.id === v); if (b?.category) setCategory(b.category); }
                }} className="select-field" disabled={loading}>
                  <option value="">Ümumi AI (Bot olmadan)</option>
                  {bots.map(b => <option key={b.id} value={b.id}>{b.name}{b.category ? ` (${b.category})` : ""}</option>)}
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
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Məs: Azərbaycan Konstitusiyası, Cəbr..."
                className="input-field" disabled={loading} />
            </div>

            {/* Sual sayı */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Sual Sayı <span className="text-red-500">*</span>
              </label>
              <input type="number" value={questionCount}
                onChange={e => setQuestionCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                min={1} max={50} className="input-field" disabled={loading} />
            <p className="mt-1 text-xs text-slate-400">Groq + OpenRouter modelləri ardıcıl işləyir</p>
            </div>

            {/* Kateqoriya */}
            {categories.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Kateqoriya <span className="text-slate-400 text-xs">(isteğe bağlı)</span>
                </label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="select-field" disabled={loading}>
                  <option value="">Avtomatik seç</option>
                  {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            )}

            <div className="rounded-xl p-3 text-xs text-purple-700 border border-purple-200 bg-purple-50">
              <p className="font-medium mb-1">⚡ Necə işləyir:</p>
              <ul className="space-y-0.5 text-purple-600">
                <li>• Groq + OpenRouter modelləri ardıcıl işləyir, rate limit olmur</li>
                <li>• Hər model uğursuz olsa növbəti sınanır</li>
                <li>• 50 sual üçün ~20-40 saniyə kifayətdir</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50 flex-shrink-0">
            <button onClick={handleGenerate} disabled={loading || !title.trim()}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)" }}>
              {loading ? <><Loader2 size={16} className="animate-spin" /> Yaradılır...</> : <><Sparkles size={16} /> Quiz Yarat</>}
            </button>
            <button onClick={onClose} disabled={loading} className="btn-secondary px-4 sm:px-6 text-sm disabled:opacity-50">
              Ləğv et
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
