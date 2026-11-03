"use client";

import { useEffect, useState, useTransition } from "react";
import { Copy, Eye, Heart, MousePointerClick, Nfc, QrCode, Send, Share2, UserPlus } from "lucide-react";
import { cardAnalytics } from "@/lib/admin/actions/cards";
import type { CardAnalytics } from "@/lib/cards/types";
import { cn } from "@/lib/utils";

// One card's activity: totals, a daily chart and top links.
export function CardAnalyticsView({ cardId }: { cardId: string }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<CardAnalytics | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  useEffect(() => {
    start(async () => { const r = await cardAnalytics(cardId, days); if ("error" in r) setError(r.error); else { setData(r); setError(undefined); } });
  }, [cardId, days]);

  const t = data?.totals;
  const tiles = [
    ["Views", t?.view, Eye, "text-blue-500"], ["Clicks", t?.click, MousePointerClick, "text-amber-500"], ["Shares", t?.share, Share2, "text-violet-500"],
    ["Saves", t?.save, UserPlus, "text-emerald-500"], ["Leads", t?.lead, Send, "text-rose-500"], ["Likes", t?.like, Heart, "text-pink-500"],
    ["QR scans", t?.qr, QrCode, "text-foreground"], ["NFC taps", t?.nfc, Nfc, "text-cyan-500"],
  ] as const;
  const max = Math.max(1, ...(data?.daily.map((d) => d.views + d.clicks) ?? [1]));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <div className="flex items-center rounded-lg border bg-card p-0.5 text-xs">
          {[7, 30, 90].map((r) => <button key={r} type="button" onClick={() => setDays(r)} className={cn("rounded-md px-3 py-1.5 font-medium", days === r ? "bg-accent text-foreground" : "text-muted-foreground")}>{r} days</button>)}
        </div>
      </div>
      {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {tiles.map(([label, value, Icon, tint]) => (
          <div key={label} className="rounded-xl border bg-card px-4 py-3">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><Icon className={cn("size-3.5", tint)} />{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{pending && !data ? "—" : value ?? 0}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold">Activity</p>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-blue-500" />Views</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-amber-500" />Clicks</span>
            </div>
          </div>
          <div className="flex h-44 items-end gap-0.5">
            {(data?.daily ?? []).map((d) => (
              <div key={d.date} className="flex h-full flex-1 flex-col justify-end" title={`${d.date}: ${d.views} views, ${d.clicks} clicks`}>
                <div className="w-full rounded-t-sm bg-amber-500/80" style={{ height: `${(d.clicks / max) * 100}%` }} />
                <div className="w-full bg-blue-500/80" style={{ height: `${(d.views / max) * 100}%` }} />
              </div>
            ))}
          </div>
          {data && <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>{data.daily[0]?.date}</span><span>{data.daily.at(-1)?.date}</span></div>}
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-3 text-sm font-semibold">Top links</p>
          {data?.topLinks.length ? (
            <div className="space-y-2">
              {data.topLinks.map((l) => (
                <div key={l.label}>
                  <div className="mb-0.5 flex items-center justify-between text-xs"><span className="truncate">{l.label}</span><span className="text-muted-foreground tabular-nums">{l.count}</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(l.count / data.topLinks[0].count) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-muted-foreground">No link clicks yet.</p>}
          <p className="mt-4 flex items-center gap-1.5 border-t pt-3 text-[11px] text-muted-foreground"><Copy className="size-3" /> Links copied: <span className="font-medium text-foreground">{t?.copy ?? 0}</span></p>
        </div>
      </div>
    </div>
  );
}
