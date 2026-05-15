"use client";

import { useState, useEffect } from "react";
import { Sparkles, X, Loader2, Bot } from "lucide-react";
import { useToast } from "@/components/ui/toast-1";

interface AiBot {
  id: string;
  name: string;
  category: string;
  active: boolean;
  isUserBot?: boolean;
}

interface UserAIQuizGeneratorProps {
  onGenerate: (questions: any[]) => void;
  onClose: () => void;
  preselectedBotId?: string;
}

export default function UserAIQuizGenerator({
  onGenerate,
  onClose,
  preselectedBotId,
}: UserAIQuizGeneratorProps) {
  const { success, error } = useToast();
  const [title, setTitle] = useState("");
  const [questionCount, setQuestionCount] = useState(5);
  const [botId, setBotId] = useState<string>(preselectedBotId || "");
  const [userBots, setUserBots] = useState<AiBot[]>([]);
  const [botsLoading, setBotsLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  // Yalnız istifadəçinin öz botlarını yüklə
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

  const selectedBot = userBots.find((b) => b.id === botId);

  const handleGenerate = async () => {
    if (!title.trim()) { error("Quiz mövzusu daxil edin"); return; }
    if (questionCount < 1 || questionCount > 30) { error("Sual sayı 1-30 arasında olmalıdır"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/ai/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          questionCount,
          language: "az",
          botId: botId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { error(data.error || "AI quiz yarada bilmədi"); return; }
      if (!data.questions?.length) { error("AI sual yarada bilmədi"); return; }
      success(`${data.questions.length} sual yaradıldı!`);
      onGenerate(data.questions);
      onClose();
    } catch {
      error("Şəbəkə xətası baş verdi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh]">
        {/* Drag handle — mobil */}
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
          {/* Bot seçimi — yalnız öz botları */}
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
              onChange={(e) => setQuestionCount(parseInt(e.target.value) || 1)}
              min={1}
              max={30}
              className="input-field"
              disabled={loading}
            />
          </div>

          <div className="rounded-xl p-3 text-xs text-purple-700 border border-purple-200 bg-purple-50">
            <p className="font-medium mb-1">💡 Məsləhət:</p>
            <ul className="space-y-0.5 text-purple-600">
              <li>• "Botlarım" bölməsindən öz PDF botunuzu seçin</li>
              <li>• Dəqiq mövzu adı daxil edin</li>
              <li>• AI 5-30 saniyə ərzində suallar yaradacaq</li>
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
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Yaradılır...</>
            ) : (
              <><Sparkles size={16} /> Quiz Yarat</>
            )}
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
  );
}
