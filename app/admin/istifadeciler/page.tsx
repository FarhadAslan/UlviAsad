"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, UserCheck, UserX, ArrowLeft, Eye, Loader2, Share2, Check } from "lucide-react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast-1";
import { formatDate, getCategoryLabel, getTypeLabel } from "@/lib/utils";
import Pagination from "@/components/Pagination";
import ResultDetailModal from "@/components/ResultDetailModal";

const ADMIN_ROLES = ["USER", "STUDENT", "TEACHER", "ADMIN"];
const roleLabels: Record<string, string> = {
  USER: "İstifadəçi",
  STUDENT: "Tələbə",
  TEACHER: "Müəllim",
  ADMIN: "Admin",
};
const PAGE_SIZE = 10;

function isActive(val: any): boolean {
  if (val === true  || val === 1) return true;
  if (val === false || val === 0) return false;
  return true;
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const currentRole = (session?.user as any)?.role;
  const isTeacher   = currentRole === "TEACHER";

  const { success, error } = useToast();

  // ── Bütün state-lər hook qaydalarına uyğun olaraq şərtsiz çağırılır ──
  const [users,            setUsers]            = useState<any[]>([]);
  const [teachers,         setTeachers]         = useState<any[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [search,           setSearch]           = useState("");
  const [page,             setPage]             = useState(1);
  const [selectedUser,     setSelectedUser]     = useState<any>(null);
  const [userResults,      setUserResults]      = useState<any[]>([]);
  const [resultsLoading,   setResultsLoading]   = useState(false);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [copiedId,         setCopiedId]         = useState<string | null>(null);
  const [resultsPage,      setResultsPage]      = useState(1);

  const RESULTS_PAGE_SIZE = 8;
  const totalResultPages  = Math.ceil(userResults.length / RESULTS_PAGE_SIZE);
  const paginatedResults  = useMemo(
    () => userResults.slice((resultsPage - 1) * RESULTS_PAGE_SIZE, resultsPage * RESULTS_PAGE_SIZE),
    [userResults, resultsPage]
  );

  const totalPages = Math.ceil(users.length / PAGE_SIZE);
  const paginated  = useMemo(
    () => users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [users, page]
  );

  useEffect(() => {
    if (status === "loading" || !currentRole) return;
    fetchUsers();
  }, [search, status, currentRole]);

  useEffect(() => {
    if (status === "loading" || !currentRole || isTeacher) return;
    fetch("/api/users/teachers")
      .then((r) => r.json())
      .then((d) => setTeachers(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [isTeacher, status, currentRole]);

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

  const openUserDetail = async (user: any) => {
    setSelectedUser(user);
    setResultsLoading(true);
    setUserResults([]);
    setResultsPage(1);
    try {
      const res  = await fetch(`/api/results?userId=${user.id}`);
      const data = await res.json();
      setUserResults(Array.isArray(data) ? data : []);
    } catch { error("Nəticələr yüklənmədi"); }
    finally   { setResultsLoading(false); }
  };

  const copyResultLink = async (e: React.MouseEvent, resultId: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}/neticeler/${resultId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(resultId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      prompt("Linki kopyalayın:", url);
    }
  };

  const updateUser = async (id: string, data: any) => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      });
      if (res.ok) { success("Yeniləndi"); fetchUsers(); }
      else error("Xəta baş verdi");
    } catch { error("Xəta baş verdi"); }
  };

  const toggleActive = (user: any) => {
    updateUser(user.id, { active: !isActive(user.active) });
  };

  // ── Session yüklənir — skeleton ──────────────────────────
  if (status === "loading" || !currentRole) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 rounded-xl animate-pulse" style={{ background: "rgba(147,204,255,0.1)" }} />
        <div className="card-static space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "rgba(147,204,255,0.08)" }} />
          ))}
        </div>
      </div>
    );
  }

  // ── İstifadəçi detay görünüşü ────────────────────────────
  if (selectedUser) {
    return (
      <div>
        <button
          onClick={() => { setSelectedUser(null); setUserResults([]); }}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-6 text-sm font-medium"
        >
          <ArrowLeft size={16} /> {isTeacher ? "Tələbələrə qayıt" : "İstifadəçilərə qayıt"}
        </button>

        <div className="card-static mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#1a7fe0,rgb(147,204,255))" }}>
              {selectedUser.name[0].toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{selectedUser.name}</h2>
              <p className="text-sm text-slate-500">{selectedUser.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">
                  {roleLabels[selectedUser.role] ?? selectedUser.role}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  isActive(selectedUser.active) ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"
                }`}>
                  {isActive(selectedUser.active) ? "Aktiv" : "Deaktiv"}
                </span>
                <span className="text-xs text-slate-400">
                  Qeydiyyat: {formatDate(selectedUser.createdAt)}
                </span>
              </div>
              {selectedUser.teacher && (
                <p className="text-xs text-slate-400 mt-1">
                  Müəllim: <span className="font-medium text-slate-600">{selectedUser.teacher.name}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="card-static">
          <h3 className="text-lg font-bold text-slate-900 mb-5">
            Quiz Tarixçəsi
            {!resultsLoading && (
              <span className="ml-2 text-sm font-normal text-slate-400">({userResults.length} nəticə)</span>
            )}
          </h3>

          {resultsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={28} className="text-[#1a7fe0] animate-spin" />
            </div>
          ) : userResults.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <div className="text-4xl mb-3">📊</div>
              Bu istifadəçi hələ heç bir quiz işləməyib
            </div>
          ) : (
            <>
              <div className="table-scroll">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {["Quiz Adı", "Kateqoriya", "Tip", "Nəticə", "Xal", "Tarix", "Əməliyyatlar"].map((h) => (
                        <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3 pr-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginatedResults.map((r: any) => (
                      <tr key={r.id}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => setSelectedResultId(r.id)}>
                        <td className="py-3 pr-4 font-medium text-sm text-slate-800 max-w-[180px] truncate">
                          {r.quiz?.title ?? "—"}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="badge-category">{getCategoryLabel(r.quiz?.category ?? "")}</span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className={r.quiz?.type === "SINAQ" ? "badge-type-sinaq" : "badge-type-test"}>
                            {getTypeLabel(r.quiz?.type ?? "TEST")}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-sm">
                          <span className="font-bold text-green-600">{r.correct}</span>
                          <span className="text-slate-400 mx-1">/</span>
                          <span className="text-red-500">{r.wrong}</span>
                          <span className="text-slate-400 mx-1">/</span>
                          <span className="text-slate-400">{r.skipped}</span>
                          <span className="text-xs text-slate-400 ml-1">(d/s/k)</span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="font-bold text-[#1a7fe0]">{r.score} xal</span>
                        </td>
                        <td className="py-3 pr-4 text-sm text-slate-400">{formatDate(r.createdAt)}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedResultId(r.id); }}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#1a7fe0] hover:bg-blue-50 border border-[rgba(147,204,255,0.4)] transition-all"
                              title="Detaylı bax">
                              <Eye size={13} /> Detay
                            </button>
                            <button
                              onClick={(e) => copyResultLink(e, r.id)}
                              className="p-1.5 rounded-lg text-[#1a7fe0] hover:bg-blue-50 transition-all"
                              title="Nəticə linkini kopyala">
                              {copiedId === r.id
                                ? <Check size={13} className="text-green-500" />
                                : <Share2 size={13} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={resultsPage}
                totalPages={totalResultPages}
                onPageChange={(p) => setResultsPage(p)}
              />
            </>
          )}
        </div>

        {selectedResultId && (
          <ResultDetailModal
            resultId={selectedResultId}
            userName={selectedUser.name}
            onClose={() => setSelectedResultId(null)}
          />
        )}
      </div>
    );
  }

  // ── İstifadəçilər / Tələbələr siyahısı ──────────────────
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 mb-8">
        {isTeacher ? "Tələbələrim" : "İstifadəçilər"}
      </h1>

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
                    {[
                      "Ad", "Email", "Rol",
                      ...(isTeacher ? [] : ["Müəllim"]),
                      "Status", "Qeydiyyat", "Əməliyyatlar",
                    ].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginated.map((user) => {
                    const active = isActive(user.active);
                    return (
                      <tr key={user.id}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => openUserDetail(user)}>
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

                        <td className="py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                          {isTeacher ? (
                            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-600">
                              {roleLabels[user.role] ?? user.role}
                            </span>
                          ) : (
                            <select value={user.role}
                              onChange={(e) => updateUser(user.id, { role: e.target.value })}
                              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-[rgb(147,204,255)] min-w-[110px]"
                              style={{ fontSize: "max(14px, 0.75rem)", WebkitAppearance: "none", appearance: "none", paddingRight: "1.5rem", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 0.4rem center" }}>
                              {ADMIN_ROLES.map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}
                            </select>
                          )}
                        </td>

                        {!isTeacher && (
                          <td className="py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                            {user.role === "STUDENT" ? (
                              <select
                                value={user.teacherId ?? ""}
                                onChange={(e) => updateUser(user.id, { teacherId: e.target.value || null })}
                                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-[rgb(147,204,255)] min-w-[130px]"
                                style={{ fontSize: "max(14px, 0.75rem)", WebkitAppearance: "none", appearance: "none", paddingRight: "1.5rem", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 0.4rem center" }}>
                                <option value="">— Müəllim yoxdur —</option>
                                {teachers.map((t: any) => (
                                  <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        )}

                        <td className="py-3 pr-4">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1 ${
                            active ? "bg-green-50 text-green-700 border border-green-100" : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-green-500" : "bg-slate-400"}`} />
                            {active ? "Aktiv" : "Deaktiv"}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-sm text-slate-400">{formatDate(user.createdAt)}</td>
                        <td className="py-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => toggleActive(user)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              active
                                ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100"
                                : "bg-green-50 text-green-700 hover:bg-green-100 border border-green-100"
                            }`}>
                            {active ? <><UserX size={12} /> Deaktiv et</> : <><UserCheck size={12} /> Aktiv et</>}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {users.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  {isTeacher ? "Hələ tələbəniz yoxdur" : "İstifadəçi tapılmadı"}
                </div>
              )}
            </div>
            <Pagination page={page} totalPages={totalPages}
              onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
          </>
        )}
      </div>
    </div>
  );
}
