"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import RubiksLoader from "@/components/ui/rubiks-loader";

const MIN_MS = 800;

// Route dəyişikliyini izləyir
function RouteWatcher({ onStart, onEnd }: { onStart: () => void; onEnd: () => void }) {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const prev = useRef("");

  useEffect(() => {
    const cur = pathname + searchParams.toString();
    if (!prev.current) { prev.current = cur; return; }
    if (prev.current === cur) return;
    prev.current = cur;
    onEnd();
  }, [pathname, searchParams, onEnd]);

  return null;
}

export default function PageTransition() {
  const [show, setShow]   = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<number>(0);

  const handleStart = () => {
    setShow(true);
    startRef.current = Date.now();
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleEnd = () => {
    const elapsed = Date.now() - startRef.current;
    const remaining = Math.max(0, MIN_MS - elapsed);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShow(false), remaining);
  };

  // Link click-də dərhal loader göstər
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (!href || href.startsWith("http") || href.startsWith("#") ||
          href.startsWith("mailto") || href.startsWith("tel") ||
          a.target === "_blank") return;
      handleStart();
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return (
    <>
      {show && <RubiksLoader />}
      <Suspense fallback={null}>
        <RouteWatcher onStart={handleStart} onEnd={handleEnd} />
      </Suspense>
    </>
  );
}
