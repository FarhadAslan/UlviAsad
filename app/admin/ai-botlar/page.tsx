"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Edit, Bot, X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/components/ui/toast-1";

interface AiBot {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  prompt: string;
  active: boolean;
  createdAt: string;
}

const emptyForm = () => ({
  name: "",
  description: "",
  category: "",
  content: "",
  prompt: "",
  active: true,
});

export default function AiBotsPage() {
  const { success, error } = useToast();
  const [bots, setBots]               = useState<AiBot[]>([]);
  const [categories, setCategories]   = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [editing, setEditing]         = useState<AiBot | null>(null);
  const [form, setForm]               = useState(emptyForm());
  const [saving, setSaving]           = useState(false);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [expandedId, setExpandedId]   = useState<string | null>(null);

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

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (bot: AiBot) => {
    setEditing(bot);
    setForm({
      name: bot.name,
      description: bot.description,
      category: bot.category,
      content: bot.content,
      prompt: bot.prompt,
      active: bot.active,
    });
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
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
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
      const res = await fetch(`/api/ai-bots/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { error(data.error || "Silinmədi"); return; }
      success("Bot silindi");
      setBots((p) => p.filter((b) => b.id !== id));
    } catch { error("Xəta baş verdi"); }
    finally { setDeletingId(null); }
  };

  const labelCls = "block text-sm font-medium text-slate-700 mb-1.5";

  // ── FORM VIEW ──────────────────────────────────────────────
  if (showForm) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            {editing ? "Bot Düzəlt" : "Yeni AI Bot"}
          </h1>
          <button onClick={() => setShowForm(false)} className="btn-secondary flex items-center gap-2">
            <X size={15} /> Ləğv et
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
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
              <label className={labelCls}>Qısa Təsvir <span className="text-slate-400 text-xs">(isteğe bağlı)</span></label>
              <input type="text" value={form.description} className="input-field"
                placeholder="Bu bot nə üçün istifadə olunur?"
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>

            <div>
              <label className={labelCls}>Kateqoriya <span className="text-slate-400 text-xs">(isteğe bağlı)</span></label>
              <select
                value={form.category}
                className="select-field"
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              >
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
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
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
          <div className="card-static space-y-3">
            <div>
              <h2 className="text-base font-semibold text-slate-800 mb-1">Sistem Promptu <span className="text-red-500">*</span></h2>
              <p className="text-xs text-slate-500 mb-3">
                AI-a verilən əsas təlimat. Bu prompt AI-ın davranışını, tonunu və çərçivəsini müəyyən edir.
              </p>
              <textarea
                value={form.prompt}
                rows={5}
                required
                className="input-field resize-none font-mono text-sm"
                placeholder={`Məs: Sən Azərbaycan qanunvericiliyi üzrə mütəxəssis AI-san. Yalnız Azərbaycan qanunları, normativ aktlar və hüquqi prosedurlar haqqında suallar yarat. Suallar real imtahan formatında olsun.`}
                onChange={(e) => setForm((p) => ({ ...p, prompt: e.target.value }))}
              />
            </div>
          </div>

          {/* Öyrətmə mətni */}
          <div className="card-static space-y-3">
            <div>
              <h2 className="text-base font-semibold text-slate-800 mb-1">Öyrətmə Mətni (Bilik Bazası) <span className="text-red-500">*</span></h2>
              <p className="text-xs text-slate-500 mb-3">
                AI bu mətnə əsaslanaraq suallar yaradacaq. Mövzu ilə bağlı qanunlar, qaydalar, faktlar, anlayışlar əlavə edin.
                AI yalnız bu məlumatlar çərçivəsindən çıxmayacaq.
              </p>
              <textarea
                value={form.content}
                rows={12}
                required
                className="input-field resize-y font-mono text-sm"
                placeholder={`Məs:\nAzərbaycan Respublikasının Konstitusiyası 1995-ci ildə qəbul edilmişdir.\nKonstitusiya 5 bölmə, 12 fəsil və 158 maddədən ibarətdir.\nAzərbaycan Respublikası demokratik, hüquqi, dünyəvi, unitar respublikadır...\n\nMaddə 1. Dövlət hakimiyyəti\nAzərbaycan Respublikasında dövlət hakimiyyətinin yeganə mənbəyi Azərbaycan xalqıdır...`}
                onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
              />
              <p className="text-xs text-slate-400 mt-1">
                {form.content.length} simvol — nə qədər çox məlumat, bir o qədər dəqiq suallar
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <button type="submit" disabled={saving}
              className="btn-primary flex-1 py-3 flex items-center justify-center gap-2">
              {saving
                ? <><Loader2 size={16} className="animate-spin" /> Saxlanılır...</>
                : (editing ? "Yadda Saxla" : "Bot Yarat")}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary px-8">
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">AI Botlar</h1>
          <p className="text-sm text-slate-500 mt-1">Quiz generasiyası üçün AI botları idarə edin</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Yeni Bot
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
          <div className="text-center py-16 text-slate-400">
            <Bot size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Hələ AI bot əlavə edilməyib</p>
            <p className="text-sm mt-1">Yeni bot yaradaraq quiz generasiyasını fərdiləşdirin</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bots.map((bot) => (
              <div key={bot.id} className="border border-slate-100 rounded-xl overflow-hidden">
                {/* Bot header */}
                <div className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,#667eea,#764ba2)" }}>
                    <Bot size={18} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 text-sm">{bot.name}</p>
                      {bot.category && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                          {bot.category}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        bot.active
                          ? "bg-green-50 text-green-700 border border-green-100"
                          : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}>
                        {bot.active ? "Aktiv" : "Deaktiv"}
                      </span>
                    </div>
                    {bot.description && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{bot.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setExpandedId(expandedId === bot.id ? null : bot.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                      title="Detayları göstər">
                      {expandedId === bot.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                    <button onClick={() => openEdit(bot)}
                      className="p-1.5 text-[#1a7fe0] hover:bg-blue-50 rounded-lg transition-all"
                      title="Düzəlt">
                      <Edit size={14} />
                    </button>
                    <button onClick={() => handleDelete(bot.id)}
                      disabled={deletingId === bot.id}
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
                  <div className="border-t border-slate-100 p-4 space-y-3 bg-slate-50">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Sistem Promptu</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap font-mono bg-white rounded-lg p-3 border border-slate-200 max-h-32 overflow-y-auto">
                        {bot.prompt}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Bilik Bazası <span className="text-slate-400 font-normal normal-case">({bot.content.length} simvol)</span>
                      </p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap font-mono bg-white rounded-lg p-3 border border-slate-200 max-h-48 overflow-y-auto">
                        {bot.content}
                      </p>
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
