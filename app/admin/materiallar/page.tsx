"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, X, Edit, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/toast-1";
import { getCategoryLabel, formatDate } from "@/lib/utils";
import FileUpload from "@/components/ui/file-upload";
import Pagination from "@/components/Pagination";
import { useFormDraft } from "@/lib/useFormDraft";

const CATEGORIES = [
  { value: "QANUNVERICILIK", label: "Qanunvericilik" },
  { value: "MANTIQ",          label: "Məntiq" },
  { value: "AZERBAYCAN_DILI", label: "Azərbaycan Dili" },
  { value: "INFORMATIKA",     label: "İnformatika" },
  { value: "DQ_QEBUL",        label: "DQ Qəbul" },
];

const PAGE_SIZE = 10;

interface UploadResult { url: string; fileType: string; fileName: string; size: number; }
const emptyForm = () => ({ title: "", category: "QANUNVERICILIK", visibility: "PUBLIC", active: true });

export default function AdminMaterialsPage() {
  const { success, error } = useToast();
  const [materials,       setMaterials]       = useState<any[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [showForm,        setShowForm]        = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<any>(null);
  const [saving,          setSaving]          = useState(false);
  const [form,            setForm,  clearMaterialDraft] = useFormDraft("material_form", emptyForm(), false);
  const [uploaded,        setUploaded]        = useState<UploadResult | null>(null);
  const [page,            setPage]            = useState(1);

  useEffect(() => { fetchMaterials(); }, []);

  useEffect(() => {
    if (editingMaterial) {
      setForm({ title: editingMaterial.title, category: editingMaterial.category, visibility: editingMaterial.visibility, active: editingMaterial.active !== false });
      setUploaded({ url: editingMaterial.fileUrl, fileType: editingMaterial.fileType, fileName: editingMaterial.fileUrl.split("/").pop() || editingMaterial.title, size: 0 });
      setShowForm(true);
    }
  }, [editingMaterial]);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/materials?adminAll=true");
      const data = await res.json();
      setMaterials(Array.isArray(data) ? data : []);
    } catch { error("Xəta baş verdi"); }
    finally   { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploaded) { error("Zəhmət olmasa fayl yükləyin"); return; }
    setSaving(true);
    try {
      const url    = editingMaterial ? `/api/materials/${editingMaterial.id}` : "/api/materials";
      const method = editingMaterial ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, category: form.category, fileUrl: uploaded.url, fileType: uploaded.fileType, visibility: form.visibility, active: form.active }),
      });
      if (res.ok) {
        success(editingMaterial ? "Material yeniləndi" : "Material əlavə edildi");
        clearMaterialDraft();
        closeForm();
        fetchMaterials();
      } else {
        const d = await res.json();
        error(d.error || "Xəta baş verdi");
      }
    } catch { error("Xəta baş verdi"); }
    finally   { setSaving(false); }
  };

  const deleteMaterial = async (id: string) => {
    if (!confirm("Bu materialı silmək istədiyinizə əminsiniz?")) return;
    try {
      const res = await fetch(`/api/materials/${id}`, { method: "DELETE" });
      if (res.ok) { success("Material silindi"); fetchMaterials(); }
    } catch { error("Xəta baş verdi"); }
  };

  const closeForm = () => { setShowForm(false); setEditingMaterial(null); setForm(emptyForm()); setUploaded(null); };
  const openAdd   = () => { setEditingMaterial(null); setForm(emptyForm()); setUploaded(null); setShowForm(true); };

  const labelCls  = "block text-sm font-medium text-slate-700 mb-1.5";
  const toggleBtn = (active: boolean) =>
    `px-4 py-2 rounded-xl text-sm font-medium transition-all ${active ? "bg-[#1f6f43] text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:border-[rgb(147,204,255)]"}`;

  // Pagination
  const totalPages = Math.ceil(materials.length / PAGE_SIZE);
  const paginated  = useMemo(() => materials.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [materials, page]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Materiallar</h1>
        {!showForm && (
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Yeni Material
          </button>
        )}
      </div>

      {showForm && (
        <div className="card-static mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-slate-800">{editingMaterial ? "Materialı Düzəlt" : "Material Əlavə Et"}</h2>
            <button type="button" onClick={closeForm} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className={labelCls}>Başlıq *</label>
              <input type="text" value={form.title} required className="input-field" placeholder="Material başlığı"
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Kateqoriya *</label>
              <select value={form.category} className="select-field" onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>
                Fayl *
                {editingMaterial && <span className="ml-2 text-xs font-normal text-slate-400">(yeni fayl seçsəniz köhnəsi əvəz olunacaq)</span>}
              </label>
              <FileUpload
                uploaded={uploaded}
                onUpload={(result) => setUploaded(result)}
                onClear={() => {
                  if (editingMaterial) {
                    setUploaded({ url: editingMaterial.fileUrl, fileType: editingMaterial.fileType, fileName: editingMaterial.fileUrl.split("/").pop() || editingMaterial.title, size: 0 });
                  } else { setUploaded(null); }
                }}
              />
              {editingMaterial && uploaded?.url && (
                <a href={uploaded.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 text-xs text-[#1a7fe0] hover:underline">
                  <ExternalLink size={12} /> Mövcud faylı aç
                </a>
              )}
            </div>
            <div>
              <label className={labelCls}>Görünürlük</label>
              <div className="flex gap-2">
                {[{ value: "PUBLIC", label: "🌐 Açıq" }, { value: "STUDENT_ONLY", label: "🔒 Tələbə" }].map((v) => (
                  <button key={v.value} type="button" onClick={() => setForm((p) => ({ ...p, visibility: v.value }))} className={toggleBtn(form.visibility === v.value)}>{v.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm((p) => ({ ...p, active: true }))}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${form.active ? "bg-green-600 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:border-green-400"}`}>
                  <span className="w-2 h-2 rounded-full bg-current" /> Aktiv
                </button>
                <button type="button" onClick={() => setForm((p) => ({ ...p, active: false }))}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${!form.active ? "bg-slate-500 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-400"}`}>
                  <span className="w-2 h-2 rounded-full bg-current" /> Deaktiv
                </button>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={saving || !uploaded} className="btn-primary flex items-center gap-2">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (editingMaterial ? "Yadda Saxla" : "Əlavə Et")}
              </button>
              <button type="button" onClick={closeForm} className="btn-secondary">Ləğv et</button>
            </div>
          </form>
        </div>
      )}

      <div className="card-static overflow-hidden">
        {loading ? (
          <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "rgba(147,204,255,0.08)" }} />)}</div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {["Başlıq","Kateqoriya","Tip","Görünürlük","Status","Tarix","Əməliyyatlar"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginated.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 pr-4 font-medium text-sm text-slate-800 max-w-[200px] truncate">{m.title}</td>
                      <td className="py-3 pr-4"><span className="badge-category">{getCategoryLabel(m.category)}</span></td>
                      <td className="py-3 pr-4 text-sm text-slate-500">{m.fileType}</td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${m.visibility === "PUBLIC" ? "bg-green-50 text-green-700 border border-green-100" : "bg-amber-50 text-amber-700 border border-amber-100"}`}>
                          {m.visibility === "PUBLIC" ? "🌐 Açıq" : "🔒 Tələbə"}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1 ${m.active !== false ? "bg-green-50 text-green-700 border border-green-100" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${m.active !== false ? "bg-green-500" : "bg-slate-400"}`} />
                          {m.active !== false ? "Aktiv" : "Deaktiv"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-sm text-slate-400">{formatDate(m.createdAt)}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setEditingMaterial(m)} className="p-1.5 text-[#1a7fe0] hover:bg-blue-50 rounded-lg transition-all" title="Düzəlt"><Edit size={14} /></button>
                          <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-all" title="Faylı aç"><ExternalLink size={14} /></a>
                          <button onClick={() => deleteMaterial(m.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Sil"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {materials.length === 0 && <div className="text-center py-12 text-slate-400">Hələ material əlavə edilməyib</div>}
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
          </>
        )}
      </div>
    </div>
  );
}
