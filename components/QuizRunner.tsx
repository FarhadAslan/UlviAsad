"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/toast-1";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Trophy,
  CheckCircle,
  XCircle,
  MinusCircle,
  RotateCcw,
  ArrowLeft,
  Share2,
  Check,
} from "lucide-react";
import { getCategoryLabel, getTypeLabel } from "@/lib/utils";
import ShareButton from "@/components/ShareButton";

interface QuizRunnerProps {
  quiz: any;
  session: any;
}

type Phase = "start" | "running" | "result";

export default function QuizRunner({ quiz, session }: QuizRunnerProps) {
  const { success } = useToast();
  const [phase,        setPhase]        = useState<Phase>("start");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers,      setAnswers]      = useState<Record<string, string | null>>({});
  const [timeLeft,     setTimeLeft]     = useState(quiz.duration ? quiz.duration * 60 : 0);
  const [startTime,    setStartTime]    = useState<number>(0);
  const [result,       setResult]       = useState<any>(null);
  const [showDetails,  setShowDetails]  = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [resultCopied, setResultCopied] = useState(false);
  const submittingRef = useRef(false);

  const isSinaq   = quiz.type === "SINAQ";
  const questions = quiz.questions;

  // Timer for SINAQ
  useEffect(() => {
    if (phase !== "running" || !isSinaq) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(timer); handleSubmit(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, isSinaq]);

  const handleStart = () => {
    setPhase("running");
    setStartTime(Date.now());
    if (isSinaq) setTimeLeft(quiz.duration * 60);
  };

  const handleAnswer = useCallback((questionId: string, option: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  }, []);

  const handleSubmit = useCallback(
    async (autoSubmit = false) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);

      const elapsed   = (Date.now() - startTime) / 1000;
      const totalTime = isSinaq ? quiz.duration * 60 : 0;
      const timeBonus = isSinaq && !autoSubmit ? Math.floor((totalTime - elapsed) / 10) : 0;

      let correct = 0, wrong = 0, skipped = 0;
      let score = 0;
      const answerDetails: any[] = [];

      questions.forEach((q: any) => {
        const selected  = answers[q.id] || null;
        const isCorrect = selected === q.correctOption;
        const pts       = q.points ?? 1;
        if (!selected) skipped++;
        else if (isCorrect) { correct++; score += pts; }
        else wrong++;
        answerDetails.push({
          questionId: q.id, selected,
          isCorrect: selected ? isCorrect : false,
          correctOption: q.correctOption,
          points: pts,
        });
      });

      if (session) {
        try {
          const res  = await fetch("/api/results", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quizId: quiz.id, correct, wrong, skipped, answers: answerDetails, timeBonus }),
          });
          const data = await res.json();
          setResult({ ...data, correct, wrong, skipped, score, answers: answerDetails });
        } catch {
          setResult({ correct, wrong, skipped, score, answers: answerDetails });
        }
      } else {
        setResult({ correct, wrong, skipped, score, answers: answerDetails });
      }

      setPhase("result");
      submittingRef.current = false;
      setSubmitting(false);
    },
    [answers, questions, quiz, session, startTime, isSinaq]
  );

  // Nəticəni paylaş
  const shareResult = async () => {
    const resultId = result?.id;
    const base     = typeof window !== "undefined" ? window.location.origin : "";
    // Nəticə ID-si varsa — ayrıca nəticə səhifəsi, yoxsa quiz linki
    const shareUrl = resultId
      ? `${base}/neticeler/${resultId}`
      : `${base}/quizler/${quiz.id}`;
    const text = `"${quiz.title}" quizini işlədim — ${result?.score ?? 0} xal aldım! Sən də cəhd et:`;

    if (navigator.share) {
      try { await navigator.share({ title: quiz.title, text, url: shareUrl }); } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
        success("Nəticə linki kopyalandı!");
        setResultCopied(true);
        setTimeout(() => setResultCopied(false), 2500);
      } catch {
        prompt("Linki kopyalayın:", shareUrl);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const percentage = result
    ? (() => {
        const totalPossible = questions.reduce((sum: number, q: any) => sum + (q.points ?? 1), 0);
        return totalPossible > 0 ? Math.round((result.score / totalPossible) * 100) : 0;
      })()
    : 0;
  const totalPossible = questions.reduce((sum: number, q: any) => sum + (q.points ?? 1), 0);

  // ── START PHASE ──────────────────────────────────────────────
  if (phase === "start") {
    return (
      <div className="container mx-auto py-16 max-w-2xl">
        <div className="card-static text-center">
          <div className="w-20 h-20 bg-[rgba(147,204,255,0.12)] rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">📝</span>
          </div>
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="badge-category">{getCategoryLabel(quiz.category)}</span>
            <span className={quiz.type === "SINAQ" ? "badge-type-sinaq" : "badge-type-test"}>
              {getTypeLabel(quiz.type)}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">{quiz.title}</h1>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-slate-500 text-sm mb-1">Sual sayı</p>
              <p className="text-3xl font-extrabold text-slate-900">{questions.length}</p>
            </div>
            {isSinaq ? (
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-slate-500 text-sm mb-1">Müddət</p>
                <p className="text-3xl font-extrabold text-orange-500">
                  {quiz.duration} <span className="text-base font-medium text-slate-400">dəq</span>
                </p>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-slate-500 text-sm mb-1">Tip</p>
                <p className="text-xl font-bold text-[#1a7fe0]">Vaxtsız</p>
              </div>
            )}
          </div>

          {!session && (
            <div className="rounded-xl p-4 mb-6 text-sm"
              style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", color: "#92400e" }}>
              ⚠️ Nəticəniz saxlanılmayacaq. Nəticəni saxlamaq üçün{" "}
              <Link href="/auth/giris" className="font-semibold underline" style={{ color: "#b45309" }}>
                giriş edin
              </Link>.
            </div>
          )}

          <button onClick={handleStart} className="btn-primary w-full text-lg py-4">
            Başla
          </button>
          <div className="flex items-center justify-between mt-3">
            <Link href="/quizler" className="text-slate-500 hover:text-slate-900 transition-colors text-sm">
              Geri qayıt
            </Link>
            <ShareButton title={quiz.title} variant="default" />
          </div>
        </div>
      </div>
    );
  }

  // ── RUNNING PHASE ────────────────────────────────────────────
  if (phase === "running") {
    const question      = questions[currentIndex];
    const selectedAnswer = answers[question.id];
    const isWarning     = isSinaq && timeLeft <= 30;
    const isFirst       = currentIndex === 0;
    const isLast        = currentIndex === questions.length - 1;

    return (
      <div className="container mx-auto py-8 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-slate-500 text-sm whitespace-nowrap">
              {currentIndex + 1}/{questions.length}
            </span>
            <div className="w-24 sm:w-48 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1f6f43] rounded-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          {isSinaq && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono font-bold text-base flex-shrink-0 ${
              isWarning
                ? "bg-red-50 text-red-500 timer-warning border border-red-200"
                : "bg-slate-50 text-slate-900 border border-slate-200"
            }`}>
              <Clock size={15} />
              {formatTime(timeLeft)}
            </div>
          )}
        </div>

        {/* Question */}
        <div className="card-static mb-6">
          {question.imageUrl && (
            <div className="mb-4 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={question.imageUrl} alt={`Sual ${currentIndex + 1}`} className="w-full object-contain max-h-72" />
            </div>
          )}
          {question.text && (
            <p
              className="text-slate-900 text-xl font-medium leading-relaxed quiz-render"
              dangerouslySetInnerHTML={{ __html: question.text }}
            />
          )}
        </div>

        {/* Options */}
        <div className="space-y-3 mb-8">
          {question.options.map((option: any) => (
            <button
              key={option.label}
              onClick={() => handleAnswer(question.id, option.label)}
              className={`answer-option ${selectedAnswer === option.label ? "answer-option-selected" : ""}`}
            >
              <div className="flex items-center gap-4">
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                  selectedAnswer === option.label
                    ? "bg-[#1f6f43] text-slate-900"
                    : "bg-[rgba(147,204,255,0.12)] text-[#1a7fe0]"
                }`}>
                  {option.label}
                </span>
                <span className="text-slate-900">{option.text}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Navigation — HƏM SINAQ HƏM TEST üçün əvvəlki/növbəti */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => { setCurrentIndex((prev) => Math.max(0, prev - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            disabled={isFirst}
            className="btn-secondary flex items-center gap-2 disabled:opacity-30"
          >
            <ChevronLeft size={18} />
            Əvvəlki
          </button>

          {!isLast ? (
            <button
              onClick={() => { setCurrentIndex((prev) => prev + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="btn-primary flex items-center gap-2"
            >
              Növbəti
              <ChevronRight size={18} />
            </button>
          ) : (
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="btn-primary flex items-center gap-2"
            >
              {submitting ? "Göndərilir..." : "Bitir"}
            </button>
          )}
        </div>

        {/* Question grid navigation — HƏM SINAQ HƏM TEST */}
        <div className="mt-6 flex flex-wrap gap-2">
          {questions.map((_: any, i: number) => (
            <button
              key={i}
              onClick={() => { setCurrentIndex(i); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                i === currentIndex
                  ? "bg-[#1f6f43] text-white shadow-sm"
                  : answers[questions[i].id]
                  ? "bg-[rgba(147,204,255,0.2)] text-[#1a7fe0] border border-[rgba(147,204,255,0.4)]"
                  : "bg-slate-50 text-slate-500 border border-slate-200"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── RESULT PHASE ─────────────────────────────────────────────
  if (phase === "result" && result) {
    const circumference    = 2 * Math.PI * 54;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    const scoreColor       = percentage >= 60 ? "#22c55e" : percentage >= 40 ? "#f59e0b" : "#ef4444";

    return (
      <div className="container mx-auto py-12 max-w-3xl">
        <h1 className="text-3xl font-bold text-slate-900 text-center mb-8">Nəticəniz</h1>

        {/* Score cards */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="card-static text-center p-4">
            <CheckCircle size={24} className="text-green-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-400">{result.correct}</p>
            <p className="text-slate-500 text-xs mt-1">Düzgün</p>
          </div>
          <div className="card-static text-center p-4">
            <XCircle size={24} className="text-red-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-red-400">{result.wrong}</p>
            <p className="text-slate-500 text-xs mt-1">Səhv</p>
          </div>
          <div className="card-static text-center p-4">
            <MinusCircle size={24} className="text-slate-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-slate-500">{result.skipped}</p>
            <p className="text-slate-500 text-xs mt-1 leading-tight">Cavab<br/>lanmamış</p>
          </div>
        </div>

        {/* Circular progress */}
        <div className="card-static flex flex-col items-center mb-8">
          <div className="relative w-36 h-36 mb-4">
            <svg className="circular-progress w-full h-full" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" fill="none" stroke="#e2e8f0" strokeWidth="10" />
              <circle cx="60" cy="60" r="54" fill="none"
                stroke={scoreColor} strokeWidth="10"
                strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                strokeLinecap="round" className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-slate-900">{percentage}%</span>
            </div>
          </div>
          <p className="text-slate-500">
            Ümumi xal: <span className="text-[#1a7fe0] font-bold text-xl">{result.score}</span>
            <span className="text-slate-400 text-sm ml-1">/ {totalPossible}</span>
          </p>
        </div>

        {/* Leaderboard */}
        {quiz.results && quiz.results.length > 0 && (
          <div className="card-static mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={20} className="text-yellow-400" />
              <h3 className="text-slate-900 font-semibold">Top 3 Nəticə</h3>
            </div>
            <div className="space-y-2">
              {quiz.results.map((r: any, i: number) => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-700">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"} {r.user?.name}
                  </span>
                  <span className="text-[#1a7fe0] font-bold">{r.score} xal</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed answers toggle */}
        <button onClick={() => setShowDetails(!showDetails)} className="btn-secondary w-full mb-4">
          {showDetails ? "Detalları Gizlə" : "Detallı Bax"}
        </button>

        {showDetails && (
          <div className="space-y-4 mb-8">
            {questions.map((q: any, i: number) => {
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
                        <img src={q.imageUrl} alt={`Sual ${i + 1}`} className="w-full object-contain max-h-56" />
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-2">
                      {q.text ? (
                        <p
                          className="text-slate-900 font-medium quiz-render"
                          dangerouslySetInnerHTML={{ __html: `${i + 1}. ${q.text}` }}
                        />
                      ) : (
                        <p className="text-slate-500 text-sm font-medium">{i + 1}. (şəkilli sual)</p>
                      )}
                      <span className="text-xs font-semibold px-2 py-1 rounded-lg flex-shrink-0"
                        style={{ background: "rgba(147,204,255,0.12)", color: "#1a7fe0" }}>
                        {q.points ?? 1} xal
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {q.options.map((opt: any) => {
                      let cls = "p-3 rounded-lg text-sm flex items-center gap-3 ";
                      if (opt.label === correctOpt)
                        cls += "bg-green-100 border border-green-400 text-green-800 font-medium";
                      else if (opt.label === selected && !isCorrect)
                        cls += "bg-red-100 border border-red-400 text-red-800 font-medium";
                      else
                        cls += "bg-slate-50 border border-slate-200 text-slate-600";

                      return (
                        <div key={opt.label} className={cls}>
                          <span className="font-bold w-6">{opt.label}.</span>
                          <span>{opt.text}</span>
                          {opt.label === correctOpt && <CheckCircle size={14} className="ml-auto text-green-500" />}
                          {opt.label === selected && !isCorrect && <XCircle size={14} className="ml-auto text-red-500" />}
                        </div>
                      );
                    })}
                  </div>
                  {!selected && <p className="text-slate-400 text-xs mt-2">⏭️ Cavablanmamış</p>}
                </div>
              );
            })}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              setPhase("start"); setAnswers({}); setCurrentIndex(0);
              setResult(null); setShowDetails(false);
            }}
            className="flex-1 min-w-[130px] btn-secondary flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} /> Yenidən
          </button>

          {/* Nəticəni paylaş */}
          <button
            onClick={shareResult}
            className="flex-1 min-w-[130px] btn-secondary flex items-center justify-center gap-2"
          >
            {resultCopied
              ? <><Check size={16} className="text-green-500" /> Kopyalandı!</>
              : <><Share2 size={16} /> Nəticəni Paylaş</>}
          </button>

          <Link
            href="/quizler"
            className="flex-1 min-w-[130px] btn-primary flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} /> Quizlərə qayıt
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
