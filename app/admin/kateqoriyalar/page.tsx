"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, X, AlertTriangle, Loader2, Tag, BookOpen, FileText } from "lucide-react";
import { useToast } from "@/components/ui/toast-1";

// ── Silmə xəbərdarlıq modalu ────────────────────────────────
function DeleteWarningModal({
  info,
  onConfirm,
  onCancel,
  loading,
}: {
  info: { categoryLabel: string; quizCount: number; materialCount: number };
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={22} className="text-red-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">
                "{info.categoryLabel}" silinsin?
              </h3>
              <p className="text-sm text-slate-500">
                Bu kateqoriya silinərsə aşağıdakı məlumatlar{" "}
                <span className="font-semibold text-slate-700">kateqoriyasız</span> qalacaq:
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className={`rounded-xl p-4 border text-center ${
              info.quizCount > 0 ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"
            }`}>
              <BookOpen size={18} className={`mx-auto mb-1.5 ${info.quizCount > 0 ? "text-red-400" : "text-slate-300"}`} />
              <p className={`text-2xl font-bold ${info.quizCount > 0 ? "text-red-600" : "text-slate-400"}`}>
                {info.quizCount}
              </p>
              <p className="text-xs font-medium text-slate-500 mt-0.5">Quiz</p>
            </div>
            <div className={`rounded-xl p-4 border text-center ${
              info.materialCount > 0 ? "bg-orange-50 border-orange-200" : "bg-slate-50 border-slate-200"
            }`}>
              <FileText size={18} className={`mx-auto mb-1.5 ${info.materialCount > 0 ? "text-orange-400" : "text-slate-300"}`} />
              <p className={`text-2xl font-bold ${info.materialCount > 0 ? "text-orange-600" : "text-slate-400"}`}>
                {info.materialCount}
              </p>
              <p className="text-xs font-medium text-slate-500 mt-0.5">Material</p>
            </div>
          </div>

          {(info.quizCount > 0 || info.materialCount > 0) && (
            <div className="rounded-xl p-3 bg-amber-50 border border-amber-200 text-xs text-amber-700 mb-5">
              ⚠️ Kateqoriya silinəndə mövcud quiz və materiallar silinmir, yalnız kateqoriya sahəsi boş qalır.
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={onConfirm} disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-all disabled:opacity-50">
              {loading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><Trash2 size={14} /> Bəli, sil</>}
            </button>
            <button onClick={onCancel} disabled={loading} className="flex-1 btn-secondary text-sm">
              Ləğv et
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Əsas səhifə ─────────────────────────────────────────────
export default function CategoriesPage() {
  const { success, error } = useToast();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [newLabel,   setNewLabel]   = useState("");
  const [adding,     setAdding]     = useState(false);
  const [showAdd,    setShowAdd]    = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [warnInfo,   setWarnInfo]   = useState<any>(null);
  const [pendingDel, setPendingDel] = useState<string | null>(null);

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/categories");
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      error("Kateqoriyalar yüklənmədi");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setAdding(true);
    try {
      const res  = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        success("Kateqoriya əlavə edildi");
        setNewLabel("");
        setShowAdd(false);
        fetchCategories();
      } else {
        error(data.error || "Xəta baş verdi");
      }
    } catch {
      error("Şəbəkə xətası");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteClick = async (id: string) => {
    setDeletingId(id);
    try {
      const res  = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.status === 409 && data.warning) {
        setWarnInfo(data);
        setPendingDel(id);
      } else if (res.ok) {
        success("Kateqoriya silindi");
        fetchCategories();
      } else {
        error(data.error || "Silinmədi");
      }
    } catch {
      error("Şəbəkə xətası");
    } finally {
      setDeletingId(null);
    }
  };

  const handleForceDelete = async () => {
    if (!pendingDel) return;
    setDeletingId(pendingDel);
    try {
      const res  = await fetch(`/api/categories/${pendingDel}?force=true`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        success("Kateqoriya silindi");
        setWarnInfo(null);
        setPendingDel(null);
        fetchCategories();
      } else {
        error(data.error || "Silinmədi");
      }
    } catch {
      error("Şəbəkə xətası");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Kateqoriyalar</h1>
          <p className="text-slate-500 text-sm mt-1">Quiz və material kateqoriyalarını idarə edin</p>
        </div>
        <button onClick={() => { setShowAdd((v) => !v); setNewLabel(""); }}
          className="btn-primary flex items-center gap-2">
          {showAdd ? <><X size={15} /> Bağla</> : <><Plus size={15} /> Yeni Kateqoriya</>}
        </button>
      </div>

      {/* Əlavə etmə formu */}
      {showAdd && (
        <div className="card-static mb-6">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Yeni Kateqoriya Əlavə Et</h2>
          <form onSubmit={handleAdd} className="flex gap-3">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="input-field flex-1"
              placeholder="Kateqoriya adı (məs: Riyaziyyat)"
              required
              autoFocus
            />
            <button type="submit" disabled={adding || !newLabel.trim()}
              className="btn-primary flex items-center gap-2 whitespace-nowrap">
              {adding
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><Plus size={14} /> Əlavə Et</>}
            </button>
          </form>
          <p className="text-xs text-slate-400 mt-2">
            Daxil etdiyiniz ad avtomatik olaraq sistem dəyərinə çevriləcək.
          </p>
        </div>
      )}

      {/* Kateqoriyalar grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl animate-pulse"
              style={{ background: "rgba(147,204,255,0.08)" }} />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="card-static text-center py-20">
          <Tag size={40} className="mx-auto mb-4 text-slate-200" />
          <p className="text-slate-400 font-medium">Hələ kateqoriya yoxdur</p>
          <button onClick={() => setShowAdd(true)}
            className="mt-4 btn-primary text-sm px-5 py-2">
            İlk kateqoriyanı əlavə et
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {categories.map((cat, i) => (
            <div key={cat.id}
              className="group relative card-static flex items-start justify-between gap-3 hover:border-[rgba(147,204,255,0.5)] transition-all">
              <div className="flex items-start gap-3 min-w-0">
                {/* Nömrə badge */}
                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-[#1a7fe0] flex-shrink-0 mt-0.5"
                  style={{ background: "rgba(147,204,255,0.12)", border: "1px solid rgba(147,204,255,0.25)" }}>
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 leading-tight">{cat.label}</p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">{cat.value}</p>
                </div>
              </div>

              {/* Sil düyməsi — hover-da görünür */}
              <button
                onClick={() => handleDeleteClick(cat.id)}
                disabled={deletingId === cat.id}
                className="flex-shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                title="Sil">
                {deletingId === cat.id
                  ? <div className="w-4 h-4 border-2 border-red-200 border-t-red-400 rounded-full animate-spin" />
                  : <Trash2 size={14} />}
              </button>
            </div>
          ))}

          {/* Yeni kateqoriya əlavə et kartı */}
          <button
            onClick={() => { setShowAdd(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className="card-static flex items-center justify-center gap-2 text-sm font-medium text-slate-400 hover:text-[#1a7fe0] border-dashed hover:border-[rgba(147,204,255,0.5)] transition-all min-h-[80px]"
            style={{ borderStyle: "dashed" }}>
            <Plus size={16} />
            Yeni əlavə et
          </button>
        </div>
      )}

      {/* Xəbərdarlıq modalu */}
      {warnInfo && (
        <DeleteWarningModal
          info={warnInfo}
          loading={deletingId === pendingDel}
          onConfirm={handleForceDelete}
          onCancel={() => { setWarnInfo(null); setPendingDel(null); }}
        />
      )}
    </div>
  );
}
