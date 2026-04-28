"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

interface GlowCardProps {
  children: React.ReactNode;
  className?: string;
}

function GlowCard({ children, className }: GlowCardProps) {
  return (
    <div
      className={cn(
        "bg-white border border-slate-200 rounded-2xl p-5 h-full flex flex-col",
        "shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.06)]",
        // will-change GPU layer-ə keçidi sürətləndirir
        "will-change-transform",
        "transition-[transform,box-shadow,border-color] duration-200",
        "hover:-translate-y-1.5",
        "hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_16px_40px_rgba(0,0,0,0.1)]",
        "hover:border-[rgba(147,204,255,0.5)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export { GlowCard };
export default memo(GlowCard);
