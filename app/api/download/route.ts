import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function extractPublicId(url: string): { publicId: string; format: string } | null {
  try {
    const match = url.match(/\/raw\/upload\/(?:v\d+\/)?(.+?)(?:\.([a-zA-Z0-9]+))?$/);
    if (!match) return null;
    return { publicId: match[1], format: match[2] || "" };
  } catch {
    return null;
  }
}

function getExtFromUrl(url: string, contentType: string): string {
  const urlExt = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)?.[1];
  if (urlExt && urlExt.length <= 5) return `.${urlExt}`;
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

async function fetchFromCloudinary(url: string): Promise<Response | null> {
  // Əvvəlcə birbaşa sına
  const direct = await fetch(url);
  if (direct.ok) return direct;

  // 401 — signed URL ilə cəhd et
  if (direct.status === 401) {
    const parsed = extractPublicId(url);
    if (!parsed) return null;

    const signedUrl = cloudinary.utils.private_download_url(
      parsed.publicId,
      parsed.format || "pdf",
      {
        resource_type: "raw",
        expires_at:    Math.floor(Date.now() / 1000) + 3600,
        attachment:    false, // inline üçün false
      }
    );

    const signed = await fetch(signedUrl);
    if (signed.ok) return signed;
  }

  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url      = searchParams.get("url");
  const filename = searchParams.get("filename") || "fayl";
  // inline=true → brauzerdə göstər, inline=false/yoxdur → yüklə
  const inline   = searchParams.get("inline") === "true";

  if (!url) {
    return NextResponse.json({ error: "URL tələb olunur" }, { status: 400 });
  }

  if (!url.startsWith("https://res.cloudinary.com/")) {
    return NextResponse.json({ error: "İcazəsiz URL" }, { status: 403 });
  }

  try {
    const res = await fetchFromCloudinary(url);

    if (!res) {
      return NextResponse.json({ error: "Fayl tapılmadı" }, { status: 404 });
    }

    const buffer      = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const ext         = getExtFromUrl(url, contentType);
    const safeFilename = encodeURIComponent(
      filename.endsWith(ext) ? filename : filename + ext
    );

    const disposition = inline
      ? `inline; filename="${safeFilename}"`
      : `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":        contentType,
        "Content-Disposition": disposition,
        "Content-Length":      buffer.byteLength.toString(),
        "Cache-Control":       "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Download proxy error:", error);
    return NextResponse.json({ error: "Yükləmə xətası" }, { status: 500 });
  }
}
