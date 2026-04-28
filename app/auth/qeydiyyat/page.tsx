"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/ui/toast-1";
import { signIn } from "next-auth/react";
import { AuthCard, AuthField } from "@/components/ui/sign-in-card-2";

export default function RegisterPage() {
  const router = useRouter();
  const { success, error } = useToast();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [showPw,  setShowPw]  = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { error("Şifrələr uyğun gəlmir"); return; }
    if (form.password.length < 6)               { error("Şifrə ən az 6 simvol olmalıdır"); return; }
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) { error(data.error || "Xəta baş verdi"); return; }
      success("Qeydiyyat uğurla tamamlandı!");
      const result = await signIn("credentials", { email: form.email, password: form.password, redirect: false });
      if (result?.ok) { router.push("/"); router.refresh(); }
      else router.push("/auth/giris");
    } catch { error("Xəta baş verdi"); }
    finally { setLoading(false); }
  };

  return (
    <AuthCard mode="register" onSubmit={handleSubmit} loading={loading}
      title="Qeydiyyat" subtitle="Yeni hesab yaradın">

      <AuthField icon={User} type="text" name="name" value={form.name}
        onChange={set("name")} placeholder="Ad Soyad" required />

      <AuthField icon={Mail} type="email" name="email" value={form.email}
        onChange={set("email")} placeholder="Email ünvanı" required />

      <AuthField icon={Lock} type={showPw ? "text" : "password"} name="password"
        value={form.password} onChange={set("password")}
        placeholder="Şifrə (min. 6 simvol)" required
        rightElement={
          <button type="button" onClick={() => setShowPw(!showPw)}
            className="transition-colors duration-200"
            style={{ color: "rgba(147,204,255,0.4)" }}>
            {showPw ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>
        } />

      <AuthField icon={Lock} type="password" name="confirmPassword"
        value={form.confirmPassword} onChange={set("confirmPassword")}
        placeholder="Şifrəni təsdiqlə" required />

      {/* Info */}
      <p className="text-xs rounded-xl px-3 py-2.5"
        style={{ background: "rgba(31,111,67,0.12)", border: "1px solid rgba(46,139,87,0.2)", color: "rgba(147,204,255,0.5)" }}>
        ℹ️ Default rol:{" "}
        <span className="font-semibold" style={{ color: "rgb(147,204,255)" }}>İstifadəçi</span>.
        Tələbə statusu üçün admin ilə əlaqə saxlayın.
      </p>

      {/* Footer */}
      <p className="text-center text-xs pt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
        Artıq hesabınız var?{" "}
        <Link href="/auth/giris"
          className="font-semibold transition-colors duration-200"
          style={{ color: "rgb(147,204,255)" }}>
          Daxil olun
        </Link>
      </p>
    </AuthCard>
  );
}
