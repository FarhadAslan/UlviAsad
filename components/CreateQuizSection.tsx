"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { Sparkles, FileText, Bot, ChevronRight, Upload, Zap } from "lucide-react";
import { useState } from "react";

const STEPS = [
  {
    icon: Upload,
    color: "#4facfe",
    bg: "rgba(79,172,254,0.12)",
    title: "PDF Yüklə",
    desc: "Öyrənmək istədiyin materialı PDF formatında yüklə",
  },
  {
    icon: Bot,
    color: "#a855f7",
    bg: "rgba(168,85,247,0.12)",
    title: "Bot Yarat",
    desc: "PDF-dən AI botu yaradılır — bilik bazası hazır olur",
  },
  {
    icon: Zap,
    color: "#1f6f43",
    bg: "rgba(31,111,67,0.12)",
    title: "Quiz Generasiya Et",
    desc: "AI saniyələr içində sənin üçün suallar hazırlayır",
  },
];

// Şəkil yüklənmədikdə göstərilən fallback
function ImageFallback() {
  return (
    <div
      className="w-full aspect-[3/2] rounded-3xl flex items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0d3d26 0%, #1a7fe0 50%, #0d3d26 100%)" }}
    >
      {/* Şəbəkə effekti */}
      <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#43e97b" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      {/* PDF ikonu */}
      <div className="relative flex items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <div
            className="w-20 h-24 rounded-xl flex flex-col items-center justify-center shadow-2xl"
            style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(67,233,123,0.4)", backdropFilter: "blur(8px)" }}
          >
            <FileText size={28} className="text-[#43e97b] mb-1" />
            <span className="text-[#43e97b] text-xs font-bold">PDF</span>
          </div>
        </div>
        {/* Ok */}
        <div className="flex items-center gap-1">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full" style={{ background: "#43e97b", opacity: 0.4 + i * 0.3 }} />
          ))}
        </div>
        {/* Quiz ikonu */}
        <div
          className="w-24 h-28 rounded-xl p-3 shadow-2xl"
          style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(79,172,254,0.4)", backdropFilter: "blur(8px)" }}
        >
          <p className="text-[#4facfe] text-[9px] font-bold mb-2">QUIZ</p>
          {[1,2,3,4].map(i => (
            <div key={i} className="flex items-center gap-1.5 mb-1.5">
              <div className="w-3 h-3 rounded-full border border-[#4facfe]/60 flex-shrink-0" />
              <div className="h-1.5 rounded-full flex-1" style={{ background: "rgba(79,172,254,0.3)" }} />
            </div>
          ))}
        </div>
      </div>
      {/* Sparkles */}
      <Sparkles size={20} className="absolute top-6 right-8 text-[#43e97b] opacity-60 animate-pulse" />
      <Sparkles size={14} className="absolute bottom-8 left-10 text-[#4facfe] opacity-50 animate-pulse" style={{ animationDelay: "0.5s" }} />
    </div>
  );
}

export default function CreateQuizSection() {
  const { status } = useSession();
  const isLoggedIn = status === "authenticated";
  const [imgError, setImgError] = useState(false);

  return (
    <section
      className="py-16 sm:py-20 relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #f0fff8 0%, #e8f5ff 50%, #f0f8ff 100%)" }}
    >
      {/* Arxa fon dekorları */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 60% 50%, rgba(31,111,67,0.07) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute -top-20 -left-20 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(79,172,254,0.08) 0%, transparent 70%)" }}
      />

      <div className="container mx-auto relative z-10">
        {/* İki sütunlu layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* ── Sol: Şəkil ── */}
          <div className="relative order-1 lg:order-1">
            {/* Parıltı effekti arxada */}
            <div
              className="absolute inset-0 rounded-3xl blur-3xl opacity-25 pointer-events-none"
              style={{ background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 50%, #4facfe 100%)" }}
            />
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/60">
              {imgError ? (
                <ImageFallback />
              ) : (
                <Image
                  src="/quiz-banner.jpg"
                  alt="PDF-dən AI ilə Quiz Yarat"
                  width={600}
                  height={400}
                  className="w-full h-auto object-cover"
                  priority
                  onError={() => setImgError(true)}
                />
              )}
              {/* Üzərindəki overlay badge */}
              <div
                className="absolute bottom-4 left-4 right-4 rounded-2xl px-4 py-3 flex items-center gap-3"
                style={{
                  background: "rgba(255,255,255,0.92)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.8)",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #1f6f43, #43e97b)" }}
                >
                  <Sparkles size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800">AI ilə Quiz Generasiyası</p>
                  <p className="text-xs text-slate-500 truncate">PDF → Bot → Quiz — saniyələr içində</p>
                </div>
                <div className="ml-auto flex-shrink-0">
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
                    style={{ background: "linear-gradient(135deg, #1f6f43, #2d9d5f)" }}
                  >
                    Yeni
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Sağ: Mətn + addımlar ── */}
          <div className="order-2 lg:order-2">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 mb-4">
              <span
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                style={{
                  background: "rgba(31,111,67,0.1)",
                  color: "#1f6f43",
                  border: "1px solid rgba(31,111,67,0.2)",
                }}
              >
                <Sparkles size={12} />
                Süni İntellekt
              </span>
            </div>

            {/* Başlıq */}
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4 leading-tight tracking-tight">
              Öz Quizini{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #1f6f43 0%, #4facfe 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                AI ilə Yarat
              </span>
            </h2>

            <p className="text-slate-500 text-base sm:text-lg leading-relaxed mb-8">
              PDF materialını yüklə, AI botu yarat və saniyələr içində
              özünə məxsus quiz sualları generasiya et. Səhv cavabladığın
              suallar növbəti quizdə avtomatik təkrarlanır.
            </p>

            {/* Addımlar */}
            <div className="space-y-4 mb-8">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={i} className="flex items-start gap-4">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
                        style={{ background: step.bg, color: step.color, border: `1px solid ${step.color}30` }}
                      >
                        <Icon size={16} />
                      </div>
                      {i < STEPS.length - 1 && (
                        <div
                          className="w-px mt-1"
                          style={{ background: `linear-gradient(to bottom, ${step.color}40, transparent)`, height: 20 }}
                        />
                      )}
                    </div>
                    <div className="pb-2 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm">{step.title}</p>
                      <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CTA düymələri */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={isLoggedIn ? "/menim-quizlerim" : "/auth/qeydiyyat"}
                className="relative flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105 overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, #a855f7 0%, #6366f1 50%, #1f6f43 100%)",
                  boxShadow: "0 4px 20px rgba(99,102,241,0.35)",
                }}
              >
                <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 -skew-x-12 translate-x-[-100%] hover:translate-x-[200%] transition-transform duration-700" />
                <Sparkles size={15} className="animate-pulse" />
                {isLoggedIn ? "Quiz Yarat" : "İndi Başla"}
              </Link>
              <Link
                href="/quizler"
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold border transition-all hover:bg-slate-50"
                style={{ borderColor: "rgba(31,111,67,0.3)", color: "#1f6f43" }}
              >
                <FileText size={15} />
                Quizlərə Bax
                <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
