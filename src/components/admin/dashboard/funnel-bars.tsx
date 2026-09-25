/** Funnel stages as horizontal bars (one hue); each shows its count and share of the previous stage. */
export function FunnelBars({
  stages,
  formatCount,
  ofPrevious,
}: {
  stages: { label: string; value: number }[];
  formatCount: (n: number) => string;
  ofPrevious: (percent: number) => string;
}) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <ol className="viz grid gap-3">
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1]!.value : null;
        const pct = prev ? Math.round((s.value / prev) * 1000) / 10 : null;
        return (
          <li key={s.label} className="grid gap-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span>{s.label}</span>
              <span className="tabular-nums">
                <span className="font-semibold">{formatCount(s.value)}</span>
                {pct !== null && (
                  <span className="ml-2 text-xs text-muted-foreground">{ofPrevious(pct)}</span>
                )}
              </span>
            </div>
            <div className="h-4 rounded bg-muted" aria-hidden>
              <div
                className="h-full rounded bg-[var(--viz-accent)]"
                style={{ width: `${(s.value / max) * 100}%` }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
