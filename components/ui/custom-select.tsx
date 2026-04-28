"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

interface Option { value: string; label: string; }

interface CustomSelectProps {
  options: Option[];
  value: string;
  onChange: (val: string) => void;
  className?: string;
}

export default function CustomSelect({ options, value, onChange, className = "" }: CustomSelectProps) {
  const [open, setOpen]       = useState(false);
  const [pos,  setPos]        = useState({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((o) => o.value === value);

  // Portal üçün client-side mount
  useEffect(() => { setMounted(true); }, []);

  // Dropdown pozisiyasını hesabla
  const openDropdown = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top:   rect.bottom + window.scrollY + 4,
      left:  rect.left   + window.scrollX,
      width: rect.width,
    });
    setOpen(true);
  };

  // Kənara basanda bağla
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Scroll/resize-da bağla
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll",  close, true);
    window.addEventListener("resize",  close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const dropdown = open && mounted ? createPortal(
    <div
      style={{
        position:  "absolute",
        top:       pos.top,
        left:      pos.left,
        width:     pos.width,
        zIndex:    99999,
        background: "#ffffff",
        borderRadius: "12px",
        border: "1px solid #e2e8f0",
        boxShadow: "0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onChange(opt.value); setOpen(false); }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "10px 16px",
            fontSize: "0.875rem",
            textAlign: "left",
            background: opt.value === value ? "rgba(147,204,255,0.1)" : "transparent",
            color:      opt.value === value ? "#1a7fe0" : "#0f172a",
            fontWeight: opt.value === value ? 600 : 400,
            cursor: "pointer",
            border: "none",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            if (opt.value !== value)
              (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              opt.value === value ? "rgba(147,204,255,0.1)" : "transparent";
          }}
        >
          <span>{opt.label}</span>
          {opt.value === value && <Check size={14} style={{ color: "#1a7fe0", flexShrink: 0 }} />}
        </button>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => open ? setOpen(false) : openDropdown()}
        className="w-full flex items-center justify-between gap-2 px-4 rounded-xl border text-sm font-medium transition-all duration-200 text-left"
        style={{
          background:  "rgba(255,255,255,0.9)",
          border:      open ? "1.5px solid rgb(147,204,255)" : "1.5px solid rgba(147,204,255,0.3)",
          boxShadow:   open ? "0 0 0 3px rgba(147,204,255,0.15)" : "none",
          color:       "#0f172a",
          minHeight:   "44px",
          paddingTop:  "0.625rem",
          paddingBottom: "0.625rem",
        }}
      >
        <span className="truncate">{selected?.label || "Seçin"}</span>
        <ChevronDown
          size={16}
          className="flex-shrink-0 text-slate-400 transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {dropdown}
    </div>
  );
}
