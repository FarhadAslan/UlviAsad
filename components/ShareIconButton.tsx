"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

interface ShareIconButtonProps {
  title: string;
  // path: "/meqaleler/abc123" kimi — origin runtime-da əlavə olunur
  path: string;
}

export default function ShareIconButton({ title, path }: ShareIconButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}${path}`;
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        prompt("Linki kopyalayın:", url);
      }
    }
  };

  return (
    <button
      onClick={handleShare}
      className="p-1.5 rounded-lg text-slate-400 hover:text-[#1a7fe0] hover:bg-blue-50 transition-all"
      title="Paylaş"
    >
      {copied
        ? <Check size={14} className="text-green-500" />
        : <Share2 size={14} />}
    </button>
  );
}
