"use client";

import { Share2 } from "lucide-react";
import { useToast } from "@/components/ui/toast-1";

export default function ShareButton({ title }: { title: string }) {
  const { success } = useToast();

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      success("Link kopyalandı!");
    }
  };

  return (
    <button
      onClick={handleShare}
      className="btn-primary flex items-center gap-2"
    >
      <Share2 size={16} />
      Paylaş
    </button>
  );
}
