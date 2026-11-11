"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { addDevice, removeDevice, resetDevice, setDeviceRing, type DeviceLogin } from "@/lib/redial/device-actions";
import { PHONE_MODELS, VENDORS, type PhoneVendor } from "@/lib/redial/phone-models";

// The Phones page: add a phone by model and MAC address, see the setup
// address and login (shown once), and choose which phones ring.

export type DeviceRow = { id: string; line_id: string; label: string; model: string; vendor: PhoneVendor; mac: string | null; sip_username: string; ring: boolean; last_provisioned_at: string | null; created_at: string };
type LineRow = { id: string; label: string; number: string };

const SELECT = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";
const pretty = (n: string) => n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3");
const macText = (m: string | null) => (m ? m.toUpperCase().match(/.{2}/g)!.join(":") : "");
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function CopyField({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex gap-2">
        <Input readOnly value={value} className={secret ? "font-mono text-xs" : "text-xs"} onFocus={(e) => e.target.select()} />
        <Button variant="outline" size="icon" aria-label={`Copy ${label}`} onClick={() => { void navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); }}>{done ? <Check /> : <Copy />}</Button>
      </div>
    </div>
  );
}

// How to point this kind of phone at its setup address.
function SetupSteps({ vendor, login }: { vendor: PhoneVendor; login: DeviceLogin }) {
  const path = login.setupUrl.replace(/^https?:\/\//, "");
  if (vendor === "grandstream") {
    return (
      <ol className="list-decimal space-y-1.5 pl-5 text-sm">
        <li>Connect the phone to Wi-Fi (on a WP826: <span className="font-medium">Quick Network Configuration → Via Local Device</span>).</li>
        <li>On the handset, find its IP address (Menu → Status), and open that address in a browser on the same network. Sign in as <span className="font-medium">admin</span> with the password on the phone&apos;s label.</li>
        <li>Go to <span className="font-medium">Maintenance → Upgrade and Provisioning</span>. Set <span className="font-medium">Config Upgrade Via</span> to <span className="font-medium">HTTPS</span> and paste the address below into <span className="font-medium">Config Server Path</span>.</li>
        <li>Click <span className="font-medium">Save and Apply</span>, then <span className="font-medium">Start Provision</span> (or restart the phone). It downloads its settings and shows your line.</li>
      </ol>
    );
  }
  if (vendor === "other") return <p className="text-sm">Enter the SIP server, username and password below in your phone&apos;s SIP account settings.</p>;
  return <p className="text-sm">Open the phone&apos;s settings, go to <span className="font-medium">{VENDORS[vendor].setup}</span>, and enter the address below ({vendor === "yealink" ? "with https://" : path}). Then restart the phone.</p>;
}

export function PhonesView({ lines, devices, ready, domain }: { lines: LineRow[]; devices: DeviceRow[]; ready: boolean; domain: string | null }) {
  const [lineId, setLineId] = useState(lines[0].id);
  const [modelId, setModelId] = useState("gs_wp826");
  const [label, setLabel] = useState("");
  const [mac, setMac] = useState("");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [shown, setShown] = useState<{ login: DeviceLogin; vendor: PhoneVendor } | null>(null);
  const [removing, setRemoving] = useState<DeviceRow | null>(null);
  const [pending, start] = useTransition();
  const model = PHONE_MODELS.find((m) => m.id === modelId)!;

  function run(act: () => Promise<{ ok?: string; error?: string; login?: DeviceLogin }>, vendor?: PhoneVendor) {
    start(async () => {
      const r = await act();
      setMsg(r.error ? { text: r.error, error: true } : { text: r.ok ?? "Done." });
      if (r.login && vendor) setShown({ login: r.login, vendor });
    });
  }

  return (
    <div className="space-y-6">
      {!ready && <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">Desk phones are almost ready: Redial support is switching them on. You can add phones as soon as they are.</p>}

      {lines.map((l) => {
        const mine = devices.filter((d) => d.line_id === l.id);
        return (
          <section key={l.id} className="space-y-2">
            <h2 className="text-sm font-semibold">{l.label} · {pretty(l.number)}</h2>
            <ul className="divide-y rounded-xl border bg-card">
              {mine.length === 0 && <li className="p-4 text-sm text-muted-foreground">No phones on this line yet.</li>}
              {mine.map((d) => {
                const m = PHONE_MODELS.find((x) => x.id === d.model);
                return (
                  <li key={d.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{d.label} <span className="font-normal text-muted-foreground">· {VENDORS[d.vendor].label} {m?.name ?? ""}</span></p>
                      <p className="text-xs text-muted-foreground">{d.mac ? `MAC ${macText(d.mac)} · ` : ""}{d.last_provisioned_at ? `Set itself up ${when(d.last_provisioned_at)}` : "Waiting for the phone to download its settings"}</p>
                    </div>
                    {d.last_provisioned_at ? <Badge variant="secondary">Set up</Badge> : <Badge variant="outline">Not set up yet</Badge>}
                    <label className="flex items-center gap-2 text-sm"><Switch checked={d.ring} onCheckedChange={(v) => run(() => setDeviceRing(d.id, v))} aria-label={`Ring ${d.label} for calls`} /> Rings</label>
                    <Button size="sm" variant="outline" disabled={pending || !ready} onClick={() => run(() => resetDevice(d.id), d.vendor)}><KeyRound /> New setup address</Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Remove ${d.label}`} onClick={() => setRemoving(d)}><Trash2 /></Button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <form className="space-y-3 rounded-2xl border p-4" onSubmit={(e) => { e.preventDefault(); run(() => addDevice({ lineId, modelId, label, mac }), model.vendor); }}>
        <p className="flex items-center gap-2 font-semibold"><Plus className="size-4" /> Add a phone</p>
        {lines.length > 1 && (
          <label className="block space-y-1.5"><span className="text-sm font-medium">Line</span>
            <select className={SELECT} value={lineId} onChange={(e) => setLineId(e.target.value)}>{lines.map((l) => <option key={l.id} value={l.id}>{l.label} · {pretty(l.number)}</option>)}</select>
          </label>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5"><span className="text-sm font-medium">Model</span>
            <select className={SELECT} value={modelId} onChange={(e) => setModelId(e.target.value)}>
              {(Object.keys(VENDORS) as PhoneVendor[]).map((v) => (
                <optgroup key={v} label={VENDORS[v].label}>{PHONE_MODELS.filter((m) => m.vendor === v).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5"><span className="text-sm font-medium">Name</span>
            <Input maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Kitchen, Front desk" />
          </label>
        </div>
        {model.vendor !== "other" && (
          <label className="block space-y-1.5"><span className="text-sm font-medium">MAC address</span>
            <Input value={mac} onChange={(e) => setMac(e.target.value)} placeholder="C0:74:AD:12:34:56" className="font-mono" />
            <span className="block text-xs text-muted-foreground">On the label on the phone or its box. Used so only this phone can download its settings.</span>
          </label>
        )}
        {msg && <p role="status" className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.text}</p>}
        <Button type="submit" disabled={pending || !ready}>{pending ? "Adding…" : "Add phone"}</Button>
      </form>

      <Dialog open={Boolean(shown)} onOpenChange={(o) => { if (!o) setShown(null); }}>
        {shown && (
          <DialogContent title="Set up your phone" description="Copy these now: the password isn't shown again. You can always make a new setup address." className="max-w-lg">
            <SetupSteps vendor={shown.vendor} login={shown.login} />
            {shown.vendor !== "other" && <CopyField label={shown.vendor === "grandstream" ? "Config Server Path" : "Setup address"} value={shown.vendor === "grandstream" ? shown.login.setupUrl.replace(/^https?:\/\//, "") : shown.login.setupUrl} />}
            <details className="space-y-2 rounded-lg border p-3 text-sm" open={shown.vendor === "other"}>
              <summary className="cursor-pointer font-medium">Manual settings</summary>
              <div className="mt-2 space-y-2">
                <CopyField label="SIP server" value={domain ?? shown.login.domain} />
                <CopyField label="Username (SIP user ID and authentication ID)" value={shown.login.username} />
                <CopyField label="Password" value={shown.login.password} secret />
              </div>
            </details>
            <div className="flex justify-end"><Button onClick={() => setShown(null)}>Done</Button></div>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={Boolean(removing)} onOpenChange={(o) => { if (!o) setRemoving(null); }}>
        {removing && (
          <DialogContent title={`Remove ${removing.label}?`} description="Its login stops working right away and it won't ring for calls.">
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRemoving(null)}>Cancel</Button>
              <Button variant="destructive" disabled={pending} onClick={() => { const d = removing; setRemoving(null); run(() => removeDevice(d.id)); }}><Trash2 /> Remove</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
