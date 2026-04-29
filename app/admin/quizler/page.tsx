"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Edit } from "lucide-react";
import { useToast } from "@/components/ui/toast-1";
import { getCategoryLabel, getTypeLabel } from "@/lib/utils";
import QuizForm from "@/components/admin/QuizForm";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 10;

export default function AdminQuizzesPage() {
  const { success, error } = useToast();
  const [quizzes,     setQuizzes]     = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<any>(null);
  const [editLoading, setEditLoading] = useState<string | null>(null);
  const [page,        setPage]        = useState(1);

  useEffect(() => { fetchQuizzes(); }, []);

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/quizzes?adminAll=true");
      const data = await res.json();
      setQuizzes(Array.isArray(data) ? data : []);
    } catch { error("Xəta baş verdi"); }
    finally { setLoading(false); }
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
    try {
      const res = await fetch(`/api/quizzes/${id}`, { method: "DELETE" });
      if (res.ok) { success("Quiz silindi"); fetchQuizzes(); }
    } catch { error("Xəta baş verdi"); }
  };

  if (showForm || editingQuiz) {
    return (
      <QuizForm quiz={editingQuiz}
        onSuccess={() => { setShowForm(false); setEditingQuiz(null); fetchQuizzes(); }}
        onCancel={() => { setShowForm(false); setEditingQuiz(null); }} />
    );
  }

  const totalPages = Math.ceil(quizzes.length / PAGE_SIZE);
  const paginated  = quizzes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Quizlər</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Yeni Quiz
        </button>
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
                    {["Başlıq","Kateqoriya","Tip","Suallar","Görünürlük","Status","Əməliyyatlar"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3 pr-4">{h}</th>
                    ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.map((quiz) => (
                  <tr key={quiz.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 pr-4 font-medium text-sm text-slate-800">{quiz.title}</td>
                    <td className="py-3 pr-4"><span className="badge-category">{getCategoryLabel(quiz.category)}</span></td>
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
                    <td className="py-3 pr-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1 ${
                        quiz.active !== false
                          ? "bg-green-50 text-green-700 border border-green-100"
                          : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${quiz.active !== false ? "bg-green-500" : "bg-slate-400"}`} />
                        {quiz.active !== false ? "Aktiv" : "Deaktiv"}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handleEdit(quiz)} disabled={editLoading === quiz.id}
                          className="p-1.5 text-[#1a7fe0] hover:bg-blue-50 rounded-lg transition-all disabled:opacity-50">
                          {editLoading === quiz.id
                            ? <div className="w-3.5 h-3.5 border-2 border-blue-200 border-t-[#1a7fe0] rounded-full animate-spin" />
                            : <Edit size={14} />}
                        </button>
                        <button onClick={() => deleteQuiz(quiz.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {quizzes.length === 0 && (
              <div className="text-center py-12 text-slate-400">Hələ quiz əlavə edilməyib</div>
            )}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
          </>
        )}
      </div>
    </div>
  );
}
