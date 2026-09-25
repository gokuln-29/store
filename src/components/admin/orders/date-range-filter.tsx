"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePathname, useRouter } from "@/i18n/navigation";

/** "From" / "To" date filter kept in the URL (?from=YYYY-MM-DD&to=YYYY-MM-DD). */
export function DateRangeFilter() {
  const t = useTranslations("AdminOrders");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");

  const apply = (nextFrom: string, nextTo: string) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of [
      ["from", nextFrom],
      ["to", nextTo],
    ] as const) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        apply(from, to);
      }}
    >
      <div className="grid gap-1">
        <Label htmlFor="orders-from" className="text-xs">
          {t("from")}
        </Label>
        <Input
          id="orders-from"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => setFrom(e.target.value)}
          className="w-40"
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="orders-to" className="text-xs">
          {t("to")}
        </Label>
        <Input
          id="orders-to"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => setTo(e.target.value)}
          className="w-40"
        />
      </div>
      <Button type="submit" variant="outline">
        {t("applyDates")}
      </Button>
      {(params.get("from") || params.get("to")) && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setFrom("");
            setTo("");
            apply("", "");
          }}
        >
          {t("clearDates")}
        </Button>
      )}
    </form>
  );
}
