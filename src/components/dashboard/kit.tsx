"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { LucideIcon } from "lucide-react";
import type { Count, DayPoint } from "@/lib/dashboard/data";
import { cn } from "@/lib/utils";

// Building blocks every dashboard card shares, so they look like one family.

export const SKY = "oklch(0.62 0.17 250)";
export const MINT = "oklch(0.7 0.15 160)";
export const AMBER = "oklch(0.78 0.16 75)";
export const ROSE = "oklch(0.65 0.2 15)";

export function Frame({ title, icon: Icon, href, action, children, className, bodyClassName }: {
  title?: string; icon?: LucideIcon; href?: string; action?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string;
}) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col rounded-2xl border bg-card p-4 text-card-foreground shadow-xs", className)}>
      {title && (
        <div className="mb-3 flex items-center gap-2">
          {Icon && <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted"><Icon className="size-3.5" /></span>}
          <h3 className="min-w-0 flex-1 truncate text-sm font-medium">{title}</h3>
          {action}
          {href && <Link href={href} className="text-xs text-muted-foreground hover:text-foreground" aria-label={`Open ${title}`}><ArrowRight className="size-4" /></Link>}
        </div>
      )}
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </div>
  );
}

export function Change({ count }: { count: Count }) {
  if (!count.last && !count.now) return <span className="text-xs text-muted-foreground">No activity yet</span>;
  if (!count.last) return <span className="text-xs text-muted-foreground">New this month</span>;
  const pct = Math.round(((count.now - count.last) / count.last) * 100);
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs", up ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
      <Icon className="size-3.5" />{Math.abs(pct)}% <span className="text-muted-foreground">vs last month</span>
    </span>
  );
}

export function Spark({ points, color = SKY, field = "a" }: { points: DayPoint[]; color?: string; field?: "a" | "b" }) {
  if (!points.some((p) => p[field] > 0)) return null;
  const id = `spark-${field}-${color.replace(/\W/g, "")}`;
  return (
    <div className="pointer-events-none -mx-1 mt-auto h-12 shrink-0 pt-2" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={field} stroke={color} strokeWidth={1.75} fill={`url(#${id})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** One number with its label, change against last month and an optional sparkline. */
export function Stat({ label, icon: Icon, value, count, hint, href, spark, chips, tone }: {
  label: string; icon: LucideIcon; value: React.ReactNode; count?: Count | null; hint?: React.ReactNode; href?: string;
  spark?: React.ReactNode; chips?: { label: string; value: number }[]; tone?: "warn" | "good";
}) {
  const body = (
    <div className={cn("flex h-full flex-col rounded-2xl border bg-card p-4 shadow-xs transition-colors", href && "hover:bg-muted/40",
      tone === "warn" && "border-amber-500/40")}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5" /> <span className="truncate">{label}</span>
      </div>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <div className="mt-0.5 min-h-4">{count ? <Change count={count} /> : hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}</div>
      {chips && chips.length > 0 && (
        // One row; slides sideways when the chips don't fit the card.
        <div className="-mx-4 mt-2 flex snap-x gap-1 overflow-x-auto overscroll-x-contain px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {chips.map((c) => <span key={c.label} className="shrink-0 snap-start rounded-full bg-muted px-2 py-0.5 text-[11px] whitespace-nowrap tabular-nums">{c.label} {c.value}</span>)}
        </div>
      )}
      {spark}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

export function Empty({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-4 text-center text-sm text-muted-foreground">
      <p>{children}</p>
      {action}
    </div>
  );
}

export const ago = (iso: string) => {
  const s = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};
