"use client";

import { useState } from "react";
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !email.includes("@")) {
      setError("Düzgün email daxil edin");
      return;
    }
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/forgot-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setSent(true);
      } else {
        setError(data.error || "Xəta baş verdi");
      }
    } catch {
      setError("Xəta baş verdi. Zəhmət olmasa yenidən cəhd edin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">

        <Link href="/auth/giris"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-6">
          <ArrowLeft size={15} /> Girişə qayıt
        </Link>

        {sent ? (
          /* Göndərildi vəziyyəti */
          <div className="flex flex-col items-center text-center py-4 gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-green-50">
              <CheckCircle2 size={36} className="text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Email göndərildi!</h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              <span className="font-medium text-slate-700">{email}</span> ünvanına parol sıfırlama linki göndərildi.
              Link <strong>1 saat</strong> ərzində etibarlıdır.
            </p>
            <p className="text-xs text-slate-400">Emaili görmürsünüzsə spam/zibil qutusunu yoxlayın.</p>
            <button
              onClick={() => { setSent(false); setEmail(""); }}
              className="text-sm text-[#1a7fe0] hover:underline mt-1">
              Başqa email ilə cəhd et
            </button>
          </div>
        ) : (
          /* Form */
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(147,204,255,0.15)" }}>
                <Mail size={22} className="text-[#1a7fe0]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Parolu Unutmusunuz?</h1>
                <p className="text-sm text-slate-500">Emailinizə sıfırlama linki göndərəcəyik</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email ünvanı</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="input-field pl-9"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2">
                {loading
                  ? <><Loader2 size={15} className="animate-spin" /> Göndərilir...</>
                  : "Sıfırlama Linki Göndər"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
