"use client";

import { useTranslations } from "next-intl";
import type { SortKey } from "@/lib/utils/store-filters";
import { useListingUrl } from "./use-listing-url";

export function SortSelect({
  value,
  options,
  defaultSort,
}: {
  value: SortKey;
  options: SortKey[];
  defaultSort: SortKey;
}) {
  const t = useTranslations("Listing");
  const { update } = useListingUrl();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-muted-foreground sm:inline">{t("sort")}</span>
      <select
        value={value}
        onChange={(e) => update({ sort: e.target.value === defaultSort ? null : e.target.value })}
        className="h-9 rounded-md border bg-background px-2 text-sm"
        aria-label={t("sort")}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {t(`sort_${o}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
