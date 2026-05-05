import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { v2 as cloudinary } from "cloudinary";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Kiçik fayllar (şəkillər) üçün Cloudinary proxy
// Böyük fayllar (PDF, video) UploadThing vasitəsilə yüklənir

const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", // şəkillər
]);

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

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Fayl oxunarkən xəta baş verdi." }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Fayl tapılmadı" }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: `Bu endpoint yalnız şəkillər üçündür (${ext})` }, { status: 400 });
    }

    const cleanName = path.basename(file.name, ext).replace(/[^a-zA-Z0-9-_]/g, "_").substring(0, 50);
    const publicId  = `${cleanName}_${Date.now()}`;

    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream({
        folder:        "muellim-portal",
        public_id:     publicId,
        resource_type: "image",
        access_mode:   "public",
        type:          "upload",
      }, (error, result) => {
        if (error || !result) reject(error ?? new Error("Upload failed"));
        else resolve(result);
      }).end(buffer);
    });

    return NextResponse.json({
      url:      result.secure_url,
      fileType: "IMAGE",
      fileName: file.name,
      size:     file.size,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: `Yükləmə xətası: ${error instanceof Error ? error.message : "Naməlum xəta"}` }, { status: 500 });
  }
}
