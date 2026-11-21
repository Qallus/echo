"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pick } from "@/components/ui/pick";
import { deleteSocial, saveSocial } from "@/lib/admin/actions/analytics";

export type SocialRow = { id: string; month: string; network: string; followers: number | null; reach: number | null; engagements: number | null; posts: number | null; clicks: number | null; calls: number | null; notes: string | null };

export const NETWORK_LABELS: Record<string, string> = {
  linkedin: "LinkedIn", facebook: "Facebook", instagram: "Instagram", x: "X", youtube: "YouTube", tiktok: "TikTok",
  nextdoor: "Nextdoor", google_business: "Google Business Profile", other: "Other",
};

const FIELDS: [string, string][] = [["followers", "Followers"], ["reach", "Reach / views"], ["engagements", "Engagements"], ["posts", "Posts"], ["clicks", "Website clicks"], ["calls", "Calls (Business Profile)"]];

// Monthly numbers from each network's insights page (one row per network and
// month; saving again updates it).
export function SocialManager({ rows, canEdit }: { rows: SocialRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [network, setNetwork] = useState("linkedin");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  if (!canEdit) return null;
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Add this month&apos;s numbers</h3>
        <span className="text-xs text-muted-foreground">From LinkedIn Page analytics, Meta Business Suite, Google Business Profile and others.</span>
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => setOpen((o) => !o)}><Plus /> Add</Button>
      </div>
      {open && (
        <form className="grid gap-3 rounded-lg bg-muted/40 p-3 sm:grid-cols-3 lg:grid-cols-4" onSubmit={(e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
          start(async () => { const r = await saveSocial({ ...f, network }); if (r.error) setError(r.error); else { setError(undefined); setOpen(false); router.refresh(); } });
        }}>
          <div className="space-y-1.5"><Label htmlFor="so-month">Month</Label><Input id="so-month" name="month" type="month" defaultValue={new Date().toISOString().slice(0, 7)} required /></div>
          <div className="space-y-1.5"><Label htmlFor="so-net">Network</Label>
            <Pick id="so-net" label="Network" value={network} onChange={setNetwork} options={Object.entries(NETWORK_LABELS).map(([value, label]) => ({ value, label }))} /></div>
          {FIELDS.map(([k, l]) => <div key={k} className="space-y-1.5"><Label htmlFor={`so-${k}`}>{l}</Label><Input id={`so-${k}`} name={k} inputMode="numeric" /></div>)}
          <div className="flex items-center gap-2 sm:col-span-3 lg:col-span-4">
            <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            {error && <span className="text-sm text-destructive">{error}</span>}
          </div>
        </form>
      )}
      {rows.length > 0 && (
        <ul className="divide-y rounded-lg border text-sm">
          {rows.slice(0, 12).map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-1.5">
              <span className="w-20 tabular-nums text-muted-foreground">{r.month.slice(0, 7)}</span>
              <span className="flex-1">{NETWORK_LABELS[r.network] ?? r.network}</span>
              <Button size="icon-xs" variant="ghost" aria-label="Delete" onClick={() => start(async () => { await deleteSocial(r.id); router.refresh(); })}><Trash2 /></Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
