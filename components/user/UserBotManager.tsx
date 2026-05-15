"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bot, Plus, Trash2, Sparkles, Upload, X, Loader2, FileText } from "lucide-react";
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">Mənim Botlarım</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            PDF yükləyin, bot yaradın, quiz generasiyasında istifadə edin
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2 text-sm self-start sm:self-auto flex-shrink-0"
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
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "rgba(147,204,255,0.08)" }} />
          ))}
        </div>
      )}

      {/* Boş vəziyyət */}
      {!loading && bots.length === 0 && !showCreate && (
        <div className="text-center py-12 sm:py-14">
          <div
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "rgba(147,204,255,0.12)" }}
          >
            <Bot size={26} className="text-[#1a7fe0]" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 mb-1">Hələ bot yaratmamısınız</h3>
          <p className="text-sm text-slate-500 mb-5 max-w-xs mx-auto">
            PDF yükləyin, bot yaradın. Sonra bu bot əsasında quiz generasiya edin.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2 mx-auto text-sm"
          >
            <Plus size={15} /> Bot Yarat
          </button>
        </div>
      )}

      {/* Bot siyahısı */}
      {!loading && bots.length > 0 && (
        <div className="space-y-2.5">
          {bots.map((bot) => (
            <div key={bot.id} className="flex items-center gap-3 p-3 sm:p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <div
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)" }}
              >
                <Bot size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-slate-800 truncate">{bot.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {bot.category || "Kateqoriyasız"} · {new Date(bot.createdAt).toLocaleDateString("az-AZ")}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {onSelectBot && (
                  <button
                    onClick={() => onSelectBot(bot)}
                    className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                    style={{ background: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)" }}
                    title="Bu bot ilə quiz yarat"
                  >
                    <Sparkles size={11} />
                    <span className="hidden sm:inline">Quiz Yarat</span>
                    <span className="sm:hidden">Yarat</span>
                  </button>
                )}
                <button
                  onClick={() => setConfirmDelete(bot.id)}
                  disabled={deletingId === bot.id}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                  title="Sil"
                >
                  {deletingId === bot.id ? (
                    <div className="w-3.5 h-3.5 border-2 border-red-200 border-t-red-500 rounded-full animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
            </div>
          ))}
          <p className="text-xs text-slate-400 text-right pt-1">{bots.length}/10 bot</p>
        </div>
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
    <div className="mb-5 p-4 sm:p-5 rounded-xl border-2 border-dashed border-purple-200 bg-purple-50/30">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
          <Bot size={15} className="text-purple-600" /> Yeni Bot Yarat
        </h3>
        <button onClick={onCancel} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all">
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
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

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Bilik Bazası (PDF) <span className="text-red-500">*</span>
          </label>
          {pdfInfo ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
              <FileText size={18} className="text-green-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-800 truncate">{pdfInfo.name}</p>
                <p className="text-xs text-green-600">{pdfInfo.pages} səhifə · {pdfInfo.chars.toLocaleString()} simvol</p>
              </div>
              <button
                type="button"
                onClick={() => { setPdfInfo(null); setContent(""); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                className="p-1 text-green-600 hover:text-red-500 rounded-lg transition-all flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div
              onClick={() => !pdfLoading && fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 sm:p-8 transition-colors cursor-pointer ${
                pdfLoading
                  ? "border-purple-200 bg-purple-50/50 cursor-wait"
                  : "border-slate-200 hover:border-purple-300 bg-slate-50 hover:bg-purple-50/30"
              }`}
            >
              {pdfLoading ? (
                <>
                  <Loader2 size={22} className="text-purple-500 animate-spin" />
                  <span className="text-sm text-slate-500">PDF oxunur...</span>
                </>
              ) : (
                <>
                  <Upload size={22} className="text-slate-400" />
                  <span className="text-sm font-medium text-slate-600 text-center">PDF faylı yükləmək üçün klikləyin</span>
                  <span className="text-xs text-slate-400">Ölçü limiti yoxdur</span>
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

        <div className="rounded-xl p-3 text-xs text-purple-700 border border-purple-200 bg-purple-50">
          <p className="font-medium mb-1">💡 Necə işləyir?</p>
          <ul className="space-y-0.5 text-purple-600">
            <li>• PDF yükləyin — mətn avtomatik çıxarılır</li>
            <li>• Bot yaradıldıqdan sonra "Quiz Yarat" ilə quiz generasiya edin</li>
            <li>• AI yalnız bu PDF-in məzmunundan sual yaradacaq</li>
          </ul>
        </div>

        <div className="flex gap-2.5 sm:gap-3 pt-1">
          <button
            type="submit"
            disabled={saving || pdfLoading || !content}
            className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <><Loader2 size={14} className="animate-spin" /> Yaradılır...</> : <><Bot size={14} /> Bot Yarat</>}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary px-4 sm:px-6 text-sm">
            Ləğv et
          </button>
        </div>
      </form>
    </div>
  );
}
