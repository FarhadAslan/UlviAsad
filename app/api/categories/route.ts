import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Bütün kateqoriyaları qaytarır (hamı üçün açıqdır — form-larda lazımdır)
export async function GET() {
  try {
    let categories = await prisma.category.findMany({
      orderBy: { order: "asc" },
    });

    // Cədvəl boşdursa default kateqoriyaları seed et
    if (categories.length === 0) {
      const defaults = [
        { id: "cat_qanunvericilik", value: "QANUNVERICILIK", label: "Qanunvericilik", order: 1 },
        { id: "cat_mantiq",         value: "MANTIQ",         label: "Məntiq",         order: 2 },
        { id: "cat_azerbaycan",     value: "AZERBAYCAN_DILI",label: "Azərbaycan Dili",order: 3 },
        { id: "cat_informatika",    value: "INFORMATIKA",    label: "İnformatika",    order: 4 },
        { id: "cat_dq_qebul",       value: "DQ_QEBUL",       label: "DQ Qəbul",       order: 5 },
      ];
      await prisma.category.createMany({ data: defaults, skipDuplicates: true });
      categories = await prisma.category.findMany({ orderBy: { order: "asc" } });
    }

    return NextResponse.json(categories);
  } catch {
    // DB-də cədvəl hələ yoxdursa default qaytarır
    return NextResponse.json([
      { id: "cat_qanunvericilik", value: "QANUNVERICILIK", label: "Qanunvericilik", order: 1 },
      { id: "cat_mantiq",         value: "MANTIQ",         label: "Məntiq",         order: 2 },
      { id: "cat_azerbaycan",     value: "AZERBAYCAN_DILI",label: "Azərbaycan Dili",order: 3 },
      { id: "cat_informatika",    value: "INFORMATIKA",    label: "İnformatika",    order: 4 },
      { id: "cat_dq_qebul",       value: "DQ_QEBUL",       label: "DQ Qəbul",       order: 5 },
    ]);
  }
}

// Yeni kateqoriya yarat — yalnız ADMIN
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const { label } = await req.json();
    if (!label?.trim()) {
      return NextResponse.json({ error: "Ad tələb olunur" }, { status: 400 });
    }

    // value: label-dən avtomatik yarat (böyük hərf, boşluq → _)
    const value = label.trim()
      .toUpperCase()
      .replace(/\s+/g, "_")
      .replace(/[^A-Z0-9_ÇƏĞIİÖŞÜ]/g, "")
      .replace(/\s/g, "_");

    if (!value) {
      return NextResponse.json({ error: "Yanlış kateqoriya adı" }, { status: 400 });
    }

    // Mövcudluğu yoxla
    const existing = await prisma.category.findUnique({ where: { value } });
    if (existing) {
      return NextResponse.json({ error: "Bu kateqoriya artıq mövcuddur" }, { status: 400 });
    }

    // Ən böyük order tap
    const last = await prisma.category.findFirst({ orderBy: { order: "desc" } });
    const order = (last?.order ?? 0) + 1;

    const category = await prisma.category.create({
      data: { value, label: label.trim(), order },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Category POST error:", error);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
