"use client";

import { useEffect, useRef, useState } from "react";
import type { Call, Device } from "@twilio/voice-sdk";
import { Mic, MicOff, Phone, PhoneIncoming, PhoneOff, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { agentDeskToken } from "@/lib/live-agents/agent-actions";
import { cn } from "@/lib/utils";

type Incoming = { business: string; caller: string; reason: string; engagement: string };
type State = "off" | "starting" | "ready" | "ringing" | "on-call";

const pretty = (n: string) => n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3");
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// The Agent Desk phone. Turn it on while you can take calls: a business's
// missed calls (and, soon, the AI's handoffs) ring here with a call card.
// Scripts come from the booking, so the agent knows how to answer.
export function AgentPhone({ scripts }: { scripts: Record<string, { business: string; script: string | null }> }) {
  const [state, setState] = useState<State>("off");
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<Incoming | null>(null);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const device = useRef<Device | null>(null);
  const call = useRef<Call | null>(null);

  useEffect(() => () => { device.current?.destroy(); }, []);
  useEffect(() => {
    if (state !== "on-call") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [state]);

  const reset = () => { call.current = null; setInfo(null); setMuted(false); setSeconds(0); setState(device.current ? "ready" : "off"); };

  async function turnOn() {
    setError(undefined);
    setState("starting");
    const r = await agentDeskToken();
    if (!r.token) { setError(r.error); setState("off"); return; }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => s.getTracks().forEach((t) => t.stop()));
      const { Device: TwilioDevice, Call: TwilioCall } = await import("@twilio/voice-sdk");
      const d = new TwilioDevice(r.token, { codecPreferences: [TwilioCall.Codec.Opus, TwilioCall.Codec.PCMU], closeProtection: true });
      d.on("incoming", (c: Call) => {
        const p = c.customParameters;
        setInfo({ business: p.get("business") ?? "A business", caller: p.get("caller") ?? "", reason: p.get("reason") ?? "", engagement: p.get("engagement") ?? "" });
        call.current = c;
        setState("ringing");
        c.on("accept", () => { setSeconds(0); setState("on-call"); });
        c.on("disconnect", reset); c.on("cancel", reset); c.on("reject", reset);
        c.on("error", (e: { message?: string }) => { setError(e.message ?? "The call dropped."); reset(); });
      });
      d.on("tokenWillExpire", async () => { const n = await agentDeskToken(); if (n.token) d.updateToken(n.token); });
      d.on("error", (e: { message?: string }) => setError(e.message ?? "The phone stopped working. Turn it off and on again."));
      await d.register();
      device.current = d;
      setState("ready");
    } catch (e) {
      setError(e instanceof Error && /permission|notallowed/i.test(e.message) ? "Allow microphone access in your browser to take calls." : "Couldn't turn on the phone.");
      setState("off");
    }
  }

  function turnOff() { device.current?.destroy(); device.current = null; reset(); setState("off"); }

  const script = info?.engagement ? scripts[info.engagement]?.script : null;

  return (
    <section className={cn("rounded-2xl border p-5", state === "ringing" && "border-emerald-500 ring-2 ring-emerald-500/40")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn("flex size-9 items-center justify-center rounded-full", state === "off" ? "bg-muted text-muted-foreground" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400")}>
            {state === "ringing" ? <PhoneIncoming className="size-4 animate-pulse" /> : <Phone className="size-4" />}
          </span>
          <div>
            <p className="font-semibold">Agent Desk phone</p>
            <p className="text-xs text-muted-foreground">
              {state === "off" ? "Off. Turn it on when you can take calls." : state === "starting" ? "Turning on…" : state === "ready" ? "Ready. Keep this page open; calls ring here." : state === "ringing" ? "Incoming transfer" : `On a call · ${clock(seconds)}`}
            </p>
          </div>
        </div>
        {state === "off" || state === "starting"
          ? <Button disabled={state === "starting"} onClick={turnOn}><Power /> Turn on phone</Button>
          : state === "ready" && <Button variant="outline" onClick={turnOff}><Power /> Turn off</Button>}
      </div>

      {info && (state === "ringing" || state === "on-call") && (
        <div className="mt-4 space-y-3 rounded-xl bg-muted/50 p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{state === "ringing" ? "Incoming transfer" : "On the call"} · {info.business}</p>
          <p className="text-lg font-semibold">{info.caller ? pretty(info.caller) : "Caller"}</p>
          {info.reason && <p className="text-sm text-muted-foreground">Redial captured: {info.reason}</p>}
          {script && <div className="rounded-lg border bg-background p-3 text-sm whitespace-pre-wrap"><p className="mb-1 text-xs font-medium text-muted-foreground">How {info.business} wants calls answered</p>{script}</div>}
          <div className="flex flex-wrap gap-2">
            {state === "ringing" ? (
              <>
                <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => call.current?.accept()}><Phone /> Answer</Button>
                <Button variant="outline" onClick={() => call.current?.reject()}>Let it go to voicemail</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => { const m = !muted; call.current?.mute(m); setMuted(m); }}>{muted ? <><MicOff /> Unmute</> : <><Mic /> Mute</>}</Button>
                <Button variant="destructive" onClick={() => call.current?.disconnect()}><PhoneOff /> Hang up</Button>
              </>
            )}
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </section>
  );
}
