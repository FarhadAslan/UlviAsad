import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import JSZip from "jszip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function getContentType(fileType: string, url: string): string {
  const type = fileType.toUpperCase();
  const map: Record<string, string> = {
    PDF:  "application/pdf",
    DOC:  "application/msword",
    DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    PPT:  "application/vnd.ms-powerpoint",
    PPTX: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    TXT:  "text/plain",
    VIDEO: "video/mp4",
    MP4:  "video/mp4",
    IMAGE: "image/jpeg",
  };
  if (map[type]) return map[type];
  const ext = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)?.[1]?.toLowerCase() || "";
  const extMap: Record<string, string> = {
    pdf: "application/pdf", doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain", mp4: "video/mp4",
  };
  return extMap[ext] || "application/octet-stream";
}

function buildFilename(filename: string, fileType: string): string {
  const extMap: Record<string, string> = {
    PDF: ".pdf", DOC: ".doc", DOCX: ".docx",
    PPT: ".ppt", PPTX: ".pptx", TXT: ".txt",
    VIDEO: ".mp4", MP4: ".mp4", IMAGE: ".jpg",
  };
  const ext = extMap[fileType.toUpperCase()] || "";
  // Artıq uzantı varsa əlavə etmə
  if (ext && filename.toLowerCase().endsWith(ext)) return filename;
  // Uzantı yoxdursa əlavə et
  if (ext) return filename + ext;
  return filename;
}

// Cloudinary URL-dən public_id çıxar
function extractPublicId(url: string): string | null {
  const match = url.match(/\/raw\/upload\/(?:v\d+\/)?(.+)$/);
  return match ? match[1] : null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url      = searchParams.get("url");
  const filename = searchParams.get("filename") || "fayl";
  const inline   = searchParams.get("inline") === "true";
  const fileType = searchParams.get("type") || "";

  if (!url) return NextResponse.json({ error: "URL tələb olunur" }, { status: 400 });
  if (!url.startsWith("https://res.cloudinary.com/")) {
    return NextResponse.json({ error: "İcazəsiz URL" }, { status: 403 });
  }

  try {
    // 1. Birbaşa fetch cəhdi
    const directRes = await fetch(url);

    if (directRes.ok) {
      const buffer      = await directRes.arrayBuffer();
      const contentType = getContentType(fileType, url);
      const finalFilename = buildFilename(filename, fileType);
      const disposition   = inline
        ? `inline; filename="${finalFilename}"`
        : `attachment; filename="${finalFilename}"`;

      return new NextResponse(buffer, {
        headers: {
          "Content-Type":        contentType,
          "Content-Disposition": disposition,
          "Content-Length":      buffer.byteLength.toString(),
          "Cache-Control":       "public, max-age=3600",
        },
      });
    }

    // 2. 401 aldıqda — Cloudinary generate_archive API ilə ZIP al
    if (directRes.status === 401) {
      const publicId = extractPublicId(url);
      if (!publicId) return NextResponse.json({ error: "URL formatı tanınmadı" }, { status: 400 });

      const zipUrl = cloudinary.utils.download_zip_url({
        public_ids:    [publicId],
        resource_type: "raw",
      });

      const zipRes = await fetch(zipUrl as string);
      if (!zipRes.ok) {
        return NextResponse.json({ error: "Fayl tapılmadı" }, { status: 404 });
      }

      const zipBuffer = await zipRes.arrayBuffer();

      // ZIP-dən faylı çıxar
      const zip = await JSZip.loadAsync(zipBuffer);
      const zipFiles = Object.keys(zip.files).filter(f => !zip.files[f].dir);

      if (zipFiles.length === 0) {
        return NextResponse.json({ error: "ZIP boşdur" }, { status: 404 });
      }

      const fileData    = await zip.files[zipFiles[0]].async("arraybuffer");
      const contentType = getContentType(fileType, url);

      // Fayl adını düzgün qur — uzantı mütləq olsun
      const finalFilename = buildFilename(filename, fileType);

      const disposition = inline
        ? `inline; filename="${finalFilename}"`
        : `attachment; filename="${finalFilename}"`;

      return new NextResponse(fileData, {
        headers: {
          "Content-Type":        contentType,
          "Content-Disposition": disposition,
          "Content-Length":      fileData.byteLength.toString(),
          "Cache-Control":       "public, max-age=3600",
        },
      });
    }

    return NextResponse.json({ error: "Fayl tapılmadı" }, { status: 404 });

  } catch (error) {
    console.error("Download proxy error:", error);
    return NextResponse.json(
      { error: `Yükləmə xətası: ${error instanceof Error ? error.message : "Naməlum xəta"}` },
      { status: 500 }
    );
  }
}
