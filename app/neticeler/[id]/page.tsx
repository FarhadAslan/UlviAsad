import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, User, Trophy, CheckCircle, XCircle, MinusCircle, Share2 } from "lucide-react";
import { formatDate, getCategoryLabel, getTypeLabel } from "@/lib/utils";
import ShareButton from "@/components/ShareButton";

export const dynamic = "force-dynamic";

async function getResult(id: string, userId?: string, userRole?: string) {
  const result = await prisma.result.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      score: true,
      correct: true,
      wrong: true,
      skipped: true,
      answers: true,
      createdAt: true,
      user: {
        select: { id: true, name: true },
      },
      quiz: {
        select: {
          id: true,
          title: true,
          type: true,
          category: true,
          questions: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              text: true,
              imageUrl: true,
              options: true,
              correctOption: true,
              order: true,
            },
          },
        },
      },
    },
  });

  if (!result) return null;

  const isOwner = userId && result.userId === userId;
  const isAdmin = userRole === "ADMIN";
  const canSeeDetails = !!(isOwner || isAdmin);

  return {
    ...result,
    canSeeDetails,
    answers: canSeeDetails ? JSON.parse(result.answers as string) : null,
    quiz: {
      ...result.quiz,
      questions: canSeeDetails
        ? result.quiz.questions.map((q) => ({
            ...q,
            options: JSON.parse(q.options),
          }))
        : [],
    },
  };
}

export default async function ResultPage({ params }: { params: { id: string } }) {
  const session  = await getServerSession(authOptions);
  const userId   = (session?.user as any)?.id;
  const userRole = (session?.user as any)?.role;

  const result = await getResult(params.id, userId, userRole);
  if (!result) notFound();

  const total      = result.quiz.questions.length || (result.correct + result.wrong + result.skipped);
  const percentage = total > 0 ? Math.round((result.correct / total) * 100) : 0;
  const scoreColor = percentage >= 60 ? "#22c55e" : percentage >= 40 ? "#f59e0b" : "#ef4444";
  const circumference    = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="container mx-auto py-10 max-w-3xl">

      {/* Back */}
      <Link href={`/quizler/${result.quiz.id}`}
        className="inline-flex items-center gap-2 text-slate-500 hover:text-[#1a7fe0] transition-colors mb-8 text-sm font-medium">
        <ArrowLeft size={16} /> Quizə qayıt
      </Link>

      {/* Header card — kimin nəticəsi */}
      <div className="card-static mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="badge-category">{getCategoryLabel(result.quiz.category)}</span>
              <span className={result.quiz.type === "SINAQ" ? "badge-type-sinaq" : "badge-type-test"}>
                {getTypeLabel(result.quiz.type)}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-3">{result.quiz.title}</h1>

            {/* İstifadəçi məlumatı */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <User size={14} className="text-[#1a7fe0]" />
                <span className="font-medium text-slate-700">{result.user.name}</span>
                <span className="text-slate-400">tərəfindən işlənib</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar size={14} className="text-[#1a7fe0]" />
                {formatDate(result.createdAt)}
              </span>
            </div>
          </div>

          {/* Paylaş */}
          <div className="flex-shrink-0">
            <ShareButton title={`${result.user.name} — ${result.quiz.title}`} variant="default" />
          </div>
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card-static text-center p-4">
          <CheckCircle size={22} className="text-green-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-green-500">{result.correct}</p>
          <p className="text-slate-500 text-xs mt-1">Düzgün</p>
        </div>
        <div className="card-static text-center p-4">
          <XCircle size={22} className="text-red-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-red-500">{result.wrong}</p>
          <p className="text-slate-500 text-xs mt-1">Səhv</p>
        </div>
        <div className="card-static text-center p-4">
          <MinusCircle size={22} className="text-slate-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-slate-500">{result.skipped}</p>
          <p className="text-slate-500 text-xs mt-1 leading-tight">Cavab<br/>lanmamış</p>
        </div>
      </div>

      {/* Circular progress */}
      <div className="card-static flex flex-col items-center mb-6">
        <div className="relative w-32 h-32 mb-3">
          <svg className="circular-progress w-full h-full" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" stroke="#e2e8f0" strokeWidth="10" />
            <circle cx="60" cy="60" r="54" fill="none"
              stroke={scoreColor} strokeWidth="10"
              strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
              strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-slate-900">{percentage}%</span>
          </div>
        </div>
        <p className="text-slate-500 text-sm">
          Ümumi xal: <span className="font-bold text-xl" style={{ color: scoreColor }}>{result.score}</span>
        </p>
        {total > 0 && (
          <p className="text-slate-400 text-xs mt-1">{result.correct} / {total} düzgün cavab</p>
        )}
      </div>

      {/* Cavablar — yalnız sahibi və admin görür */}
      {result.canSeeDetails && result.quiz.questions.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-4">Cavabların Detayı</h2>
          <div className="space-y-4">
            {result.quiz.questions.map((q: any, i: number) => {
              const answerDetail = result.answers?.find((a: any) => a.questionId === q.id);
              const selected     = answerDetail?.selected;
              const isCorrect    = answerDetail?.isCorrect;
              const correctOpt   = q.correctOption;

              return (
                <div key={q.id} className="card-static">
                  <div className="mb-3">
                    {q.imageUrl && (
                      <div className="mb-3 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={q.imageUrl} alt="" className="w-full object-contain max-h-56" />
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        {q.text ? (
                          <p
                            className="text-slate-900 font-medium quiz-render"
                            dangerouslySetInnerHTML={{ __html: q.text }}
                          />
                        ) : (
                          <p className="text-slate-500 text-sm">(şəkilli sual)</p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        {!selected
                          ? <MinusCircle size={16} className="text-slate-400" />
                          : isCorrect
                          ? <CheckCircle size={16} className="text-green-500" />
                          : <XCircle    size={16} className="text-red-500" />}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {q.options.map((opt: any) => {
                      const isCorrectOpt  = opt.label === correctOpt;
                      const isWrongSelect = opt.label === selected && !isCorrect;

                      let cls = "flex items-center gap-3 p-2.5 rounded-lg text-sm ";
                      if (isCorrectOpt)   cls += "bg-green-100 border border-green-400 text-green-800 font-medium";
                      else if (isWrongSelect) cls += "bg-red-100 border border-red-400 text-red-800 font-medium";
                      else                cls += "bg-slate-50 border border-slate-200 text-slate-600";

                      return (
                        <div key={opt.label} className={cls}>
                          <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            isCorrectOpt   ? "bg-green-200 text-green-800" :
                            isWrongSelect  ? "bg-red-200 text-red-800" :
                                             "bg-slate-100 text-slate-500"
                          }`}>
                            {opt.label}
                          </span>
                          <span className="flex-1">{opt.text}</span>
                          {isCorrectOpt  && <CheckCircle size={13} className="text-green-500 flex-shrink-0" />}
                          {isWrongSelect && <XCircle    size={13} className="text-red-500 flex-shrink-0" />}
                        </div>
                      );
                    })}
                    {!selected && (
                      <p className="text-slate-400 text-xs pl-1">⏭ Cavablanmamış</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Başqası baxırsa — cavablar gizlidir */}
      {!result.canSeeDetails && (
        <div className="card-static text-center py-8 text-slate-400">
          <Trophy size={32} className="mx-auto mb-3 text-amber-400" />
          <p className="font-medium text-slate-600 mb-1">
            <span className="text-slate-800">{result.user.name}</span> bu quizə {result.score} xal topladı
          </p>
          <p className="text-sm">Cavabların detayı yalnız nəticə sahibinə görünür.</p>
          <Link href={`/quizler/${result.quiz.id}`} className="btn-primary inline-flex mt-4">
            Sən də cəhd et
          </Link>
        </div>
      )}

      {/* Bottom actions */}
      <div className="flex flex-wrap gap-3 mt-8">
        <Link href={`/quizler/${result.quiz.id}`} className="btn-primary flex items-center gap-2">
          Quizə get
        </Link>
        <Link href="/quizler" className="btn-secondary flex items-center gap-2">
          <ArrowLeft size={15} /> Bütün quizlər
        </Link>
      </div>
    </div>
  );
}
