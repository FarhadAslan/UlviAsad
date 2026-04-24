"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Search } from "lucide-react";
import CustomSelect from "@/components/ui/custom-select";

const CATEGORIES = [
  { value: "ALL", label: "Hamısı" },
  { value: "QANUNVERICILIK", label: "Qanunvericilik" },
  { value: "MANTIQ", label: "Məntiq" },
  { value: "AZERBAYCAN_DILI", label: "Azərbaycan Dili" },
  { value: "INFORMATIKA", label: "İnformatika" },
  { value: "DQ_QEBUL", label: "DQ Qəbul" },
];

const TYPES = [
  { value: "ALL", label: "Hamısı" },
  { value: "SINAQ", label: "Sınaq" },
  { value: "TEST", label: "Test" },
];

export default function QuizFilters({
  category, type, search,
}: {
  category: string; type: string; search: string;
}) {
  const router   = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [localSearch, setLocalSearch] = useState(search);

  const update = useCallback((key: string, val: string) => {
    const params = new URLSearchParams();
    if (key !== "category" && category !== "ALL") params.set("category", category);
    if (key !== "type"     && type     !== "ALL") params.set("type",     type);
    if (key !== "search"   && search)             params.set("search",   search);
    if (val && val !== "ALL") params.set(key, val);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }, [category, type, search, pathname, router]);

  return (
    <div className="card-static mb-8">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Quiz adına görə axtar..."
            value={localSearch}
            onChange={(e) => {
              setLocalSearch(e.target.value);
              const v = e.target.value;
              const t = setTimeout(() => update("search", v), 300);
              return () => clearTimeout(t);
            }}
            className="input-field pl-9"
          />
        </div>
        <CustomSelect options={CATEGORIES} value={category}
          onChange={(v) => update("category", v)} className="md:w-52" />
        <CustomSelect options={TYPES} value={type}
          onChange={(v) => update("type", v)} className="md:w-36" />
      </div>
    </div>
  );
}
