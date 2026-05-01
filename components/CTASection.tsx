"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export default function CTASection() {
  const { status } = useSession();
  const isLoggedIn = status === "authenticated";

  return (
    <section className="py-20 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg,rgba(191,231,255,0.4) 0%,rgba(232,245,238,0.6) 100%)" }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% 50%,rgba(147,204,255,0.15) 0%,transparent 70%)" }} />
      <div className="container mx-auto text-center relative z-10">
        <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
          Hazırsınız? İndi Başlayın!
        </h2>
        <p className="text-slate-500 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
          {isLoggedIn
            ? "Quizlər işləyin, materiallar yükləyin və biliklərinizi artırın."
            : "Qeydiyyatdan keçin, quizlər işləyin, materiallar yükləyin və biliklərinizi artırın."}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {isLoggedIn ? (
            <Link href="/materiallar" className="btn-primary px-10 py-3.5 text-base">
              Materiallara Bax
            </Link>
          ) : (
            <Link href="/auth/qeydiyyat" className="btn-primary px-10 py-3.5 text-base">
              Pulsuz Qeydiyyat
            </Link>
          )}
          <Link href="/quizler" className="btn-secondary px-10 py-3.5 text-base">
            Quizlərə Bax
          </Link>
        </div>
      </div>
    </section>
  );
}
