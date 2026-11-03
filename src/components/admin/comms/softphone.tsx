"use client";

import { useEffect, useRef, useState } from "react";
import type { Call, Device } from "@twilio/voice-sdk";
import { Grid3x3, Mic, MicOff, Phone, PhoneIncoming, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The admin browser phone (Twilio Voice). Registers on every admin page for
// staff who can make calls, rings for incoming calls, and places calls asked
// for with startCall() from anywhere (deal pages, contacts, the dialpad).

type Detail = { number: string; name?: string; contactId?: string | null; dealId?: string | null };
let ready = false;
export const phoneReady = () => ready;

// Places a call through the browser phone, or falls back to the device's own
// dialer when the browser phone isn't set up.
export function startCall(detail: Detail) {
  if (ready) window.dispatchEvent(new CustomEvent<Detail>("echo:call", { detail }));
  else window.location.href = `tel:${detail.number}`;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function Softphone() {
  const device = useRef<Device | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [incoming, setIncoming] = useState<Call | null>(null);
  const [label, setLabel] = useState("");
  const [state, setState] = useState<"idle" | "connecting" | "live">("idle");
  const [muted, setMuted] = useState(false);
  const [keypad, setKeypad] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    const getToken = async () => {
      const res = await fetch("/api/admin/comms/token", { cache: "no-store" });
      return res.ok ? ((await res.json()) as { token: string }).token : null;
    };
    (async () => {
      const token = await getToken().catch(() => null);
      if (!token || cancelled) return;
      const { Device: TwilioDevice, Call: TwilioCall } = await import("@twilio/voice-sdk");
      const d = new TwilioDevice(token, { codecPreferences: [TwilioCall.Codec.Opus, TwilioCall.Codec.PCMU], closeProtection: true });
      d.on("registered", () => { ready = true; });
      d.on("unregistered", () => { ready = false; });
      d.on("error", (e: { message?: string }) => setError(e.message ?? "Phone error."));
      d.on("tokenWillExpire", async () => { const t = await getToken().catch(() => null); if (t) d.updateToken(t); });
      d.on("incoming", (c: Call) => {
        setIncoming(c);
        setLabel(c.parameters.From ?? "Unknown caller");
        const clear = () => setIncoming((cur) => (cur === c ? null : cur));
        c.on("cancel", clear); c.on("disconnect", clear); c.on("reject", clear);
      });
      device.current = d;
      await d.register().catch((e: Error) => setError(e.message));
    })();
    return () => { cancelled = true; ready = false; device.current?.destroy(); device.current = null; };
  }, []);

  const track = (c: Call) => {
    setCall(c); setState("connecting"); setMuted(false); setSeconds(0); setKeypad(false);
    c.on("accept", () => setState("live"));
    const end = () => { setCall(null); setState("idle"); };
    c.on("disconnect", end); c.on("cancel", end); c.on("reject", end);
    c.on("error", (e: { message?: string }) => { setError(e.message ?? "Call failed."); end(); });
  };

  useEffect(() => {
    const onCall = async (e: Event) => {
      const { number, name, contactId, dealId } = (e as CustomEvent<Detail>).detail;
      if (!device.current || call) return;
      setError(undefined);
      setLabel(name ? `${name} · ${number}` : number);
      try {
        const params: Record<string, string> = { To: number };
        if (contactId) params.ContactId = contactId;
        if (dealId) params.DealId = dealId;
        track(await device.current.connect({ params }));
      } catch (err) { setError(err instanceof Error ? err.message : "Couldn't place the call."); }
    };
    window.addEventListener("echo:call", onCall);
    return () => window.removeEventListener("echo:call", onCall);
  }, [call]);

  useEffect(() => {
    if (state !== "live") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [state]);

  if (!call && !incoming && !error) return null;
  return (
    <div role="dialog" aria-label="Phone" className="fixed right-4 bottom-4 z-50 w-72 space-y-3 rounded-2xl border bg-popover p-4 shadow-xl">
      {incoming && !call ? (
        <>
          <p className="flex items-center gap-2 text-sm font-medium"><PhoneIncoming className="size-4 animate-pulse text-emerald-600" /> Incoming call</p>
          <p className="truncate text-lg font-semibold">{label}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="destructive" onClick={() => { incoming.reject(); setIncoming(null); }}><PhoneOff /> Decline</Button>
            <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => { incoming.accept(); track(incoming); setIncoming(null); }}><Phone /> Answer</Button>
          </div>
        </>
      ) : call ? (
        <>
          <p className="text-xs text-muted-foreground">{state === "live" ? `On call · ${clock(seconds)}` : "Calling…"}</p>
          <p className="truncate text-lg font-semibold">{label}</p>
          {keypad && (
            <div className="grid grid-cols-3 gap-1.5">
              {KEYS.map((k) => <Button key={k} variant="outline" size="sm" onClick={() => call.sendDigits(k)}>{k}</Button>)}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" aria-label={muted ? "Unmute" : "Mute"} onClick={() => { call.mute(!muted); setMuted(!muted); }}>{muted ? <MicOff /> : <Mic />}</Button>
            <Button variant="outline" aria-label="Keypad" className={cn(keypad && "bg-accent")} onClick={() => setKeypad(!keypad)}><Grid3x3 /></Button>
            <Button variant="destructive" aria-label="Hang up" onClick={() => call.disconnect()}><PhoneOff /></Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Recorded and transcribed to the timeline.</p>
        </>
      ) : null}
      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <span className="flex-1">{error}</span>
          <button type="button" className="text-xs underline" onClick={() => setError(undefined)}>Dismiss</button>
        </div>
      )}
    </div>
  );
}
