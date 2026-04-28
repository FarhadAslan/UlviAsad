"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function PerformanceMonitor() {
  const pathname = usePathname();

  useEffect(() => {
    // Səhifə yüklənmə vaxtını ölç
    if (typeof window !== "undefined" && "performance" in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === "navigation") {
            const navEntry = entry as PerformanceNavigationTiming;
            console.log(`📊 Page Load Time: ${Math.round(navEntry.loadEventEnd - navEntry.fetchStart)}ms`);
          }
        }
      });

      try {
        observer.observe({ entryTypes: ["navigation"] });
      } catch (e) {
        // Köhnə brauzerlər dəstəkləməyə bilər
      }

      return () => observer.disconnect();
    }
  }, [pathname]);

  return null;
}
