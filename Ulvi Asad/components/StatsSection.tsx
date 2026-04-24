"use client";

import { useEffect, useState, useRef } from "react";
import { BookOpen, FileText, Users } from "lucide-react";

interface Stats { totalQuizzes: number; totalMaterials: number; totalUsers: number; }

function AnimatedCounter({ target, duration = 2000 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !started.current) {
        started.current = true;
        const t0 = Date.now();
        const timer = setInterval(() => {
          const p = Math.min((Date.now()-t0)/duration, 1);
          setCount(Math.floor((1-Math.pow(1-p,3))*target));
          if (p >= 1) { clearInterval(timer); setCount(target); }
        }, 16);
      }
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target, duration]);
  return <span ref={ref}>{count.toLocaleString()}</span>;
}

export default function StatsSection({ stats }: { stats: Stats }) {
  const items = [
    { icon: BookOpen, label: "Cəmi Quiz",              value: stats.totalQuizzes,  color: "#1a7fe0", bg: "rgba(147,204,255,0.1)",  border: "rgba(147,204,255,0.3)" },
    { icon: FileText, label: "Material",               value: stats.totalMaterials,color: "#1f6f43", bg: "rgba(31,111,67,0.08)",   border: "rgba(31,111,67,0.2)" },
    { icon: Users,    label: "Qeydiyyatlı İstifadəçi", value: stats.totalUsers,    color: "#7c3aed", bg: "rgba(124,58,237,0.08)",  border: "rgba(124,58,237,0.2)" },
  ];

  return (
    <section className="py-16 relative overflow-hidden"
      style={{ background: "linear-gradient(180deg,rgba(147,204,255,0.12) 0%,rgba(191,231,255,0.08) 100%)", borderTop: "1px solid rgba(147,204,255,0.15)", borderBottom: "1px solid rgba(147,204,255,0.15)" }}>
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((item) => (
            <div key={item.label}
              className="flex items-center gap-5 p-6 rounded-2xl border transition-all duration-300 hover:-translate-y-1"
              style={{
                background: "#fff",
                borderColor: item.border,
                boxShadow: `0 2px 8px ${item.bg}`,
              }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: item.bg }}>
                <item.icon size={26} style={{ color: item.color }} />
              </div>
              <div>
                <div className="text-3xl font-extrabold" style={{ color: item.color }}>
                  <AnimatedCounter target={item.value} />+
                </div>
                <p className="text-sm text-slate-500 font-medium mt-0.5">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
