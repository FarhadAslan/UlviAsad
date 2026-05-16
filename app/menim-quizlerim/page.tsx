"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, Edit, BookOpen, Search, X, Loader2, ChevronRight,
  Bot, Sparkles, Trophy, Clock, HelpCircle, Zap,
} from "lucide-react";
import { useToast } from "@/components/ui/toast-1";
import { getTypeLabel } from "@/lib/utils";
import UserQuizForm from "@/components/user/UserQuizForm";
import UserBotManager from "@/components/user/UserBotManager";
import ConfirmModal from "@/components/ui/confirm-modal";

const PAGE_SIZE = 12;
type Tab = "quizler" | "botlar";

// Hər quiz üçün sabit gradient seçir (id-yə görə)
const CARD_GRADIENTS = [
  "from-blue-500 to-indigo-600",
  "from-violet-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-sky-500 to-cyan-600",
  "from-pink-500 to-rose-600",
  "from-cyan-500 to-blue-600",
];
function getGradient(id: string) {
  const idx = id.charCodeAt(0) % CARD_GRADIENTS.length;
  return CARD_GRADIENTS[idx];
}

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
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-6xl overflow-x-hidden">
      <ConfirmModal
        open={!!confirmDelete}
        title="Quizi sil"
        message="Bu quizi silmək istədiyinizə əminsiniz? Bu əməliyyat geri alına bilməz."
        confirmText="Sil"
        loading={deletingId === confirmDelete}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* ── HERO HEADER ── */}
      <div className="relative overflow-hidden rounded-2xl mb-6 sm:mb-8 p-6 sm:p-8"
        style={{ background: "linear-gradient(135deg, #1a7fe0 0%, #1f6f43 100%)" }}>
        {/* Dekorativ dairələr */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-10 -left-6 w-32 h-32 rounded-full opacity-10 bg-white" />
        <div className="absolute top-4 right-24 w-16 h-16 rounded-full opacity-5 bg-white" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Trophy size={18} className="text-yellow-300 flex-shrink-0" />
              <span className="text-white/80 text-sm font-medium">Şəxsi Məkan</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 break-words">Mənim Quizlərim</h1>
            <p className="text-white/70 text-sm">
              Öz quizlərini yarat, AI ilə genişləndir, bilikini test et
            </p>
          </div>

          {tab === "quizler" && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => { setSelectedBotId(undefined); setView("create"); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white text-slate-800 hover:bg-slate-50 transition-all shadow-sm"
              >
                <Plus size={15} /> Yeni Quiz
              </button>
              <button
                onClick={() => { setSelectedBotId(undefined); setOpenAI(true); setView("create"); }}
                className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105 overflow-hidden"
                style={{ background: "linear-gradient(135deg, #a855f7 0%, #6366f1 50%, #ec4899 100%)", boxShadow: "0 0 20px rgba(168,85,247,0.5)" }}
              >
                {/* Parıltı effekti */}
                <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 translate-x-[-100%] hover:translate-x-[200%] transition-transform duration-700" />
                <Sparkles size={15} className="animate-pulse" /> AI ilə Yarat
              </button>
            </div>
          )}
        </div>

        {/* Statistika sətri */}
        {tab === "quizler" && quizzes.length > 0 && (
          <div className="relative flex items-center gap-4 mt-5 pt-4 border-t border-white/20">
            <div className="flex items-center gap-1.5 text-white/80 text-xs">
              <BookOpen size={13} />
              <span><strong className="text-white">{quizzes.length}</strong> quiz</span>
            </div>
            <div className="flex items-center gap-1.5 text-white/80 text-xs">
              <HelpCircle size={13} />
              <span>
                <strong className="text-white">
                  {quizzes.reduce((s, q) => s + (q._count?.questions || 0), 0)}
                </strong> sual
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── TABS ── */}
      <div className="flex gap-1 p-1 rounded-xl bg-slate-100 mb-6 w-fit">
        {([
          { key: "quizler", label: "Quizlərim", icon: BookOpen, count: quizzes.length },
          { key: "botlar",  label: "Botlarım",  icon: Bot,      count: null },
        ] as const).map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon size={14} />
            <span>{label}</span>
            {count !== null && count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                tab === key ? "bg-[#1a7fe0]/10 text-[#1a7fe0]" : "bg-slate-200 text-slate-500"
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── BOTLAR TAB ── */}
      {tab === "botlar" && (
        <div className="w-full min-w-0">
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
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5"
                style={{ background: "linear-gradient(135deg,rgba(26,127,224,0.12),rgba(31,111,67,0.12))" }}>
                <BookOpen size={36} className="text-[#1a7fe0]" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Hələ quiz yaratmamısınız</h3>
              <p className="text-sm text-slate-500 mb-8 max-w-sm mx-auto leading-relaxed">
                İlk quizinizi yaradın. Özünüz sual əlavə edin və ya AI ilə saniyələr içində quiz hazırlayın.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => { setSelectedBotId(undefined); setView("create"); }}
                  className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center px-6 py-3"
                >
                  <Plus size={16} /> Quiz Yarat
                </button>
                <button
                  onClick={() => { setSelectedBotId(undefined); setOpenAI(true); setView("create"); }}
                  className="relative flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105 overflow-hidden w-full sm:w-auto justify-center"
                  style={{ background: "linear-gradient(135deg, #a855f7 0%, #6366f1 50%, #ec4899 100%)", boxShadow: "0 0 24px rgba(168,85,247,0.45)" }}
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 translate-x-[-100%] hover:translate-x-[200%] transition-transform duration-700" />
                  <Sparkles size={15} className="animate-pulse" /> AI ilə Yarat
                </button>
                <button
                  onClick={() => setTab("botlar")}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all w-full sm:w-auto justify-center"
                >
                  <Bot size={15} /> Bot Yarat
                </button>
              </div>
            </div>
          )}

          {/* Axtarış */}
          {(loading || quizzes.length > 0) && (
            <>
              {quizzes.length > 0 && (
                <div className="flex items-center gap-2 sm:gap-3 mb-5">
                  <div className="relative flex-1 max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                      placeholder="Quiz axtar..."
                      className="input-field pl-9 py-2 text-sm"
                    />
                  </div>
                  {search && (
                    <button
                      onClick={() => { setSearch(""); setPage(1); }}
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 px-3 py-2 rounded-xl hover:bg-slate-100 transition-all border border-slate-200"
                    >
                      <X size={12} /> Təmizlə
                    </button>
                  )}
                  <span className="text-xs text-slate-400 ml-auto">{filtered.length} nəticə</span>
                </div>
              )}

              {/* Quiz Card Grid */}
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-44 rounded-2xl animate-pulse"
                      style={{ background: "rgba(147,204,255,0.08)" }} />
                  ))}
                </div>
              ) : (
                <>
                  {filtered.length === 0 && (
                    <div className="text-center py-12 text-slate-400 text-sm">
                      Axtarışa uyğun quiz tapılmadı
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {paginated.map((quiz) => {
                      const grad = getGradient(quiz.id);
                      const qCount = quiz._count?.questions || 0;
                      return (
                        <div
                          key={quiz.id}
                          className="group relative bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
                        >
                          {/* Rəngli üst zolaq */}
                          <div className={`h-2 w-full bg-gradient-to-r ${grad}`} />

                          <div className="p-4 sm:p-5">
                            {/* Tip badge */}
                            <div className="flex items-center justify-between mb-3">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                quiz.type === "SINAQ"
                                  ? "bg-blue-50 text-blue-600 border border-blue-100"
                                  : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                              }`}>
                                {getTypeLabel(quiz.type)}
                              </span>
                              <span className="text-xs text-slate-400">
                                {new Date(quiz.createdAt).toLocaleDateString("az-AZ")}
                              </span>
                            </div>

                            {/* Başlıq */}
                            <h3 className="font-bold text-slate-800 text-sm sm:text-base leading-snug mb-3 line-clamp-2 group-hover:text-[#1a7fe0] transition-colors">
                              {quiz.title}
                            </h3>

                            {/* Statistika */}
                            <div className="flex items-center gap-3 mb-4">
                              <div className="flex items-center gap-1 text-xs text-slate-500">
                                <HelpCircle size={12} className="text-slate-400" />
                                <span>{qCount} sual</span>
                              </div>
                              {quiz.timeLimit && (
                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                  <Clock size={12} className="text-slate-400" />
                                  <span>{quiz.timeLimit} dəq</span>
                                </div>
                              )}
                            </div>

                            {/* Əməliyyat düymələri */}
                            <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                              <a
                                href={`/quizler/${quiz.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
                                style={{ background: "linear-gradient(135deg,#1f6f43,#2d9d5f)" }}
                              >
                                <ChevronRight size={13} /> Başla
                              </a>
                              <button
                                onClick={() => handleEdit(quiz)}
                                disabled={editLoading === quiz.id}
                                className="flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 text-slate-500 hover:text-[#1a7fe0] hover:border-blue-200 hover:bg-blue-50 transition-all disabled:opacity-50"
                                title="Düzəlt"
                              >
                                {editLoading === quiz.id
                                  ? <Loader2 size={13} className="animate-spin" />
                                  : <Edit size={13} />}
                              </button>
                              <button
                                onClick={() => setConfirmDelete(quiz.id)}
                                disabled={deletingId === quiz.id}
                                className="flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 text-slate-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all disabled:opacity-50"
                                title="Sil"
                              >
                                {deletingId === quiz.id
                                  ? <Loader2 size={13} className="animate-spin" />
                                  : <Trash2 size={13} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-1.5 mt-6 flex-wrap">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`w-9 h-9 rounded-xl text-sm font-medium transition-all ${
                            p === page
                              ? "bg-[#1f6f43] text-white shadow-sm"
                              : "border border-slate-200 text-slate-600 hover:border-[#1a7fe0] hover:text-[#1a7fe0]"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
