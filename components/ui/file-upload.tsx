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

const MAX_SIZE   = 200 * 1024 * 1024; // 200MB
// Fayllar bu limitdən böyüksə birbaşa Cloudinary-ə göndərilir
const PROXY_LIMIT = 4 * 1024 * 1024;  // 4MB

// Unsigned upload preset — Cloudinary dashboard-da yaradılmış
const UPLOAD_PRESET = "muellim-portal-upload";

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

function getResourceType(ext: string): string {
  if ([".jpg",".jpeg",".png",".gif",".webp"].includes(ext)) return "image";
  if ([".mp4",".webm",".ogg"].includes(ext)) return "video";
  return "raw";
}

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
  const inputRef  = useRef<HTMLInputElement>(null);
  const xhrRef    = useRef<XMLHttpRequest | null>(null);

  // ── Kiçik fayllar (≤4MB): server proxy ─────────────────────
  const uploadViaProxy = useCallback(async (file: File): Promise<UploadResult> => {
    const fd = new FormData();
    fd.append("file", file);
    const res  = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Yükləmə xətası");
    return data as UploadResult;
  }, []);

  // ── Böyük fayllar (>4MB): unsigned preset ilə birbaşa Cloudinary ──
  // Unsigned preset CORS-u həll edir — api.cloudinary.com icazə verir
  const uploadDirect = useCallback((
    file: File,
    cloudName: string,
    onProgress: (pct: number) => void
  ): Promise<UploadResult> => {
    return new Promise((resolve, reject) => {
      const ext          = getExt(file.name);
      const resourceType = getResourceType(ext);
      const fileType     = FILE_TYPE_MAP[ext] ?? "FILE";
      const uploadUrl    = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

      const fd = new FormData();
      fd.append("file",           file);
      fd.append("upload_preset",  UPLOAD_PRESET);
      fd.append("folder",         "muellim-portal");

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      xhr.open("POST", uploadUrl);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        xhrRef.current = null;
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            if (result.secure_url) {
              resolve({
                url:      result.secure_url,
                fileType: fileType,
                fileName: file.name,
                size:     file.size,
              });
            } else {
              reject(new Error(result.error?.message || "Cloudinary cavab xətası"));
            }
          } catch {
            reject(new Error("Cavab parse xətası"));
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error?.message || `Cloudinary xətası (${xhr.status})`));
          } catch {
            reject(new Error(`Yükləmə xətası (${xhr.status})`));
          }
        }
      };

      xhr.onerror   = () => { xhrRef.current = null; reject(new Error("Şəbəkə xətası. İnternet bağlantınızı yoxlayın.")); };
      xhr.onabort   = () => { xhrRef.current = null; reject(new Error("Ləğv edildi")); };
      xhr.ontimeout = () => { xhrRef.current = null; reject(new Error("Yükləmə vaxtı bitdi")); };
      xhr.timeout   = 600000; // 10 dəqiqə

      xhr.send(fd);
    });
  }, []);

  const handleFile = useCallback(async (file: File) => {
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
    setStatusMsg("Hazırlanır...");

    try {
      let result: UploadResult;

      if (file.size <= PROXY_LIMIT) {
        // Kiçik fayl — server proxy
        setStatusMsg("Yüklənir...");
        const interval = setInterval(() => setProgress((p) => p < 85 ? p + 10 : p), 150);
        result = await uploadViaProxy(file);
        clearInterval(interval);
      } else {
        // Böyük fayl — birbaşa Cloudinary (unsigned preset)
        // Cloud name-i environment variable-dan al
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
        if (!cloudName) {
          throw new Error("Cloudinary konfiqurasiyası tapılmadı");
        }
        setStatusMsg("Yüklənir...");
        result = await uploadDirect(file, cloudName, (pct) => {
          setProgress(pct);
        });
      }

      setProgress(100);
      setStatusMsg("Tamamlandı!");
      setTimeout(() => {
        setUploading(false);
        setStatusMsg("");
        setProgress(0);
        onUpload(result);
      }, 400);

    } catch (e: any) {
      setUploading(false);
      setProgress(0);
      setStatusMsg("");
      if (e?.message !== "Ləğv edildi") {
        error(e?.message || "Yükləmə zamanı xəta baş verdi");
      }
    }
  }, [onUpload, error, uploadViaProxy, uploadDirect]);

  const cancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setUploading(false);
    setProgress(0);
    setStatusMsg("");
  };

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
            <button type="button" onClick={cancelUpload}
              className="text-xs text-red-400 hover:text-red-600 transition-colors">
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
