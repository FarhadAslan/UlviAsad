import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Eye, Lock } from "lucide-react";
import { getCategoryLabel, getFileTypeIcon, formatDate } from "@/lib/utils";
import ShareButton from "@/components/ShareButton";

export const dynamic = "force-dynamic";

async function getMaterial(id: string) {
  return prisma.material.findUnique({ where: { id } });
}

export default async function MaterialDetailPage({ params }: { params: { id: string } }) {
  const session  = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;

  const material = await getMaterial(params.id);

  // Material yoxdursa 404
  if (!material) notFound();

  // Admin hər zaman görə bilər
  // Digər istifadəçilər üçün: deaktiv material 404
  if (userRole !== "ADMIN" && !material.active) notFound();

  // STUDENT_ONLY materialı giriş etməmiş USER görə bilməz
  if (
    material.visibility === "STUDENT_ONLY" &&
    (!userRole || userRole === "USER")
  ) {
    redirect("/auth/giris");
  }

  const downloadUrl = `/api/download?url=${encodeURIComponent(material.fileUrl)}&filename=${encodeURIComponent(material.title)}&type=${material.fileType}`;
  const viewUrl     = `/api/download?url=${encodeURIComponent(material.fileUrl)}&filename=${encodeURIComponent(material.title)}&type=${material.fileType}&inline=true`;

  // Video fayllar üçün birbaşa Cloudinary URL-i istifadə et (streaming üçün daha yaxşı)
  const isVideo     = material.fileType === "VIDEO";
  const finalViewUrl = isVideo ? material.fileUrl : viewUrl;

  return (
    <div className="container mx-auto py-12 max-w-3xl">
      <Link
        href="/materiallar"
        className="inline-flex items-center gap-2 text-slate-500 hover:text-[#1a7fe0] transition-colors mb-8 text-sm font-medium"
      >
        <ArrowLeft size={16} /> Materiallara qayıt
      </Link>

      <div className="card-static">
        {/* Icon + badges */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
              style={{ background: "rgba(147,204,255,0.12)", border: "1px solid rgba(147,204,255,0.25)" }}
            >
              {getFileTypeIcon(material.fileType)}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="badge-category">{getCategoryLabel(material.category)}</span>
                <span className="text-[0.65rem] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide bg-slate-100 text-slate-500 border border-slate-200">
                  {material.fileType}
                </span>
                {material.visibility === "STUDENT_ONLY" && (
                  <span className="text-[0.65rem] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide bg-amber-50 text-amber-600 border border-amber-200">
                    🔒 Tələbə
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">{formatDate(material.createdAt)}</p>
            </div>
          </div>
          {/* Paylaş */}
          <ShareButton title={material.title} variant="icon" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-slate-900 mb-8">{material.title}</h1>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <a
            href={finalViewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-[120px] btn-primary flex items-center justify-center gap-2"
          >
            <Eye size={16} /> Bax
          </a>
          <a
            href={downloadUrl}
            className="flex-1 min-w-[120px] btn-secondary flex items-center justify-center gap-2"
          >
            <Download size={16} /> Yüklə
          </a>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Link href="/materiallar" className="btn-secondary flex items-center gap-2 text-sm">
          <ArrowLeft size={15} /> Bütün materiallar
        </Link>
        <ShareButton title={material.title} variant="default" />
      </div>
    </div>
  );
}
