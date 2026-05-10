"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, ImagePlus, Loader2, XCircle, GripVertical } from "lucide-react";
import { useToast } from "@/components/ui/toast-1";
import { formatDate } from "@/lib/utils";
import ConfirmModal from "@/components/ui/confirm-modal";

export default function AdminCertificatesPage() {
  const { success, error } = useToast();
  const [certs,         setCerts]         = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [uploading,     setUploading]     = useState(false);
  const [title,         setTitle]         = useState("");
  const [confirmId,     setConfirmId]     = useState<string | null>(null);
  const [deleting,      setDeleting]      = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchCerts(); }, []);

  const fetchCerts = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/certificates");
      const data = await res.json();
      setCerts(Array.isArray(data) ? data : []);
    } catch { error("Xəta baş verdi"); }
    finally   { setLoading(false); }
  };

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) { error("Yalnız şəkil faylı yükləyə bilərsiniz"); return; }
    if (file.size > 10 * 1024 * 1024)   { error("Şəkil ölçüsü 10MB-dan çox ola bilməz"); return; }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes  = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) { error(uploadData.error || "Yükləmə xətası"); return; }

      const res = await fetch("/api/certificates", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ imageUrl: uploadData.url, title }),
      });
      if (res.ok) {
        success("Sertifikat əlavə edildi");
        setTitle("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        fetchCerts();
      } else {
        const d = await res.json();
        error(d.error || "Xəta baş verdi");
      }
    } catch { error("Xəta baş verdi"); }
    finally   { setUploading(false); }
  };

  const deleteCert = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/certificates/${id}`, { method: "DELETE" });
      if (res.ok) { success("Sertifikat silindi"); fetchCerts(); }
      else error("Silinmədi");
    } catch { error("Xəta baş verdi"); }
    finally { setDeleting(false); setConfirmId(null); }
  };

  return (
    <div>
      <ConfirmModal
        open={!!confirmId}
        title="Sertifikatı sil"
        message="Bu sertifikatı silmək istədiyinizə əminsiniz?"
        confirmText="Sil"
        loading={deleting}
        onConfirm={() => confirmId && deleteCert(confirmId)}
        onCancel={() => setConfirmId(null)}
      />

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Sertifikatlar</h1>
      </div>

      {/* Yükləmə bölməsi */}
      <div className="card-static mb-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Yeni Sertifikat Əlavə Et</h2>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Başlıq <span className="text-slate-400 text-xs">(isteğe bağlı)</span>
          </label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Məs: Azərbaycan Tarixi Sertifikatı"
            className="input-field" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Sertifikat Şəkli *</label>
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-200 hover:border-[rgb(147,204,255)] rounded-xl p-10 cursor-pointer transition-colors bg-slate-50 hover:bg-blue-50/30"
          >
            {uploading ? (
              <><Loader2 size={32} className="text-[#1a7fe0] animate-spin" /><span className="text-sm text-slate-500">Yüklənir...</span></>
            ) : (
              <><ImagePlus size={32} className="text-slate-400" /><span className="text-sm text-slate-500">Sertifikat şəklini yükləmək üçün klikləyin</span><span className="text-xs text-slate-400">JPG, PNG — maks. 10MB</span></>
            )}
          </div>
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
        </div>
      </div>

      {/* Sertifikatlar siyahısı */}
      <div className="card-static overflow-hidden">
        <h2 className="text-lg font-semibold text-slate-800 mb-5">
          Mövcud Sertifikatlar
          {!loading && <span className="ml-2 text-sm font-normal text-slate-400">({certs.length} ədəd)</span>}
        </h2>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-video rounded-xl animate-pulse"
                style={{ background: "rgba(147,204,255,0.08)" }} />
            ))}
          </div>
        ) : certs.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-4">🏆</div>
            <p>Hələ sertifikat əlavə edilməyib</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {certs.map((cert) => (
              <div key={cert.id} className="group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 hover:border-[rgba(147,204,255,0.5)] transition-all">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cert.imageUrl} alt={cert.title || "Sertifikat"}
                  className="w-full aspect-video object-cover" />
                {cert.title && (
                  <div className="px-2 py-1.5 text-xs font-medium text-slate-700 truncate border-t border-slate-100">
                    {cert.title}
                  </div>
                )}
                {/* Sil düyməsi — hover-da görünür */}
                <button
                  onClick={() => setConfirmId(cert.id)}
                  className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-all"
                  title="Sil">
                  <Trash2 size={13} />
                </button>
                <div className="absolute bottom-2 left-2 text-[10px] text-white/70 bg-black/30 px-1.5 py-0.5 rounded">
                  {formatDate(cert.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
