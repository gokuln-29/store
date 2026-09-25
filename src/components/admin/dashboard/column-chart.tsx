"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { formatINR } from "@/lib/utils/money";

export type ColumnPoint = { label: string; value: number; display: string };

const HEIGHT = 180;
const PAD = { top: 20, right: 8, bottom: 24, left: 56 };

/** 0, 1, 2, 2.5, 5 × 10ⁿ steps so ticks read as clean numbers. */
function niceMax(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 1, step: 1 };
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough)!;
  return { top: Math.ceil(max / step) * step, step };
}

/**
 * Single-series column chart (SVG). Hover or arrow keys show a tooltip; the peak is labelled;
 * a table view below carries every value for screen readers and exact reading.
 */
export function ColumnChart({
  title,
  points,
  format,
  locale,
  tableLabels,
}: {
  title: string;
  points: ColumnPoint[];
  /** How axis ticks are written: rupees from paise, or plain counts. */
  format: "inr" | "count";
  locale: string;
  tableLabels: { period: string; value: string; showTable: string };
}) {
  const formatTick = (value: number) =>
    format === "inr"
      ? formatINR(value, locale)
      : new Intl.NumberFormat(`${locale}-IN`, { numberingSystem: "latn" }).format(value);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [active, setActive] = useState<number | null>(null);
  const id = useId();

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(260, Math.round(entry!.contentRect.width))),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const max = Math.max(0, ...points.map((p) => p.value));
  const { top, step } = niceMax(max);
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(1, points.length);
  const barW = Math.max(2, Math.min(24, slot - 2)); // leaves at least a 2px gap between bars
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const labelEvery = Math.ceil(points.length / Math.max(2, Math.floor(plotW / 56)));
  const peak = max > 0 ? points.findIndex((p) => p.value === max) : -1;

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") setActive((i) => Math.min(points.length - 1, (i ?? -1) + 1));
    else if (e.key === "ArrowLeft") setActive((i) => Math.max(0, (i ?? points.length) - 1));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  };

  const bar = (value: number) => {
    const h = Math.max(0, PAD.top + plotH - y(value));
    return { h, r: Math.min(4, barW / 2, h) };
  };

  return (
    <figure className="viz grid gap-2">
      <figcaption className="text-sm font-medium">{title}</figcaption>
      <div ref={box} className="relative">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={title}
          aria-describedby={`${id}-table`}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
          className="block max-w-full overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke={t === 0 ? "var(--viz-axis)" : "var(--viz-grid)"}
                strokeWidth={1}
              />
              <text
                x={PAD.left - 6}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                className="fill-muted-foreground text-[11px] tabular-nums"
              >
                {formatTick(t)}
              </text>
            </g>
          ))}
          {points.map((p, i) => {
            const x = PAD.left + i * slot + (slot - barW) / 2;
            const { h, r } = bar(p.value);
            const yTop = PAD.top + plotH - h;
            return (
              <g key={p.label}>
                {h > 0 && (
                  <path
                    d={`M${x},${yTop + h}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + barW - r}Q${x + barW},${yTop} ${x + barW},${yTop + r}V${yTop + h}Z`}
                    fill={
                      active === null || active === i
                        ? "var(--viz-accent)"
                        : "var(--viz-accent-soft)"
                    }
                  />
                )}
                {/* Hit target: the whole slot, taller than the bar. */}
                <rect
                  x={PAD.left + i * slot}
                  y={PAD.top}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  onPointerMove={() => setActive(i)}
                />
                {i % labelEvery === 0 && (
                  <text
                    x={x + barW / 2}
                    y={HEIGHT - 6}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[11px]"
                  >
                    {p.label}
                  </text>
                )}
                {i === peak && active === null && (
                  <text
                    x={x + barW / 2}
                    y={yTop - 6}
                    textAnchor="middle"
                    className="fill-foreground text-[11px] font-medium"
                  >
                    {p.display}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {active !== null && points[active] && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-xs shadow-sm"
            style={{
              left: Math.min(width - 60, Math.max(60, PAD.left + active * slot + slot / 2)),
            }}
          >
            <p className="font-semibold">{points[active].display}</p>
            <p className="text-muted-foreground">{points[active].label}</p>
          </div>
        )}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">{tableLabels.showTable}</summary>
        <table id={`${id}-table`} className="mt-2 w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="py-1 font-medium">{tableLabels.period}</th>
              <th className="py-1 text-right font-medium">{tableLabels.value}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.label} className="border-b last:border-0">
                <td className="py-1">{p.label}</td>
                <td className="py-1 text-right tabular-nums">{p.display}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
