import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Label · value · change vs the previous period (icon + sign, never color alone). */
export function StatTile({
  label,
  value,
  change,
  changeLabel,
  hint,
}: {
  label: string;
  value: string;
  /** Percent change; null = nothing to compare with. */
  change: number | null;
  changeLabel: string;
  hint?: string;
}) {
  const Icon = change === null || change === 0 ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="grid gap-1 rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      <p
        className={cn(
          "flex items-center gap-1 text-xs",
          change === null || change === 0
            ? "text-muted-foreground"
            : change > 0
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-rose-700 dark:text-rose-400",
        )}
      >
        <Icon className="size-3.5" aria-hidden />
        {change === null ? changeLabel : `${change > 0 ? "+" : ""}${change}% ${changeLabel}`}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
