"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, FileText, Film, File, CheckCircle } from "lucide-react";
import { useToast } from "@/components/ui/toast-1";
import { generateReactHelpers } from "@uploadthing/react";
import type { OurFileRouter } from "@/lib/uploadthing";

const { useUploadThing } = generateReactHelpers<OurFileRouter>();

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

const MAX_SIZE = 512 * 1024 * 1024; // 512MB (UploadThing free limit)

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

  const { startUpload } = useUploadThing("materialUploader", {
    onUploadProgress: (p) => setProgress(p),
    onClientUploadComplete: (res) => {
      if (res?.[0]) {
        const r = res[0];
        const serverData = (r as any).serverData;
        const ext = getExt(r.name);
        onUpload({
          url:      serverData?.url ?? r.ufsUrl ?? (r as any).url,
          fileType: serverData?.fileType ?? FILE_TYPE_MAP[ext] ?? "FILE",
          fileName: r.name,
          size:     r.size,
        });
      }
      setUploading(false);
      setProgress(0);
      setStatusMsg("");
    },
    onUploadError: (e) => {
      error(e.message || "Yükləmə xətası baş verdi");
      setUploading(false);
      setProgress(0);
      setStatusMsg("");
    },
  });

  const handleFile = useCallback(async (file: File) => {
    if (file.size > MAX_SIZE) {
      error(`Fayl ölçüsü 512MB-dan çox ola bilməz (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      return;
    }
    const ext = getExt(file.name);
    if (!ALLOWED_EXTS.includes(ext)) {
      error(`Bu fayl tipi dəstəklənmir (${ext || file.type})`);
      return;
    }

    setUploading(true);
    setProgress(0);
    setStatusMsg("Yüklənir...");

    await startUpload([file]);
  }, [startUpload, error]);

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
            <p className="text-xs text-slate-400">{progress}%</p>
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
              PDF · DOC · DOCX · PPT · PPTX · TXT · MP4 · Şəkil · Maks 512MB
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
