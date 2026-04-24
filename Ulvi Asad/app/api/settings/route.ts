import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const DEFAULT_SETTINGS = {
  id:             "main",
  heroTitle:      "Biliklərinizi Test Edin",
  heroBadge:      "Ulvi Asad — İnteraktiv Təhsil Platforması",
  heroSubtitle:   "Qanunvericilik, məntiq, Azərbaycan dili, informatika və DQ Qəbul sahələrində quiz və testlərlə özünüzü sınayın. Materiallar yükləyin, məqalələr oxuyun.",
  contactEmail:   "info@muellim.az",
  contactPhone:   "+994 50 000 00 00",
  contactAddress: "Bakı, Azərbaycan",
  facebook:       "",
  instagram:      "",
  youtube:        "",
};

export async function GET() {
  try {
    let s = await prisma.siteSettings.findUnique({ where: { id: "main" } });
    if (!s) s = await prisma.siteSettings.create({ data: DEFAULT_SETTINGS });
    return NextResponse.json(s);
  } catch {
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const body = await req.json();
    const {
      heroTitle, heroBadge, heroSubtitle,
      contactEmail, contactPhone, contactAddress,
      facebook, instagram, youtube,
    } = body;

    const s = await prisma.siteSettings.upsert({
      where:  { id: "main" },
      update: { heroTitle, heroBadge, heroSubtitle, contactEmail, contactPhone, contactAddress, facebook, instagram, youtube },
      create: { id: "main", heroTitle, heroBadge, heroSubtitle, contactEmail, contactPhone, contactAddress, facebook, instagram, youtube },
    });

    return NextResponse.json(s);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
