import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (e) {
      console.error("FormData parse error:", e);
      return NextResponse.json({ error: "Fayl oxunarkən xəta baş verdi" }, { status: 400 });
    }

    const file = formData.get("file") as File | null;

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Fayl tapılmadı" }, { status: 400 });
    }

    // Max 50MB
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "Fayl ölçüsü 50MB-dan çox ola bilməz" }, { status: 400 });
    }

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "video/mp4",
      "video/webm",
      "video/ogg",
      "image/jpeg",
      "image/png",
      "image/gif",
    ];

    // Bəzi brauzerlər fərqli MIME type göndərə bilər — extension-a görə də yoxla
    const ext = path.extname(file.name).toLowerCase();
    const extAllowed = [".pdf",".doc",".docx",".ppt",".pptx",".mp4",".webm",".ogg",".jpg",".jpeg",".png",".gif"];

    if (!allowedTypes.includes(file.type) && !extAllowed.includes(ext)) {
      return NextResponse.json(
        { error: `Bu fayl tipi dəstəklənmir (${file.type || ext}). PDF, DOC, DOCX, PPT, PPTX, MP4 yükləyə bilərsiniz.` },
        { status: 400 }
      );
    }

    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const baseName = path.basename(file.name, ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .substring(0, 40);
    const fileName = `${baseName}_${Date.now()}${ext}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, fileName), buffer);

    const typeMap: Record<string, string> = {
      ".pdf":  "PDF",
      ".doc":  "DOC",
      ".docx": "DOCX",
      ".ppt":  "PPT",
      ".pptx": "PPTX",
      ".mp4":  "VIDEO",
      ".webm": "VIDEO",
      ".ogg":  "VIDEO",
      ".jpg":  "IMAGE",
      ".jpeg": "IMAGE",
      ".png":  "IMAGE",
      ".gif":  "IMAGE",
    };

    return NextResponse.json({
      url:      `/uploads/${fileName}`,
      fileType: typeMap[ext] || "FILE",
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
