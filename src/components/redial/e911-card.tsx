"use client";

import { useState, useTransition } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveE911, type E911Form } from "@/lib/redial/phone-service-actions";

// A line's 911 address: where its phones are. Shown on the Phones page;
// desk phones can't be added until it's registered.

export type E911Row = { line_id: string; customer_name: string; street: string; street2: string | null; city: string; region: string; postal_code: string; status: "pending" | "registered" | "failed"; message: string | null; updated_at: string };

export function E911Card({ lineId, row, defaultName }: { lineId: string; row: E911Row | null; defaultName: string }) {
  const [editing, setEditing] = useState(!row || row.status === "failed");
  const [f, setF] = useState<E911Form>({
    customerName: row?.customer_name ?? defaultName, street: row?.street ?? "", street2: row?.street2 ?? "",
    city: row?.city ?? "", region: row?.region ?? "", postalCode: row?.postal_code ?? "",
  });
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const set = (p: Partial<E911Form>) => setF((x) => ({ ...x, ...p }));
  const id = (k: string) => `e911-${lineId}-${k}`;

  function save() {
    start(async () => {
      const r = await saveE911(lineId, f);
      setMsg(r.error ? { text: r.error, error: true } : { text: r.ok ?? "Saved." });
      if (!r.error) setEditing(false);
    });
  }

  const ok = row?.status === "registered";
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {ok ? <ShieldCheck className="size-5 shrink-0 self-start text-emerald-600 dark:text-emerald-400" /> : <ShieldAlert className="size-5 shrink-0 self-start text-destructive" />}
        <div className="min-w-0 flex-1">
          <p className="font-medium">911 address</p>
          {row && !editing ? (
            <p className="text-sm text-muted-foreground">{row.street}{row.street2 ? `, ${row.street2}` : ""}, {row.city}, {row.region} {row.postal_code}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Where this line&apos;s phones are. 911 calls from your Redial number send this address to emergency services.</p>
          )}
        </div>
        {row && (
          <div className="flex items-center gap-3">
            <Badge variant={ok ? "success" : "outline"}>{ok ? "Registered" : row.status === "pending" ? "Registering" : "Not registered"}</Badge>
            {!editing && <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Change</Button>}
          </div>
        )}
      </div>

      {editing && (
        <div className="grid gap-3 sm:grid-cols-6">
          <div className="space-y-1 sm:col-span-6"><Label htmlFor={id("name")}>Name on the account</Label><Input id={id("name")} value={f.customerName} onChange={(e) => set({ customerName: e.target.value })} placeholder="Business or your name" /></div>
          <div className="space-y-1 sm:col-span-4"><Label htmlFor={id("street")}>Street address</Label><Input id={id("street")} value={f.street} onChange={(e) => set({ street: e.target.value })} autoComplete="address-line1" /></div>
          <div className="space-y-1 sm:col-span-2"><Label htmlFor={id("street2")}>Suite or unit</Label><Input id={id("street2")} value={f.street2} onChange={(e) => set({ street2: e.target.value })} autoComplete="address-line2" /></div>
          <div className="space-y-1 sm:col-span-3"><Label htmlFor={id("city")}>City</Label><Input id={id("city")} value={f.city} onChange={(e) => set({ city: e.target.value })} autoComplete="address-level2" /></div>
          <div className="space-y-1 sm:col-span-1"><Label htmlFor={id("state")}>State</Label><Input id={id("state")} value={f.region} maxLength={2} onChange={(e) => set({ region: e.target.value.toUpperCase() })} placeholder="AZ" autoComplete="address-level1" /></div>
          <div className="space-y-1 sm:col-span-2"><Label htmlFor={id("zip")}>ZIP code</Label><Input id={id("zip")} value={f.postalCode} inputMode="numeric" onChange={(e) => set({ postalCode: e.target.value })} autoComplete="postal-code" /></div>
          <div className="flex flex-wrap gap-2 sm:col-span-6">
            <Button disabled={pending} onClick={save}>{pending ? "Registering…" : "Register 911 address"}</Button>
            {row && <Button variant="ghost" disabled={pending} onClick={() => setEditing(false)}>Cancel</Button>}
          </div>
        </div>
      )}

      {msg && <p className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.text}</p>}
      {!msg && row?.message && row.status !== "registered" && <p className="text-sm text-destructive">{row.message}</p>}
      <p className="text-xs text-muted-foreground">Internet phones need power and a connection: 911 won&apos;t work in an outage unless your router and phones have backup power. Update this whenever the phones move. Your mobile is always a backup for 911.</p>
    </div>
  );
}
