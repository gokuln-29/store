"use client";

import { Minus, Plus, ShoppingCart } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Price } from "../price";
import { DeliveryCheck } from "./delivery-check";

export type PanelVariant = {
  id: string;
  sku: string;
  optionValues: Record<string, string>;
  price: number;
  compareAtPrice: number | null;
  stock: number;
};

export type PanelOption = {
  key: string;
  label: string;
  values: { value: string; label: string }[];
};

const MAX_QTY = 10;
const LOW_STOCK = 5;

function matches(variant: PanelVariant, selection: Record<string, string>) {
  return Object.entries(selection).every(([k, v]) => variant.optionValues[k] === v);
}

/** Variant choice, price, stock, quantity, add to cart and delivery check. */
export function PurchasePanel({
  variants,
  options,
  pricesIncludeTax,
}: {
  variants: PanelVariant[];
  options: PanelOption[];
  pricesIncludeTax: boolean;
}) {
  const t = useTranslations("Product");
  const locale = useLocale();
  const initial = variants.find((v) => v.stock > 0) ?? variants[0]!;
  const [selection, setSelection] = useState<Record<string, string>>(initial.optionValues);
  const [quantity, setQuantity] = useState(1);

  // A shared link can preselect a variant (?variant=SKU). Read in the browser so the page
  // itself stays static.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const sku = new URLSearchParams(window.location.search).get("variant");
      const linked = sku ? variants.find((v) => v.sku === sku) : undefined;
      if (linked) setSelection(linked.optionValues);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [variants]);

  const variant = useMemo(
    () => variants.find((v) => matches(v, selection)) ?? initial,
    [variants, selection, initial],
  );
  const maxQty = Math.max(1, Math.min(MAX_QTY, variant.stock));

  function choose(key: string, value: string) {
    const wanted = { ...selection, [key]: value };
    // Keep other choices if that combination exists; otherwise switch to one that does.
    const next =
      variants.find((v) => matches(v, wanted) && v.stock > 0) ??
      variants.find((v) => matches(v, wanted)) ??
      variants.find((v) => v.optionValues[key] === value && v.stock > 0) ??
      variants.find((v) => v.optionValues[key] === value);
    if (!next) return;
    setSelection(next.optionValues);
    setQuantity(1);
    // Shareable link to this variant without a navigation.
    const url = new URL(window.location.href);
    url.searchParams.set("variant", next.sku);
    window.history.replaceState(null, "", url);
  }

  const stockText =
    variant.stock <= 0
      ? t("outOfStock")
      : variant.stock <= LOW_STOCK
        ? t("lowStock", { count: variant.stock })
        : t("inStock");

  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <Price
          price={variant.price}
          compareAtPrice={variant.compareAtPrice}
          locale={locale}
          size="lg"
        />
        <p className="text-xs text-muted-foreground">
          {pricesIncludeTax ? t("inclTax") : t("exclTax")}
        </p>
      </div>

      {options.map((option) => (
        <fieldset key={option.key} className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">
            {option.label}:{" "}
            <span className="font-normal text-muted-foreground">
              {option.values.find((v) => v.value === selection[option.key])?.label}
            </span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {option.values.map((v) => {
              const candidate = variants.find((x) =>
                matches(x, { ...selection, [option.key]: v.value }),
              );
              const exists = variants.some((x) => x.optionValues[option.key] === v.value);
              const soldOut = !candidate || candidate.stock <= 0;
              const selected = selection[option.key] === v.value;
              return (
                <label
                  key={v.value}
                  className={cn(
                    "relative inline-flex min-w-11 cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                    selected && "border-primary bg-primary/5 font-medium",
                    soldOut && "text-muted-foreground line-through decoration-1",
                    !exists && "cursor-not-allowed opacity-40",
                  )}
                >
                  <input
                    type="radio"
                    name={`option-${option.key}`}
                    value={v.value}
                    checked={selected}
                    disabled={!exists}
                    onChange={() => choose(option.key, v.value)}
                    className="sr-only"
                  />
                  {soldOut ? (
                    <span aria-label={t("unavailable", { value: v.label })}>{v.label}</span>
                  ) : (
                    v.label
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      <p
        className={cn(
          "text-sm font-medium",
          variant.stock <= 0
            ? "text-destructive"
            : variant.stock <= LOW_STOCK
              ? "text-amber-700"
              : "text-emerald-700",
        )}
        aria-live="polite"
      >
        {stockText}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div
          className="inline-flex items-center rounded-md border"
          role="group"
          aria-label={t("quantity")}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={quantity <= 1}
            onClick={() => setQuantity((q) => q - 1)}
            aria-label={t("decrease")}
          >
            <Minus className="size-4" aria-hidden />
          </Button>
          <output className="w-10 text-center tabular-nums" aria-live="polite">
            {quantity}
          </output>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={quantity >= maxQty || variant.stock <= 0}
            onClick={() => setQuantity((q) => q + 1)}
            aria-label={t("increase")}
          >
            <Plus className="size-4" aria-hidden />
          </Button>
        </div>
        <Button
          type="button"
          size="lg"
          className="flex-1 sm:flex-none"
          disabled={variant.stock <= 0}
          onClick={() => toast.info(t("comingSoon"))}
        >
          <ShoppingCart className="size-4" aria-hidden />
          {t("addToCart")}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{t("sku", { sku: variant.sku })}</p>

      <DeliveryCheck variantId={variant.id} quantity={quantity} />
    </div>
  );
}
