"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type Unit = "count" | "money" | "minutes";
export type Point = { bucket: string; value: number };

export const formatValue = (v: number, unit: Unit) =>
  unit === "money" ? v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: v >= 1000 ? 0 : 2 })
  : unit === "minutes" ? `${Math.round(v).toLocaleString()} min`
  : Math.round(v).toLocaleString();

const label = (bucket: string, by: string) => {
  const d = new Date(`${bucket}T00:00:00`);
  return by === "year" ? String(d.getFullYear())
    : by === "month" ? d.toLocaleDateString([], { month: "short", year: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
};

// One metric over time: thin bars from a shared baseline, a hover tooltip on
// each bar, and a table view for screen readers and exact numbers.
export function BarChart({ title, points, unit, by }: { title: string; points: Point[]; unit: Unit; by: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = Math.max(...points.map((p) => p.value), 0);
  const total = points.reduce((n, p) => n + p.value, 0);
  const ticks = points.length > 1 ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : [0];
  const h = hover !== null ? points[hover] : null;

  return (
    <figure className="space-y-3 rounded-xl border bg-card p-4">
      <figcaption className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="text-xl font-semibold tabular-nums">{formatValue(total, unit)}</p>
        </div>
        <button type="button" onClick={() => setTable((t) => !t)} className="text-xs text-muted-foreground hover:text-foreground">{table ? "Chart" : "Table"}</button>
      </figcaption>
      {table ? (
        <div className="max-h-44 overflow-y-auto text-xs">
          <table className="w-full">
            <thead><tr className="text-left text-muted-foreground"><th className="py-1 font-medium">Period</th><th className="py-1 text-right font-medium">{title}</th></tr></thead>
            <tbody>{points.map((p) => <tr key={p.bucket} className="border-t"><td className="py-1">{label(p.bucket, by)}</td><td className="py-1 text-right tabular-nums">{formatValue(p.value, unit)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border" />
          <span className="pointer-events-none absolute -top-2 right-0 bg-card pl-1 text-[10px] text-muted-foreground tabular-nums">{formatValue(max, unit)}</span>
          <div className="flex h-32 items-end gap-[2px] border-b border-border" onMouseLeave={() => setHover(null)} role="img" aria-label={`${title}: ${formatValue(total, unit)} in total`}>
            {points.map((p, i) => (
              <div key={p.bucket} className="flex h-full min-w-0 flex-1 items-end" onMouseEnter={() => setHover(i)}>
                <div className={cn("w-full rounded-t-[4px] bg-viz-1 transition-opacity", hover !== null && hover !== i && "opacity-50")}
                  style={{ height: max ? `${Math.max(p.value > 0 ? 2 : 0, (p.value / max) * 100)}%` : 0 }} />
              </div>
            ))}
          </div>
          {h && (
            <div className="pointer-events-none absolute -top-9 z-10 -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap shadow-sm"
              style={{ left: `${((hover! + 0.5) / points.length) * 100}%` }}>
              <span className="text-muted-foreground">{label(h.bucket, by)}</span> <span className="font-medium tabular-nums">{formatValue(h.value, unit)}</span>
            </div>
          )}
          <div className="relative mt-1 h-4 text-[10px] text-muted-foreground">
            {ticks.map((i) => (
              <span key={i} className={cn("absolute", i === 0 ? "left-0" : i === points.length - 1 ? "right-0" : "-translate-x-1/2")}
                style={i !== 0 && i !== points.length - 1 ? { left: `${((i + 0.5) / points.length) * 100}%` } : undefined}>
                {points[i] && label(points[i].bucket, by)}
              </span>
            ))}
          </div>
        </div>
      )}
    </figure>
  );
}
