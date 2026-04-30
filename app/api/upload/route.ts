import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { v2 as cloudinary } from "cloudinary";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

function uploadStream(buffer: Buffer, options: Record<string, any>): Promise<any> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(options, (error, result) => {
        if (error || !result) reject(error ?? new Error("Upload failed"));
        else resolve(result);
      })
      .end(buffer);
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return NextResponse.json({ error: "Cloudinary konfiqurasiyası tapılmadı" }, { status: 500 });
    }

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Fayl oxunarkən xəta baş verdi" }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Fayl tapılmadı" }, { status: 400 });
    }

    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: "Fayl ölçüsü 100MB-dan çox ola bilməz" }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(file.type) && !ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `Bu fayl tipi dəstəklənmir (${file.type || ext})` },
        { status: 400 }
      );
    }

    const resourceType = getResourceType(ext);
    const cleanName = path.basename(file.name, ext).replace(/[^a-zA-Z0-9-_]/g, "_").substring(0, 50);
    const publicId   = `${cleanName}_${Date.now()}`;

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

    // Raw fayllar üçün: PDF-i uzantısız yüklə (Cloudinary PDF delivery-ni bloklamır)
    // Digər raw fayllar üçün format saxla
    if (resourceType === "raw" && ext !== ".pdf") {
      uploadOptions.format = ext.replace(".", "");
    }
    // PDF üçün format əlavə etmirik — uzantısız yüklənir, proxy düzgün serve edir

    const result  = await uploadStream(buffer, uploadOptions);
    const fileUrl = result.secure_url as string;

    return NextResponse.json({
      url:      fileUrl,
      fileType: FILE_TYPE_MAP[ext] ?? "FILE",
      fileName: file.name,
      size:     file.size,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: `Yükləmə xətası: ${error instanceof Error ? error.message : "Naməlum xəta"}` },
      { status: 500 }
    );
  }
}
