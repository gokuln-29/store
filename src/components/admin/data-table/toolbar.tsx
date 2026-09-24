"use client";

import { Search, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };
export type FilterConfig = {
  key: string;
  label: string;
  allLabel: string;
  options: FilterOption[];
};

/** Debounced search box and select filters that update the URL. */
export function DataTableToolbar({
  searchPlaceholder,
  filters = [],
  children,
}: {
  searchPlaceholder: string;
  filters?: FilterConfig[];
  /** Extra actions (e.g. "Add" button) shown on the right. */
  children?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [isPending, startTransition] = useTransition();
  const lastPushed = useRef(q);

  function update(changes: Record<string, string>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  }

  useEffect(() => {
    if (q === lastPushed.current) return;
    const timer = setTimeout(() => {
      lastPushed.current = q;
      update({ q: q.trim() });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the text changes
  }, [q]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-72">
        <Search
          className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className={cn("pl-8", isPending && "opacity-70")}
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="×"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
      {filters.map((filter) => (
        <select
          key={filter.key}
          aria-label={filter.label}
          value={searchParams.get(filter.key) ?? ""}
          onChange={(e) => update({ [filter.key]: e.target.value })}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">{filter.allLabel}</option>
          {filter.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}
