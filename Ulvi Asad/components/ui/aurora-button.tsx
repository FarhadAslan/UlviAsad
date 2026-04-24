"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface AuroraButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}

export function AuroraButton({
  className,
  children,
  variant = "primary",
  ...props
}: AuroraButtonProps) {
  const isPrimary = variant === "primary";

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2",
        "px-6 py-2.5 rounded-lg font-semibold text-sm",
        "transition-all duration-200 cursor-pointer",
        "disabled:opacity-45 disabled:cursor-not-allowed",
        isPrimary
          ? "text-[#7dbeff] border border-[rgba(125,190,255,0.2)]"
          : "text-[#7dbeff] border border-[rgba(125,190,255,0.3)] bg-transparent",
        className
      )}
      style={
        isPrimary
          ? {
              background: "linear-gradient(135deg, #013c01 0%, #025902 100%)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(125,190,255,0.08)",
            }
          : {
              boxShadow: "inset 0 1px 0 rgba(125,190,255,0.05)",
            }
      }
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        if (isPrimary) {
          el.style.background = "linear-gradient(135deg, #025902 0%, #037003 100%)";
          el.style.boxShadow  = "0 4px 16px rgba(1,60,1,0.5), 0 0 0 1px rgba(125,190,255,0.15)";
          el.style.transform  = "translateY(-1px)";
          el.style.color      = "#a8d8ff";
          el.style.borderColor = "rgba(125,190,255,0.4)";
        } else {
          el.style.background  = "rgba(125,190,255,0.07)";
          el.style.boxShadow   = "0 0 16px rgba(125,190,255,0.1)";
          el.style.transform   = "translateY(-1px)";
          el.style.color       = "#a8d8ff";
          el.style.borderColor = "rgba(125,190,255,0.55)";
        }
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        if (isPrimary) {
          el.style.background  = "linear-gradient(135deg, #013c01 0%, #025902 100%)";
          el.style.boxShadow   = "0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(125,190,255,0.08)";
          el.style.transform   = "";
          el.style.color       = "#7dbeff";
          el.style.borderColor = "rgba(125,190,255,0.2)";
        } else {
          el.style.background  = "transparent";
          el.style.boxShadow   = "inset 0 1px 0 rgba(125,190,255,0.05)";
          el.style.transform   = "";
          el.style.color       = "#7dbeff";
          el.style.borderColor = "rgba(125,190,255,0.3)";
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
}
