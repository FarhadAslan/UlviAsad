"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Edit, Bot, X, Loader2, ChevronDown, ChevronUp, FileText, Upload, CheckCircle, FileUp } from "lucide-react";
import { useToast } from "@/components/ui/toast-1";

interface AiBot {
  id: string;
  name: string;
  category: string;
  content: string;
  prompt: string;
  active: boolean;
  createdAt: string;
}

const DEFAULT_PROMPT = `Sən ixtisaslaşmış bir quiz yaradıcısı AI-san. Sənin yeganə vəzifən — verilmiş bilik bazasına əsaslanaraq yüksək keyfiyyətli test sualları yaratmaqdır.

ƏSAS QAYDALAR:
1. Yalnız sənə verilmiş bilik bazasındakı məlumatlardan istifadə et. Kənar bilik əlavə etmə.
2. Hər sualın yalnız 1 dəqiq düzgün cavabı olsun.
3. Yanlış variantlar (distraktorlar) inandırıcı olsun — oxşar, amma yanlış məlumatlar seç.
4. Suallar birmənalı olsun — fərqli şəkildə yozula bilməsin.
5. Suallar müxtəlif çətinlik dərəcəsini əhatə etsin: asan (30%), orta (50%), çətin (20%).
6. Sual mətni qısa və aydın olsun — maksimum 2 cümlə.
7. Variantlar təxminən eyni uzunluqda olsun.
8. "Yuxarıdakıların hamısı" və ya "Heç biri" kimi variantlardan istifadə etmə.
9. Cavablar arasında müəyyən bir nümunə (həmişə A, həmişə D) olmasın — düzgün cavabı təsadüfi paylat.
10. Yalnız JSON formatında cavab ver — başqa heç nə yazma.`;

const emptyForm = () => ({
  name: "",
  category: "",
  content: "",
  prompt: DEFAULT_PROMPT,
  active: true,
});

export default function AiBotsPage() {
  const { success, error } = useToast();
  const [bots, setBots]             = useState<AiBot[]>([]);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<AiBot | null>(null);
  const [form, setForm]             = useState(emptyForm());
  const [saving, setSaving]         = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const fileInputRef                 = useRef<HTMLInputElement>(null);

  const fetchBots = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai-bots?full=true", { cache: "no-store" });
      const data = await res.json();
      setBots(Array.isArray(data) ? data : []);
    } catch { error("Botlar yüklənmədi"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchBots();
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setCategories(d); })
      .catch(() => {});
  }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setShowForm(true); };

  const openEdit = (bot: AiBot) => {
    setEditing(bot);
    setForm({ name: bot.name, category: bot.category, content: bot.content, prompt: bot.prompt, active: bot.active });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim())    { error("Bot adı tələb olunur"); return; }
    if (!form.content.trim()) { error("Öyrətmə mətni tələb olunur"); return; }
    if (!form.prompt.trim())  { error("Sistem promptu tələb olunur"); return; }
    setSaving(true);
    try {
      const url    = editing ? `/api/ai-bots/${editing.id}` : "/api/ai-bots";
      const method = editing ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data   = await res.json();
      if (!res.ok) { error(data.error || "Xəta baş verdi"); return; }
      success(editing ? "Bot yeniləndi" : "Bot yaradıldı");
      setShowForm(false);
      fetchBots();
    } catch { error("Xəta baş verdi"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu botu silmək istədiyinizə əminsiniz?")) return;
    setDeletingId(id);
    try {
      const res  = await fetch(`/api/ai-bots/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { error(data.error || "Silinmədi"); return; }
      success("Bot silindi");
      setBots((p) => p.filter((b) => b.id !== id));
    } catch { error("Xəta baş verdi"); }
    finally { setDeletingId(null); }
  };

  const labelCls = "block text-sm font-medium text-slate-700 mb-1.5";

  const ACCEPTED_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  const handleFileUpload = async (file: File) => {
    const isDocx = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      || file.name?.toLowerCase().endsWith(".docx");
    const isPdf = file.type === "application/pdf" || file.name?.toLowerCase().endsWith(".pdf");

    if (!isPdf && !isDocx) {
      error("Yalnız PDF və ya Word (.docx) fayl qəbul edilir");
      return;
    }
    setFileLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ai-bots/extract-pdf", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        error(data.error || "Fayl oxunarkən xəta baş verdi");
        return;
      }

      setForm((p) => ({ ...p, content: data.text }));
      const typeLabel = isDocx ? "Word" : "PDF";
      success(`${typeLabel} oxundu: ${data.charCount.toLocaleString()} simvol, ~${data.pageCount} səhifə`);
    } catch (e: any) {
      console.error("File parse error:", e);
      error(`Fayl xətası: ${e?.message || "Faylın zədəli olmadığını yoxlayın"}`);
    } finally {
      setFileLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── FORM VIEW ──────────────────────────────────────────────
  if (showForm) {
    return (
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8 gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 truncate">
            {editing ? "Bot Düzəlt" : "Yeni AI Bot"}
          </h1>
          <button onClick={() => setShowForm(false)}
            className="btn-secondary flex items-center gap-2 flex-shrink-0 text-sm">
            <X size={15} /> <span className="hidden sm:inline">Ləğv et</span>
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-5 w-full max-w-3xl">
          {/* Əsas məlumatlar */}
          <div className="card-static space-y-4">
            <h2 className="text-base font-semibold text-slate-800">Əsas Məlumatlar</h2>

            <div>
              <label className={labelCls}>Bot Adı <span className="text-red-500">*</span></label>
              <input type="text" value={form.name} required className="input-field"
                placeholder="Məs: Qanunvericilik Mütəxəssisi"
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>

            <div>
              <label className={labelCls}>Kateqoriya <span className="text-slate-400 text-xs">(isteğe bağlı)</span></label>
              <select value={form.category} className="select-field"
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
                <option value="">— Seçin —</option>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Status</label>
              <div className="flex gap-2">
                {[{ val: true, label: "Aktiv" }, { val: false, label: "Deaktiv" }].map((s) => (
                  <button key={String(s.val)} type="button"
                    onClick={() => setForm((p) => ({ ...p, active: s.val }))}
                    className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      form.active === s.val
                        ? s.val ? "bg-green-600 text-white" : "bg-slate-500 text-white"
                        : "bg-white border border-slate-200 text-slate-600"
                    }`}>
                    <span className="w-2 h-2 rounded-full bg-current" />
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sistem promptu */}
          <div className="card-static">
            <h2 className="text-base font-semibold text-slate-800 mb-1">
              Sistem Promptu <span className="text-red-500">*</span>
            </h2>
            <p className="text-xs text-slate-500 mb-3">
              AI-a verilən əsas təlimat. Bu prompt AI-ın davranışını, tonunu və çərçivəsini müəyyən edir.
            </p>
            <textarea
              value={form.prompt}
              rows={4}
              required
              className="input-field resize-none font-mono text-xs sm:text-sm w-full"
              placeholder="Məs: Sən Azərbaycan qanunvericiliyi üzrə mütəxəssis AI-san. Yalnız Azərbaycan qanunları haqqında suallar yarat."
              onChange={(e) => setForm((p) => ({ ...p, prompt: e.target.value }))}
            />
          </div>

          {/* Öyrətmə mətni */}
          <div className="card-static">
            <div className="flex items-start justify-between gap-3 mb-1">
              <div>
                <h2 className="text-base font-semibold text-slate-800">
                  Öyrətmə Mətni (Bilik Bazası) <span className="text-red-500">*</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  AI bu mətnə əsaslanaraq suallar yaradacaq. Mövzu ilə bağlı qanunlar, qaydalar, faktlar əlavə edin.
                </p>
              </div>
              {/* Fayl yüklə düyməsi (PDF / Word) */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={fileLoading}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "rgba(102,126,234,0.1)", color: "#667eea", border: "1px solid rgba(102,126,234,0.25)" }}
                title="PDF və ya Word (.docx) yüklə — mətn avtomatik doldurulacaq"
              >
                {fileLoading
                  ? <><Loader2 size={13} className="animate-spin" /> Oxunur...</>
                  : <><Upload size={13} /> Fayl Yüklə</>}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
              />
            </div>

            {/* PDF yüklənibsə kiçik info */}
            {form.content.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-green-600 mb-2">
                <CheckCircle size={12} />
                {form.content.length.toLocaleString()} simvol daxil edilib
              </div>
            )}

            <textarea
              value={form.content}
              rows={10}
              required
              className="input-field resize-y font-mono text-xs sm:text-sm w-full"
              placeholder={"PDF və ya Word faylı yükləyin, yaxud mətni əl ilə daxil edin...\n\nMəs:\nAzərbaycan Respublikasının Konstitusiyası 1995-ci ildə qəbul edilmişdir...\n\nMaddə 1. Dövlət hakimiyyəti\nAzərbaycan Respublikasında dövlət hakimiyyətinin yeganə mənbəyi Azərbaycan xalqıdır..."}
              onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
            />
            <p className="text-xs text-slate-400 mt-1.5">
              {form.content.length.toLocaleString()} simvol — nə qədər çox məlumat, bir o qədər dəqiq suallar
            </p>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button type="submit" disabled={saving}
              className="btn-primary flex-1 py-3 flex items-center justify-center gap-2 order-1 sm:order-none">
              {saving
                ? <><Loader2 size={16} className="animate-spin" /> Saxlanılır...</>
                : (editing ? "Yadda Saxla" : "Bot Yarat")}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="btn-secondary sm:px-8 py-3 order-2 sm:order-none">
              Ləğv et
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between mb-6 sm:mb-8 gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">AI Botlar</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Quiz generasiyası üçün AI botları idarə edin</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 flex-shrink-0 text-sm">
          <Plus size={16} /> <span className="hidden xs:inline sm:inline">Yeni Bot</span>
          <span className="xs:hidden sm:hidden">Bot</span>
        </button>
      </div>

      <div className="card-static overflow-hidden">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl animate-pulse"
                style={{ background: "rgba(147,204,255,0.08)" }} />
            ))}
          </div>
        ) : bots.length === 0 ? (
          <div className="text-center py-12 sm:py-16 text-slate-400">
            <Bot size={36} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium text-sm sm:text-base">Hələ AI bot əlavə edilməyib</p>
            <p className="text-xs sm:text-sm mt-1">Yeni bot yaradaraq quiz generasiyasını fərdiləşdirin</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bots.map((bot) => (
              <div key={bot.id} className="border border-slate-100 rounded-xl overflow-hidden">
                {/* Bot row */}
                <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4">
                  {/* Icon */}
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,#667eea,#764ba2)" }}>
                    <Bot size={16} className="text-white" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm truncate">{bot.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {bot.category && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                          {bot.category}
                        </span>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        bot.active
                          ? "bg-green-50 text-green-700 border border-green-100"
                          : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}>
                        {bot.active ? "Aktiv" : "Deaktiv"}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setExpandedId(expandedId === bot.id ? null : bot.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                      title="Detayları göstər">
                      {expandedId === bot.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                    <button onClick={() => openEdit(bot)}
                      className="p-1.5 text-[#1a7fe0] hover:bg-blue-50 rounded-lg transition-all"
                      title="Düzəlt">
                      <Edit size={14} />
                    </button>
                    <button onClick={() => handleDelete(bot.id)} disabled={deletingId === bot.id}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                      title="Sil">
                      {deletingId === bot.id
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {expandedId === bot.id && (
                  <div className="border-t border-slate-100 p-3 sm:p-4 space-y-3 bg-slate-50">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Sistem Promptu
                      </p>
                      <pre className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap font-mono bg-white rounded-lg p-3 border border-slate-200 max-h-28 sm:max-h-32 overflow-y-auto">
                        {bot.prompt}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Bilik Bazası{" "}
                        <span className="text-slate-400 font-normal normal-case">
                          ({bot.content.length} simvol)
                        </span>
                      </p>
                      <pre className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap font-mono bg-white rounded-lg p-3 border border-slate-200 max-h-40 sm:max-h-48 overflow-y-auto">
                        {bot.content}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
