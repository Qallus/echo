"use client";

import { useState, useTransition } from "react";
import { BarChart3, Columns3, GanttChart, List, Network, PieChart, Table2 } from "lucide-react";
import { MindMap } from "@/components/recording/mind-map";
import { setSummaryVisual } from "@/lib/actions";
import { STATUS_LABEL, VISUALS, type ItemStatus, type VisualItem, type VisualKind } from "@/lib/visuals";
import { cn } from "@/lib/utils";

const ICONS: Record<VisualKind, typeof List> = { mindmap: Network, list: List, bars: BarChart3, timeline: GanttChart, kanban: Columns3, pie: PieChart, table: Table2 };
const COLORS = ["#3b82f6", "#22c55e", "#a855f7", "#f59e0b", "#ec4899", "#14b8a6", "#ef4444", "#84cc16", "#0ea5e9", "#f97316"];
const STATUS_COLOR: Record<ItemStatus, string> = { idea: "#94a3b8", planned: "#3b82f6", in_progress: "#f59e0b", blocked: "#ef4444", done: "#22c55e" };
const ORDER: ItemStatus[] = ["idea", "planned", "in_progress", "blocked", "done"];

// The summary's picture: switch between a mind map and charts of the same items.
export function SummaryVisual({ recordingId, initial, root, branches, items }: {
  recordingId: string; initial: VisualKind | null; root: string; branches: string[]; items: VisualItem[];
}) {
  const [kind, setKind] = useState<VisualKind>(initial ?? "mindmap");
  const [, start] = useTransition();
  const pick = (k: VisualKind) => { setKind(k); start(async () => { await setSummaryVisual(recordingId, k); }); };
  const groups = [...new Set(items.map((i) => i.group))];
  const color = (g: string) => COLORS[groups.indexOf(g) % COLORS.length];

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Visualization style" className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
        {VISUALS.map((v) => {
          const Icon = ICONS[v.id];
          return (
            <button key={v.id} type="button" role="tab" aria-selected={kind === v.id} onClick={() => pick(v.id)}
              className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition", kind === v.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="size-3.5" />{v.label}
            </button>
          );
        })}
      </div>
      <div className="rounded-xl border p-4">
        {kind === "mindmap" && <MindMap root={root} branches={branches.length ? branches : items.map((i) => i.label).slice(0, 7)} />}

        {kind === "list" && (
          <div className="grid gap-4 sm:grid-cols-2">
            {groups.map((g) => (
              <div key={g}>
                <p className="mb-1.5 flex items-center gap-2 text-sm font-medium"><span className="size-2.5 rounded-full" style={{ background: color(g) }} />{g}</p>
                <ul className="space-y-1 pl-4 text-sm">
                  {items.filter((i) => i.group === g).map((i) => <li key={i.label} className="flex items-center justify-between gap-2"><span>{i.label}</span><StatusPill s={i.status} /></li>)}
                </ul>
              </div>
            ))}
          </div>
        )}

        {kind === "bars" && (
          <div className="space-y-2.5">
            {[...items].sort((a, b) => b.weight - a.weight).map((i) => (
              <div key={i.label} className="grid grid-cols-[minmax(0,10rem)_1fr] items-center gap-3 text-xs sm:grid-cols-[minmax(0,14rem)_1fr]">
                <span className="truncate font-medium" title={i.label}>{i.label}</span>
                <div className="h-6 overflow-hidden rounded-md bg-muted">
                  <div className="flex h-full items-center justify-end rounded-md pr-2 text-[11px] font-semibold text-white" style={{ width: `${i.weight}%`, background: color(i.group) }}>{i.weight}%</div>
                </div>
              </div>
            ))}
            <p className="pt-1 text-[11px] text-muted-foreground">How much each topic came up, as a share of the conversation&apos;s focus.</p>
          </div>
        )}

        {kind === "timeline" && <Timeline items={items} color={color} />}

        {kind === "kanban" && (
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {ORDER.map((s) => {
              const list = items.filter((i) => i.status === s);
              return (
                <div key={s} className="min-h-24 rounded-lg bg-muted/50 p-2">
                  <p className="mb-2 flex items-center justify-between text-xs font-medium"><span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: STATUS_COLOR[s] }} />{STATUS_LABEL[s]}</span><span className="text-muted-foreground">{list.length}</span></p>
                  <div className="space-y-1.5">{list.map((i) => <div key={i.label} className="rounded-md border bg-card p-2 text-xs"><p className="font-medium">{i.label}</p><p className="text-muted-foreground">{i.group}</p></div>)}</div>
                </div>
              );
            })}
          </div>
        )}

        {kind === "pie" && <Pie items={items} groups={groups} color={color} />}

        {kind === "table" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 pr-3 font-medium">Item</th><th className="py-2 pr-3 font-medium">Group</th><th className="py-2 pr-3 font-medium">Status</th><th className="py-2 pr-3 font-medium">Focus</th><th className="py-2 font-medium">Dates</th></tr></thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.label} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{i.label}</td><td className="py-2 pr-3 text-muted-foreground">{i.group}</td>
                    <td className="py-2 pr-3"><StatusPill s={i.status} /></td><td className="py-2 pr-3 tabular-nums">{i.weight}%</td>
                    <td className="py-2 text-muted-foreground">{[i.start, i.end].filter(Boolean).join(" → ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ s }: { s: ItemStatus }) {
  return <span className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"><span className="size-1.5 rounded-full" style={{ background: STATUS_COLOR[s] }} />{STATUS_LABEL[s]}</span>;
}

// Gantt-style rows. Items with dates sit on a date scale; without dates they
// are laid out in order, one step each.
function Timeline({ items, color }: { items: VisualItem[]; color: (g: string) => string }) {
  const dated = items.filter((i) => i.start || i.end);
  const day = (s: string) => Date.parse(`${s}T00:00:00`);
  if (dated.length) {
    const starts = dated.map((i) => day(i.start ?? i.end!)), ends = dated.map((i) => day(i.end ?? i.start!));
    const min = Math.min(...starts), max = Math.max(...ends, min + 86400000);
    const span = max - min;
    const fmt = (t: number) => new Date(t).toLocaleDateString([], { month: "short", day: "numeric" });
    return (
      <div className="space-y-2">
        <div className="flex justify-between pl-[40%] text-[10px] text-muted-foreground"><span>{fmt(min)}</span><span>{fmt(max)}</span></div>
        {dated.map((i) => {
          const a = day(i.start ?? i.end!), b = day(i.end ?? i.start!);
          return (
            <div key={i.label} className="grid grid-cols-[40%_1fr] items-center gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-2"><span className="truncate font-medium">{i.label}</span><StatusPill s={i.status} /></span>
              <div className="relative h-4 rounded bg-muted">
                <div className="absolute h-full rounded" title={[i.start, i.end].filter(Boolean).join(" → ")} style={{ left: `${((a - min) / span) * 100}%`, width: `${Math.max(3, ((b - a) / span) * 100)}%`, background: color(i.group) }} />
              </div>
            </div>
          );
        })}
        {dated.length < items.length && <p className="pt-1 text-[11px] text-muted-foreground">{items.length - dated.length} item{items.length - dated.length === 1 ? " has" : "s have"} no dates; see Table.</p>}
      </div>
    );
  }
  const steps = Math.max(4, items.length);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[40%_1fr] text-[10px] text-muted-foreground"><span /><span className="flex justify-between"><span>Step 1</span><span>Step {steps}</span></span></div>
      {items.map((i, n) => (
        <div key={i.label} className="grid grid-cols-[40%_1fr] items-center gap-2 text-xs">
          <span className="flex min-w-0 items-center gap-2"><span className="truncate font-medium">{i.label}</span><StatusPill s={i.status} /></span>
          <div className="relative h-4 rounded bg-muted"><div className="absolute h-full rounded" style={{ left: `${(n / steps) * 100}%`, width: `${Math.max(100 / steps, (i.weight / 100) * (200 / steps))}%`, background: color(i.group) }} /></div>
        </div>
      ))}
      <p className="pt-1 text-[11px] text-muted-foreground">No dates were discussed, so items are shown in the order they came up.</p>
    </div>
  );
}

function Pie({ items, groups, color }: { items: VisualItem[]; groups: string[]; color: (g: string) => string }) {
  const totals = groups.map((g) => ({ g, v: items.filter((i) => i.group === g).reduce((n, i) => n + i.weight, 0) }));
  const sum = totals.reduce((n, t) => n + t.v, 0) || 1;
  const arcs = totals.map((t, i) => {
    const before = totals.slice(0, i).reduce((n, x) => n + x.v, 0);
    const from = -Math.PI / 2 + (before / sum) * Math.PI * 2;
    const a = (t.v / sum) * Math.PI * 2;
    const [x1, y1] = [50 + 40 * Math.cos(from), 50 + 40 * Math.sin(from)];
    const [x2, y2] = [50 + 40 * Math.cos(from + a), 50 + 40 * Math.sin(from + a)];
    return { ...t, d: totals.length === 1 ? "M50 10 A40 40 0 1 1 49.99 10 Z" : `M50 50 L${x1} ${y1} A40 40 0 ${a > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z` };
  });
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <svg viewBox="0 0 100 100" className="size-48 shrink-0" role="img" aria-label="Pie chart of topics by group">
        {arcs.map((a) => <path key={a.g} d={a.d} fill={color(a.g)} stroke="var(--background)" strokeWidth="1" />)}
        <circle cx="50" cy="50" r="18" fill="var(--background)" />
      </svg>
      <ul className="space-y-1.5 text-sm">
        {arcs.map((a) => <li key={a.g} className="flex items-center gap-2"><span className="size-2.5 rounded-sm" style={{ background: color(a.g) }} />{a.g}<span className="text-muted-foreground tabular-nums">{Math.round((a.v / sum) * 100)}%</span></li>)}
      </ul>
    </div>
  );
}
