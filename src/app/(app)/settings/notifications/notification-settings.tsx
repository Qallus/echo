"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { BellRing, Check, Mail, MonitorSmartphone, Phone, Send, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CHANNELS, NOTIFICATION_TYPES, type Channel, type Preference } from "@/lib/notify/types";
import { TimePicker } from "@/components/ui/time-picker";
import { cn } from "@/lib/utils";
import {
  addChannel, removeChannel, removePushSubscription, savePushSubscription, sendCode, sendTest, setPreference,
  setQuietHours, verifyCode, type Result,
} from "./actions";

function Note({ result }: { result?: Result }) {
  if (result?.error) return <p className="text-xs text-destructive">{result.error}</p>;
  if (result?.ok) return <p className="text-xs text-muted-foreground">{result.ok}</p>;
  return null;
}

type ChannelRow = { id: string; address: string; verified_at: string | null };

// ---------------------------------------------------------------------------
// Email addresses / phone numbers, verified by a 6-digit code
// ---------------------------------------------------------------------------
export function ChannelList({ kind, channels, accountEmail }: { kind: "email" | "sms"; channels: ChannelRow[]; accountEmail?: string }) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<Result>();
  const [pending, start] = useTransition();
  const Icon = kind === "email" ? Mail : Phone;

  const add = () => start(async () => {
    const r = await addChannel(kind, value);
    setResult(r);
    if (r.channelId) setValue("");
  });

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-medium"><Icon className="size-4" /> {kind === "email" ? "Email" : "Text messages (SMS)"}</h3>
      <ul className="divide-y rounded-lg border">
        {accountEmail && (
          <li className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
            <span className="min-w-0 flex-1 truncate">{accountEmail}</span>
            <Badge variant="outline">Account email</Badge>
          </li>
        )}
        {channels.map((c) => <ChannelItem key={c.id} channel={c} />)}
        {!accountEmail && !channels.length && <li className="px-3 py-2.5 text-sm text-muted-foreground">No phone number yet.</li>}
      </ul>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <Input value={value} onChange={(e) => setValue(e.target.value)} type={kind === "email" ? "email" : "tel"}
          placeholder={kind === "email" ? "Add another email address" : "+1 555 123 4567"} autoComplete={kind === "email" ? "email" : "tel"} />
        <Button type="submit" variant="outline" disabled={pending || !value.trim()}>{pending ? "Adding…" : "Add"}</Button>
      </form>
      {kind === "sms" && <p className="text-xs text-muted-foreground">By adding a number you agree to receive notification texts from Echo. Msg &amp; data rates may apply. Reply STOP to opt out.</p>}
      <Note result={result} />
    </div>
  );
}

function ChannelItem({ channel }: { channel: ChannelRow }) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<Result>();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Result>) => start(async () => setResult(await fn()));

  return (
    <li className="space-y-2 px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 truncate">{channel.address}</span>
        {channel.verified_at
          ? <Badge variant="outline" className="gap-1 text-emerald-700 dark:text-emerald-400"><Check className="size-3" /> Verified</Badge>
          : <Badge variant="outline" className="text-amber-700 dark:text-amber-400">Not verified</Badge>}
        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${channel.address}`} disabled={pending} onClick={() => run(() => removeChannel(channel.id))}><Trash2 /></Button>
      </div>
      {!channel.verified_at && (
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); run(() => verifyCode(channel.id, code)); }}>
          <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" maxLength={8} className="w-36" />
          <Button type="submit" size="sm" disabled={pending || code.replace(/\D/g, "").length !== 6}>Verify</Button>
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(() => sendCode(channel.id))}>Send a new code</Button>
        </form>
      )}
      <Note result={result} />
    </li>
  );
}

// ---------------------------------------------------------------------------
// Push (this browser or device)
// ---------------------------------------------------------------------------
const noop = () => () => {};

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function deviceLabel() {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${browser} on ${os}`;
}

export function PushCard({ devices, vapidKey }: { devices: { id: string; address: string; label: string | null }[]; vapidKey: string }) {
  const support = useSyncExternalStore(noop, () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      const ios = /iPhone|iPad/.test(navigator.userAgent);
      return ios && !window.matchMedia("(display-mode: standalone)").matches ? "ios-install" : "none";
    }
    return "ok";
  }, () => "loading");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [result, setResult] = useState<Result>();
  const [pending, start] = useTransition();

  useEffect(() => {
    if (support !== "ok") return;
    navigator.serviceWorker.getRegistration("/sw.js")
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setEndpoint(sub?.endpoint ?? null));
  }, [support]);

  const thisDeviceOn = !!endpoint && devices.some((d) => d.address === endpoint);

  const enable = () => start(async () => {
    if (!vapidKey) return setResult({ error: "Push isn't configured on the server yet." });
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return setResult({ error: "Notifications are blocked for this site. Allow them in your browser's site settings, then try again." });
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    const r = await savePushSubscription(json, deviceLabel());
    setResult(r);
    if (!r.error) setEndpoint(json.endpoint);
  });

  const disable = () => start(async () => {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    if (endpoint) setResult(await removePushSubscription(endpoint));
    setEndpoint(null);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MonitorSmartphone className="size-4" /> Desktop &amp; mobile notifications</CardTitle>
        <CardDescription>Pop-up notifications on this computer or phone, even when Echo isn&apos;t open.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {support === "ios-install" && (
          <p className="rounded-lg border bg-muted/40 p-3 text-sm">On iPhone and iPad, first add Echo to your Home Screen: tap <span className="font-medium">Share</span>, then <span className="font-medium">Add to Home Screen</span>. Open Echo from there and come back to this page.</p>
        )}
        {support === "none" && <p className="text-sm text-muted-foreground">This browser doesn&apos;t support push notifications.</p>}
        {support === "ok" && (
          thisDeviceOn
            ? <Button variant="outline" disabled={pending} onClick={disable}>Turn off on this device</Button>
            : <Button disabled={pending} onClick={enable}><BellRing /> Turn on for this device</Button>
        )}
        {devices.length > 0 && (
          <ul className="divide-y rounded-lg border text-sm">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center gap-2 px-3 py-2">
                <span className="flex-1 truncate">{d.label ?? "Device"}</span>
                {d.address === endpoint && <Badge variant="outline">This device</Badge>}
              </li>
            ))}
          </ul>
        )}
        <Note result={result} />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Event x channel switches
// ---------------------------------------------------------------------------
export function PreferenceGrid({ prefs }: { prefs: Record<string, Preference> }) {
  const [state, setState] = useState(prefs);
  const [error, setError] = useState<string>();

  const toggle = async (type: string, channel: Channel, on: boolean) => {
    setState((s) => ({ ...s, [type]: { ...s[type], [channel]: on } }));
    const r = await setPreference(type, channel, on);
    if (r.error) {
      setError(r.error);
      setState((s) => ({ ...s, [type]: { ...s[type], [channel]: !on } }));
    }
  };

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-2 font-medium">Event</th>
              {CHANNELS.map((c) => <th key={c.key} className="w-16 pb-2 text-center font-medium">{c.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {NOTIFICATION_TYPES.map((t) => (
              <tr key={t.type}>
                <td className="py-3 pr-3">
                  <div className="font-medium">{t.label}</div>
                  <div className="text-xs text-muted-foreground">{t.desc}</div>
                </td>
                {CHANNELS.map((c) => (
                  <td key={c.key} className="text-center">
                    <Switch checked={state[t.type][c.key]} onCheckedChange={(v) => toggle(t.type, c.key, v)}
                      aria-label={`${t.label}: ${c.label}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">SMS and push only reach verified numbers and devices you&apos;ve turned on above.</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quiet hours and test
// ---------------------------------------------------------------------------
export function QuietHours({ start: s, end: e }: { start: string; end: string }) {
  const [start, setStart] = useState(s);
  const [end, setEnd] = useState(e);
  const [result, setResult] = useState<Result>();
  const [pending, run] = useTransition();
  return (
    <form className="space-y-2" onSubmit={(ev) => { ev.preventDefault(); run(async () => setResult(await setQuietHours(start, end))); }}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>From</span>
        <TimePicker value={start} onChange={setStart} step={15} className="w-36" aria-label="Quiet hours start" />
        <span>to</span>
        <TimePicker value={end} onChange={setEnd} step={15} className="w-36" aria-label="Quiet hours end" />
        <Button type="submit" variant="outline" disabled={pending}>Save</Button>
        {(start || end) && (
          <Button type="button" variant="ghost" disabled={pending}
            onClick={() => { setStart(""); setEnd(""); run(async () => setResult(await setQuietHours("", ""))); }}>Turn off</Button>
        )}
      </div>
      <Note result={result} />
    </form>
  );
}

export function TestButton() {
  const [result, setResult] = useState<Result>();
  const [pending, start] = useTransition();
  return (
    <div className={cn("space-y-2")}>
      <Button variant="outline" disabled={pending} onClick={() => start(async () => setResult(await sendTest()))}><Send /> Send a test notification</Button>
      <Note result={result} />
    </div>
  );
}
