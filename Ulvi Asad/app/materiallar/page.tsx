import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import MaterialCard from "@/components/MaterialCard";
import MaterialFilters from "@/components/MaterialFilters";

async function getMaterials(category: string, search: string, userRole?: string) {
  const isAdmin   = userRole === "ADMIN";
  const isStudent = userRole === "STUDENT";

  const where: any = { active: true };
  if (!isAdmin && !isStudent) where.visibility = "PUBLIC";
  if (category && category !== "ALL") where.category = category;
  if (search) where.title = { contains: search };

  return prisma.material.findMany({
    where,
    select: {
      id: true, title: true, category: true,
      fileUrl: true, fileType: true, visibility: true, active: true, createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: { category?: string; search?: string };
}) {
  const session  = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;

  const category = searchParams.category || "ALL";
  const search   = searchParams.search   || "";

  const materials = await getMaterials(category, search, userRole);

  return (
    <div className="container mx-auto py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Materiallar</h1>
        <p className="text-slate-500">PDF, DOC və video formatında tədris materialları</p>
      </div>

      <MaterialFilters category={category} search={search} />

      {materials.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {materials.map((m) => (
            <MaterialCard key={m.id} material={m} userRole={userRole} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📁</div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Material tapılmadı</h3>
          <p className="text-slate-500">Axtarış kriteriyalarınıza uyğun material yoxdur</p>
        </div>
      )}
    </div>
  );
}
