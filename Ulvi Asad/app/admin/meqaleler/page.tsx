"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Edit, X } from "lucide-react";
import { useToast } from "@/components/ui/toast-1";
import { formatDate } from "@/lib/utils";
import RichEditor from "@/components/ui/rich-editor";

export default function AdminArticlesPage() {
  const { success, error } = useToast();
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState<any>(null);
  const [form, setForm] = useState({ title: "", summary: "", content: "", active: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchArticles(); }, []);
  useEffect(() => {
    if (editingArticle) {
      setForm({ title: editingArticle.title, summary: editingArticle.summary || "", content: editingArticle.content, active: editingArticle.active !== false });
      setShowForm(true);
    }
  }, [editingArticle]);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/articles?all=true");
      const data = await res.json();
      setArticles(Array.isArray(data) ? data : []);
    } catch { error("Xəta baş verdi"); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.content) { error("Məzmun tələb olunur"); return; }
    setSaving(true);
    try {
      const url = editingArticle ? `/api/articles/${editingArticle.id}` : "/api/articles";
      const res = await fetch(url, {
        method: editingArticle ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        success(editingArticle ? "Məqalə yeniləndi" : "Məqalə yaradıldı");
        resetForm(); fetchArticles();
      } else { const d = await res.json(); error(d.error || "Xəta baş verdi"); }
    } catch { error("Xəta baş verdi"); }
    finally { setSaving(false); }
  };

  const resetForm = () => { setShowForm(false); setEditingArticle(null); setForm({ title: "", summary: "", content: "", active: true }); };

  const deleteArticle = async (id: string) => {
    if (!confirm("Bu məqaləni silmək istədiyinizə əminsiniz?")) return;
    try {
      const res = await fetch(`/api/articles/${id}`, { method: "DELETE" });
      if (res.ok) { success("Məqalə silindi"); fetchArticles(); }
    } catch { error("Xəta baş verdi"); }
  };

  const labelCls = "block text-sm font-medium text-slate-700 mb-1.5";

  if (showForm) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            {editingArticle ? "Məqaləni Düzəlt" : "Yeni Məqalə"}
          </h1>
          <button onClick={resetForm} className="btn-secondary flex items-center gap-2">
            <X size={15} /> Ləğv et
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="card-static space-y-4">
            <div>
              <label className={labelCls}>Başlıq *</label>
              <input type="text" value={form.title} required className="input-field"
                placeholder="Məqalə başlığı"
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Qısa Xülasə</label>
              <textarea value={form.summary} rows={2} maxLength={200}
                className="input-field resize-none" placeholder="Qısa xülasə..."
                onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Məzmun *</label>
              <RichEditor
                value={form.content}
                onChange={(c) => setForm((p) => ({ ...p, content: c }))}
                placeholder="Məqalənin məzmununu buraya yazın..."
                minHeight={300}
              />
            </div>
          </div>
          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm((p) => ({ ...p, active: true }))}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  form.active ? "bg-green-600 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:border-green-400"
                }`}>
                <span className="w-2 h-2 rounded-full bg-current" /> Aktiv
              </button>
              <button type="button" onClick={() => setForm((p) => ({ ...p, active: false }))}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  !form.active ? "bg-slate-500 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-400"
                }`}>
                <span className="w-2 h-2 rounded-full bg-current" /> Deaktiv
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 px-8">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Yayımla"}
            </button>
            <button type="button" onClick={resetForm} className="btn-secondary">Ləğv et</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Məqalələr</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Yeni Məqalə
        </button>
      </div>
      <div className="card-static overflow-hidden">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "rgba(147,204,255,0.08)" }} />
            ))}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Başlıq","Xülasə","Status","Tarix","Əməliyyatlar"].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {articles.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 pr-4 font-medium text-sm text-slate-800 max-w-xs">{a.title}</td>
                    <td className="py-3 pr-4 text-sm text-slate-500 max-w-xs truncate">{a.summary || "—"}</td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1 ${
                        a.active !== false
                          ? "bg-green-50 text-green-700 border border-green-100"
                          : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${a.active !== false ? "bg-green-500" : "bg-slate-400"}`} />
                        {a.active !== false ? "Aktiv" : "Deaktiv"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-sm text-slate-400">{formatDate(a.createdAt)}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setEditingArticle(a)}
                          className="p-1.5 text-[#1a7fe0] hover:bg-blue-50 rounded-lg transition-all">
                          <Edit size={14} />
                        </button>
                        <button onClick={() => deleteArticle(a.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {articles.length === 0 && (
              <div className="text-center py-12 text-slate-400">Hələ məqalə əlavə edilməyib</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
