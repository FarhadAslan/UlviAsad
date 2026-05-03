"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Edit, Share2, Check, Search, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast-1";
import { getCategoryLabel, getTypeLabel } from "@/lib/utils";
import QuizForm from "@/components/admin/QuizForm";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 10;

export default function AdminQuizzesPage() {
  const { data: session, status } = useSession();
  const currentRole = (session?.user as any)?.role;
  const isTeacher   = currentRole === "TEACHER";

  const { success, error } = useToast();
  const [quizzes,        setQuizzes]        = useState<any[]>([]);
  const [teachers,       setTeachers]       = useState<any[]>([]);
  const [categories,     setCategories]     = useState<any[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [showForm,       setShowForm]       = useState(false);
  const [editingQuiz,    setEditingQuiz]    = useState<any>(null);
  const [editLoading,    setEditLoading]    = useState<string | null>(null);
  const [page,           setPage]           = useState(1);
  const [copiedId,       setCopiedId]       = useState<string | null>(null);
  const [deletingId,     setDeletingId]     = useState<string | null>(null);
  const [togglingId,     setTogglingId]     = useState<string | null>(null);
  const [search,         setSearch]         = useState("");
  const [filterTeacher,  setFilterTeacher]  = useState("ALL");
  const [filterType,     setFilterType]     = useState("ALL");
  const [filterCategory, setFilterCategory] = useState("ALL");

  useEffect(() => {
    if (status === "loading" || !currentRole) return;
    fetchQuizzes();
    if (!isTeacher) {
      fetch("/api/users/teachers").then((r) => r.json()).then((d) => setTeachers(Array.isArray(d) ? d : [])).catch(() => {});
      fetch("/api/categories").then((r) => r.json()).then((d) => setCategories(Array.isArray(d) ? d : [])).catch(() => {});
    }
  }, [status, currentRole]);

  // Session yüklənir — skeleton
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

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/quizzes?adminAll=true", { cache: "no-store" });
      const data = await res.json();
      setQuizzes(Array.isArray(data) ? data : []);
    } catch { error("Xəta baş verdi"); }
    finally { setLoading(false); }
  };

  // Client-side filter (admin üçün)
  const filtered = useMemo(() => {
    if (isTeacher) return quizzes;
    return quizzes.filter((q) => {
      if (search && !q.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterTeacher !== "ALL") {
        if (filterTeacher === "ADMIN") { if (q.createdById !== null && q.createdById !== undefined) return false; }
        else { if (q.createdById !== filterTeacher) return false; }
      }
      if (filterType !== "ALL" && q.type !== filterType) return false;
      if (filterCategory !== "ALL" && q.category !== filterCategory) return false;
      return true;
    });
  }, [quizzes, search, filterTeacher, filterType, filterCategory, isTeacher]);

  const hasFilters = search || filterTeacher !== "ALL" || filterType !== "ALL" || filterCategory !== "ALL";

  const clearFilters = () => {
    setSearch(""); setFilterTeacher("ALL"); setFilterType("ALL"); setFilterCategory("ALL"); setPage(1);
  };

  const toggleActive = async (quiz: any) => {
    setTogglingId(quiz.id);
    try {
      const res  = await fetch(`/api/quizzes/${quiz.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !quiz.active }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        success(quiz.active ? "Quiz deaktiv edildi" : "Quiz aktiv edildi");
        setQuizzes((prev) => prev.map((q) => q.id === quiz.id ? { ...q, active: !quiz.active } : q));
      } else { error(data?.error || "Status dəyişdirilmədi"); }
    } catch { error("Şəbəkə xətası baş verdi"); }
    finally { setTogglingId(null); }
  };

  const copyLink = async (quizId: string) => {
    const url = `${window.location.origin}/quizler/${quizId}`;
    try {
      await navigator.clipboard.writeText(url);
      success("Link kopyalandı!"); setCopiedId(quizId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { prompt("Linki kopyalayın:", url); }
  };

  const handleEdit = async (quiz: any) => {
    setEditLoading(quiz.id);
    try {
      const res = await fetch(`/api/quizzes/${quiz.id}`);
      if (!res.ok) { error("Quiz məlumatları yüklənmədi"); return; }
      setEditingQuiz(await res.json());
    } catch { error("Xəta baş verdi"); }
    finally { setEditLoading(null); }
  };

  const deleteQuiz = async (id: string) => {
    if (!confirm("Bu quizi silmək istədiyinizə əminsiniz?")) return;
    setDeletingId(id);
    try {
      const res  = await fetch(`/api/quizzes/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        success("Quiz silindi");
        setQuizzes((prev) => prev.filter((q) => q.id !== id));
      } else { error(data?.error || "Quiz silinərkən xəta baş verdi"); }
    } catch { error("Şəbəkə xətası baş verdi"); }
    finally { setDeletingId(null); }
  };

  if (showForm || editingQuiz) {
    return (
      <QuizForm quiz={editingQuiz}
        onSuccess={() => { setShowForm(false); setEditingQuiz(null); fetchQuizzes(); }}
        onCancel={() => { setShowForm(false); setEditingQuiz(null); }} />
    );
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const selectCls = "text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-[rgb(147,204,255)] cursor-pointer";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-slate-900">
          {isTeacher ? "Quizlərim" : "Quizlər"}
        </h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Yeni Quiz
        </button>
      </div>

      {/* Filterlər — yalnız ADMIN */}
      {!isTeacher && (
        <div className="card-static mb-5">
          <div className="flex flex-wrap items-center gap-3">
            {/* Axtarış */}
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Ada görə axtar..."
                className="input-field pl-8 py-1.5 text-sm h-9" />
            </div>

            {/* Müəllim filteri */}
            <select value={filterTeacher}
              onChange={(e) => { setFilterTeacher(e.target.value); setPage(1); }}
              className={selectCls}>
              <option value="ALL">Bütün müəllimlər</option>
              <option value="ADMIN">Admin (müəllim yoxdur)</option>
              {teachers.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            {/* Tip filteri */}
            <select value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
              className={selectCls}>
              <option value="ALL">Bütün tiplər</option>
              <option value="SINAQ">⏱ Sınaq</option>
              <option value="TEST">📝 Test</option>
            </select>

            {/* Kateqoriya filteri */}
            <select value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
              className={selectCls}>
              <option value="ALL">Bütün kateqoriyalar</option>
              {categories.map((c: any) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>

            {/* Filteri təmizlə */}
            {hasFilters && (
              <button onClick={clearFilters}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-all border border-slate-200">
                <X size={12} /> Təmizlə
              </button>
            )}

            <span className="text-xs text-slate-400 ml-auto">
              {filtered.length} quiz
            </span>
          </div>
        </div>
      )}

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
                      "Başlıq", "Kateqoriya", "Tip", "Suallar", "Görünürlük",
                      ...(isTeacher ? [] : ["Müəllim"]),
                      "Status", "Əməliyyatlar",
                    ].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginated.map((quiz) => (
                    <tr key={quiz.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 pr-4 font-medium text-sm text-slate-800 max-w-[180px] truncate">{quiz.title}</td>
                      <td className="py-3 pr-4">
                        <span className="badge-category">{getCategoryLabel(quiz.category)}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={quiz.type === "SINAQ" ? "badge-type-sinaq" : "badge-type-test"}>
                          {getTypeLabel(quiz.type)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-sm text-slate-500">{quiz._count?.questions || 0}</td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          quiz.visibility === "PUBLIC"
                            ? "bg-green-50 text-green-700 border border-green-100"
                            : "bg-amber-50 text-amber-700 border border-amber-100"
                        }`}>
                          {quiz.visibility === "PUBLIC" ? "🌐 Açıq" : "🔒 Tələbə"}
                        </span>
                      </td>

                      {!isTeacher && (
                        <td className="py-3 pr-4 text-sm text-slate-500">
                          {quiz.createdBy?.name ?? <span className="text-slate-300">Admin</span>}
                        </td>
                      )}

                      <td className="py-3 pr-4">
                        <button onClick={() => toggleActive(quiz)} disabled={togglingId === quiz.id}
                          title="Klikləyin: aktiv/deaktiv et"
                          className={`text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1 transition-all cursor-pointer hover:opacity-80 disabled:opacity-50 ${
                            quiz.active !== false
                              ? "bg-green-50 text-green-700 border border-green-100"
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}>
                          {togglingId === quiz.id
                            ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            : <span className={`w-1.5 h-1.5 rounded-full ${quiz.active !== false ? "bg-green-500" : "bg-slate-400"}`} />}
                          {quiz.active !== false ? "Aktiv" : "Deaktiv"}
                        </button>
                      </td>

                      <td className="py-3">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => handleEdit(quiz)} disabled={editLoading === quiz.id}
                            className="p-1.5 text-[#1a7fe0] hover:bg-blue-50 rounded-lg transition-all disabled:opacity-50" title="Düzəlt">
                            {editLoading === quiz.id
                              ? <div className="w-3.5 h-3.5 border-2 border-blue-200 border-t-[#1a7fe0] rounded-full animate-spin" />
                              : <Edit size={14} />}
                          </button>
                          <button onClick={() => copyLink(quiz.id)}
                            className="p-1.5 text-[#1a7fe0] hover:bg-blue-50 rounded-lg transition-all" title="Linki kopyala">
                            {copiedId === quiz.id
                              ? <Check size={14} className="text-green-500" />
                              : <Share2 size={14} />}
                          </button>
                          <button onClick={() => deleteQuiz(quiz.id)} disabled={deletingId === quiz.id}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50" title="Sil">
                            {deletingId === quiz.id
                              ? <div className="w-3.5 h-3.5 border-2 border-red-200 border-t-red-500 rounded-full animate-spin" />
                              : <Trash2 size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  {isTeacher ? "Hələ quiz yaratmamısınız" : hasFilters ? "Filtrə uyğun quiz tapılmadı" : "Hələ quiz əlavə edilməyib"}
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
