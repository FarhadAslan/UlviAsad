import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadToCloudinary } from "@/lib/cloudinary";
import path from "path";

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

function getResourceType(ext: string): "image" | "video" | "raw" {
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)) return "image";
  if ([".mp4", ".webm", ".ogg"].includes(ext)) return "video";
  return "raw";
}

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

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return NextResponse.json({ error: "Cloudinary konfiqurasiyası tapılmadı" }, { status: 500 });
    }

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

    // 100MB limit
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

    const baseName = path.basename(file.name, ext).replace(/[^a-zA-Z0-9-_]/g, "_").substring(0, 40);
    const publicId = `${baseName}_${Date.now()}`;

    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const resourceType = getResourceType(ext);
    const { url } = await uploadToCloudinary(buffer, {
      folder:        "muellim-portal",
      filename:      publicId,
      resource_type: resourceType,
    });

    return NextResponse.json({
      url,
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
