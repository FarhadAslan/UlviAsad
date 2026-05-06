"use client";

import { useState, useMemo } from "react";
import { formatDate, getCategoryLabel, getTypeLabel, getRoleLabel } from "@/lib/utils";
import Link from "next/link";
import {
  User, Trophy, Target, Star, Zap, Calendar, Eye, Share2, Check,
  Pencil, X, Save, KeyRound, Mail, CheckCircle2, Loader2,
} from "lucide-react";
import ResultDetailModal from "@/components/ResultDetailModal";
import Pagination from "@/components/Pagination";
import { useSession } from "next-auth/react";

interface ProfileData {
  user: any;
  stats: any;
  results: any[];
}

const RESULTS_PAGE_SIZE = 8;

const roleBadge: Record<string, { bg: string; color: string; border: string }> = {
  ADMIN:   { bg: "#fee2e2", color: "#dc2626", border: "#fecaca" },
  TEACHER: { bg: "rgba(31,111,67,0.1)", color: "#1f6f43", border: "rgba(31,111,67,0.25)" },
  STUDENT: { bg: "rgba(147,204,255,0.15)", color: "#1a7fe0", border: "rgba(147,204,255,0.35)" },
  USER:    { bg: "#f1f5f9", color: "#475569", border: "#e2e8f0" },
};

export default function ProfileClient({ data }: { data: ProfileData }) {
  const { user, stats, results } = data;
  const { update: updateSession } = useSession();
  const rb = roleBadge[user.role] || roleBadge.USER;

  // Quiz tarixçəsi
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [copiedId,          setCopiedId]         = useState<string | null>(null);
  const [resultsPage,       setResultsPage]       = useState(1);

  // Profil redaktəsi
  const [editMode,    setEditMode]    = useState(false);
  const [editName,    setEditName]    = useState(user.name);
  const [editEmail,   setEditEmail]   = useState(user.email);
  const [savingInfo,  setSavingInfo]  = useState(false);
  const [infoError,   setInfoError]   = useState("");
  const [infoSuccess, setInfoSuccess] = useState(false);
  const [localUser,   setLocalUser]   = useState(user);

  // Parol sıfırlama
  const [resetSent,    setResetSent]    = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError,   setResetError]   = useState("");

  const totalResultPages = Math.ceil(results.length / RESULTS_PAGE_SIZE);
  const paginatedResults = useMemo(
    () => results.slice((resultsPage - 1) * RESULTS_PAGE_SIZE, resultsPage * RESULTS_PAGE_SIZE),
    [results, resultsPage]
  );

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

  const handleSaveInfo = async () => {
    setInfoError("");
    if (!editName.trim()) { setInfoError("Ad boş ola bilməz"); return; }
    if (!editEmail.trim() || !editEmail.includes("@")) { setInfoError("Düzgün email daxil edin"); return; }

    setSavingInfo(true);
    try {
      const res  = await fetch("/api/profile", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: editName.trim(), email: editEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setLocalUser((p: any) => ({ ...p, name: data.name, email: data.email }));
        setInfoSuccess(true);
        setEditMode(false);
        // NextAuth session-u yenilə ki, header-dəki ad dəyişsin
        await updateSession({ name: data.name, email: data.email });
        setTimeout(() => setInfoSuccess(false), 3000);
      } else {
        setInfoError(data.error || "Xəta baş verdi");
      }
    } catch {
      setInfoError("Xəta baş verdi");
    } finally {
      setSavingInfo(false);
    }
  };

  const handleResetPassword = async () => {
    setResetError("");
    setResetLoading(true);
    try {
      const res  = await fetch("/api/auth/forgot-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: localUser.email }),
      });
      const data = await res.json();
      if (res.ok) {
        setResetSent(true);
      } else {
        setResetError(data.error || "Xəta baş verdi");
      }
    } catch {
      setResetError("Xəta baş verdi");
    } finally {
      setResetLoading(false);
    }
  };

  const statCards = [
    { icon: Target, label: "İşlənən Quiz",    value: stats.totalQuizzes, color: "#1a7fe0", bg: "rgba(147,204,255,0.1)" },
    { icon: Star,   label: "Ortalama Xal",    value: stats.averageScore, color: "#1f6f43", bg: "rgba(31,111,67,0.1)" },
    { icon: Trophy, label: "Ən Yaxşı Nəticə", value: stats.bestScore,    color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
    { icon: Zap,    label: "Ümumi Xal",       value: stats.totalPoints,  color: "#7c3aed", bg: "rgba(124,58,237,0.1)" },
  ];

  return (
    <div className="container mx-auto py-12 max-w-5xl">
      <h1 className="text-4xl font-bold text-slate-900 mb-8">Profilim</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* ── Profil kartı ── */}
        <div className="card-static flex flex-col items-center text-center py-8 relative">
          {/* Redaktə düyməsi */}
          {!editMode && (
            <button
              onClick={() => { setEditMode(true); setEditName(localUser.name); setEditEmail(localUser.email); setInfoError(""); }}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-[#1a7fe0] hover:bg-blue-50 transition-all"
              title="Redaktə et"
            >
              <Pencil size={15} />
            </button>
          )}

          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg,#1a7fe0,rgb(147,204,255))" }}>
            {localUser.image
              ? <img src={localUser.image} alt={localUser.name} className="w-full h-full rounded-2xl object-cover" />
              : <User size={36} className="text-white" />}
          </div>

          {/* Normal görünüş */}
          {!editMode ? (
            <>
              <h2 className="text-xl font-bold text-slate-900 mb-1">{localUser.name}</h2>
              <p className="text-slate-500 text-sm mb-3">{localUser.email}</p>
              <span className="text-xs px-3 py-1 rounded-full font-semibold"
                style={{ background: rb.bg, color: rb.color, border: `1px solid ${rb.border}` }}>
                {getRoleLabel(localUser.role)}
              </span>
              <p className="text-slate-400 text-xs mt-4 flex items-center gap-1.5">
                <Calendar size={12} />
                {formatDate(localUser.createdAt)} tarixindən üzv
              </p>

              {infoSuccess && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                  <CheckCircle2 size={13} /> Məlumatlar yeniləndi
                </div>
              )}

              {/* Parol sıfırlama */}
              <div className="mt-5 w-full border-t border-slate-100 pt-5">
                {resetSent ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle2 size={22} className="text-green-500" />
                    <p className="text-xs text-green-700 font-medium">Link emailinizə göndərildi</p>
                    <p className="text-xs text-slate-400">Spam qutusunu da yoxlayın</p>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={handleResetPassword}
                      disabled={resetLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 hover:border-[rgb(147,204,255)] hover:text-[#1a7fe0] hover:bg-blue-50/40 transition-all disabled:opacity-60"
                    >
                      {resetLoading
                        ? <><Loader2 size={14} className="animate-spin" /> Göndərilir...</>
                        : <><KeyRound size={14} /> Parolu Sıfırla</>}
                    </button>
                    <p className="text-xs text-slate-400 mt-2">
                      Emailinizə sıfırlama linki göndəriləcək
                    </p>
                    {resetError && (
                      <p className="text-xs text-red-500 mt-1">{resetError}</p>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            /* Redaktə formu */
            <div className="w-full space-y-3 mt-1">
              <div className="text-left">
                <label className="block text-xs font-medium text-slate-600 mb-1">Ad Soyad</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input-field text-sm"
                  placeholder="Adınız"
                />
              </div>
              <div className="text-left">
                <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="input-field text-sm pl-8"
                    placeholder="email@example.com"
                  />
                </div>
              </div>

              {infoError && (
                <p className="text-xs text-red-500 text-left">{infoError}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSaveInfo}
                  disabled={savingInfo}
                  className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-sm py-2"
                >
                  {savingInfo
                    ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saxlanır...</>
                    : <><Save size={13} /> Saxla</>}
                </button>
                <button
                  onClick={() => { setEditMode(false); setInfoError(""); }}
                  className="btn-secondary flex items-center gap-1.5 text-sm py-2 px-3"
                >
                  <X size={13} /> Ləğv
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          {statCards.map((s) => (
            <div key={s.label} className="card-static">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
                style={{ background: s.bg }}>
                <s.icon size={22} style={{ color: s.color }} />
              </div>
              <p className="text-3xl font-bold mb-1" style={{ color: s.color }}>{s.value}</p>
              <p className="text-sm text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quiz Tarixçəsi ── */}
      <div className="card-static">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-900">Quiz Tarixçəsi</h3>
          {results.length > 0 && (
            <span className="text-sm text-slate-400">{results.length} nəticə</span>
          )}
        </div>

        {results.length > 0 ? (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {["Quiz Adı", "Tip", "Nəticə", "Tarix", "Əməliyyatlar"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedResults.map((r) => (
                    <tr key={r.id}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedResultId(r.id)}>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-sm text-slate-800">{r.quizTitle}</p>
                        <p className="text-xs text-slate-400">{getCategoryLabel(r.quizCategory)}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={r.quizType === "SINAQ" ? "badge-type-sinaq" : "badge-type-test"}>
                          {getTypeLabel(r.quizType)}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-bold text-[#1f6f43]">{r.correct}/{r.totalQuestions}</span>
                        <span className="text-xs text-slate-400 ml-1.5">({r.score} bal)</span>
                      </td>
                      <td className="py-3 pr-4 text-sm text-slate-400">{formatDate(r.createdAt)}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedResultId(r.id); }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#1a7fe0] hover:bg-blue-50 border border-[rgba(147,204,255,0.4)] transition-all">
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

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {paginatedResults.map((r) => (
                <div key={r.id}
                  className="p-4 rounded-xl border border-slate-100 bg-slate-50 cursor-pointer hover:border-[rgba(147,204,255,0.4)] transition-all"
                  onClick={() => setSelectedResultId(r.id)}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-800 truncate">{r.quizTitle}</p>
                      <p className="text-xs text-slate-400">{getCategoryLabel(r.quizCategory)}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); setSelectedResultId(r.id); }}
                        className="p-1.5 rounded-lg text-[#1a7fe0] hover:bg-blue-50 transition-all">
                        <Eye size={14} />
                      </button>
                      <button onClick={(e) => copyResultLink(e, r.id)}
                        className="p-1.5 rounded-lg text-[#1a7fe0] hover:bg-blue-50 transition-all">
                        {copiedId === r.id ? <Check size={14} className="text-green-500" /> : <Share2 size={14} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={r.quizType === "SINAQ" ? "badge-type-sinaq" : "badge-type-test"}>
                      {getTypeLabel(r.quizType)}
                    </span>
                    <span className="font-bold text-sm text-[#1f6f43]">{r.correct}/{r.totalQuestions}</span>
                    <span className="text-xs text-slate-400">({r.score} bal)</span>
                    <span className="text-xs text-slate-400 ml-auto">{formatDate(r.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>

            <Pagination page={resultsPage} totalPages={totalResultPages} onPageChange={(p) => setResultsPage(p)} />
          </>
        ) : (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-slate-500 mb-4">Hələ heç bir quiz işləməmisiniz</p>
            <Link href="/quizler" className="btn-primary inline-flex">Quizlərə Bax</Link>
          </div>
        )}
      </div>

      {selectedResultId && (
        <ResultDetailModal resultId={selectedResultId} onClose={() => setSelectedResultId(null)} />
      )}
    </div>
  );
}
