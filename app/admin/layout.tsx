import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== "ADMIN") {
    redirect("/auth/giris");
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      {/* Mobile-da sol padding əlavə et ki hamburger düyməsi üstünə gəlməsin */}
      <main className="flex-1 overflow-auto p-4 pt-16 md:pt-6 md:p-8 lg:p-10 min-w-0">
        {children}
      </main>
    </div>
  );
}
