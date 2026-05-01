"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, User, LayoutDashboard, BookOpen, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";

export default function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router   = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    // Session tamamilə silinsin, sonra yönləndir
    router.push("/");
    router.refresh();
  };

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrolled(window.scrollY > 20);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (p: string) => pathname === p;

  const navLinks = [
    { href: "/",            label: "Ana Səhifə" },
    { href: "/quizler",     label: "Quizlər" },
    { href: "/materiallar", label: "Materiallar" },
    { href: "/meqaleler",   label: "Məqalələr" },
  ];

  return (
    <header
      className="sticky top-0 z-50 transition-all duration-300"
      style={{
        background: scrolled
          ? "rgba(238,249,255,0.85)"
          : "rgba(223,244,255,0.6)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: scrolled
          ? "1px solid rgba(147,204,255,0.3)"
          : "1px solid rgba(147,204,255,0.15)",
        boxShadow: scrolled
          ? "0 4px 24px rgba(147,204,255,0.15)"
          : "none",
      }}
    >
      <div className="container mx-auto">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: "linear-gradient(135deg,#1f6f43,#2e8b57)" }}>
              <BookOpen size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900 tracking-tight">
              Ulvi Asad
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label }) => (
              <Link key={href} href={href}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive(href)
                    ? "text-[#1a7fe0] font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                style={isActive(href)
                  ? { background: "rgba(147,204,255,0.18)" }
                  : { }
                }
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Auth */}
          <div className="hidden md:flex items-center gap-2">
            {session ? (
              <>
                {(session.user as any)?.role === "ADMIN" && (
                  <Link href="/admin"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{ background: "rgba(147,204,255,0.15)", color: "#1a7fe0" }}>
                    <LayoutDashboard size={15} />
                    <span>Admin</span>
                  </Link>
                )}
                <Link href="/profil"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 transition-all"
                  style={{ background: "rgba(255,255,255,0.6)" }}>
                  <User size={15} />
                  <span className="max-w-[100px] truncate">{session.user?.name}</span>
                </Link>
                <button onClick={handleSignOut}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-all">
                  <LogOut size={15} />
                  <span>Çıxış</span>
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/giris" className="btn-ghost text-sm">Giriş</Link>
                <Link href="/auth/qeydiyyat" className="btn-primary text-sm px-4 py-2">Qeydiyyat</Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button className="md:hidden p-2 rounded-xl text-slate-600 transition-all"
            style={{ background: "rgba(147,204,255,0.12)" }}
            onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t py-3 space-y-1"
            style={{ borderColor: "rgba(147,204,255,0.2)" }}>
            {navLinks.map(({ href, label }) => (
              <Link key={href} href={href}
                onClick={() => setMobileOpen(false)}
                className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive(href) ? "text-[#1a7fe0] font-semibold" : "text-slate-600"
                }`}
                style={isActive(href) ? { background: "rgba(147,204,255,0.15)" } : {}}>
                {label}
              </Link>
            ))}
            <div className="pt-2 border-t flex flex-col gap-1"
              style={{ borderColor: "rgba(147,204,255,0.15)" }}>
              {session ? (
                <>
                  {(session.user as any)?.role === "ADMIN" && (
                    <Link href="/admin" onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all"
                      style={{ color: "#1a7fe0", background: "rgba(147,204,255,0.1)" }}>
                      <LayoutDashboard size={15} /> Admin Panel
                    </Link>
                  )}
                  <Link href="/profil" onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600">
                    <User size={15} /> {session.user?.name}
                  </Link>
                  <button onClick={handleSignOut}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 text-left">
                    <LogOut size={15} /> Çıxış
                  </button>
                </>
              ) : (
                <>
                  <Link href="/auth/giris" onClick={() => setMobileOpen(false)}
                    className="px-4 py-2.5 text-sm text-slate-600">Giriş</Link>
                  <Link href="/auth/qeydiyyat" onClick={() => setMobileOpen(false)}
                    className="btn-primary mx-4 text-center text-sm">Qeydiyyat</Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
