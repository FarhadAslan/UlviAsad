"use client";

import { useEffect, useState, useRef, memo } from "react";
import { BookOpen, FileText, Users } from "lucide-react";

interface Stats { totalQuizzes: number; totalMaterials: number; totalUsers: number; }

// Memoized — yalnız target dəyişəndə yenidən render olur
const AnimatedCounter = memo(function AnimatedCounter({
  target,
  duration = 1800,
}: {
  target: number;
  duration?: number;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // target 0-dırsa animasiya etmə
    if (target === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true;
          const t0 = Date.now();
          timerRef.current = setInterval(() => {
            const p = Math.min((Date.now() - t0) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
            setCount(Math.floor(eased * target));
            if (p >= 1) {
              if (timerRef.current) clearInterval(timerRef.current);
              setCount(target);
            }
          }, 16);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) obs.observe(ref.current);

    return () => {
      obs.disconnect();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [target, duration]);

  return <span ref={ref}>{count.toLocaleString()}</span>;
});

const STAT_ITEMS = [
  { key: "totalQuizzes"   as const, label: "Cəmi Quiz",              Icon: BookOpen, color: "#1a7fe0", bg: "rgba(147,204,255,0.1)",  border: "rgba(147,204,255,0.3)" },
  { key: "totalMaterials" as const, label: "Material",               Icon: FileText, color: "#1f6f43", bg: "rgba(31,111,67,0.08)",   border: "rgba(31,111,67,0.2)" },
  { key: "totalUsers"     as const, label: "Qeydiyyatlı İstifadəçi", Icon: Users,    color: "#7c3aed", bg: "rgba(124,58,237,0.08)",  border: "rgba(124,58,237,0.2)" },
];

export default function StatsSection({ stats }: { stats: Stats }) {
  return (
    <section
      className="py-16 relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg,rgba(147,204,255,0.12) 0%,rgba(191,231,255,0.08) 100%)",
        borderTop: "1px solid rgba(147,204,255,0.15)",
        borderBottom: "1px solid rgba(147,204,255,0.15)",
      }}
    >
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STAT_ITEMS.map(({ key, label, Icon, color, bg, border }) => (
            <div
              key={key}
              className="flex items-center gap-5 p-6 rounded-2xl border transition-all duration-300 hover:-translate-y-1"
              style={{ background: "#fff", borderColor: border, boxShadow: `0 2px 8px ${bg}` }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: bg }}
              >
                <Icon size={26} style={{ color }} />
              </div>
              <div>
                <div className="text-3xl font-extrabold" style={{ color }}>
                  <AnimatedCounter target={stats[key]} />+
                </div>
                <p className="text-sm text-slate-500 font-medium mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
