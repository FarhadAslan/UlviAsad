"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, UserCheck, UserX } from "lucide-react";
import { useToast } from "@/components/ui/toast-1";
import { formatDate } from "@/lib/utils";
import Pagination from "@/components/Pagination";

const ROLES = ["USER", "STUDENT", "ADMIN"];
const roleLabels: Record<string, string> = { USER: "İstifadəçi", STUDENT: "Tələbə", ADMIN: "Admin" };
const PAGE_SIZE = 10;

function isActive(val: any): boolean {
  if (val === true  || val === 1) return true;
  if (val === false || val === 0) return false;
  return true;
}

export default function AdminUsersPage() {
  const { success, error } = useToast();
  const [users,   setUsers]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [page,    setPage]    = useState(1);

  useEffect(() => { fetchUsers(); }, [search]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res  = await fetch(`/api/users?${params}`);
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch { error("Xəta baş verdi"); }
    finally   { setLoading(false); }
  };

  const updateUser = async (id: string, data: any) => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      });
      if (res.ok) {
        success("Yeniləndi");
        fetchUsers();
      } else {
        error("Xəta baş verdi");
      }
    } catch { error("Xəta baş verdi"); }
  };

  const toggleActive = (user: any) => {
    const currentlyActive = isActive(user.active);
    updateUser(user.id, { active: !currentlyActive });
  };

  const totalPages = Math.ceil(users.length / PAGE_SIZE);
  const paginated  = useMemo(() => users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [users, page]);

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 mb-8">İstifadəçilər</h1>

      <div className="card-static mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Ada və ya emailə görə axtar..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9" />
        </div>
      </div>

      <div className="card-static overflow-hidden">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 rounded-xl animate-pulse"
                style={{ background: "rgba(147,204,255,0.08)" }} />
            ))}
          </div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {["Ad","Email","Rol","Status","Qeydiyyat","Əməliyyatlar"].map((h) => (
                      <th key={h}
                        className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3 pr-4">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginated.map((user) => {
                    const active = isActive(user.active);
                  return (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                            style={{ background: "linear-gradient(135deg,#1a7fe0,rgb(147,204,255))" }}>
                            {user.name[0].toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-slate-800">{user.name}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-sm text-slate-500">{user.email}</td>
                      <td className="py-3 pr-4">
                        <select value={user.role}
                          onChange={(e) => updateUser(user.id, { role: e.target.value })}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-[rgb(147,204,255)] min-w-[100px]"
                          style={{ fontSize: "max(14px, 0.75rem)", WebkitAppearance: "none", appearance: "none", paddingRight: "1.5rem", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 0.4rem center" }}>
                          {ROLES.map((r) => (
                            <option key={r} value={r}>{roleLabels[r]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1 ${
                          active
                            ? "bg-green-50 text-green-700 border border-green-100"
                            : "bg-slate-100 text-slate-500 border border-slate-200"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-green-500" : "bg-slate-400"}`} />
                          {active ? "Aktiv" : "Deaktiv"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-sm text-slate-400">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => toggleActive(user)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            active
                              ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100"
                              : "bg-green-50 text-green-700 hover:bg-green-100 border border-green-100"
                          }`}>
                          {active
                            ? <><UserX size={12} /> Deaktiv et</>
                            : <><UserCheck size={12} /> Aktiv et</>}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="text-center py-12 text-slate-400">İstifadəçi tapılmadı</div>
            )}
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
          </>
        )}
      </div>
    </div>
  );
}
