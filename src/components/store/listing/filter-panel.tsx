"use client";

import { SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useListingUrl } from "./use-listing-url";

export type FilterAttributeView = {
  key: string;
  label: string;
  type: "TEXT" | "NUMBER" | "SELECT" | "COLOR";
  unit: string | null;
  /** For choice facets: value, display label, product count. */
  values?: { value: string; label: string; count: number }[];
  range?: { min: number; max: number };
};

type Props = {
  attributes: FilterAttributeView[];
  price: { min: number; max: number } | null;
  activeCount: number;
};

function RangeForm({
  name,
  placeholderMin,
  placeholderMax,
  initial,
  onApply,
}: {
  name: string;
  placeholderMin: string;
  placeholderMax: string;
  initial: [string, string];
  onApply: (min: string, max: string) => void;
}) {
  const t = useTranslations("Listing");
  const [min, setMin] = useState(initial[0]);
  const [max, setMax] = useState(initial[1]);
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onApply(min.trim(), max.trim());
      }}
    >
      <input
        inputMode="decimal"
        value={min}
        onChange={(e) => setMin(e.target.value)}
        placeholder={placeholderMin}
        aria-label={`${name} ${t("min")}`}
        className="h-9 w-full min-w-0 rounded-md border bg-background px-2 text-sm"
      />
      <span aria-hidden>–</span>
      <input
        inputMode="decimal"
        value={max}
        onChange={(e) => setMax(e.target.value)}
        placeholder={placeholderMax}
        aria-label={`${name} ${t("max")}`}
        className="h-9 w-full min-w-0 rounded-md border bg-background px-2 text-sm"
      />
      <Button type="submit" size="sm" variant="outline">
        {t("apply")}
      </Button>
    </form>
  );
}

function Filters({ attributes, price }: Omit<Props, "activeCount">) {
  const t = useTranslations("Listing");
  const { searchParams, update, isPending } = useListingUrl();
  const selected = (key: string) => (searchParams.get(`f.${key}`) ?? "").split(",").filter(Boolean);

  return (
    <div className={cn("grid gap-6", isPending && "opacity-60")}>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">{t("availability")}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={searchParams.get("stock") === "1"}
            onChange={(e) => update({ stock: e.target.checked ? "1" : null })}
          />
          {t("inStockOnly")}
        </label>
      </fieldset>

      {price && price.max > price.min && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-semibold">{t("price")} (₹)</legend>
          <RangeForm
            key={`${searchParams.get("min")}-${searchParams.get("max")}`}
            name={t("price")}
            placeholderMin={String(Math.floor(price.min / 100))}
            placeholderMax={String(Math.ceil(price.max / 100))}
            initial={[searchParams.get("min") ?? "", searchParams.get("max") ?? ""]}
            onApply={(min, max) => update({ min: min || null, max: max || null })}
          />
        </fieldset>
      )}

      {attributes.map((attr) =>
        attr.values ? (
          <fieldset key={attr.key} className="grid gap-2">
            <legend className="mb-1 text-sm font-semibold">{attr.label}</legend>
            <ul className="grid max-h-56 gap-1.5 overflow-y-auto">
              {attr.values.map((v) => {
                const current = selected(attr.key);
                const checked = current.includes(v.value);
                return (
                  <li key={v.value}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? current.filter((x) => x !== v.value)
                            : [...current, v.value];
                          update({ [`f.${attr.key}`]: next.join(",") || null });
                        }}
                      />
                      {attr.type === "COLOR" && (
                        <span
                          className="size-4 rounded-full border"
                          style={{ background: v.value }}
                          aria-hidden
                        />
                      )}
                      <span className="flex-1">{v.label}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{v.count}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ) : attr.range && attr.range.max > attr.range.min ? (
          <fieldset key={attr.key} className="grid gap-2">
            <legend className="mb-1 text-sm font-semibold">
              {attr.label}
              {attr.unit ? ` (${attr.unit})` : ""}
            </legend>
            <RangeForm
              key={searchParams.get(`f.${attr.key}`) ?? ""}
              name={attr.label}
              placeholderMin={String(attr.range.min)}
              placeholderMax={String(attr.range.max)}
              initial={(() => {
                const [lo = "", hi = ""] = (searchParams.get(`f.${attr.key}`) ?? "").split("-");
                return [lo, hi] as [string, string];
              })()}
              onApply={(min, max) =>
                update({ [`f.${attr.key}`]: min || max ? `${min}-${max}` : null })
              }
            />
          </fieldset>
        ) : null,
      )}
    </div>
  );
}

/** Sidebar filters on desktop; a drawer on mobile. Every change updates the URL. */
export function FilterPanel({ attributes, price, activeCount }: Props) {
  const t = useTranslations("Listing");
  return (
    <>
      <aside className="hidden lg:block" aria-label={t("filters")}>
        <Filters attributes={attributes} price={price} />
      </aside>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="lg:hidden">
            <SlidersHorizontal className="size-4" aria-hidden />
            {activeCount ? t("filtersCount", { count: activeCount }) : t("filters")}
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t("filters")}</SheetTitle>
          </SheetHeader>
          <div className="px-4">
            <Filters attributes={attributes} price={price} />
          </div>
          <SheetFooter>
            <SheetTrigger asChild>
              <Button>{t("showResults")}</Button>
            </SheetTrigger>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
