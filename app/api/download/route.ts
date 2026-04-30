import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cloudinary URL-dən public_id çıxar
function extractPublicId(url: string): { publicId: string; format: string } | null {
  try {
    // Format: https://res.cloudinary.com/{cloud}/raw/upload/v{ver}/{folder}/{name}.{ext}
    // və ya:  https://res.cloudinary.com/{cloud}/raw/upload/v{ver}/{folder}/{name}
    const match = url.match(/\/raw\/upload\/(?:v\d+\/)?(.+?)(?:\.([a-zA-Z0-9]+))?$/);
    if (!match) return null;
    const publicId = match[1];
    const format   = match[2] || "";
    return { publicId, format };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url      = searchParams.get("url");
  const filename = searchParams.get("filename") || "fayl";

  if (!url) {
    return NextResponse.json({ error: "URL tələb olunur" }, { status: 400 });
  }

  if (!url.startsWith("https://res.cloudinary.com/")) {
    return NextResponse.json({ error: "İcazəsiz URL" }, { status: 403 });
  }

  try {
    // Əvvəlcə birbaşa URL-i sına
    const directRes = await fetch(url);

    if (directRes.ok) {
      // Birbaşa işləyir — proxy kimi serve et
      const buffer      = await directRes.arrayBuffer();
      const contentType = directRes.headers.get("content-type") || "application/octet-stream";
      const ext         = getExtFromUrl(url, contentType);
      const safeFilename = encodeURIComponent(
        filename.endsWith(ext) ? filename : filename + ext
      );

      return new NextResponse(buffer, {
        headers: {
          "Content-Type":        contentType,
          "Content-Disposition": `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`,
          "Content-Length":      buffer.byteLength.toString(),
          "Cache-Control":       "public, max-age=3600",
        },
      });
    }

    // 401 aldıqda — Cloudinary signed URL istifadə et
    if (directRes.status === 401) {
      const parsed = extractPublicId(url);
      if (!parsed) {
        return NextResponse.json({ error: "URL formatı tanınmadı" }, { status: 400 });
      }

      // Signed download URL yarat (1 saat etibarlı)
      const signedUrl = cloudinary.utils.private_download_url(
        parsed.publicId,
        parsed.format || "pdf",
        {
          resource_type: "raw",
          expires_at:    Math.floor(Date.now() / 1000) + 3600,
          attachment:    true,
        }
      );

      const signedRes = await fetch(signedUrl);
      if (!signedRes.ok) {
        return NextResponse.json({ error: "Fayl tapılmadı" }, { status: 404 });
      }

      const buffer      = await signedRes.arrayBuffer();
      const contentType = signedRes.headers.get("content-type") || "application/octet-stream";
      const ext         = parsed.format ? `.${parsed.format}` : getExtFromUrl(url, contentType);
      const safeFilename = encodeURIComponent(
        filename.endsWith(ext) ? filename : filename + ext
      );

      return new NextResponse(buffer, {
        headers: {
          "Content-Type":        contentType,
          "Content-Disposition": `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`,
          "Content-Length":      buffer.byteLength.toString(),
          "Cache-Control":       "public, max-age=3600",
        },
      });
    }

    return NextResponse.json({ error: "Fayl tapılmadı" }, { status: 404 });

  } catch (error) {
    console.error("Download proxy error:", error);
    return NextResponse.json({ error: "Yükləmə xətası" }, { status: 500 });
  }
}

function getExtFromUrl(url: string, contentType: string): string {
  // URL-dən uzantı götür
  const urlExt = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)?.[1];
  if (urlExt && urlExt.length <= 5) return `.${urlExt}`;

  // Content-Type-dan
  const map: Record<string, string> = {
    "application/pdf":       ".pdf",
    "application/msword":    ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-powerpoint": ".ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "text/plain":            ".txt",
    "video/mp4":             ".mp4",
    "image/jpeg":            ".jpg",
    "image/png":             ".png",
    "image/gif":             ".gif",
    "image/webp":            ".webp",
    "application/octet-stream": "",
  };
  return map[contentType.split(";")[0].trim()] || "";
}
