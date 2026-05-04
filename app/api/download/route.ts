import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import JSZip from "jszip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function getContentType(fileType: string, url: string): string {
  const type = fileType.toUpperCase();
  const map: Record<string, string> = {
    PDF:   "application/pdf",
    DOC:   "application/msword",
    DOCX:  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    PPT:   "application/vnd.ms-powerpoint",
    PPTX:  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    TXT:   "text/plain",
    VIDEO: "video/mp4",
    MP4:   "video/mp4",
    IMAGE: "image/jpeg",
  };
  if (map[type]) return map[type];
  const ext = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)?.[1]?.toLowerCase() || "";
  const extMap: Record<string, string> = {
    pdf:  "application/pdf",
    doc:  "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt:  "text/plain",
    mp4:  "video/mp4",
  };
  return extMap[ext] || "application/octet-stream";
}

function buildFilename(filename: string, fileType: string): string {
  const extMap: Record<string, string> = {
    PDF:   ".pdf",
    DOC:   ".doc",
    DOCX:  ".docx",
    PPT:   ".ppt",
    PPTX:  ".pptx",
    TXT:   ".txt",
    VIDEO: ".mp4",
    MP4:   ".mp4",
    IMAGE: ".jpg",
  };
  const ext = extMap[fileType.toUpperCase()] || "";
  if (ext && filename.toLowerCase().endsWith(ext)) return filename;
  if (ext) return filename + ext;
  return filename;
}

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

  if (!url) {
    return NextResponse.json({ error: "URL tələb olunur" }, { status: 400 });
  }
  if (!url.startsWith("https://res.cloudinary.com/")) {
    return NextResponse.json({ error: "İcazəsiz URL" }, { status: 403 });
  }

  const contentType   = getContentType(fileType, url);
  const finalFilename = buildFilename(filename, fileType);
  const disposition   = inline
    ? `inline; filename*=UTF-8''${encodeURIComponent(finalFilename)}`
    : `attachment; filename*=UTF-8''${encodeURIComponent(finalFilename)}`;

  try {
    // Birbaşa fetch — streaming ilə qaytar (RAM-a tam yükləmə yox)
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 55000); // 55s timeout

    const directRes = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "muellim-portal/1.0" },
    });
    clearTimeout(timeoutId);

    if (directRes.ok) {
      // Cloudinary-dən gələn stream-i birbaşa client-ə ötür
      // Bu RAM-ı qoruyur — böyük fayllar üçün kritikdir
      const headers: Record<string, string> = {
        "Content-Type":        contentType,
        "Content-Disposition": disposition,
        "Cache-Control":       "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      };

      // Content-Length varsa ötür (progress bar üçün)
      const cl = directRes.headers.get("content-length");
      if (cl) headers["Content-Length"] = cl;

      return new NextResponse(directRes.body, { headers });
    }

    // 401 aldıqda — Cloudinary ZIP API ilə al
    if (directRes.status === 401) {
      const publicId = extractPublicId(url);
      if (!publicId) {
        return NextResponse.json({ error: "URL formatı tanınmadı" }, { status: 400 });
      }

      const zipUrl = cloudinary.utils.download_zip_url({
        public_ids:    [publicId],
        resource_type: "raw",
      });

      const zipController = new AbortController();
      const zipTimeout    = setTimeout(() => zipController.abort(), 55000);

      const zipRes = await fetch(zipUrl as string, { signal: zipController.signal });
      clearTimeout(zipTimeout);

      if (!zipRes.ok) {
        return NextResponse.json({ error: "Fayl tapılmadı" }, { status: 404 });
      }

      const zipBuffer = await zipRes.arrayBuffer();
      const zip       = await JSZip.loadAsync(zipBuffer);
      const zipFiles  = Object.keys(zip.files).filter((f) => !zip.files[f].dir);

      if (zipFiles.length === 0) {
        return NextResponse.json({ error: "ZIP boşdur" }, { status: 404 });
      }

      const fileData = await zip.files[zipFiles[0]].async("arraybuffer");

      return new NextResponse(fileData, {
        headers: {
          "Content-Type":        contentType,
          "Content-Disposition": disposition,
          "Content-Length":      fileData.byteLength.toString(),
          "Cache-Control":       "public, max-age=3600",
        },
      });
    }

    // Digər xətalar
    console.error(`Download failed: ${directRes.status} ${directRes.statusText} for ${url}`);
    return NextResponse.json(
      { error: `Fayl yüklənə bilmədi (${directRes.status})` },
      { status: directRes.status }
    );

  } catch (error) {
    console.error("Download proxy error:", error);
    const msg = error instanceof Error ? error.message : "Naməlum xəta";

    if (msg.includes("abort") || msg.includes("timeout")) {
      return NextResponse.json(
        { error: "Yükləmə vaxtı bitdi. Fayl çox böyükdür, birbaşa Cloudinary linkini istifadə edin." },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: `Yükləmə xətası: ${msg}` },
      { status: 500 }
    );
  }
}
