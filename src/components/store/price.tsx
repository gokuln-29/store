import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/utils/money";

export function discountPercent(price: number, compareAtPrice: number | null): number | null {
  if (!compareAtPrice || compareAtPrice <= price) return null;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}

/** Selling price, struck-through MRP and discount. `from` shows "From ₹x" for price ranges. */
export function Price({
  price,
  compareAtPrice,
  locale,
  from = false,
  size = "md",
  className,
}: {
  price: number;
  compareAtPrice: number | null;
  locale: string;
  from?: boolean;
  size?: "md" | "lg";
  className?: string;
}) {
  const t = useTranslations("Product");
  const off = discountPercent(price, compareAtPrice);
  const amount = formatINR(price, locale);
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span className={cn("font-semibold tabular-nums", size === "lg" ? "text-2xl" : "text-base")}>
        {from ? t("from", { price: amount }) : amount}
      </span>
      {off && compareAtPrice && (
        <>
          <span
            className={cn(
              "text-muted-foreground tabular-nums line-through",
              size === "lg" ? "text-base" : "text-sm",
            )}
          >
            <span className="sr-only">{t("mrp")} </span>
            {formatINR(compareAtPrice, locale)}
          </span>
          <span
            className={cn("font-medium text-emerald-700", size === "lg" ? "text-base" : "text-sm")}
          >
            {t("off", { percent: off })}
          </span>
        </>
      )}
    </div>
  );
}
