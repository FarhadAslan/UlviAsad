"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/ui/toast-1";
import { AuthCard, AuthField } from "@/components/ui/sign-in-card-2";

export default function LoginPage() {
  const router = useRouter();
  const { success, error } = useToast();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) { error(result.error); }
      else { success("Uğurla daxil oldunuz!"); router.push("/"); router.refresh(); }
    } catch { error("Xəta baş verdi"); }
    finally { setLoading(false); }
  };

  return (
    <AuthCard mode="login" onSubmit={handleSubmit} loading={loading}
      title="Xoş Gəldiniz" subtitle="Hesabınıza daxil olun">

      <AuthField icon={Mail} type="email" name="email" value={email}
        onChange={(e) => setEmail(e.target.value)} placeholder="Email ünvanı" required />

      <AuthField icon={Lock} type={showPw ? "text" : "password"} name="password"
        value={password} onChange={(e) => setPassword(e.target.value)}
        placeholder="Şifrə" required
        rightElement={
          <button type="button" onClick={() => setShowPw(!showPw)}
            className="transition-colors duration-200"
            style={{ color: "rgba(147,204,255,0.4)" }}>
            {showPw ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>
        } />

      {/* Footer */}
      <p className="text-center text-xs pt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
        Hesabınız yoxdur?{" "}
        <Link href="/auth/qeydiyyat"
          className="font-semibold transition-colors duration-200"
          style={{ color: "rgb(147,204,255)" }}>
          Qeydiyyat
        </Link>
      </p>
    </AuthCard>
  );
}
