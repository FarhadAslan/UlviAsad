"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, Phone, MapPin, Facebook, Instagram, Youtube, BookOpen } from "lucide-react";

const DEFAULT = {
  contactEmail:   "info@muellim.az",
  contactPhone:   "+994 50 000 00 00",
  contactAddress: "Bakı, Azərbaycan",
  facebook:       "",
  instagram:      "",
  youtube:        "",
};

// Module-level cache — bütün Footer instance-ları paylaşır
let cachedSettings: any = null;

export default function Footer() {
  const [s, setS] = useState(cachedSettings || DEFAULT);

  useEffect(() => {
    // Hər dəfə fetch et — settings dəyişə bilər
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        const result = {
          contactEmail:   d.contactEmail   || DEFAULT.contactEmail,
          contactPhone:   d.contactPhone   || DEFAULT.contactPhone,
          contactAddress: d.contactAddress || DEFAULT.contactAddress,
          facebook:       d.facebook       || "",
          instagram:      d.instagram      || "",
          youtube:        d.youtube        || "",
        };
        cachedSettings = result;
        setS(result);
      })
      .catch(() => {});
  }, []);

  const socials = [
    { href: s.facebook,  Icon: Facebook,  color: "#1877f2" },
    { href: s.instagram, Icon: Instagram, color: "#e1306c" },
    { href: s.youtube,   Icon: Youtube,   color: "#ff0000" },
  ];

  return (
    <footer className="mt-20 relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg,rgba(191,231,255,0.3) 0%,rgba(147,204,255,0.15) 100%)",
        borderTop: "1px solid rgba(147,204,255,0.25)",
      }}>

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse,rgba(147,204,255,0.12) 0%,transparent 70%)" }} />

      <div className="container mx-auto py-14 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">

          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
                style={{ background: "linear-gradient(135deg,#1f6f43,#2e8b57)" }}>
                <BookOpen size={18} className="text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900">Ulvi Asad</span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
              Müəllimlər və tələbələr üçün interaktiv təhsil platforması. Quiz, test,
              material və məqalələrlə öyrənməni daha effektiv edin.
            </p>
            {/* Social icons — yalnız link daxil edilənlər göstərilir */}
            <div className="flex items-center gap-2 mt-5">
              {socials
                .filter(({ href }) => href)
                .map(({ href, Icon, color }, i) => (
                  <a key={i} href={href} target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:-translate-y-0.5"
                    style={{
                      background: `${color}12`,
                      border: `1px solid ${color}30`,
                      color,
                    }}>
                    <Icon size={16} />
                  </a>
                ))}
              {socials.every(({ href }) => !href) && (
                <span className="text-xs text-slate-400">—</span>
              )}
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Keçidlər</h4>
            <ul className="space-y-2.5">
              {[
                { href: "/",               label: "Ana Səhifə" },
                { href: "/quizler",        label: "Quizlər" },
                { href: "/materiallar",    label: "Materiallar" },
                { href: "/meqaleler",      label: "Məqalələr" },
                { href: "/auth/giris",     label: "Giriş" },
                { href: "/auth/qeydiyyat", label: "Qeydiyyat" },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="footer-link">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Əlaqə</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2.5 text-sm text-slate-500">
                <Mail size={15} className="text-[#1a7fe0] flex-shrink-0" />
                {s.contactEmail}
              </li>
              <li className="flex items-center gap-2.5 text-sm text-slate-500">
                <Phone size={15} className="text-[#1a7fe0] flex-shrink-0" />
                {s.contactPhone}
              </li>
              <li className="flex items-center gap-2.5 text-sm text-slate-500">
                <MapPin size={15} className="text-[#1a7fe0] flex-shrink-0" />
                {s.contactAddress}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3"
          style={{ borderTop: "1px solid rgba(147,204,255,0.2)" }}>
          <p className="text-sm text-slate-400">
            © {new Date().getFullYear()} Ulvi Asad. Bütün hüquqlar qorunur.
          </p>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-slate-400">Bütün sistemlər aktiv</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
