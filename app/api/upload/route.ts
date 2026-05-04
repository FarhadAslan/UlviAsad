import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { v2 as cloudinary } from "cloudinary";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".txt",
  ".mp4", ".webm", ".ogg",
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
]);

const FILE_TYPE_MAP: Record<string, string> = {
  ".pdf":  "PDF",  ".doc":  "DOC",  ".docx": "DOCX",
  ".ppt":  "PPT",  ".pptx": "PPTX", ".txt":  "TXT",
  ".mp4":  "VIDEO",".webm": "VIDEO",".ogg":  "VIDEO",
  ".jpg":  "IMAGE",".jpeg": "IMAGE",".png":  "IMAGE",
  ".gif":  "IMAGE",".webp": "IMAGE",
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

// Cloudinary upload_large — chunk-based upload
// Content-Range header ilə hissə-hissə yüklənir
async function uploadChunkToCloudinary(
  chunk: Buffer,
  options: {
    publicId: string;
    resourceType: "image" | "video" | "raw";
    contentRange: string; // "bytes start-end/total"
    uploadId: string;
  }
): Promise<any> {
  const { publicId, resourceType, contentRange, uploadId } = options;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey    = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = {
    timestamp,
    public_id:   publicId,
    access_mode: "public",
    type:        "upload",
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

  const formData = new FormData();
  formData.append("file",        new Blob([chunk]));
  formData.append("api_key",     apiKey);
  formData.append("timestamp",   String(timestamp));
  formData.append("signature",   signature);
  formData.append("public_id",   publicId);
  formData.append("access_mode", "public");
  formData.append("type",        "upload");

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Range": contentRange,
      "X-Unique-Upload-Id": uploadId,
    },
    body: formData,
  });

  const data = await res.json();
  if (!res.ok && res.status !== 206) {
    throw new Error(data.error?.message || `Cloudinary chunk upload failed: ${res.status}`);
  }
  return data;
}

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
        error: "Fayl oxunarkən xəta. Chunk upload istifadə edin.",
      }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Fayl tapılmadı" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: `Fayl ölçüsü 200MB-dan çox ola bilməz (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
      }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: `Bu fayl tipi dəstəklənmir (${ext})` }, { status: 400 });
    }

    // Chunk upload parametrləri
    const chunkIndex  = parseInt(formData.get("chunkIndex") as string ?? "0");
    const totalChunks = parseInt(formData.get("totalChunks") as string ?? "1");
    const totalSize   = parseInt(formData.get("totalSize") as string ?? String(file.size));
    const uploadId    = formData.get("uploadId") as string ?? `upload_${Date.now()}`;
    const publicId    = formData.get("publicId") as string ?? "";

    const resourceType = getResourceType(ext);
    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Content-Range hesabla
    const chunkSize  = buffer.length;
    const startByte  = chunkIndex * (totalSize / totalChunks | 0);
    // Son chunk üçün dəqiq end byte
    const endByte    = Math.min(startByte + chunkSize - 1, totalSize - 1);
    const contentRange = `bytes ${startByte}-${endByte}/${totalSize}`;

    const result = await uploadChunkToCloudinary(buffer, {
      publicId,
      resourceType,
      contentRange,
      uploadId,
    });

    // Son chunk — tam URL qaytar
    if (chunkIndex === totalChunks - 1 && result.secure_url) {
      return NextResponse.json({
        url:      result.secure_url,
        fileType: FILE_TYPE_MAP[ext] ?? "FILE",
        fileName: file.name,
        size:     totalSize,
        done:     true,
      });
    }

    // Aralıq chunk — davam et
    return NextResponse.json({ done: false, chunkIndex });

  } catch (error) {
    console.error("Upload error:", error);
    const msg = error instanceof Error ? error.message : "Naməlum xəta";
    return NextResponse.json({ error: `Yükləmə xətası: ${msg}` }, { status: 500 });
  }
}
