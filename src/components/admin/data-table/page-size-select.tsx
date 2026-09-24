"use client";

import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { PAGE_SIZES } from "@/lib/utils/table-params";

export function PageSizeSelect({ value, label }: { value: number; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <label className="flex items-center gap-2 text-muted-foreground">
      <span className="hidden sm:inline">{label}</span>
      <select
        value={value}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams);
          params.set("pageSize", e.target.value);
          params.delete("page");
          router.replace(`${pathname}?${params.toString()}`);
        }}
        className="h-8 rounded-md border bg-background px-2 text-foreground"
      >
        {PAGE_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </label>
  );
}
