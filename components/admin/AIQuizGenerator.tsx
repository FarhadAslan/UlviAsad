"use client";

import { useState, useEffect } from "react";
import { Sparkles, X, Loader2, Bot } from "lucide-react";
import { useToast } from "@/components/ui/toast-1";

interface AiBot {
  id: string;
  name: string;
  category: string;
  active: boolean;
}

interface AIQuizGeneratorProps {
  onGenerate: (questions: any[]) => void;
  onClose: () => void;
  categories: { value: string; label: string }[];
}

export default function AIQuizGenerator({ onGenerate, onClose, categories }: AIQuizGeneratorProps) {
  const { success, error } = useToast();
  const [title, setTitle]                   = useState("");
  const [questionCount, setQuestionCount]   = useState(5);
  const [category, setCategory]             = useState("");
  const [language, setLanguage]             = useState("az");
  const [botId, setBotId]                   = useState<string>("");
  const [bots, setBots]                     = useState<AiBot[]>([]);
  const [botsLoading, setBotsLoading]       = useState(true);
  const [loading, setLoading]               = useState(false);

  useEffect(() => {
    fetch("/api/ai-bots?active=true", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setBots(d); })
      .catch(() => {})
      .finally(() => setBotsLoading(false));
  }, []);

  const selectedBot = bots.find((b) => b.id === botId);

  const handleGenerate = async () => {
    if (!title.trim()) { error("Quiz mövzusu daxil edin"); return; }
    if (questionCount < 1 || questionCount > 30) { error("Sual sayı 1-30 arasında olmalıdır"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/ai/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, questionCount, category, language, botId: botId || undefined }),
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
      {/* Modal — mobilda alt sheet, desktopda mərkəzdə */}
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh]">

        {/* Drag handle — yalnız mobil */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
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

        {/* Body — scrollable */}
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
                <a href="/admin/ai-botlar" target="_blank"
                  className="text-[#1a7fe0] hover:underline font-medium">
                  Bot yarat →
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Ümumi AI */}
                <label className={`flex items-center gap-3 p-2.5 sm:p-3 rounded-xl border cursor-pointer transition-all ${
                  !botId ? "border-purple-300 bg-purple-50" : "border-slate-200 hover:border-slate-300 bg-white"
                }`}>
                  <input type="radio" name="bot" value="" checked={!botId}
                    onChange={() => setBotId("")} className="accent-purple-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700">Ümumi AI</p>
                    <p className="text-xs text-slate-400 hidden sm:block">Bot olmadan, ümumi bilikdən istifadə et</p>
                  </div>
                </label>

                {/* Bot siyahısı */}
                {bots.map((bot) => (
                  <label key={bot.id} className={`flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl border cursor-pointer transition-all ${
                    botId === bot.id ? "border-purple-300 bg-purple-50" : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}>
                    <input type="radio" name="bot" value={bot.id} checked={botId === bot.id}
                      onChange={() => setBotId(bot.id)} className="accent-purple-600 flex-shrink-0" />
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "linear-gradient(135deg,#667eea,#764ba2)" }}>
                      <Bot size={12} className="text-white" />
                    </div>
                    <p className="text-sm font-medium text-slate-800 flex-1 truncate">{bot.name}</p>
                    {bot.category && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex-shrink-0 hidden sm:inline">
                        {bot.category}
                      </span>
                    )}
                  </label>
                ))}
              </div>
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
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Məs: Azərbaycan Konstitusiyası, Cəbr..."
              className="input-field" disabled={loading} />
          </div>

          {/* Sual sayı + Dil */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Sual Sayı <span className="text-red-500">*</span>
              </label>
              <input type="number" value={questionCount}
                onChange={(e) => setQuestionCount(parseInt(e.target.value) || 1)}
                min={1} max={30} className="input-field" disabled={loading} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Dil</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)}
                className="select-field" disabled={loading}>
                <option value="az">🇦🇿 Azərbaycan</option>
                <option value="en">🇬🇧 English</option>
                <option value="ru">🇷🇺 Русский</option>
              </select>
            </div>
          </div>

          {/* Kateqoriya */}
          {categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Kateqoriya <span className="text-slate-400 text-xs">(isteğe bağlı)</span>
              </label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="select-field" disabled={loading}>
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
              <li>• Dəqiq mövzu adı daxil edin</li>
              <li>• AI 5-15 saniyə ərzində suallar yaradacaq</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50 flex-shrink-0">
          <button onClick={handleGenerate} disabled={loading || !title.trim()}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)" }}>
            {loading
              ? <><Loader2 size={16} className="animate-spin" /> Yaradılır...</>
              : <><Sparkles size={16} /> Quiz Yarat</>}
          </button>
          <button onClick={onClose} disabled={loading}
            className="btn-secondary px-4 sm:px-6 disabled:opacity-50 text-sm">
            Ləğv et
          </button>
        </div>
      </div>
    </div>
  );
}
