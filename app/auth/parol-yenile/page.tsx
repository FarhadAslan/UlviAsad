"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { KeyRound, Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const token        = searchParams.get("token") ?? "";

  const [status,       setStatus]       = useState<"checking" | "valid" | "invalid" | "success">("checking");
  const [password,     setPassword]     = useState("");
  const [confirm,      setConfirm]      = useState("");
  const [showPass,     setShowPass]     = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [errorMsg,     setErrorMsg]     = useState("");

  // Token-i yoxla
  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }
    fetch(`/api/auth/reset-password?token=${token}`)
      .then((r) => r.json())
      .then((d) => setStatus(d.valid ? "valid" : "invalid"))
      .catch(() => setStatus("invalid"));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (password.length < 6) { setErrorMsg("Parol ən az 6 simvol olmalıdır"); return; }
    if (password !== confirm) { setErrorMsg("Parollar uyğun gəlmir"); return; }

    setSaving(true);
    try {
      const res  = await fetch("/api/auth/reset-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setTimeout(() => router.push("/auth/giris"), 3000);
      } else {
        setErrorMsg(data.error || "Xəta baş verdi");
      }
    } catch {
      setErrorMsg("Xəta baş verdi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        {/* Checking */}
        {status === "checking" && (
          <div className="flex flex-col items-center py-8 gap-4">
            <Loader2 size={36} className="text-[#1a7fe0] animate-spin" />
            <p className="text-slate-500">Link yoxlanılır...</p>
          </div>
        )}

        {/* Invalid */}
        {status === "invalid" && (
          <div className="flex flex-col items-center py-8 gap-4 text-center">
            <XCircle size={48} className="text-red-400" />
            <h2 className="text-xl font-bold text-slate-900">Link etibarsızdır</h2>
            <p className="text-slate-500 text-sm">
              Bu parol sıfırlama linki etibarsız və ya müddəti bitib. Yenidən tələb göndərin.
            </p>
            <Link href="/auth/giris" className="btn-primary mt-2">Girişə qayıt</Link>
          </div>
        )}

        {/* Success */}
        {status === "success" && (
          <div className="flex flex-col items-center py-8 gap-4 text-center">
            <CheckCircle2 size={48} className="text-green-500" />
            <h2 className="text-xl font-bold text-slate-900">Parol yeniləndi!</h2>
            <p className="text-slate-500 text-sm">
              Parolunuz uğurla dəyişdirildi. Giriş səhifəsinə yönləndirilirsiniz...
            </p>
            <Link href="/auth/giris" className="btn-primary mt-2">İndi Daxil Ol</Link>
          </div>
        )}

        {/* Form */}
        {status === "valid" && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(147,204,255,0.15)" }}>
                <KeyRound size={22} className="text-[#1a7fe0]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Yeni Parol Təyin Et</h1>
                <p className="text-sm text-slate-500">Ən az 6 simvol daxil edin</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Yeni Parol</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ən az 6 simvol"
                    className="input-field pr-10"
                    required
                  />
                  <button type="button" onClick={() => setShowPass((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Parolu Təsdiqlə</label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Parolu təkrar daxil edin"
                    className="input-field pr-10"
                    required
                  />
                  <button type="button" onClick={() => setShowConfirm((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {confirm && password !== confirm && (
                  <p className="text-xs text-red-500 mt-1">Parollar uyğun gəlmir</p>
                )}
                {confirm && password === confirm && confirm.length >= 6 && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Parollar uyğundur
                  </p>
                )}
              </div>

              {errorMsg && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
                  {errorMsg}
                </div>
              )}

              <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Yenilənir...</>
                  : <><KeyRound size={15} /> Parolu Yenilə</>}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
