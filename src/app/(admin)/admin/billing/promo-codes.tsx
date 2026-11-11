"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pick } from "@/components/ui/pick";
import { Switch } from "@/components/ui/switch";
import { createPromoCode, setPromoCodeActive } from "@/lib/admin/actions/billing";

export type PromoRow = { id: string; code: string; active: boolean; redeemed: number; max: number | null; summary: string };
const TYPE_OPTIONS = [{ value: "percent", label: "% off" }, { value: "amount", label: "$ off" }];
const DURATION_OPTIONS = [{ value: "once", label: "First payment" }, { value: "repeating", label: "For some months" }, { value: "forever", label: "Forever" }];

// Stripe promotion codes customers enter at checkout.
export function PromoCodes({ codes, readOnly }: { codes: PromoRow[]; readOnly: boolean }) {
  const [f, setF] = useState({ code: "", type: "percent" as "percent" | "amount", value: "", duration: "once" as "once" | "repeating" | "forever", months: "", max: "" });
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      {codes.length === 0 ? <p className="rounded-xl border p-4 text-sm text-muted-foreground">No promotion codes yet.</p> : (
        <ul className="divide-y rounded-xl border text-sm">
          {codes.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 p-3">
              <code className="font-semibold">{c.code}</code>
              <span className="text-muted-foreground">{c.summary}</span>
              <Badge variant="outline">{c.redeemed}{c.max ? ` / ${c.max}` : ""} used</Badge>
              <span className="ml-auto flex items-center gap-2 text-xs">
                <Switch size="sm" checked={c.active} disabled={readOnly || pending} onCheckedChange={(on) => start(async () => setMsg(await setPromoCodeActive(c.id, on)))} />
                {c.active ? "On" : "Off"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (adding ? (
        <form className="grid gap-2 rounded-xl border p-4 sm:grid-cols-3" onSubmit={(e) => {
          e.preventDefault();
          const value = Number(f.value);
          start(async () => {
            const res = await createPromoCode({
              code: f.code, ...(f.type === "percent" ? { percentOff: value } : { amountOff: Math.round(value * 100) }),
              duration: f.duration, months: f.months ? Number(f.months) : undefined, maxRedemptions: f.max ? Number(f.max) : undefined,
            });
            setMsg(res);
            if (res.ok) { setAdding(false); setF({ ...f, code: "", value: "" }); }
          });
        }}>
          <Input required placeholder="Code, e.g. LAUNCH20" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} aria-label="Code" />
          <div className="flex gap-2">
            <Pick label="Discount type" className="w-fit shrink-0" value={f.type} onChange={(v) => setF({ ...f, type: v as "percent" | "amount" })} options={TYPE_OPTIONS} />
            <Input required type="number" min={0} step="any" placeholder={f.type === "percent" ? "20" : "10.00"} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} aria-label="Amount" />
          </div>
          <div className="flex gap-2">
            <Pick label="Duration" className="w-fit shrink-0" value={f.duration} onChange={(v) => setF({ ...f, duration: v as typeof f.duration })} options={DURATION_OPTIONS} />
            {f.duration === "repeating" && <Input type="number" min={1} placeholder="Months" value={f.months} onChange={(e) => setF({ ...f, months: e.target.value })} aria-label="Months" />}
          </div>
          <Input type="number" min={1} placeholder="Max uses (optional)" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} aria-label="Max uses" />
          <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create code"}</Button>
          <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
        </form>
      ) : <Button variant="outline" size="sm" onClick={() => setAdding(true)}><Plus /> New promotion code</Button>)}
      {msg.error && <p className="text-sm text-destructive">{msg.error}</p>}
      {msg.ok && <p className="text-sm text-muted-foreground">{msg.ok}</p>}
    </div>
  );
}
