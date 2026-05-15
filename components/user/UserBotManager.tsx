"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Bot, Plus, Trash2, Sparkles, Upload, X, Loader2,
  FileText, Zap, BookOpen, Calendar,
} from "lucide-react";
import { useToast } from "@/components/ui/toast-1";
import ConfirmModal from "@/components/ui/confirm-modal";

interface UserBot {
  id: string;
  name: string;
  category: string;
  active: boolean;
  createdAt: string;
  description: string;
}

interface UserBotManagerProps {
  onSelectBot?: (bot: UserBot) => void;
}

const BOT_GRADIENTS = [
  { from: "#667eea", to: "#764ba2" },
  { from: "#f093fb", to: "#f5576c" },
  { from: "#4facfe", to: "#00f2fe" },
  { from: "#43e97b", to: "#38f9d7" },
  { from: "#fa709a", to: "#fee140" },
  { from: "#a18cd1", to: "#fbc2eb" },
];
function getBotGradient(id: string) {
  const idx = id.charCodeAt(0) % BOT_GRADIENTS.length;
  return BOT_GRADIENTS[idx];
}

export default function UserBotManager({ onSelectBot }: UserBotManagerProps) {
  const { success, error } = useToast();
  const [bots, setBots] = useState<UserBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchBots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user-bots", { cache: "no-store" });
      const data = await res.json();
      setBots(Array.isArray(data) ? data : []);
    } catch {
      error("Botlar yüklənərkən xəta baş verdi");
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => { fetchBots(); }, [fetchBots]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setConfirmDelete(null);
    try {
      const res = await fetch(`/api/user-bots/${id}`, { method: "DELETE" });
      if (res.ok) {
        success("Bot silindi");
        setBots((prev) => prev.filter((b) => b.id !== id));
      } else {
        const d = await res.json().catch(() => ({}));
        error(d.error || "Bot silinərkən xəta baş verdi");
      }
    } catch {
      error("Şəbəkə xətası baş verdi");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <ConfirmModal
        open={!!confirmDelete}
        title="Botu sil"
        message="Bu botu silmək istədiyinizə əminsiniz? Bu əməliyyat geri alına bilməz."
        confirmText="Sil"
        loading={deletingId === confirmDelete}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Mənim Botlarım</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            PDF yükləyin, bot yaradın, quiz generasiyasında istifadə edin
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 self-start sm:self-auto flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)" }}
        >
          <Plus size={15} /> Yeni Bot
        </button>
      </div>

      {/* Bot yaratma formu */}
      {showCreate && (
        <CreateBotForm
          onSuccess={() => { setShowCreate(false); fetchBots(); }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Yüklənir */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-44 rounded-2xl animate-pulse"
              style={{ background: "rgba(147,204,255,0.08)" }} />
          ))}
        </div>
      )}

      {/* Boş vəziyyət */}
      {!loading && bots.length === 0 && !showCreate && (
        <div className="text-center py-16 sm:py-20">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5"
            style={{ background: "linear-gradient(135deg,rgba(102,126,234,0.12),rgba(118,75,162,0.12))" }}>
            <Bot size={36} className="text-purple-500" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Hələ bot yaratmamısınız</h3>
          <p className="text-sm text-slate-500 mb-8 max-w-sm mx-auto leading-relaxed">
            PDF yükləyin, bot yaradın. Sonra bu bot əsasında AI ilə quiz generasiya edin.
          </p>

          {/* How it works */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8 max-w-lg mx-auto">
            {[
              { icon: Upload, label: "PDF yüklə", color: "text-blue-500", bg: "bg-blue-50" },
              { icon: Bot,    label: "Bot yarat", color: "text-purple-500", bg: "bg-purple-50" },
              { icon: Sparkles, label: "Quiz generasiya et", color: "text-amber-500", bg: "bg-amber-50" },
            ].map(({ icon: Icon, label, color, bg }, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${bg}`}>
                  <Icon size={14} className={color} />
                  <span className="text-xs font-medium text-slate-700">{label}</span>
                </div>
                {i < 2 && <span className="text-slate-300 hidden sm:block">→</span>}
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 mx-auto px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)" }}
          >
            <Plus size={15} /> Bot Yarat
          </button>
        </div>
      )}

      {/* Bot card grid */}
      {!loading && bots.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bots.map((bot) => {
              const grad = getBotGradient(bot.id);
              return (
                <div
                  key={bot.id}
                  className="group relative bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
                >
                  {/* Rəngli üst zolaq */}
                  <div
                    className="h-2 w-full"
                    style={{ background: `linear-gradient(90deg, ${grad.from}, ${grad.to})` }}
                  />

                  <div className="p-4 sm:p-5">
                    {/* İkon + ad */}
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                        style={{ background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` }}
                      >
                        <Bot size={18} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-800 text-sm leading-snug truncate group-hover:text-purple-600 transition-colors">
                          {bot.name}
                        </h3>
                        <span className="text-xs text-slate-400 mt-0.5 block truncate">
                          {bot.category || "Kateqoriyasız"}
                        </span>
                      </div>
                    </div>

                    {/* Tarix */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
                      <Calendar size={11} />
                      <span>{new Date(bot.createdAt).toLocaleDateString("az-AZ")}</span>
                    </div>

                    {/* Əməliyyatlar */}
                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                      {onSelectBot && (
                        <button
                          onClick={() => onSelectBot(bot)}
                          className="relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:scale-105 overflow-hidden"
                          style={{
                            background: "linear-gradient(135deg, #a855f7 0%, #6366f1 50%, #ec4899 100%)",
                            boxShadow: "0 0 14px rgba(168,85,247,0.45)",
                          }}
                          title="Bu bot ilə quiz yarat"
                        >
                          <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 translate-x-[-100%] hover:translate-x-[200%] transition-transform duration-700" />
                          <Sparkles size={12} className="animate-pulse" /> Quiz Yarat
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmDelete(bot.id)}
                        disabled={deletingId === bot.id}
                        className="flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all disabled:opacity-50"
                        title="Sil"
                      >
                        {deletingId === bot.id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 text-right mt-3">{bots.length}/10 bot istifadə edilib</p>
        </>
      )}
    </div>
  );
}

// ─── Bot Yaratma Formu ────────────────────────────────────────────────────────

function CreateBotForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const { success, error } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfInfo, setPdfInfo] = useState<{ name: string; chars: number; pages: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const handlePdfUpload = async (file: File) => {
    if (file.type !== "application/pdf") { error("Yalnız PDF fayl qəbul edilir"); return; }
    setPdfLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ai-bots/extract-pdf", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        error(data.error || "PDF oxunarkən xəta baş verdi");
        return;
      }

      setContent(data.text);
      setPdfInfo({ name: file.name, chars: data.charCount, pages: data.pageCount });
      success(`PDF oxundu — ${data.pageCount} səhifə, ${data.charCount.toLocaleString()} simvol`);
    } catch (e: any) {
      console.error("PDF parse error:", e);
      error("PDF oxunarkən xəta baş verdi. Faylın zədəli olmadığını yoxlayın.");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { error("Bot adı daxil edin"); return; }
    if (!content.trim()) { error("PDF yükləyin"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/user-bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), category: category.trim(), content }),
      });
      const data = await res.json();
      if (!res.ok) { error(data.error || "Bot yaradılarkən xəta baş verdi"); return; }
      success("Bot uğurla yaradıldı!");
      onSuccess();
    } catch {
      error("Şəbəkə xətası baş verdi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-6 rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/60 to-indigo-50/40 overflow-hidden shadow-sm">
      {/* Form header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-purple-100"
        style={{ background: "linear-gradient(135deg,rgba(102,126,234,0.08),rgba(118,75,162,0.06))" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#667eea,#764ba2)" }}>
            <Bot size={14} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Yeni Bot Yarat</h3>
            <p className="text-xs text-slate-500">PDF yükləyin, AI botu hazır olsun</p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-white/60 transition-all"
        >
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Bot Adı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Məs: Mülki Məcəllə Botu"
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Kateqoriya <span className="text-slate-400 text-xs">(isteğe bağlı)</span>
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Məs: Hüquq, Tarix..."
              className="input-field"
            />
          </div>
        </div>

        {/* PDF yükləmə sahəsi */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Bilik Bazası (PDF) <span className="text-red-500">*</span>
          </label>

          {pdfInfo ? (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                <FileText size={18} className="text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-800 truncate">{pdfInfo.name}</p>
                <p className="text-xs text-green-600 mt-0.5">
                  {pdfInfo.pages} səhifə · {pdfInfo.chars.toLocaleString()} simvol oxundu
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPdfInfo(null);
                  setContent("");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="p-1.5 text-green-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div
              onClick={() => !pdfLoading && fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer ${
                pdfLoading
                  ? "border-purple-200 bg-purple-50/50 cursor-wait"
                  : "border-slate-200 hover:border-purple-300 hover:bg-purple-50/30 bg-white/60"
              }`}
            >
              {pdfLoading ? (
                <>
                  <Loader2 size={28} className="text-purple-500 animate-spin" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-700">PDF oxunur...</p>
                    <p className="text-xs text-slate-400 mt-0.5">Bir az gözləyin</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <Upload size={22} className="text-slate-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-700">PDF faylı yükləmək üçün klikləyin</p>
                    <p className="text-xs text-slate-400 mt-1">Mətn avtomatik çıxarılacaq</p>
                  </div>
                </>
              )}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePdfUpload(f); }}
          />
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-xl p-3.5 border border-purple-100 bg-purple-50/60">
          <Zap size={14} className="text-purple-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-purple-700 space-y-0.5">
            <p className="font-semibold">Necə işləyir?</p>
            <p className="text-purple-600">PDF yükləyin → bot yaradın → "Quiz Yarat" ilə AI suallar hazırlasın</p>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={saving || pdfLoading || !content}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)" }}
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> Yaradılır...</>
              : <><Bot size={14} /> Bot Yarat</>}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary px-5 text-sm"
          >
            Ləğv et
          </button>
        </div>
      </form>
    </div>
  );
}
