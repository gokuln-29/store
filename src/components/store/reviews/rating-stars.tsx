import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Read-only stars (supports halves visually by rounding to the nearest half). */
export function RatingStars({
  value,
  count,
  size = "sm",
  className,
}: {
  value: number;
  count?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const t = useTranslations("Reviews");
  const rounded = Math.round(value * 2) / 2;
  const icon = size === "sm" ? "size-3.5" : "size-5";
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span role="img" aria-label={t("ratedOutOf", { rating: value })} className="inline-flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={cn("relative", icon)} aria-hidden>
            <Star className={cn(icon, "text-muted-foreground/40")} />
            {rounded >= n - 0.5 && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: rounded >= n ? "100%" : "50%" }}
              >
                <Star className={cn(icon, "fill-amber-400 text-amber-500")} />
              </span>
            )}
          </span>
        ))}
      </span>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground tabular-nums">
          ({t("count", { count })})
        </span>
      )}
    </span>
  );
}
