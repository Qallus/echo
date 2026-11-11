"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pick } from "@/components/ui/pick";
import { Textarea } from "@/components/ui/textarea";
import { cancelPort, requestPort, type PortForm } from "@/lib/redial/phone-service-actions";

// Bring a number to Redial: the details from the current carrier's bill and
// the member's authorization. Redial support submits the port.

export type PortRow = { id: string; number: string; carrier: string; status: string; foc_date: string | null; staff_note: string | null; created_at: string };
type LineRow = { id: string; label: string; number: string };

export const PORT_STATUS: Record<string, string> = {
  submitted: "Sent to Redial", in_review: "Being reviewed", needs_info: "Needs your input", with_carrier: "With your carrier",
  scheduled: "Transfer scheduled", completed: "Transferred", rejected: "Rejected", cancelled: "Cancelled",
};
const pretty = (n: string) => n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3");

export function PortView({ lines, requests, defaultName }: { lines: LineRow[]; requests: PortRow[]; defaultName: string }) {
  const blank = (): PortForm => ({
    lineId: lines[0]?.id ?? null, number: "", numberType: "mobile", carrier: "", accountName: defaultName, accountNumber: "", pin: "",
    street: "", city: "", region: "", postalCode: "", authorizedName: defaultName, authorize: false as unknown as true, wantedDate: "", note: "",
  });
  const [f, setF] = useState<PortForm>(blank);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const set = (p: Partial<PortForm>) => setF((x) => ({ ...x, ...p }));

  const run = (act: () => Promise<{ ok?: string; error?: string }>, reset = false) => start(async () => {
    const r = await act();
    setMsg(r.error ? { text: r.error, error: true } : { text: r.ok ?? "Done." });
    if (!r.error && reset) setF(blank());
  });

  return (
    <div className="space-y-8">
      {requests.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Your requests</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{pretty(r.number)} <span className="font-normal text-muted-foreground">· from {r.carrier}</span></p>
                  <p className="text-xs text-muted-foreground">{r.foc_date ? `Transfer date ${new Date(`${r.foc_date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : `Sent ${new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}</p>
                  {r.staff_note && <p className="mt-1 text-sm">{r.staff_note}</p>}
                </div>
                <Badge variant={r.status === "needs_info" || r.status === "rejected" ? "destructive" : r.status === "completed" ? "secondary" : "outline"}>{PORT_STATUS[r.status] ?? r.status}</Badge>
                {["submitted", "in_review", "needs_info"].includes(r.status) && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => cancelPort(r.id))}>Cancel</Button>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4 rounded-2xl border bg-card p-5">
        <div>
          <h2 className="font-semibold">Request a transfer</h2>
          <p className="text-sm text-muted-foreground">Keep using your phone until the transfer date; the number moves over by itself. Don&apos;t cancel your old service first, or the number can be lost.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-6">
          <div className="space-y-1 sm:col-span-3"><Label htmlFor="pt-number">Number to bring</Label><Input id="pt-number" value={f.number} inputMode="tel" onChange={(e) => set({ number: e.target.value })} placeholder="(480) 555-0100" /></div>
          <div className="space-y-1 sm:col-span-3"><Label htmlFor="pt-type">It&apos;s a</Label>
            <Pick id="pt-type" label="Number type" value={f.numberType} onChange={(v) => set({ numberType: v as PortForm["numberType"] })} options={[{ value: "mobile", label: "Mobile number" }, { value: "landline", label: "Landline" }, { value: "voip", label: "Internet phone (VoIP)" }]} />
          </div>
          {lines.length > 1 && (
            <div className="space-y-1 sm:col-span-6"><Label htmlFor="pt-line">Replaces this Redial line</Label>
              <Pick id="pt-line" label="Redial line" value={f.lineId ?? ""} onChange={(v) => set({ lineId: v || null })} options={lines.map((l) => ({ value: l.id, label: `${l.label} · ${pretty(l.number)}` }))} />
            </div>
          )}
          <div className="space-y-1 sm:col-span-3"><Label htmlFor="pt-carrier">Current carrier</Label><Input id="pt-carrier" value={f.carrier} onChange={(e) => set({ carrier: e.target.value })} placeholder="Verizon, AT&T, Comcast…" /></div>
          <div className="space-y-1 sm:col-span-3"><Label htmlFor="pt-acctname">Name on the account</Label><Input id="pt-acctname" value={f.accountName} onChange={(e) => set({ accountName: e.target.value })} /></div>
          <div className="space-y-1 sm:col-span-3"><Label htmlFor="pt-acct">Account number</Label><Input id="pt-acct" value={f.accountNumber} onChange={(e) => set({ accountNumber: e.target.value })} autoComplete="off" /></div>
          <div className="space-y-1 sm:col-span-3"><Label htmlFor="pt-pin">Transfer PIN {f.numberType === "mobile" ? "" : "(if any)"}</Label><Input id="pt-pin" value={f.pin} onChange={(e) => set({ pin: e.target.value })} autoComplete="off" /></div>
          <p className="text-xs text-muted-foreground sm:col-span-6">Mobile carriers give a transfer (port-out) PIN in their app or by phone. The account number and PIN are stored encrypted and only used for this transfer.</p>
          <p className="text-sm font-medium sm:col-span-6">Service address on the bill</p>
          <div className="space-y-1 sm:col-span-6"><Label htmlFor="pt-street">Street address</Label><Input id="pt-street" value={f.street} onChange={(e) => set({ street: e.target.value })} autoComplete="address-line1" /></div>
          <div className="space-y-1 sm:col-span-3"><Label htmlFor="pt-city">City</Label><Input id="pt-city" value={f.city} onChange={(e) => set({ city: e.target.value })} autoComplete="address-level2" /></div>
          <div className="space-y-1 sm:col-span-1"><Label htmlFor="pt-state">State</Label><Input id="pt-state" value={f.region} maxLength={2} onChange={(e) => set({ region: e.target.value.toUpperCase() })} placeholder="AZ" /></div>
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="pt-zip">ZIP code</Label><Input id="pt-zip" value={f.postalCode} inputMode="numeric" onChange={(e) => set({ postalCode: e.target.value })} autoComplete="postal-code" /></div>
          <div className="space-y-1 sm:col-span-3"><Label htmlFor="pt-date">Preferred transfer date (optional)</Label><Input id="pt-date" type="date" value={f.wantedDate} onChange={(e) => set({ wantedDate: e.target.value })} /></div>
          <div className="space-y-1 sm:col-span-6"><Label htmlFor="pt-note">Anything we should know (optional)</Label><Textarea id="pt-note" rows={2} value={f.note} onChange={(e) => set({ note: e.target.value })} /></div>
          <div className="space-y-1 sm:col-span-3"><Label htmlFor="pt-auth">Your full name</Label><Input id="pt-auth" value={f.authorizedName} onChange={(e) => set({ authorizedName: e.target.value })} /></div>
          <label className="flex items-start gap-2 text-sm sm:col-span-6">
            <Checkbox checked={f.authorize === true} onCheckedChange={(v) => set({ authorize: (v === true) as true })} className="mt-0.5" />
            <span>I&apos;m authorized to make changes to this account, and I authorize Redial (Qallus LLC) to transfer this number from my current carrier. The details above match my current bill.</span>
          </label>
        </div>
        {msg && <p className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.text}</p>}
        <Button disabled={pending || f.authorize !== true} onClick={() => run(() => requestPort(f), true)}>{pending ? "Sending…" : "Request transfer"}</Button>
      </section>
    </div>
  );
}
