import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// pdf-parse üçün tip bəyannaməsi
declare module "pdf-parse" {
  function pdfParse(buffer: Buffer): Promise<{ text: string; numpages: number }>;
  export = pdfParse;
}

// pdf-parse ESM/CJS uyğunsuzluğu üçün dynamic import
async function parsePdf(buffer: Buffer): Promise<{ text: string; numpages: number }> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string; numpages: number }>;
  return pdfParse(buffer);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;

    if (!session || (userRole !== "ADMIN" && userRole !== "TEACHER")) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "PDF fayl tələb olunur" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Yalnız PDF fayl qəbul edilir" }, { status: 400 });
    }

    // Maksimum 20MB
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "Fayl ölçüsü 20MB-dan çox ola bilməz" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let text: string;
    let pageCount = 1;
    try {
      const result = await parsePdf(buffer);
      text = result.text;
      pageCount = result.numpages ?? 1;
    } catch (parseErr: any) {
      console.error("PDF parse error:", parseErr?.message);
      return NextResponse.json(
        { error: "PDF oxunarkən xəta baş verdi. Fayl zədəli və ya şifrəli ola bilər." },
        { status: 422 }
      );
    }

    // Mətni təmizlə: çoxlu boş sətirləri tək sətirə endir
    const cleaned = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();

    if (!cleaned || cleaned.length < 50) {
      return NextResponse.json(
        { error: "PDF-dən mətn çıxarıla bilmədi. Skan edilmiş (şəkil) PDF ola bilər." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      text: cleaned,
      charCount: cleaned.length,
      pageCount,
    });
  } catch (err: any) {
    console.error("PDF extract error:", err?.message ?? err);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
