"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition, useRef, useEffect } from "react";
import { Search } from "lucide-react";

export default function ArticleFilters({ search }: { search: string }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [localSearch, setLocalSearch] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  return (
    <div className="card-static mb-8">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Məqalə adına görə axtar..."
          value={localSearch}
          onChange={(e) => {
            const v = e.target.value;
            setLocalSearch(v);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
              const params = new URLSearchParams();
              if (v) params.set("search", v);
              startTransition(() => {
                router.push(`${pathname}?${params.toString()}`, { scroll: false });
              });
            }, 350);
          }}
          className="input-field pl-9"
        />
      </div>
    </div>
  );
}
