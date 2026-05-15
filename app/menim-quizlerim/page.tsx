"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, Edit, BookOpen, Search, X, Loader2, ChevronRight, Bot, Sparkles,
} from "lucide-react";
import { useToast } from "@/components/ui/toast-1";
import { getCategoryLabel, getTypeLabel } from "@/lib/utils";
import UserQuizForm from "@/components/user/UserQuizForm";
import UserBotManager from "@/components/user/UserBotManager";
import ConfirmModal from "@/components/ui/confirm-modal";

const PAGE_SIZE = 10;
type Tab = "quizler" | "botlar";

export default function MenimQuizlerimPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { success, error } = useToast();

  const [tab, setTab] = useState<Tab>("quizler");
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editingQuiz, setEditingQuiz] = useState<any>(null);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState<string | null>(null);
  const [selectedBotId, setSelectedBotId] = useState<string | undefined>(undefined);
  const [openAI, setOpenAI] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/giris");
  }, [status, router]);

  const fetchQuizzes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/quizzes?myQuizzes=true", { cache: "no-store" });
      const data = await res.json();
      setQuizzes(Array.isArray(data) ? data : []);
    } catch {
      error("Quizlər yüklənərkən xəta baş verdi");
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    if (status === "authenticated") fetchQuizzes();
  }, [status, fetchQuizzes]);

  const filtered = quizzes.filter((q) =>
    search ? q.title.toLowerCase().includes(search.toLowerCase()) : true
  );
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleEdit = async (quiz: any) => {
    setEditLoading(quiz.id);
    try {
      const res = await fetch(`/api/quizzes/${quiz.id}`);
      if (!res.ok) { error("Quiz məlumatları yüklənmədi"); return; }
      setEditingQuiz(await res.json());
      setView("edit");
    } catch {
      error("Xəta baş verdi");
    } finally {
      setEditLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setConfirmDelete(null);
    try {
      const res = await fetch(`/api/quizzes/${id}`, { method: "DELETE" });
      if (res.ok) {
        success("Quiz silindi");
        setQuizzes((prev) => prev.filter((q) => q.id !== id));
      } else {
        const d = await res.json().catch(() => ({}));
        error(d.error || "Quiz silinərkən xəta baş verdi");
      }
    } catch {
      error("Şəbəkə xətası baş verdi");
    } finally {
      setDeletingId(null);
    }
  };

  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[#1a7fe0]" />
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  // Quiz yaratma/düzəltmə formu
  if (view === "create" || view === "edit") {
    return (
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-3xl">
        <UserQuizForm
          quiz={view === "edit" ? editingQuiz : undefined}
          preselectedBotId={view === "create" ? selectedBotId : undefined}
          autoOpenAI={view === "create" ? openAI : false}
          onSuccess={() => {
            setView("list");
            setEditingQuiz(null);
            setSelectedBotId(undefined);
            setOpenAI(false);
            fetchQuizzes();
          }}
          onCancel={() => {
            setView("list");
            setEditingQuiz(null);
            setSelectedBotId(undefined);
            setOpenAI(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <ConfirmModal
        open={!!confirmDelete}
        title="Quizi sil"
        message="Bu quizi silmək istədiyinizə əminsiniz? Bu əməliyyat geri alına bilməz."
        confirmText="Sil"
        loading={deletingId === confirmDelete}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Mənim Quizlərim</h1>
          <p className="text-sm text-slate-500 mt-1">
            Özünüz üçün quiz yaradın — yalnız siz görə bilərsiniz
          </p>
        </div>
        {tab === "quizler" && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => { setSelectedBotId(undefined); setView("create"); }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={16} /> Yeni Quiz
            </button>
            <button
              onClick={() => { setSelectedBotId(undefined); setOpenAI(true); setView("create"); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)" }}
            >
              <Sparkles size={15} /> AI ilə Yarat
            </button>
          </div>
        )}
      </div>

      {/* Tab-lar */}
      <div className="flex gap-1 p-1 rounded-xl bg-slate-100 mb-5 w-fit">
        <button
          onClick={() => setTab("quizler")}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "quizler" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <BookOpen size={14} />
          <span>Quizlərim</span>
          {quizzes.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-slate-200 text-slate-600">
              {quizzes.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("botlar")}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "botlar" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Bot size={14} />
          <span>Botlarım</span>
        </button>
      </div>

      {/* ── BOTLAR TAB ── */}
      {tab === "botlar" && (
        <div className="card-static">
          <UserBotManager
            onSelectBot={(bot) => {
              setSelectedBotId(bot.id);
              setTab("quizler");
              setView("create");
            }}
          />
        </div>
      )}

      {/* ── QUİZLƏR TAB ── */}
      {tab === "quizler" && (
        <>
          {/* Boş vəziyyət */}
          {!loading && quizzes.length === 0 && (
            <div className="text-center py-16 sm:py-20">
              <div
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-5"
                style={{ background: "rgba(147,204,255,0.15)" }}
              >
                <BookOpen size={30} className="text-[#1a7fe0] sm:hidden" />
                <BookOpen size={36} className="text-[#1a7fe0] hidden sm:block" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-slate-800 mb-2">
                Hələ quiz yaratmamısınız
              </h3>
              <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                Özünüz üçün quiz yaradın. AI ilə avtomatik suallar da əlavə edə bilərsiniz.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => { setSelectedBotId(undefined); setView("create"); }}
                  className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center"
                >
                  <Plus size={16} /> Quiz Yarat
                </button>
                <button
                  onClick={() => setTab("botlar")}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 w-full sm:w-auto justify-center"
                  style={{ background: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)" }}
                >
                  <Bot size={15} /> Bot Yarat
                </button>
              </div>
            </div>
          )}

          {/* Axtarış + siyahı */}
          {(loading || quizzes.length > 0) && (
            <>
              {quizzes.length > 0 && (
                <div className="card-static mb-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Ada görə axtar..."
                        className="input-field pl-8 py-1.5 text-sm h-9"
                      />
                    </div>
                    {search && (
                      <button
                        onClick={() => { setSearch(""); setPage(1); }}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-all border border-slate-200 flex-shrink-0"
                      >
                        <X size={12} /> <span className="hidden sm:inline">Təmizlə</span>
                      </button>
                    )}
                    <span className="text-xs text-slate-400 flex-shrink-0">{filtered.length} quiz</span>
                  </div>
                </div>
              )}

              <div className="card-static overflow-hidden">
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "rgba(147,204,255,0.08)" }} />
                    ))}
                  </div>
                ) : (
                  <>
                    {/* Mobil kart görünüşü */}
                    <div className="sm:hidden space-y-3">
                      {paginated.map((quiz) => (
                        <div key={quiz.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="font-semibold text-sm text-slate-800 leading-tight">{quiz.title}</p>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <a
                                href={`/quizler/${quiz.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-[#1f6f43] hover:bg-green-50 rounded-lg transition-all"
                              >
                                <ChevronRight size={14} />
                              </a>
                              <button
                                onClick={() => handleEdit(quiz)}
                                disabled={editLoading === quiz.id}
                                className="p-1.5 text-[#1a7fe0] hover:bg-blue-50 rounded-lg transition-all disabled:opacity-50"
                              >
                                {editLoading === quiz.id ? (
                                  <div className="w-3.5 h-3.5 border-2 border-blue-200 border-t-[#1a7fe0] rounded-full animate-spin" />
                                ) : <Edit size={14} />}
                              </button>
                              <button
                                onClick={() => setConfirmDelete(quiz.id)}
                                disabled={deletingId === quiz.id}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                              >
                                {deletingId === quiz.id ? (
                                  <div className="w-3.5 h-3.5 border-2 border-red-200 border-t-red-500 rounded-full animate-spin" />
                                ) : <Trash2 size={14} />}
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={quiz.type === "SINAQ" ? "badge-type-sinaq" : "badge-type-test"}>
                              {getTypeLabel(quiz.type)}
                            </span>
                            <span className="text-xs text-slate-400">{quiz._count?.questions || 0} sual</span>
                            <span className="text-xs text-slate-400">
                              {new Date(quiz.createdAt).toLocaleDateString("az-AZ")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop cədvəl görünüşü */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-100">
                            {["Başlıq", "Tip", "Suallar", "Tarix", "Əməliyyatlar"].map((h) => (
                              <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3 pr-4">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {paginated.map((quiz) => (
                            <tr key={quiz.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 pr-4 font-medium text-sm text-slate-800 max-w-[220px] truncate">
                                {quiz.title}
                              </td>
                              <td className="py-3 pr-4">
                                <span className={quiz.type === "SINAQ" ? "badge-type-sinaq" : "badge-type-test"}>
                                  {getTypeLabel(quiz.type)}
                                </span>
                              </td>
                              <td className="py-3 pr-4 text-sm text-slate-500">
                                {quiz._count?.questions || 0}
                              </td>
                              <td className="py-3 pr-4 text-xs text-slate-400">
                                {new Date(quiz.createdAt).toLocaleDateString("az-AZ")}
                              </td>
                              <td className="py-3">
                                <div className="flex items-center gap-1.5">
                                  <a
                                    href={`/quizler/${quiz.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-[#1f6f43] hover:bg-green-50 rounded-lg transition-all"
                                    title="Quizi işlə"
                                  >
                                    <ChevronRight size={14} />
                                  </a>
                                  <button
                                    onClick={() => handleEdit(quiz)}
                                    disabled={editLoading === quiz.id}
                                    className="p-1.5 text-[#1a7fe0] hover:bg-blue-50 rounded-lg transition-all disabled:opacity-50"
                                    title="Düzəlt"
                                  >
                                    {editLoading === quiz.id ? (
                                      <div className="w-3.5 h-3.5 border-2 border-blue-200 border-t-[#1a7fe0] rounded-full animate-spin" />
                                    ) : <Edit size={14} />}
                                  </button>
                                  <button
                                    onClick={() => setConfirmDelete(quiz.id)}
                                    disabled={deletingId === quiz.id}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                                    title="Sil"
                                  >
                                    {deletingId === quiz.id ? (
                                      <div className="w-3.5 h-3.5 border-2 border-red-200 border-t-red-500 rounded-full animate-spin" />
                                    ) : <Trash2 size={14} />}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {filtered.length === 0 && !loading && (
                      <div className="text-center py-10 text-slate-400 text-sm">
                        Axtarışa uyğun quiz tapılmadı
                      </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-1.5 mt-4 pt-4 border-t border-slate-100 flex-wrap">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                          <button
                            key={p}
                            onClick={() => setPage(p)}
                            className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                              p === page
                                ? "bg-[#1f6f43] text-white shadow-sm"
                                : "border border-slate-200 text-slate-600 hover:border-[rgb(147,204,255)] hover:text-[#1a7fe0]"
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
