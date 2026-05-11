"use client";

import { useState } from "react";
import { Sparkles, X, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast-1";

interface AIQuizGeneratorProps {
  onGenerate: (questions: any[]) => void;
  onClose: () => void;
  categories: { value: string; label: string }[];
}

export default function AIQuizGenerator({ onGenerate, onClose, categories }: AIQuizGeneratorProps) {
  const { success, error } = useToast();
  const [title, setTitle] = useState("");
  const [questionCount, setQuestionCount] = useState(5);
  const [category, setCategory] = useState("");
  const [language, setLanguage] = useState("az");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!title.trim()) {
      error("Quiz başlığı daxil edin");
      return;
    }
    if (questionCount < 1 || questionCount > 30) {
      error("Sual sayı 1-30 arasında olmalıdır");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/ai/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, questionCount, category, language }),
      });

      const data = await res.json();

      if (!res.ok) {
        error(data.error || "AI quiz yarada bilmədi");
        return;
      }

      if (!data.questions || data.questions.length === 0) {
        error("AI sual yarada bilmədi");
        return;
      }

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"
          style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
          <div className="flex items-center gap-2 text-white">
            <Sparkles size={20} />
            <h2 className="text-lg font-bold">AI ilə Quiz Yarat</h2>
          </div>
          <button onClick={onClose} disabled={loading}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Quiz Mövzusu <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Məs: Azərbaycan Tarixi, Riyaziyyat, Fizika..."
              className="input-field"
              disabled={loading}
            />
            <p className="text-xs text-slate-400 mt-1">
              AI bu mövzu üzrə suallar yaradacaq
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
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

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Dil
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="select-field"
                disabled={loading}
              >
                <option value="az">🇦🇿 Azərbaycan</option>
                <option value="en">🇬🇧 English</option>
                <option value="ru">🇷🇺 Русский</option>
              </select>
            </div>
          </div>

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

          <div className="rounded-xl p-3 text-xs text-purple-700 border border-purple-200 bg-purple-50">
            <p className="font-medium mb-1">💡 Məsləhət:</p>
            <ul className="space-y-0.5 text-purple-600">
              <li>• Dəqiq mövzu adı daxil edin (məs: "Azərbaycan Tarixi - Orta əsrlər")</li>
              <li>• AI 10-15 saniyə ərzində suallar yaradacaq</li>
              <li>• Yaradılan sualları sonra redaktə edə bilərsiniz</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={handleGenerate}
            disabled={loading || !title.trim()}
            className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Yaradılır...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Quiz Yarat
              </>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="btn-secondary px-6 disabled:opacity-50"
          >
            Ləğv et
          </button>
        </div>
      </div>
    </div>
  );
}
