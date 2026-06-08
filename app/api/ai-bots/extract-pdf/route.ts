import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
];

/**
 * PDF-dən mətn çıxarır.
 * pdf-parse kitabxanasını istifadə edir, test faylları olmadan.
 */
async function extractTextFromPdf(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  // pdf-parse test fayllarını yükləməsin deyə pagerender callback veririk
  // Bu Vercel serverless mühitindəki "test file not found" xətasının qarşısını alır
  const pdfParse = require("pdf-parse/lib/pdf-parse.js");

  const options = {
    // Hər səhifənin mətnini topla
    pagerender: async (pageData: any) => {
      const textContent = await pageData.getTextContent();
      return textContent.items
        .map((item: any) => item.str || "")
        .join(" ");
    },
  };

  const result = await pdfParse(buffer, options);
  return {
    text: result.text,
    pageCount: result.numpages,
  };
}

/**
 * DOCX (Word) faylından mətn çıxarır.
 * mammoth kitabxanasını istifadə edir.
 */
async function extractTextFromDocx(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const mammoth = require("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  // Word fayllarında səhifə sayını dəqiq bilmək mümkün deyil,
  // hər 3000 simvola təxminən 1 səhifə kimi hesablanır
  const estimatedPages = Math.max(1, Math.ceil(result.value.length / 3000));
  return {
    text: result.value,
    pageCount: estimatedPages,
  };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;

    if (!session || (userRole !== "ADMIN" && userRole !== "TEACHER" && userRole !== "USER" && userRole !== "STUDENT")) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Fayl tələb olunur" }, { status: 400 });
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Yalnız PDF və ya Word (.docx) fayl qəbul edilir" }, { status: 400 });
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "Fayl ölçüsü 20MB-dan çox ola bilməz" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const isDocx = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      || file.name?.toLowerCase().endsWith(".docx");

    let extracted: { text: string; pageCount: number };
    try {
      extracted = isDocx
        ? await extractTextFromDocx(buffer)
        : await extractTextFromPdf(buffer);
    } catch (parseErr: any) {
      console.error(`${isDocx ? "DOCX" : "PDF"} parse error:`, parseErr?.message ?? parseErr);
      return NextResponse.json(
        { error: `Fayl oxunarkən xəta: ${parseErr?.message ?? "bilinməyən xəta"}` },
        { status: 422 }
      );
    }

    // Mətni təmizlə
    const cleaned = extracted.text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();

    if (!cleaned || cleaned.length < 50) {
      return NextResponse.json(
        { error: isDocx
            ? "Word faylından mətn çıxarıla bilmədi. Faylın mətn ehtiva etdiyini yoxlayın."
            : "PDF-dən mətn çıxarıla bilmədi. Skan edilmiş (şəkil) PDF ola bilər."
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      text: cleaned,
      charCount: cleaned.length,
      pageCount: extracted.pageCount,
      fileType: isDocx ? "docx" : "pdf",
    });
  } catch (err: any) {
    console.error("File extract error:", err?.message ?? err);
    return NextResponse.json(
      { error: `Server xətası: ${err?.message ?? "bilinməyən xəta"}` },
      { status: 500 }
    );
  }
}
