"use client";

import { useEffect, useRef, useState, Suspense, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import RubiksLoader from "@/components/ui/rubiks-loader";

const MIN_MS = 300;
const MAX_MS = 5000; // maksimum 5 saniyə — sonra avtomatik gizlət

// Route dəyişikliyini izləyir
function RouteWatcher({ onEnd }: { onEnd: () => void }) {
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
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef    = useRef<number>(0);

  const handleEnd = useCallback(() => {
    const elapsed   = Date.now() - startRef.current;
    const remaining = Math.max(0, MIN_MS - elapsed);
    if (timerRef.current)    clearTimeout(timerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    timerRef.current = setTimeout(() => setShow(false), remaining);
  }, []);

  const handleStart = useCallback(() => {
    setShow(true);
    startRef.current = Date.now();
    if (timerRef.current)    clearTimeout(timerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    // Hər halda MAX_MS sonra gizlət — ilişib qalmasın
    maxTimerRef.current = setTimeout(() => setShow(false), MAX_MS);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current)    clearTimeout(timerRef.current);
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    };
  }, []);

  // Link click-də loader göstər
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      if (!a) return;

      const href = a.getAttribute("href") || "";

      // Xarici, anchor, mailto, tel linklərini keç
      if (
        !href ||
        href.startsWith("http") ||
        href.startsWith("#") ||
        href.startsWith("mailto") ||
        href.startsWith("tel") ||
        a.target === "_blank"
      ) return;

      // Eyni səhifəyə click — loader göstərmə
      const targetPath = href.split("?")[0];
      const currentPath = window.location.pathname;
      if (targetPath === currentPath) return;

      handleStart();
    };

    document.addEventListener("click", handler, { passive: true });
    return () => document.removeEventListener("click", handler);
  }, [handleStart]);

  return (
    <>
      {show && <RubiksLoader />}
      <Suspense fallback={null}>
        <RouteWatcher onEnd={handleEnd} />
      </Suspense>
    </>
  );
}
