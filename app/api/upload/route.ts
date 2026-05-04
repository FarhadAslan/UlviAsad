import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { v2 as cloudinary } from "cloudinary";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".txt",
  ".mp4", ".webm", ".ogg",
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
]);

const FILE_TYPE_MAP: Record<string, string> = {
  ".pdf":  "PDF",
  ".doc":  "DOC",
  ".docx": "DOCX",
  ".ppt":  "PPT",
  ".pptx": "PPTX",
  ".txt":  "TXT",
  ".mp4":  "VIDEO",
  ".webm": "VIDEO",
  ".ogg":  "VIDEO",
  ".jpg":  "IMAGE",
  ".jpeg": "IMAGE",
  ".png":  "IMAGE",
  ".gif":  "IMAGE",
  ".webp": "IMAGE",
};

function getResourceType(ext: string): "image" | "video" | "raw" {
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)) return "image";
  if ([".mp4", ".webm", ".ogg"].includes(ext)) return "video";
  return "raw";
}

function configureCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// ── GET: İmzalı upload parametrləri qaytar (client-side direct upload üçün) ──
// Böyük fayllar (>4MB) üçün client birbaşa Cloudinary-ə yükləyir
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    if (!session || (userRole !== "ADMIN" && userRole !== "TEACHER")) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const filename     = searchParams.get("filename") || "file";
    const fileType     = searchParams.get("type") || ".pdf";
    const resourceType = getResourceType(fileType);

    configureCloudinary();

    const ext       = fileType.startsWith(".") ? fileType : `.${fileType}`;
    const cleanName = path.basename(filename, ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .substring(0, 50);
    const publicId  = `muellim-portal/${cleanName}_${Date.now()}`;
    const timestamp = Math.round(Date.now() / 1000);

    const paramsToSign: Record<string, any> = {
      timestamp,
      public_id:     publicId,
      resource_type: resourceType,
      access_mode:   "public",
      type:          "upload",
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET!
    );

    return NextResponse.json({
      signature,
      timestamp,
      publicId,
      cloudName:    process.env.CLOUDINARY_CLOUD_NAME,
      apiKey:       process.env.CLOUDINARY_API_KEY,
      resourceType,
      fileType:     FILE_TYPE_MAP[ext] ?? "FILE",
    });
  } catch (error) {
    console.error("Sign error:", error);
    return NextResponse.json({ error: "İmzalama xətası" }, { status: 500 });
  }
}

// ── POST: Kiçik fayllar üçün server-side proxy upload (≤10MB) ──
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    if (!session || (userRole !== "ADMIN" && userRole !== "TEACHER")) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return NextResponse.json({ error: "Cloudinary konfiqurasiyası tapılmadı" }, { status: 500 });
    }

    configureCloudinary();

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({
        error: "Fayl oxunarkən xəta baş verdi. Fayl çox böyükdür — birbaşa yükləmə istifadə edin.",
      }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Fayl tapılmadı" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: `Fayl ölçüsü 200MB-dan çox ola bilməz (cari: ${(file.size / 1024 / 1024).toFixed(1)}MB)`,
      }, { status: 400 });
    }

    const ext      = path.extname(file.name).toLowerCase();
    const mimeOk   = ALLOWED_MIME_TYPES.has(file.type);
    const extOk    = ALLOWED_EXTENSIONS.has(ext);
    if (!mimeOk && !extOk) {
      return NextResponse.json({
        error: `Bu fayl tipi dəstəklənmir (${file.type || ext})`,
      }, { status: 400 });
    }

    const resourceType = getResourceType(ext);
    const cleanName    = path.basename(file.name, ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .substring(0, 50);
    const publicId = `${cleanName}_${Date.now()}`;

    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadOptions: Record<string, any> = {
      folder:        "muellim-portal",
      public_id:     publicId,
      resource_type: resourceType,
      access_mode:   "public",
      type:          "upload",
      use_filename:  false,
    };

    if (resourceType === "raw" && ext !== ".pdf") {
      uploadOptions.format = ext.replace(".", "");
    }

    const result = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
        if (error || !result) reject(error ?? new Error("Upload failed"));
        else resolve(result);
      }).end(buffer);
    });

    return NextResponse.json({
      url:      result.secure_url,
      fileType: FILE_TYPE_MAP[ext] ?? "FILE",
      fileName: file.name,
      size:     file.size,
    });
  } catch (error) {
    console.error("Upload error:", error);
    const msg = error instanceof Error ? error.message : "Naməlum xəta";
    if (msg.includes("timeout") || msg.includes("ETIMEDOUT")) {
      return NextResponse.json({
        error: "Yükləmə vaxtı bitdi. Fayl çox böyükdür.",
      }, { status: 504 });
    }
    return NextResponse.json({ error: `Yükləmə xətası: ${msg}` }, { status: 500 });
  }
}
