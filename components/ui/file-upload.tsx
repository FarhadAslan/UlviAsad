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

const MAX_SIZE    = 200 * 1024 * 1024; // 200MB
const CHUNK_SIZE  = 3.5 * 1024 * 1024; // 3.5MB — Vercel 4.5MB limitindən aşağı

const FILE_TYPE_MAP: Record<string, string> = {
  ".pdf":  "PDF",  ".doc":  "DOC",  ".docx": "DOCX",
  ".ppt":  "PPT",  ".pptx": "PPTX", ".txt":  "TXT",
  ".mp4":  "VIDEO",".webm": "VIDEO",".ogg":  "VIDEO",
  ".jpg":  "IMAGE",".jpeg": "IMAGE",".png":  "IMAGE",
  ".gif":  "IMAGE",".webp": "IMAGE",
};

const ALLOWED_EXTS = [
  ".pdf",".doc",".docx",".ppt",".pptx",".txt",
  ".mp4",".webm",".ogg",
  ".jpg",".jpeg",".png",".gif",".webp",
];

function formatSize(bytes: number): string {
  if (bytes === 0)         return "—";
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ type }: { type: string }) {
  if (type === "VIDEO")                    return <Film size={28} className="text-purple-500" />;
  if (type === "PDF")                      return <FileText size={28} className="text-red-500" />;
  if (["DOC","DOCX","TXT"].includes(type)) return <FileText size={28} className="text-blue-500" />;
  if (["PPT","PPTX"].includes(type))       return <FileText size={28} className="text-orange-500" />;
  return <File size={28} className="text-[#1a7fe0]" />;
}

function getExt(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx).toLowerCase() : "";
}

export default function FileUpload({ onUpload, onClear, uploaded }: FileUploadProps) {
  const { error } = useToast();
  const [dragging,  setDragging]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const handleFile = useCallback(async (file: File) => {
    // Validasiya
    if (file.size > MAX_SIZE) {
      error(`Fayl ölçüsü 200MB-dan çox ola bilməz (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      return;
    }
    const ext = getExt(file.name);
    if (!ALLOWED_EXTS.includes(ext)) {
      error(`Bu fayl tipi dəstəklənmir (${ext || file.type})`);
      return;
    }

    setUploading(true);
    setProgress(0);
    abortRef.current = false;

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId    = `uid_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const cleanName   = file.name.replace(/[^a-zA-Z0-9-_.]/g, "_").substring(0, 60);
    const publicId    = `muellim-portal/${cleanName.replace(ext, "")}_${Date.now()}`;

    try {
      for (let i = 0; i < totalChunks; i++) {
        if (abortRef.current) throw new Error("Ləğv edildi");

        const start = i * CHUNK_SIZE;
        const end   = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        setStatusMsg(
          totalChunks === 1
            ? "Yüklənir..."
            : `Yüklənir... (${i + 1}/${totalChunks})`
        );

        const fd = new FormData();
        fd.append("file",        chunk, file.name);
        fd.append("chunkIndex",  String(i));
        fd.append("totalChunks", String(totalChunks));
        fd.append("totalSize",   String(file.size));
        fd.append("uploadId",    uploadId);
        fd.append("publicId",    publicId);

        const res  = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Yükləmə xətası");
        }

        const pct = Math.round(((i + 1) / totalChunks) * 100);
        setProgress(pct);

        // Son chunk — URL gəldi
        if (data.done && data.url) {
          setStatusMsg("Tamamlandı!");
          setTimeout(() => {
            setUploading(false);
            setStatusMsg("");
            setProgress(0);
            onUpload(data as UploadResult);
          }, 400);
          return;
        }
      }

      // totalChunks === 1 amma done gəlmədisə
      throw new Error("Yükləmə tamamlanmadı");

    } catch (e: any) {
      if (!abortRef.current) {
        error(e?.message || "Yükləmə zamanı xəta baş verdi");
      }
      setUploading(false);
      setProgress(0);
      setStatusMsg("");
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

  // ── Uploaded state ──────────────────────────────────────────
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

  // ── Upload zone ─────────────────────────────────────────────
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
          <div className="text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: "rgba(147,204,255,0.12)" }}>
              <Upload size={22} className="text-[#1a7fe0] animate-bounce" />
            </div>
            <p className="text-sm font-medium text-slate-700 mb-1">{statusMsg || "Yüklənir..."}</p>
            <div className="w-full max-w-xs mx-auto h-2 rounded-full bg-slate-100 overflow-hidden mb-1">
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%`, background: "linear-gradient(90deg,#1f6f43,#2e8b57)" }} />
            </div>
            <p className="text-xs text-slate-400 mb-3">{progress}%</p>
            <button
              type="button"
              onClick={() => { abortRef.current = true; setUploading(false); setProgress(0); setStatusMsg(""); }}
              className="text-xs text-red-400 hover:text-red-600 transition-colors"
            >
              Ləğv et
            </button>
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
              PDF · DOC · DOCX · PPT · PPTX · TXT · MP4 · Şəkil · Maks 200MB
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
