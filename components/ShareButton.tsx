"use client";

import { Share2, Copy, Check } from "lucide-react";
import { useToast } from "@/components/ui/toast-1";
import { useState } from "react";

interface ShareButtonProps {
  title: string;
  url?: string;        // verilməsə window.location.href istifadə olunur
  variant?: "default" | "icon"; // icon — yalnız ikon, default — ikon + mətn
}

export default function ShareButton({ title, url, variant = "default" }: ShareButtonProps) {
  const { success } = useToast();
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareUrl = url ?? (typeof window !== "undefined" ? window.location.href : "");

    if (navigator.share) {
      try {
        await navigator.share({ title, url: shareUrl });
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        success("Link kopyalandı!");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard API işləməsə prompt göstər
        prompt("Linki kopyalayın:", shareUrl);
      }
    }
  };

  if (variant === "icon") {
    return (
      <button
        onClick={handleShare}
        title="Paylaş"
        className="p-1.5 rounded-lg transition-all text-[#1a7fe0] hover:bg-blue-50"
      >
        {copied ? <Check size={15} className="text-green-500" /> : <Share2 size={15} />}
      </button>
    );
  }

  return (
    <button
      onClick={handleShare}
      className="btn-secondary flex items-center gap-2"
    >
      {copied ? <Check size={16} className="text-green-500" /> : <Share2 size={16} />}
      {copied ? "Kopyalandı!" : "Paylaş"}
    </button>
  );
}
