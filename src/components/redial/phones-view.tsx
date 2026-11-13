"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRightLeft, Check, ChevronDown, Copy, ExternalLink, KeyRound, MoreVertical, Pencil, Phone, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pick } from "@/components/ui/pick";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { E911Card, e911Label, type E911Row } from "@/components/redial/e911-card";
import { addDevice, removeDevice, resetDevice, setDeviceRing, setDeviceWebUrl, type DeviceLogin } from "@/lib/redial/device-actions";
import { PHONE_MODELS, VENDORS, type PhoneVendor } from "@/lib/redial/phone-models";
import { cn } from "@/lib/utils";

// The Phones page: each line's phones as cards (status, ringing, settings
// link), a tile to add another, and a setup checklist beside them (number,
// 911 address, phones, plus optional next steps).

export type DeviceRow = { id: string; line_id: string; label: string; model: string; vendor: PhoneVendor; mac: string | null; sip_username: string; ring: boolean; last_provisioned_at: string | null; created_at: string; web_url: string | null; last_seen_at: string | null; firmware: string | null };
type LineRow = { id: string; label: string; number: string };

const pretty = (n: string) => n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3");
const macText = (m: string | null) => (m ? m.toUpperCase().match(/.{2}/g)!.join(":") : "");
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// Phones check in every 60 minutes; after 2 missed check-ins they're offline.
const OFFLINE_AFTER = 150 * 60_000;

// The current time, after the page has loaded (so server and browser agree),
// updated each minute.
function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const every = setInterval(() => setNow(Date.now()), 60_000);
    return () => { clearTimeout(first); clearInterval(every); };
  }, []);
  return now;
}

const ago = (iso: string, now: number) => {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  return min < 1 ? "just now" : min < 60 ? `${min} min ago` : when(iso);
};

type Status = { state: "new" | "connected" | "online" | "offline"; badge: React.ReactNode; line: string };

// Online / Offline from the phone's check-ins; phones set up before
// check-ins existed show Connected until they restart once.
function deviceStatus(d: DeviceRow, now: number | null): Status {
  const dot = <span className="size-1.5 rounded-full bg-current" aria-hidden />;
  if (!d.last_provisioned_at) return { state: "new", badge: <Badge variant="outline">Not set up yet</Badge>, line: "Waiting for the phone to download its settings" };
  if (!d.last_seen_at) return { state: "connected", badge: <Badge variant="success" className="gap-1.5">{dot} Connected</Badge>, line: `Connected ${when(d.last_provisioned_at)} · Restart the phone once to see Online status` };
  const online = now === null || now - new Date(d.last_seen_at).getTime() < OFFLINE_AFTER;
  return online
    ? { state: "online", badge: <Badge variant="success" className="gap-1.5">{dot} Online</Badge>, line: `Checked in ${now === null ? when(d.last_seen_at) : ago(d.last_seen_at, now)}` }
    : { state: "offline", badge: <Badge variant="destructive" className="gap-1.5">{dot} Offline</Badge>, line: `Last checked in ${when(d.last_seen_at)} · Check its power and Wi-Fi` };
}

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
        <li>Go to <span className="font-medium">Maintenance → Upgrade and Provisioning → Config File</span>. Set <span className="font-medium">Config Upgrade Via</span> to <span className="font-medium">HTTPS</span> and paste the address below into <span className="font-medium">Config Server Path</span>.</li>
        <li>Click <span className="font-medium">Save and Apply</span>, then <span className="font-medium">Start Provision</span> (or restart the phone). It downloads its settings and shows your line.</li>
      </ol>
    );
  }
  if (vendor === "other") return <p className="text-sm">Enter the SIP server, username and password below in your phone&apos;s SIP account settings.</p>;
  return <p className="text-sm">Open the phone&apos;s settings, go to <span className="font-medium">{VENDORS[vendor].setup}</span>, and enter the address below ({vendor === "yealink" ? "with https://" : path}). Then restart the phone.</p>;
}

// The phone's own settings page (on the member's network), saved per phone.
function WebLink({ device, busy, onSave }: { device: DeviceRow; busy: boolean; onSave: (url: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(device.web_url ?? "");
  if (editing) {
    return (
      <form className="flex w-full flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); onSave(value); setEditing(false); }}>
        <Input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="192.168.4.119" aria-label={`${device.label} settings page address`} className="h-8 min-w-0 flex-1 font-mono text-xs" />
        <Button size="sm" type="submit" disabled={busy}>Save</Button>
        <Button size="sm" type="button" variant="ghost" onClick={() => { setValue(device.web_url ?? ""); setEditing(false); }}>Cancel</Button>
        <span className="w-full text-xs text-muted-foreground">On the handset, Menu → Status shows its IP address. The link only opens on the same Wi-Fi as the phone.</span>
      </form>
    );
  }
  return device.web_url ? (
    <span className="flex min-w-0 items-center gap-1 text-xs">
      <a href={device.web_url} target="_blank" rel="noopener noreferrer" title={`${device.web_url} (same Wi-Fi as the phone)`} className="inline-flex items-center gap-1 font-medium underline underline-offset-4"><ExternalLink className="size-3.5" /> Phone settings</a>
      <Button size="icon-xs" variant="ghost" aria-label={`Change ${device.label} settings page address`} onClick={() => setEditing(true)}><Pencil /></Button>
    </span>
  ) : (
    <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"><ExternalLink className="size-3.5" /> Link its settings page</button>
  );
}

function PhoneCard({ d, now, busy, ready, onRing, onReset, onRemove, onWebUrl }: {
  d: DeviceRow; now: number | null; busy: boolean; ready: boolean;
  onRing: (v: boolean) => void; onReset: () => void; onRemove: () => void; onWebUrl: (url: string) => void;
}) {
  const m = PHONE_MODELS.find((x) => x.id === d.model);
  const status = deviceStatus(d, now);
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted"><Phone className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{d.label}</p>
          <p className="truncate text-sm text-muted-foreground">{VENDORS[d.vendor].label} {m?.name ?? ""}</p>
        </div>
        {status.badge}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`More for ${d.label}`} />}><MoreVertical /></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={busy || !ready} onClick={onReset}><KeyRound /> New setup address</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onRemove}><Trash2 /> Remove phone</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <dl className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Status</dt><dd>{status.line}</dd>
        {d.firmware && <><dt className="text-muted-foreground">Firmware</dt><dd>{d.firmware}</dd></>}
        {d.mac && <><dt className="text-muted-foreground">MAC</dt><dd className="font-mono">{macText(d.mac)}</dd></>}
      </dl>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <label className="flex items-center gap-2 text-sm"><Switch checked={d.ring} onCheckedChange={onRing} aria-label={`Ring ${d.label} for calls`} /> Rings for calls</label>
        <WebLink key={d.web_url ?? ""} device={d} busy={busy} onSave={onWebUrl} />
      </div>
    </div>
  );
}

// One step in the setup checklist.
function Step({ title, detail, done, optional, children }: { title: string; detail?: string; done?: boolean; optional?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[11px]", done && "border-transparent bg-emerald-500 text-white dark:bg-emerald-400 dark:text-emerald-950")} aria-hidden>
        {done ? <Check className="size-3" /> : null}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className="flex-1 text-sm font-medium">{title}</p>
          {done ? <Badge variant="success">Done</Badge> : optional ? <Badge variant="outline">Optional</Badge> : <Badge variant="destructive">To do</Badge>}
        </div>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
        {children}
      </div>
    </div>
  );
}

function SetupPanel({ line, row, phones, online, ownerName, onAdd }: { line: LineRow; row: E911Row | null; phones: number; online: number; ownerName: string; onAdd: () => void }) {
  const e911Done = row?.status === "registered";
  const done = 1 + (e911Done ? 1 : 0) + (phones ? 1 : 0);
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Setup</h2>
        <span className="text-xs text-muted-foreground">{done} of 3 done</span>
      </div>
      <div className="divide-y">
        <Step title="Redial number" detail={`${line.label} · ${pretty(line.number)}`} done />
        <Step title="911 address" done={e911Done} detail={e911Done ? undefined : e911Label(row)}>
          <details className="group" open={!e911Done}>
            <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
              <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" /> {e911Done ? `${row!.street}, ${row!.city}` : "Add the address"}
            </summary>
            <div className="pt-3"><E911Card lineId={line.id} row={row} defaultName={ownerName} panel /></div>
          </details>
        </Step>
        <Step title="Phones" done={phones > 0} detail={phones ? `${phones} phone${phones > 1 ? "s" : ""} · ${online} online` : "Add a desk, cordless or Wi-Fi phone."}>
          {!phones && <Button size="sm" className="mt-1" onClick={onAdd}><Plus /> Add your phone</Button>}
        </Step>
        <Step title="Bring a number you already have" detail="Move your current mobile, landline or business number to Redial." optional>
          <Link href="/calls/port" className="inline-flex items-center gap-1 text-xs font-medium underline underline-offset-4"><ArrowRightLeft className="size-3.5" /> Start a transfer</Link>
        </Step>
        <Step title="Get a compatible phone" detail="Desk, cordless and Wi-Fi phones that set themselves up with Redial." optional>
          <Link href="/compatibility" className="inline-flex items-center gap-1 text-xs font-medium underline underline-offset-4"><ShoppingBag className="size-3.5" /> See compatible phones</Link>
        </Step>
      </div>
    </section>
  );
}

export function PhonesView({ lines, devices, e911, ownerName, ready, domain }: { lines: LineRow[]; devices: DeviceRow[]; e911: E911Row[]; ownerName: string; ready: boolean; domain: string | null }) {
  const [addFor, setAddFor] = useState<string | null>(null);
  const [modelId, setModelId] = useState("gs_wp826");
  const [label, setLabel] = useState("");
  const [mac, setMac] = useState("");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const [shown, setShown] = useState<{ login: DeviceLogin; vendor: PhoneVendor } | null>(null);
  const [removing, setRemoving] = useState<DeviceRow | null>(null);
  const [pending, start] = useTransition();
  const now = useNow();
  const model = PHONE_MODELS.find((m) => m.id === modelId)!;

  function run(act: () => Promise<{ ok?: string; error?: string; login?: DeviceLogin }>, vendor?: PhoneVendor) {
    start(async () => {
      const r = await act();
      setMsg(r.error ? { text: r.error, error: true } : { text: r.ok ?? "Done." });
      if (r.login && vendor) setShown({ login: r.login, vendor });
    });
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!addFor) return;
    start(async () => {
      const r = await addDevice({ lineId: addFor, modelId, label, mac });
      if (r.error) { setFormMsg(r.error); return; }
      setAddFor(null); setLabel(""); setMac(""); setFormMsg(null);
      setMsg({ text: r.ok ?? "Phone added." });
      if (r.login) setShown({ login: r.login, vendor: model.vendor });
    });
  }

  return (
    <div className="space-y-6">
      {!ready && <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">Desk phones are almost ready: Redial support is switching them on. You can add phones as soon as they are.</p>}
      {msg && <p role="status" className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.text}</p>}

      {lines.map((l) => {
        const mine = devices.filter((d) => d.line_id === l.id);
        const online = mine.filter((d) => deviceStatus(d, now).state === "online").length;
        return (
          <div key={l.id} className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">{l.label} · {pretty(l.number)}</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {mine.map((d) => (
                  <PhoneCard key={d.id} d={d} now={now} busy={pending} ready={ready}
                    onRing={(v) => run(() => setDeviceRing(d.id, v))} onReset={() => run(() => resetDevice(d.id), d.vendor)}
                    onRemove={() => setRemoving(d)} onWebUrl={(url) => run(() => setDeviceWebUrl(d.id, url))} />
                ))}
                <button type="button" disabled={!ready} onClick={() => { setFormMsg(null); setAddFor(l.id); }}
                  className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-center text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground disabled:pointer-events-none disabled:opacity-50">
                  <Plus className="size-6" />
                  <span className="font-medium">{mine.length ? "Add another phone" : "Add your phone"}</span>
                  <span className="text-xs">Desk, cordless or Wi-Fi</span>
                </button>
              </div>
            </section>
            <aside className="lg:sticky lg:top-6">
              <SetupPanel line={l} row={e911.find((x) => x.line_id === l.id) ?? null} phones={mine.length} online={online} ownerName={ownerName} onAdd={() => { setFormMsg(null); setAddFor(l.id); }} />
            </aside>
          </div>
        );
      })}

      <Dialog open={Boolean(addFor)} onOpenChange={(o) => { if (!o) setAddFor(null); }}>
        {addFor && (
          <DialogContent title={devices.some((d) => d.line_id === addFor) ? "Add another phone" : "Add your phone"} description="Your phones already on this line stay connected. Add one here for each new handset or desk phone." className="max-w-lg">
            <form className="space-y-3" onSubmit={add}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5"><span className="text-sm font-medium">Model</span>
                  <Pick label="Model" value={modelId} onChange={setModelId} options={PHONE_MODELS.map((m) => ({ value: m.id, label: m.name, group: VENDORS[m.vendor].label }))} />
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
              {formMsg && <p role="status" className="text-sm text-destructive">{formMsg}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAddFor(null)}>Cancel</Button>
                <Button type="submit" disabled={pending || !ready}>{pending ? "Adding…" : "Add phone"}</Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>

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
