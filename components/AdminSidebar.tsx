"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard, Users, BookOpen, FileText,
  Newspaper, Home, BookMarked, Settings,
  ChevronLeft, ChevronRight, Menu, X, MessageSquare, Tag,
} from "lucide-react";

const adminNavItems = [
  { href: "/admin",               label: "Dashboard",      icon: LayoutDashboard },
  { href: "/admin/istifadeciler", label: "İstifadəçilər",  icon: Users },
  { href: "/admin/quizler",       label: "Quizlər",        icon: BookOpen },
  { href: "/admin/materiallar",   label: "Materiallar",    icon: FileText },
  { href: "/admin/meqaleler",     label: "Məqalələr",      icon: Newspaper },
  { href: "/admin/kateqoriyalar", label: "Kateqoriyalar",  icon: Tag },
  { href: "/admin/sorqular",      label: "Sorğular",       icon: MessageSquare },
  { href: "/admin/parametrler",   label: "Parametrlər",    icon: Settings },
];

// Müəllim yalnız öz tələbələrini və quizlərini idarə edə bilər
const teacherNavItems = [
  { href: "/admin",               label: "Dashboard",     icon: LayoutDashboard },
  { href: "/admin/istifadeciler", label: "Tələbələrim",   icon: Users },
  { href: "/admin/quizler",       label: "Quizlərim",     icon: BookOpen },
  { href: "/admin/sorqular",      label: "Sorğularım",    icon: MessageSquare },
];

const sidebarStyle = {
  background: "linear-gradient(180deg,rgba(223,244,255,0.98) 0%,rgba(238,249,255,0.99) 100%)",
  borderRight: "1px solid rgba(147,204,255,0.25)",
};

function NavLinks({
  pathname,
  role,
  onClick,
}: {
  pathname: string;
  role: string;
  onClick?: () => void;
}) {
  const navItems = role === "TEACHER" ? teacherNavItems : adminNavItems;
  return (
    <>
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                active
                  ? "text-[#1a7fe0] font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/70"
              }`}
              style={
                active
                  ? {
                      background: "rgba(147,204,255,0.15)",
                      borderLeft: "3px solid rgb(147,204,255)",
                    }
                  : {}
              }
            >
              <Icon size={17} className="flex-shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-2 border-t border-slate-100">
        <Link
          href="/"
          onClick={onClick}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:text-slate-900 hover:bg-white/70 transition-all"
        >
          <Home size={16} className="flex-shrink-0" />
          <span>Sayta Qayıt</span>
        </Link>
      </div>
    </>
  );
}

function Logo({ role }: { role: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "linear-gradient(135deg,#1f6f43,#2e8b57)" }}
      >
        <BookMarked size={15} className="text-white" />
      </div>
      <div>
        <p className="font-bold text-sm text-slate-900 leading-tight">Ulvi Asad</p>
        <p className="text-xs text-[#1a7fe0] font-medium">
          {role === "TEACHER" ? "Müəllim Paneli" : "Admin Panel"}
        </p>
      </div>
    </div>
  );
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role;

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Session yüklənənə qədər navItems-i müəyyən etmə
  const navItems = role === "TEACHER" ? teacherNavItems : adminNavItems;

  // Route dəyişdikdə mobil menyu bağlansın
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Session hələ yüklənir — skeleton göstər, heç bir nav render etmə
  if (status === "loading" || !role) {
    return (
      <>
        {/* Mobile hamburger skeleton */}
        <div className="md:hidden fixed top-3 left-3 z-50 w-10 h-10 rounded-xl"
          style={{ background: "linear-gradient(135deg,#1f6f43,#2e8b57)", opacity: 0.5 }} />
        {/* Desktop sidebar skeleton */}
        <aside className="hidden md:flex flex-col flex-shrink-0 h-screen sticky top-0 w-64"
          style={sidebarStyle}>
          <div className="p-4 border-b border-slate-100">
            <div className="h-8 rounded-xl animate-pulse" style={{ background: "rgba(147,204,255,0.15)" }} />
          </div>
          <div className="p-2 space-y-1 flex-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 rounded-xl animate-pulse"
                style={{ background: "rgba(147,204,255,0.08)" }} />
            ))}
          </div>
        </aside>
      </>
    );
  }

  return (
    <>
      {/* ── Mobile hamburger ─────────────────────────── */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
        style={{ background: "linear-gradient(135deg,#1f6f43,#2e8b57)" }}
        aria-label="Menyu aç"
      >
        <Menu size={18} className="text-white" />
      </button>

      {/* ── Mobile drawer ────────────────────────────── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <div
            className="relative z-10 flex flex-col w-64 h-full"
            style={sidebarStyle}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <Logo role={role} />
              <button
                onClick={() => setMobileOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
              >
                <X size={16} />
              </button>
            </div>
            <NavLinks
              pathname={pathname}
              role={role}
              onClick={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ── Desktop sidebar ──────────────────────────── */}
      <aside
        className={`hidden md:flex flex-col flex-shrink-0 h-screen sticky top-0 transition-all duration-300 ${
          collapsed ? "w-16" : "w-64"
        }`}
        style={sidebarStyle}
      >
        {/* Header */}
        <div
          className={`flex items-center border-b border-slate-100 ${
            collapsed ? "justify-center p-3" : "justify-between p-4"
          }`}
        >
          {!collapsed && <Logo role={role} />}
          {collapsed && (
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#1f6f43,#2e8b57)" }}
            >
              <BookMarked size={15} className="text-white" />
            </div>
          )}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all ${
              collapsed ? "mt-2" : ""
            }`}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Nav — collapsed-da yalnız ikonlar */}
        {collapsed ? (
          <>
            <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active =
                  href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    title={label}
                    className={`flex items-center justify-center p-2.5 rounded-xl transition-all duration-150 ${
                      active
                        ? "text-[#1a7fe0]"
                        : "text-slate-500 hover:text-slate-900 hover:bg-white/70"
                    }`}
                    style={
                      active ? { background: "rgba(147,204,255,0.15)" } : {}
                    }
                  >
                    <Icon size={18} />
                  </Link>
                );
              })}
            </nav>
            <div className="p-2 border-t border-slate-100">
              <Link
                href="/"
                title="Sayta Qayıt"
                className="flex items-center justify-center p-2.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/70 transition-all"
              >
                <Home size={17} />
              </Link>
            </div>
          </>
        ) : (
          <NavLinks pathname={pathname} role={role} />
        )}
      </aside>
    </>
  );
}
