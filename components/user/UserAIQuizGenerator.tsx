"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, X, Loader2, Bot, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/toast-1";

interface AiBot { id: string; name: string; category: string; active: boolean; isUserBot?: boolean; }

interface UserAIQuizGeneratorProps {
  onGenerate: (questions: any[], reviewQuestions?: any[], usedBotId?: string) => void;
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

const PARTS = 1;
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 15000;

export default function UserAIQuizGenerator({ onGenerate, onClose, preselectedBotId }: UserAIQuizGeneratorProps) {
  const { success, error } = useToast();
  const [title, setTitle]               = useState("");
  const [questionCount, setQuestionCount] = useState<string>("10");
  const [botId, setBotId]               = useState(preselectedBotId || "");
  const [userBots, setUserBots]         = useState<AiBot[]>([]);
  const [botsLoading, setBotsLoading]   = useState(true);
  const [loading, setLoading]           = useState(false);
  const [progress, setProgress]         = useState(0);
  const [progressText, setProgressText] = useState("");
  const [failedParts, setFailedParts]   = useState(0);
  const abortRef    = useRef<AbortController | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fakeRef     = useRef(0);

  useEffect(() => {
    fetch("/api/user-bots", { cache: "no-store" })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setUserBots(d.map((b: AiBot) => ({ ...b, isUserBot: true }))); })
      .catch(() => {}).finally(() => setBotsLoading(false));
  }, []);

  useEffect(() => { if (preselectedBotId) setBotId(preselectedBotId); }, [preselectedBotId]);
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const selectedBot = userBots.find(b => b.id === botId);

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
      body: JSON.stringify({ title, questionCount: count, language: "az", botId: botId || undefined, avoidTexts: [] }),
      signal,
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `HTTP ${res.status}`); }
    return res.json() as Promise<{ questions: any[]; reviewQuestions: any[] }>;
  };

  const handleGenerate = async () => {
    const count = parseInt(questionCount) || 0;
    if (!title.trim()) { error("Quiz mövzusu daxil edin"); return; }
    if (count < 1 || count > 50) { error("Sual sayı 1-50 arasında olmalıdır"); return; }

    setLoading(true); setProgress(0); setFailedParts(0);
    setProgressText(`${count} sual yaradılır...`);
    await new Promise(r => setTimeout(r, 50));
    startProgress();

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const allQs: any[] = [];
      let reviewQs: any[] = [];
      const seen = new Set<string>();

      const totalBatches = Math.ceil(count / BATCH_SIZE);

      for (let i = 0; i < totalBatches; i++) {
        if (ctrl.signal.aborted) break;

        const remaining = count - allQs.length;
        const batchCount = Math.min(remaining, BATCH_SIZE);

        setProgressText(`${allQs.length}/${count} sual yaradıldı...`);

        const data = await fetchPart(batchCount, ctrl.signal);
        for (const q of (data.questions || [])) {
          const k = q.text?.trim().toLowerCase();
          if (k && !seen.has(k)) { seen.add(k); allQs.push(q); }
        }
        if (!reviewQs.length) reviewQs = data.reviewQuestions || [];

        if (i < totalBatches - 1 && allQs.length < count) {
          setProgressText(`${allQs.length}/${count} sual — növbəti batch üçün gözlənilir...`);
          await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
        }
      }

      if (allQs.length === 0) { error("AI heç bir sual yarada bilmədi. Yenidən cəhd edin."); return; }

      const finalQs = allQs.slice(0, count);
      stopProgress(100);
      setProgressText(`${finalQs.length + reviewQs.length} sual hazırdır!`);
      await new Promise(r => setTimeout(r, 600));

      const msg = reviewQs.length > 0
        ? `${finalQs.length} yeni + ${reviewQs.length} təkrar sual əlavə edildi!`
        : `${finalQs.length} sual yaradıldı!`;
      success(msg);

      onGenerate(finalQs, reviewQs, botId || undefined);
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

      {loading && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-8"
          style={{ background: "linear-gradient(135deg,#0f0020 0%,#1a0533 40%,#2d1060 70%,#1a0533 100%)" }}>
          <div className="uai-lw">
            {"Generating".split("").map((ch, i) => <span key={i} className="uai-ll">{ch}</span>)}
            <div className="uai-lc" />
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

      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        onClick={e => { if (e.target === e.currentTarget && !loading) onClose(); }}>
        <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh]">

          <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-slate-200" />
          </div>

          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex-shrink-0 rounded-t-2xl"
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
                <select value={botId} onChange={e => setBotId(e.target.value)} className="select-field" disabled={loading}>
                  <option value="">Ümumi AI (Bot olmadan)</option>
                  {userBots.map(b => <option key={b.id} value={b.id}>{b.name}{b.category ? ` (${b.category})` : ""}</option>)}
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
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Məs: Azərbaycan Tarixi, Riyaziyyat..."
                className="input-field" disabled={loading} />
            </div>

            {/* Sual sayı */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Sual Sayı <span className="text-red-500">*</span>
              </label>
              <input type="number" value={questionCount}
                onChange={e => setQuestionCount(e.target.value)}
                onBlur={() => { const n = parseInt(questionCount) || 1; setQuestionCount(String(Math.min(50, Math.max(1, n)))); }}
                min={1} max={50} className="input-field" disabled={loading} />
              <p className="mt-1 text-xs text-slate-400">Groq + OpenRouter modelləri ardıcıl işləyir</p>
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

          <div className="flex gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50 flex-shrink-0 rounded-b-2xl">
            <button onClick={handleGenerate} disabled={loading || !title.trim()}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)" }}>
              {loading ? <><Loader2 size={16} className="animate-spin" /> Yaradılır...</> : <><Sparkles size={16} /> Quiz Yarat</>}
            </button>
            <button onClick={onClose} disabled={loading} className="btn-secondary px-4 sm:px-6 disabled:opacity-50 text-sm">
              Ləğv et
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
