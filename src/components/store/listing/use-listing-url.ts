"use client";

import { useSearchParams } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

/**
 * Updates listing query params (filters/sort) in the URL; any change resets to page 1.
 * `searchParams` is optimistic, so checkboxes and selects update immediately while the
 * new results load.
 */
export function useListingUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(current.toString());
  const searchParams = new URLSearchParams(optimistic);

  function update(changes: Record<string, string | null>) {
    const params = new URLSearchParams(optimistic);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      setOptimistic(qs);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  return { searchParams, update, isPending };
}
