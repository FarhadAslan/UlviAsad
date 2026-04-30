import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url      = searchParams.get("url");
  const filename = searchParams.get("filename") || "fayl";

  if (!url) {
    return NextResponse.json({ error: "URL tələb olunur" }, { status: 400 });
  }

  // Yalnız Cloudinary URL-lərinə icazə ver
  if (!url.startsWith("https://res.cloudinary.com/")) {
    return NextResponse.json({ error: "İcazəsiz URL" }, { status: 403 });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json({ error: "Fayl tapılmadı" }, { status: 404 });
    }

    const buffer      = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "application/octet-stream";

    // Fayl adından uzantını çıxar
    const ext = getExtFromContentType(contentType, filename);
    const safeFilename = encodeURIComponent(
      filename.endsWith(ext) ? filename : filename + ext
    );

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":        contentType,
        "Content-Disposition": `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`,
        "Content-Length":      buffer.byteLength.toString(),
        "Cache-Control":       "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error("Download proxy error:", error);
    return NextResponse.json({ error: "Yükləmə xətası" }, { status: 500 });
  }
}

function getExtFromContentType(contentType: string, filename: string): string {
  // Əvvəlcə fayl adından uzantı götür
  const match = filename.match(/\.[a-zA-Z0-9]+$/);
  if (match) return "";

  // Content-Type-dan uzantı müəyyən et
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
  };
  return map[contentType.split(";")[0].trim()] || "";
}
