"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, FileText, Film, File, CheckCircle } from "lucide-react";
import { useToast } from "@/components/ui/toast-1";

interface UploadResult {
  url: string;
  fileType: string;
  fileName: string;
  size: number;
}

interface FileUploadProps {
  onUpload: (result: UploadResult) => void;
  onClear?: () => void;
  uploaded?: UploadResult | null;
}

function formatSize(bytes: number): string {
  if (bytes === 0)          return "—";
  if (bytes < 1024)         return `${bytes} B`;
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ type }: { type: string }) {
  if (type === "VIDEO")                    return <Film size={28} className="text-purple-500" />;
  if (type === "PDF")                      return <FileText size={28} className="text-red-500" />;
  if (["DOC","DOCX","TXT"].includes(type)) return <FileText size={28} className="text-blue-500" />;
  if (["PPT","PPTX"].includes(type))       return <FileText size={28} className="text-orange-500" />;
  return <File size={28} className="text-[#1a7fe0]" />;
}

export default function FileUpload({ onUpload, onClear, uploaded }: FileUploadProps) {
  const { error } = useToast();
  const [dragging,  setDragging]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setUploading(true);
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((p) => (p < 85 ? p + 8 : p));
    }, 200);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res  = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();

      clearInterval(interval);

      if (!res.ok) {
        error(data.error || "Yükləmə xətası");
        setUploading(false);
        setProgress(0);
        return;
      }

      setProgress(100);
      setTimeout(() => { setUploading(false); onUpload(data); }, 400);
    } catch {
      clearInterval(interval);
      error("Yükləmə zamanı xəta baş verdi");
      setUploading(false);
      setProgress(0);
    }
  }, [onUpload, error]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  // Uploaded state
  if (uploaded) {
    return (
      <div className="rounded-2xl border p-4 flex items-center gap-4"
        style={{ background: "rgba(31,111,67,0.05)", borderColor: "rgba(31,111,67,0.25)" }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(31,111,67,0.1)" }}>
          <FileIcon type={uploaded.fileType} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <CheckCircle size={15} className="text-green-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-slate-800 truncate">{uploaded.fileName}</p>
          </div>
          <p className="text-xs text-slate-400">
            {uploaded.fileType}{uploaded.size > 0 ? ` · ${formatSize(uploaded.size)}` : ""}
          </p>
        </div>
        <button type="button" onClick={onClear}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0">
          <X size={16} />
        </button>
      </div>
    );
  }

  // Upload zone
  return (
    <div>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className="rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer select-none"
        style={{
          borderColor: dragging ? "rgb(147,204,255)" : "rgba(147,204,255,0.35)",
          background:  dragging ? "rgba(147,204,255,0.06)" : "rgba(147,204,255,0.02)",
          padding: "2rem 1.5rem",
        }}
      >
        {uploading ? (
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: "rgba(147,204,255,0.12)" }}>
              <Upload size={22} className="text-[#1a7fe0] animate-bounce" />
            </div>
            <p className="text-sm font-medium text-slate-700 mb-3">Yüklənir...</p>
            <div className="w-full max-w-xs mx-auto h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%`, background: "linear-gradient(90deg,#1f6f43,#2e8b57)" }} />
            </div>
            <p className="text-xs text-slate-400 mt-2">{progress}%</p>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: dragging ? "rgba(147,204,255,0.2)" : "rgba(147,204,255,0.1)" }}>
              <Upload size={26} style={{ color: dragging ? "#1f6f43" : "#1a7fe0" }} />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">
              {dragging ? "Buraxın!" : "Faylı buraya sürükləyin"}
            </p>
            <p className="text-xs text-slate-400 mb-3">və ya klikləyin seçin</p>
            <span className="inline-block px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: "rgba(147,204,255,0.12)", color: "#1a7fe0", border: "1px solid rgba(147,204,255,0.3)" }}>
              PDF · DOC · DOCX · PPT · PPTX · TXT · MP4 · Şəkil · Maks 100MB
            </span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={onInputChange}
        accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.mp4,.webm,.ogg,.jpg,.jpeg,.png,.gif,.webp"
      />
    </div>
  );
}
