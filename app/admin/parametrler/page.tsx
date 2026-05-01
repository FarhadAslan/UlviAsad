"use client";

import { useState, useEffect } from "react";
import {
  Save, RotateCcw, Eye,
  Globe, Mail, Phone, MapPin,
  Facebook, Instagram, Youtube,
  Layout, Contact, Share2,
} from "lucide-react";
import { useToast } from "@/components/ui/toast-1";

const DEFAULTS = {
  heroTitle:      "Biliklərinizi Test Edin",
  heroBadge:      "Ulvi Asad — İnteraktiv Təhsil Platforması",
  heroSubtitle:   "Qanunvericilik, məntiq, Azərbaycan dili, informatika və DQ Qəbul sahələrində quiz və testlərlə özünüzü sınayın. Materiallar yükləyin, məqalələr oxuyun.",
  contactEmail:   "info@muellim.az",
  contactPhone:   "+994 50 000 00 00",
  contactAddress: "Bakı, Azərbaycan",
  facebook:       "",
  instagram:      "",
  youtube:        "",
};

type Tab = "hero" | "contact" | "social";

const TABS: { id: Tab; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "hero",    label: "Hero Bölməsi",       icon: Layout,  desc: "Ana səhifənin yuxarı hissəsi" },
  { id: "contact", label: "Əlaqə Məlumatları",  icon: Contact, desc: "Footer əlaqə məlumatları" },
  { id: "social",  label: "Sosial Media",        icon: Share2,  desc: "Sosial media hesabları" },
];

export default function AdminSettingsPage() {
  const { success, error } = useToast();
  const [form,    setForm]    = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [tab,     setTab]     = useState<Tab>("hero");

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const res  = await fetch("/api/settings");
      const data = await res.json();
      setForm({
        heroTitle:      data.heroTitle      || DEFAULTS.heroTitle,
        heroBadge:      data.heroBadge      || DEFAULTS.heroBadge,
        heroSubtitle:   data.heroSubtitle   || DEFAULTS.heroSubtitle,
        contactEmail:   data.contactEmail   || DEFAULTS.contactEmail,
        contactPhone:   data.contactPhone   || DEFAULTS.contactPhone,
        contactAddress: data.contactAddress || DEFAULTS.contactAddress,
        facebook:       data.facebook       || "",
        instagram:      data.instagram      || "",
        youtube:        data.youtube        || "",
      });
    } catch { error("Parametrlər yüklənmədi"); }
    finally   { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      if (res.ok) {
        success("Parametrlər yadda saxlandı!");
        // Formu yenidən yüklə ki, DB-dəki dəyərləri göstərsin
        await fetchSettings();
      } else {
        error("Xəta baş verdi");
      }
    } catch { error("Xəta baş verdi"); }
    finally   { setSaving(false); }
  };

  const set = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const labelCls = "block text-sm font-semibold text-slate-700 mb-1.5";
  const hintCls  = "text-xs text-slate-400 mt-1.5";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-[rgb(147,204,255)] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">

      {/* ── Page header ─────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Parametrlər</h1>
          <p className="text-slate-500 text-sm mt-1">Saytın məzmununu idarə edin</p>
        </div>
        <a href="/" target="_blank"
          className="btn-secondary flex items-center gap-2 text-sm mt-1">
          <Eye size={14} /> Sayta bax
        </a>
      </div>

      {/* ── Tab navigation ──────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {TABS.map(({ id, label, icon: Icon, desc }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex flex-col items-start gap-1 p-4 rounded-2xl border text-left transition-all duration-200 ${
              tab === id
                ? "border-[rgb(147,204,255)] shadow-[0_0_0_3px_rgba(147,204,255,0.15)]"
                : "border-slate-200 hover:border-[rgba(147,204,255,0.4)] hover:bg-slate-50"
            }`}
            style={tab === id ? { background: "rgba(147,204,255,0.06)" } : { background: "#fff" }}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              tab === id ? "bg-[rgba(147,204,255,0.15)]" : "bg-slate-100"
            }`}>
              <Icon size={16} className={tab === id ? "text-[#1a7fe0]" : "text-slate-500"} />
            </div>
            <span className={`text-sm font-semibold leading-tight ${
              tab === id ? "text-[#1a7fe0]" : "text-slate-700"
            }`}>{label}</span>
            <span className="text-xs text-slate-400 leading-tight">{desc}</span>
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────── */}
      <div className="card-static">

        {/* HERO */}
        {tab === "hero" && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-[rgba(147,204,255,0.12)] flex items-center justify-center">
                <Layout size={15} className="text-[#1a7fe0]" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">Hero Bölməsi</p>
                <p className="text-xs text-slate-400">Ana səhifənin yuxarı hissəsindəki mətnlər</p>
              </div>
            </div>

            <div>
              <label className={labelCls}>Badge mətni</label>
              <input type="text" value={form.heroBadge} onChange={set("heroBadge")}
                className="input-field" placeholder="Ulvi Asad — İnteraktiv Təhsil Platforması" />
              <p className={hintCls}>🟢 Yaşıl nöqtənin yanındakı kiçik yazı</p>
            </div>

            <div>
              <label className={labelCls}>Əsas başlıq</label>
              <input type="text" value={form.heroTitle} onChange={set("heroTitle")}
                className="input-field" placeholder="Biliklərinizi Test Edin" />
              <p className={hintCls}>Böyük animasiyalı başlıq mətni</p>
            </div>

            <div>
              <label className={labelCls}>Alt başlıq</label>
              <textarea value={form.heroSubtitle} rows={3} onChange={set("heroSubtitle")}
                className="input-field resize-none" placeholder="Açıqlama mətni..." />
              <p className={hintCls}>Başlığın altındakı açıqlama — maks. 200 karakter tövsiyə olunur</p>
            </div>

            {/* Live preview */}
            <div className="rounded-2xl p-5 border"
              style={{ background: "linear-gradient(135deg,#0d2137,#0a3d2e)", borderColor: "rgba(147,204,255,0.2)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-4"
                style={{ color: "rgba(147,204,255,0.4)" }}>Canlı önizləmə</p>
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{ background: "rgba(147,204,255,0.12)", color: "rgb(147,204,255)", border: "1px solid rgba(147,204,255,0.25)" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  {form.heroBadge || "Badge mətni..."}
                </div>
                <p className="text-2xl font-extrabold text-white leading-tight">
                  {form.heroTitle || "Başlıq..."}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(147,204,255,0.65)" }}>
                  {form.heroSubtitle || "Alt başlıq..."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* CONTACT */}
        {tab === "contact" && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-[rgba(147,204,255,0.12)] flex items-center justify-center">
                <Contact size={15} className="text-[#1a7fe0]" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">Əlaqə Məlumatları</p>
                <p className="text-xs text-slate-400">Footer-də göstərilən əlaqə məlumatları</p>
              </div>
            </div>

            <div>
              <label className={labelCls}>
                <span className="flex items-center gap-1.5"><Mail size={13} className="text-[#1a7fe0]" /> Email ünvanı</span>
              </label>
              <input type="email" value={form.contactEmail} onChange={set("contactEmail")}
                className="input-field" placeholder="info@example.az" />
            </div>

            <div>
              <label className={labelCls}>
                <span className="flex items-center gap-1.5"><Phone size={13} className="text-[#1a7fe0]" /> Telefon nömrəsi</span>
              </label>
              <input type="text" value={form.contactPhone} onChange={set("contactPhone")}
                className="input-field" placeholder="+994 50 000 00 00" />
            </div>

            <div>
              <label className={labelCls}>
                <span className="flex items-center gap-1.5"><MapPin size={13} className="text-[#1a7fe0]" /> Ünvan</span>
              </label>
              <input type="text" value={form.contactAddress} onChange={set("contactAddress")}
                className="input-field" placeholder="Bakı, Azərbaycan" />
            </div>

            {/* Contact preview */}
            <div className="rounded-2xl p-5 border border-slate-100 bg-slate-50 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Önizləmə</p>
              {[
                { Icon: Mail,   val: form.contactEmail   || "—" },
                { Icon: Phone,  val: form.contactPhone   || "—" },
                { Icon: MapPin, val: form.contactAddress || "—" },
              ].map(({ Icon, val }, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm text-slate-600">
                  <Icon size={14} className="text-[#1a7fe0] flex-shrink-0" />
                  {val}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SOCIAL */}
        {tab === "social" && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-[rgba(147,204,255,0.12)] flex items-center justify-center">
                <Share2 size={15} className="text-[#1a7fe0]" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">Sosial Media</p>
                <p className="text-xs text-slate-400">Footer-dəki sosial media ikonlarının linklərini təyin edin</p>
              </div>
            </div>

            {[
              { key: "facebook",  Icon: Facebook,  label: "Facebook",  placeholder: "https://facebook.com/hesabiniz",  color: "#1877f2", bg: "#1877f218" },
              { key: "instagram", Icon: Instagram, label: "Instagram", placeholder: "https://instagram.com/hesabiniz", color: "#e1306c", bg: "#e1306c18" },
              { key: "youtube",   Icon: Youtube,   label: "YouTube",   placeholder: "https://youtube.com/@hesabiniz",  color: "#ff0000", bg: "#ff000018" },
            ].map(({ key, Icon, label, placeholder, color, bg }) => {
              const val = (form as any)[key];
              return (
                <div key={key} className="rounded-2xl border p-4 transition-all"
                  style={{
                    borderColor: val ? `${color}30` : "#e2e8f0",
                    background:  val ? bg : "#fff",
                  }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: val ? `${color}20` : "#f1f5f9", border: `1px solid ${val ? `${color}30` : "#e2e8f0"}` }}>
                      <Icon size={18} style={{ color: val ? color : "#94a3b8" }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{label}</p>
                      <p className="text-xs text-slate-400">{val ? "Aktiv" : "Link təyin edilməyib"}</p>
                    </div>
                    {val && (
                      <a href={val} target="_blank" rel="noopener noreferrer"
                        className="ml-auto text-xs font-medium transition-colors hover:underline"
                        style={{ color }}>
                        Yoxla →
                      </a>
                    )}
                  </div>
                  <input type="url" value={val} onChange={set(key)}
                    className="input-field text-sm" placeholder={placeholder} />
                </div>
              );
            })}

            {/* Social preview */}
            <div className="rounded-2xl p-4 border border-slate-100 bg-slate-50">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Footer önizləməsi</p>
              <div className="flex items-center gap-2">
                {[
                  { key: "facebook",  Icon: Facebook,  color: "#1877f2" },
                  { key: "instagram", Icon: Instagram, color: "#e1306c" },
                  { key: "youtube",   Icon: Youtube,   color: "#ff0000" },
                ].map(({ key, Icon, color }) => {
                  const val = (form as any)[key];
                  return (
                    <div key={key}
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                      style={{
                        background: val ? `${color}12` : "#f1f5f9",
                        border: `1px solid ${val ? `${color}30` : "#e2e8f0"}`,
                      }}>
                      <Icon size={16} style={{ color: val ? color : "#94a3b8" }} />
                    </div>
                  );
                })}
                <span className="text-xs text-slate-400 ml-2">
                  {[form.facebook, form.instagram, form.youtube].filter(Boolean).length} / 3 aktiv
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Save / Reset ─────────────────────────────── */}
        <div className="flex items-center justify-between pt-5 mt-5 border-t border-slate-100">
          <button onClick={() => setForm(DEFAULTS)}
            className="btn-ghost flex items-center gap-2 text-sm text-slate-500">
            <RotateCcw size={13} /> Default dəyərlər
          </button>
          <button onClick={handleSave} disabled={saving}
            className="btn-primary flex items-center gap-2 px-8">
            {saving
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><Save size={14} /> Yadda Saxla</>}
          </button>
        </div>
      </div>
    </div>
  );
}
