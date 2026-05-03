import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Users, BookOpen, FileText, GraduationCap } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function getAdminData() {
  const [totalUsers, totalStudents, totalQuizzes, totalMaterials, recentUsers] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.quiz.count(),
      prisma.material.count(),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" }, take: 10,
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      }),
    ]);
  return { totalUsers, totalStudents, totalQuizzes, totalMaterials, recentUsers };
}

async function getTeacherData(teacherId: string) {
  const [myStudents, myQuizzes, recentStudents] = await Promise.all([
    prisma.user.count({ where: { teacherId, role: "STUDENT" } }),
    prisma.quiz.count({ where: { createdById: teacherId } }),
    prisma.user.findMany({
      where: { teacherId, role: "STUDENT" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
  ]);
  return { myStudents, myQuizzes, recentStudents };
}

const roleBadgeStyle: Record<string, React.CSSProperties> = {
  ADMIN:   { background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca" },
  TEACHER: { background: "rgba(124,58,237,0.1)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.25)" },
  STUDENT: { background: "rgba(147,204,255,0.15)", color: "#1a7fe0", border: "1px solid rgba(147,204,255,0.35)" },
  USER:    { background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" },
};
const roleLabel: Record<string, string> = {
  ADMIN: "Admin", TEACHER: "Müəllim", STUDENT: "Tələbə", USER: "İstifadəçi",
};

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;

  if (role === "TEACHER") {
    const data = await getTeacherData(userId);

    return (
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Dashboard</h1>
        <p className="text-slate-500 mb-8 text-sm">Xoş gəldiniz, müəllim paneli</p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="card-static">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
              style={{ background: "rgba(147,204,255,0.12)" }}>
              <GraduationCap size={22} style={{ color: "#1a7fe0" }} />
            </div>
            <p className="text-3xl font-bold mb-1" style={{ color: "#1a7fe0" }}>
              {data.myStudents}
            </p>
            <p className="text-sm text-slate-500">Tələbələrim</p>
          </div>
          <div className="card-static">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
              style={{ background: "rgba(124,58,237,0.1)" }}>
              <BookOpen size={22} style={{ color: "#7c3aed" }} />
            </div>
            <p className="text-3xl font-bold mb-1" style={{ color: "#7c3aed" }}>
              {data.myQuizzes}
            </p>
            <p className="text-sm text-slate-500">Quizlərim</p>
          </div>
        </div>

        <div className="card-static overflow-hidden">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Son Tələbələr</h2>
          {data.recentStudents.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <div className="text-4xl mb-3">👨‍🎓</div>
              Hələ tələbəniz yoxdur
            </div>
          ) : (
            <div className="table-scroll">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {["Ad", "Email", "Tarix"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.recentStudents.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 pr-4 font-medium text-sm text-slate-800">{u.name}</td>
                      <td className="py-3 pr-4 text-sm text-slate-500">{u.email}</td>
                      <td className="py-3 text-sm text-slate-400">{formatDateTime(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ADMIN dashboard
  const data = await getAdminData();

  const statCards = [
    { key: "totalUsers",    label: "Cəmi İstifadəçi", icon: Users,         color: "#1a7fe0", bg: "rgba(147,204,255,0.12)" },
    { key: "totalStudents", label: "Tələbə",           icon: GraduationCap, color: "#1f6f43", bg: "rgba(31,111,67,0.1)" },
    { key: "totalQuizzes",  label: "Quiz",             icon: BookOpen,      color: "#7c3aed", bg: "rgba(124,58,237,0.1)" },
    { key: "totalMaterials",label: "Material",         icon: FileText,      color: "#ea580c", bg: "rgba(234,88,12,0.1)" },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((s) => (
          <div key={s.key} className="card-static">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
              style={{ background: s.bg }}>
              <s.icon size={22} style={{ color: s.color }} />
            </div>
            <p className="text-3xl font-bold mb-1" style={{ color: s.color }}>
              {(data as any)[s.key]}
            </p>
            <p className="text-sm text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="card-static overflow-hidden">
        <h2 className="text-xl font-bold text-slate-900 mb-6">Son Qeydiyyatlar</h2>
        <div className="table-scroll">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {["Ad", "Email", "Rol", "Tarix"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.recentUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 pr-4 font-medium text-sm text-slate-800">{u.name}</td>
                  <td className="py-3 pr-4 text-sm text-slate-500">{u.email}</td>
                  <td className="py-3 pr-4">
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={roleBadgeStyle[u.role] || roleBadgeStyle.USER}>
                      {roleLabel[u.role] || u.role}
                    </span>
                  </td>
                  <td className="py-3 text-sm text-slate-400">{formatDateTime(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
