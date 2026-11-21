"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pick } from "@/components/ui/pick";
import { deleteSpend, saveSpend } from "@/lib/admin/actions/analytics";
import { CHANNELS } from "@/lib/analytics/channels";

export type SpendRow = { id: string; month: string; channel: string; source: string | null; amount_cents: number; clicks: number | null; impressions: number | null; conversions: number | null; notes: string | null };

const thisMonth = () => new Date().toISOString().slice(0, 7);

// Ad and campaign spend by month (Google Ads, Meta Ads, sponsorships, print):
// gives cost per signup on the Channels table. Enter it from each ad account.
export function SpendManager({ rows, canEdit }: { rows: SpendRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [channel, setChannel] = useState("ads");

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Spend</h3>
        <span className="text-xs text-muted-foreground">Monthly ad and campaign spend, for cost per signup.</span>
        {canEdit && <Button size="sm" variant="outline" className="ml-auto" onClick={() => setOpen((o) => !o)}><Plus /> Add spend</Button>}
      </div>
      {open && (
        <form className="grid gap-3 rounded-lg bg-muted/40 p-3 sm:grid-cols-3 lg:grid-cols-6" onSubmit={(e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
          start(async () => {
            const r = await saveSpend({ ...f, channel });
            if (r.error) setError(r.error); else { setError(undefined); setOpen(false); router.refresh(); }
          });
        }}>
          <div className="space-y-1.5"><Label htmlFor="sp-month">Month</Label><Input id="sp-month" name="month" type="month" defaultValue={thisMonth()} required /></div>
          <div className="space-y-1.5"><Label htmlFor="sp-channel">Channel</Label>
            <Pick id="sp-channel" label="Channel" value={channel} onChange={setChannel} options={Object.entries(CHANNELS).filter(([k]) => k !== "direct").map(([value, label]) => ({ value, label }))} /></div>
          <div className="space-y-1.5"><Label htmlFor="sp-source">Source</Label><Input id="sp-source" name="source" placeholder="Google Ads, Meta…" /></div>
          <div className="space-y-1.5"><Label htmlFor="sp-amount">Amount ($)</Label><Input id="sp-amount" name="amount" inputMode="decimal" required placeholder="250" /></div>
          <div className="space-y-1.5"><Label htmlFor="sp-clicks">Clicks</Label><Input id="sp-clicks" name="clicks" inputMode="numeric" /></div>
          <div className="space-y-1.5"><Label htmlFor="sp-conv">Conversions</Label><Input id="sp-conv" name="conversions" inputMode="numeric" /></div>
          <div className="flex items-center gap-2 sm:col-span-3 lg:col-span-6">
            <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            {error && <span className="text-sm text-destructive">{error}</span>}
          </div>
        </form>
      )}
      {rows.length ? (
        <ul className="divide-y rounded-lg border text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <span className="w-20 tabular-nums text-muted-foreground">{r.month.slice(0, 7)}</span>
              <span className="font-medium">{CHANNELS[r.channel as keyof typeof CHANNELS] ?? r.channel}{r.source ? ` · ${r.source}` : ""}</span>
              <span className="ml-auto tabular-nums">{(r.amount_cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}</span>
              {r.clicks != null && <span className="text-xs text-muted-foreground">{r.clicks.toLocaleString()} clicks</span>}
              {canEdit && <Button size="icon-xs" variant="ghost" aria-label="Delete" onClick={() => start(async () => { await deleteSpend(r.id); router.refresh(); })}><Trash2 /></Button>}
            </li>
          ))}
        </ul>
      ) : <p className="text-xs text-muted-foreground">No spend entered. Organic channels (search, AI, referrals) have no cost.</p>}
    </section>
  );
}
