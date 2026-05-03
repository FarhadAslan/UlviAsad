import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Kateqoriyanı sil — yalnız ADMIN
// Silinmədən əvvəl həmin kateqoriyada quiz/material sayını qaytarır
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const category = await prisma.category.findUnique({ where: { id: params.id } });
    if (!category) {
      return NextResponse.json({ error: "Kateqoriya tapılmadı" }, { status: 404 });
    }

    // Həmin kateqoriyada neçə quiz/material var?
    const [quizCount, materialCount] = await Promise.all([
      prisma.quiz.count({ where: { category: category.value } }),
      prisma.material.count({ where: { category: category.value } }),
    ]);

    // force=true parametri ilə məcburi silinir
    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";

    if (!force && (quizCount > 0 || materialCount > 0)) {
      // Xəbərdarlıq qaytar — frontend modal göstərəcək
      return NextResponse.json(
        {
          warning: true,
          quizCount,
          materialCount,
          categoryLabel: category.label,
          message: `Bu kateqoriyada ${quizCount} quiz və ${materialCount} material var. Silmək istədiyinizə əminsiniz?`,
        },
        { status: 409 }
      );
    }

    await prisma.category.delete({ where: { id: params.id } });
    return NextResponse.json({ message: "Kateqoriya silindi" });
  } catch (error) {
    console.error("Category DELETE error:", error);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}

// Kateqoriyanı yenilə (label dəyiş) — yalnız ADMIN
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const { label } = await req.json();
    if (!label?.trim()) {
      return NextResponse.json({ error: "Ad tələb olunur" }, { status: 400 });
    }

    const category = await prisma.category.update({
      where: { id: params.id },
      data:  { label: label.trim() },
    });

    return NextResponse.json(category);
  } catch {
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
