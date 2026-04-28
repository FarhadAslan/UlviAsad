"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { getCategoryLabel, getTypeLabel } from "@/lib/utils";

interface QuizRunnerProps {
  quiz: any;
  session: any;
}

type Phase = "start" | "running" | "result";

export default function QuizRunner({ quiz, session }: QuizRunnerProps) {
  const router = useRouter();
  const { error: toastError } = useToast();
  const [phase, setPhase] = useState<Phase>("start");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [timeLeft, setTimeLeft] = useState(quiz.duration ? quiz.duration * 60 : 0);
  const [startTime, setStartTime] = useState<number>(0);
  const [result, setResult] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const isSinaq = quiz.type === "SINAQ";
  const questions = quiz.questions;

  // Timer for SINAQ
  useEffect(() => {
    if (phase !== "running" || !isSinaq) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit(true);
          return 0;
        }
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

      const elapsed = (Date.now() - startTime) / 1000;
      const totalTime = isSinaq ? quiz.duration * 60 : 0;
      const timeBonus =
        isSinaq && !autoSubmit
          ? Math.floor((totalTime - elapsed) / 10)
          : 0;

      let correct = 0;
      let wrong = 0;
      let skipped = 0;
      const answerDetails: any[] = [];

      questions.forEach((q: any) => {
        const selected = answers[q.id] || null;
        const isCorrect = selected === q.correctOption;

        if (!selected) skipped++;
        else if (isCorrect) correct++;
        else wrong++;

        answerDetails.push({
          questionId: q.id,
          selected,
          isCorrect: selected ? isCorrect : false,
          correctOption: q.correctOption,
        });
      });

      const score = correct * 1;

      if (session) {
        try {
          const res = await fetch("/api/results", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              quizId: quiz.id,
              correct,
              wrong,
              skipped,
              answers: answerDetails,
              timeBonus,
            }),
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
    // submitting state-i ref ilə idarə edirik ki, stale closure olmasın
    [answers, questions, quiz, session, startTime, isSinaq]
  );

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const percentage = result
    ? Math.round((result.correct / questions.length) * 100)
    : 0;

  // START PHASE
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
            {isSinaq && (
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-slate-500 text-sm mb-1">Müddət</p>
                <p className="text-3xl font-extrabold text-orange-500">{quiz.duration} <span className="text-base font-medium text-slate-400">dəq</span></p>
              </div>
            )}
            {!isSinaq && (
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-slate-500 text-sm mb-1">Tip</p>
                <p className="text-xl font-bold text-[#1a7fe0]">Vaxtsız</p>
              </div>
            )}
          </div>




          {!session && (
            <div className="rounded-xl p-4 mb-6 text-sm"
              style={{
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.3)",
                color: "#92400e",
              }}>
              ⚠️ Nəticəniz saxlanılmayacaq. Nəticəni saxlamaq üçün{" "}
              <Link href="/auth/giris" className="font-semibold underline" style={{ color: "#b45309" }}>
                giriş edin
              </Link>
              .
            </div>
          )}

          <button onClick={handleStart} className="btn-primary w-full text-lg py-4">
            Başla
          </button>
          <Link href="/quizler" className="block mt-3 text-slate-500 hover:text-slate-900 transition-colors text-sm">
            Geri qayıt
          </Link>
        </div>
      </div>
    );
  }

  // RUNNING PHASE
  if (phase === "running") {
    const question = questions[currentIndex];
    const selectedAnswer = answers[question.id];
    const isWarning = isSinaq && timeLeft <= 30;

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
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono font-bold text-base flex-shrink-0 ${
                isWarning
                  ? "bg-red-50 text-red-500 timer-warning border border-red-200"
                  : "bg-slate-50 text-slate-900 border border-slate-200"
              }`}
            >
              <Clock size={15} />
              {formatTime(timeLeft)}
            </div>
          )}
        </div>

        {/* Question */}
        <div className="card-static mb-6">
          {/* Question image */}
          {question.imageUrl && (
            <div className="mb-4 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={question.imageUrl}
                alt={`Sual ${currentIndex + 1}`}
                className="w-full object-contain max-h-72"
              />
            </div>
          )}
          {/* Question text */}
          {question.text && (
            <p className="text-slate-900 text-xl font-medium leading-relaxed">
              {question.text}
            </p>
          )}
        </div>

        {/* Options */}
        <div className="space-y-3 mb-8">
          {question.options.map((option: any) => (
            <button
              key={option.label}
              onClick={() => handleAnswer(question.id, option.label)}
              className={`answer-option ${
                selectedAnswer === option.label ? "answer-option-selected" : ""
              }`}
            >
              <div className="flex items-center gap-4">
                <span
                  className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                    selectedAnswer === option.label
                      ? "bg-[#1f6f43] text-slate-900"
                      : "bg-[rgba(147,204,255,0.12)] text-[#1a7fe0]"
                  }`}
                >
                  {option.label}
                </span>
                <span className="text-slate-900">{option.text}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          {quiz.type === "TEST" ? (
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="btn-secondary flex items-center gap-2 disabled:opacity-30"
            >
              <ChevronLeft size={18} />
              Əvvəlki
            </button>
          ) : (
            <div />
          )}

          {currentIndex < questions.length - 1 ? (
            <button
              onClick={() => setCurrentIndex((prev) => prev + 1)}
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

        {/* Question navigation for TEST */}
        {quiz.type === "TEST" && (
          <div className="mt-6 flex flex-wrap gap-2">
            {questions.map((_: any, i: number) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                  i === currentIndex
                    ? "bg-[#1f6f43] text-slate-900"
                    : answers[questions[i].id]
                    ? "bg-violet-900/50 text-[#1a7fe0] border border-[rgba(147,204,255,0.4)]"
                    : "bg-slate-50 text-slate-500 border border-slate-200"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // RESULT PHASE
  if (phase === "result" && result) {
    const circumference = 2 * Math.PI * 54;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className="container mx-auto py-12 max-w-3xl">
        <h1 className="text-3xl font-bold text-slate-900 text-center mb-8">
          Nəticəniz
        </h1>

        {/* Score cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="card-static text-center">
            <CheckCircle size={28} className="text-green-400 mx-auto mb-2" />
            <p className="text-3xl font-bold text-green-400">{result.correct}</p>
            <p className="text-slate-500 text-sm">Düzgün</p>
          </div>
          <div className="card-static text-center">
            <XCircle size={28} className="text-red-400 mx-auto mb-2" />
            <p className="text-3xl font-bold text-red-400">{result.wrong}</p>
            <p className="text-slate-500 text-sm">Səhv</p>
          </div>
          <div className="card-static text-center">
            <MinusCircle size={28} className="text-slate-500 mx-auto mb-2" />
            <p className="text-3xl font-bold text-slate-500">{result.skipped}</p>
            <p className="text-slate-500 text-sm">Cavablanmamış</p>
          </div>
        </div>

        {/* Circular progress */}
        <div className="card-static flex flex-col items-center mb-8">
          <div className="relative w-36 h-36 mb-4">
            <svg className="circular-progress w-full h-full" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="#1b1b2f"
                strokeWidth="10"
              />
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke={percentage >= 60 ? "#22c55e" : percentage >= 40 ? "#f59e0b" : "#ef4444"}
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-slate-900">{percentage}%</span>
            </div>
          </div>
          <p className="text-slate-500">
            Ümumi xal:{" "}
            <span className="text-[#1a7fe0] font-bold text-xl">{result.score}</span>
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
                <div
                  key={r.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <span className="text-gray-300">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}{" "}
                    {r.user?.name}
                  </span>
                  <span className="text-[#1a7fe0] font-bold">{r.score} xal</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed answers toggle */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="btn-secondary w-full mb-4"
        >
          {showDetails ? "Detalları Gizlə" : "Detallı Bax"}
        </button>

        {showDetails && (
          <div className="space-y-4 mb-8">
            {questions.map((q: any, i: number) => {
              const answerDetail = result.answers?.find(
                (a: any) => a.questionId === q.id
              );
              const selected = answerDetail?.selected;
              const isCorrect = answerDetail?.isCorrect;
              const correctOpt = q.correctOption;

              return (
                <div key={q.id} className="card-static">
                  <div className="mb-3">
                    {q.imageUrl && (
                      <div className="mb-3 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={q.imageUrl}
                          alt={`Sual ${i + 1}`}
                          className="w-full object-contain max-h-56"
                        />
                      </div>
                    )}
                    {q.text ? (
                      <p className="text-slate-900 font-medium">
                        {i + 1}. {q.text}
                      </p>
                    ) : (
                      <p className="text-slate-500 text-sm font-medium">{i + 1}. (şəkilli sual)</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    {q.options.map((opt: any) => {
                      let cls = "p-3 rounded-lg text-sm flex items-center gap-3 ";
                      if (opt.label === correctOpt) {
                        cls += "bg-green-900/20 border border-green-700/40 text-green-300";
                      } else if (opt.label === selected && !isCorrect) {
                        cls += "bg-red-900/20 border border-red-700/40 text-red-300";
                      } else {
                        cls += "bg-slate-50 border border-violet-900/20 text-slate-500";
                      }

                      return (
                        <div key={opt.label} className={cls}>
                          <span className="font-bold w-6">{opt.label}.</span>
                          <span>{opt.text}</span>
                          {opt.label === correctOpt && (
                            <CheckCircle size={14} className="ml-auto text-green-400" />
                          )}
                          {opt.label === selected && !isCorrect && (
                            <XCircle size={14} className="ml-auto text-red-400" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {!selected && (
                    <p className="text-slate-400 text-xs mt-2">⏭️ Cavablanmamış</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-4">
          <button
            onClick={() => {
              setPhase("start");
              setAnswers({});
              setCurrentIndex(0);
              setResult(null);
              setShowDetails(false);
            }}
            className="flex-1 btn-secondary flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} />
            Yenidən cəhd et
          </button>
          <Link
            href="/quizler"
            className="flex-1 btn-primary flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} />
            Quizlərə qayıt
          </Link>
        </div>
      </div>
    );
  }

  return null;
}

