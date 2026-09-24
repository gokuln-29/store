"use client";

import { Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/hooks/use-error-text";
import { setVariantStockAction } from "@/lib/actions/catalog.actions";
import { cn } from "@/lib/utils";

/** Inline stock field: edit and press Enter (or the check button) to save. */
export function StockEditor({
  id,
  initial,
  threshold,
  label,
  readOnly,
}: {
  id: string;
  initial: number;
  threshold: number;
  label: string;
  readOnly?: boolean;
}) {
  const t = useTranslations("Inventory");
  const errorText = useErrorText();
  const [saved, setSaved] = useState(initial);
  const [value, setValue] = useState(String(initial));
  const [isPending, startTransition] = useTransition();
  const dirty = value.trim() !== String(saved);
  const tone =
    saved === 0
      ? "text-destructive"
      : saved <= threshold
        ? "text-amber-700 dark:text-amber-400"
        : "";

  if (readOnly) return <span className={cn("font-medium tabular-nums", tone)}>{saved}</span>;

  function save() {
    if (!dirty) return;
    const stock = Number(value.trim());
    if (!/^\d+$/.test(value.trim())) {
      toast.error(errorText("numberInvalid"));
      return;
    }
    startTransition(async () => {
      const result = await setVariantStockAction(id, stock);
      if (result.ok) {
        setSaved(result.data.stock);
        setValue(String(result.data.stock));
        toast.success(t("saved"));
      } else {
        toast.error(errorText(result.fieldErrors?.stock ?? result.error));
      }
    });
  }

  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setValue(String(saved))}
        inputMode="numeric"
        aria-label={`${label} · ${t("stock")}`}
        className={cn("h-8 w-20 tabular-nums", tone)}
      />
      {dirty && (
        <Button
          type="submit"
          size="icon"
          variant="ghost"
          className="size-8"
          disabled={isPending}
          aria-label={t("save")}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Check className="size-4" aria-hidden />
          )}
        </Button>
      )}
    </form>
  );
}
