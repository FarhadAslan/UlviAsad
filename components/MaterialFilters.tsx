"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useState, useTransition, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import CustomSelect from "@/components/ui/custom-select";

export default function MaterialFilters({
  category, search, categories = [],
}: {
  category: string;
  search: string;
  categories?: { value: string; label: string }[];
}) {
  const router   = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [localSearch, setLocalSearch] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categoryOptions = [
    { value: "ALL", label: "Hamısı" },
    ...categories,
  ];

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const update = useCallback((key: string, val: string) => {
    const params = new URLSearchParams();
    if (key !== "category" && category !== "ALL") params.set("category", category);
    if (key !== "search"   && search)             params.set("search",   search);
    if (val && val !== "ALL") params.set(key, val);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }, [category, search, pathname, router]);

  return (
    <div className="card-static mb-8">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Material adına görə axtar..."
            value={localSearch}
            onChange={(e) => {
              const v = e.target.value;
              setLocalSearch(v);
              if (debounceRef.current) clearTimeout(debounceRef.current);
              debounceRef.current = setTimeout(() => update("search", v), 350);
            }}
            className="input-field pl-9"
          />
        </div>
        <CustomSelect options={categoryOptions} value={category}
          onChange={(v) => update("category", v)} className="md:w-52" />
      </div>
    </div>
  );
}
