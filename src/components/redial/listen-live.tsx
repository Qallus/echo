"use client";

import { useEffect, useRef, useState } from "react";
import type { Call, Device } from "@twilio/voice-sdk";
import { Gavel, Headphones, Mic, MicOff, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startListening, takeOver } from "@/lib/redial/actions";
import { FEATURES } from "@/lib/redial/features";

// Insider and Gavel in the browser. Listening: the server joins this browser
// to the conference muted (enforced by Twilio) and the microphone is muted
// here too. Taking over: joins muted first if needed, then the server
// removes the assistant, and only once it's gone is the microphone turned
// on. Leaving the page hangs up.
type State = "idle" | "joining" | "listening" | "handing" | "speaking";

export function ListenLive({ callId, canListen, canTakeOver, takenOver }: {
  callId: string; canListen: boolean; canTakeOver: boolean; takenOver: "me" | "other" | null;
}) {
  const device = useRef<Device | null>(null);
  const call = useRef<Call | null>(null);
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  const stop = () => {
    call.current?.disconnect();
    device.current?.destroy();
    call.current = null; device.current = null;
    setState("idle");
  };
  useEffect(() => stop, []);

  const handOver = async () => {
    setError(null); setState("handing");
    const r = await takeOver(callId);
    if (r.speaking && call.current) { call.current.mute(false); setState("speaking"); return; }
    call.current?.mute(true);
    setError(r.error ?? "Couldn't take over the call.");
    setState(call.current ? "listening" : "idle");
  };

  const join = async (thenTakeOver: boolean) => {
    setError(null); setState("joining");
    const r = await startListening(callId);
    if (!r.token || !r.ticket) { setError(r.error ?? "Couldn't join the call."); setState("idle"); return; }
    try {
      const { Device: TwilioDevice, Call: TwilioCall } = await import("@twilio/voice-sdk");
      const d = new TwilioDevice(r.token, { codecPreferences: [TwilioCall.Codec.Opus, TwilioCall.Codec.PCMU] });
      device.current = d;
      const c = await d.connect({ params: { ticket: r.ticket } });
      call.current = c;
      c.mute(true);
      // The server records the join when Twilio reports it; give it a moment
      // before asking to take over.
      c.on("accept", () => { c.mute(true); setState("listening"); if (thenTakeOver) setTimeout(handOver, 1500); });
      const end = () => { device.current?.destroy(); device.current = null; call.current = null; setState("idle"); };
      c.on("disconnect", end); c.on("cancel", end); c.on("reject", end);
      c.on("error", (e: { message?: string }) => { setError(e.message ?? "The call dropped."); end(); });
    } catch (e) {
      setError(e instanceof Error && /permission|notallowed/i.test(e.message) ? "Allow microphone access to join. You stay muted until you take over; browsers require it for calls." : "Couldn't join the call.");
      stop();
    }
  };

  const mayTakeOver = canTakeOver && takenOver === null;
  const gavel = <><Gavel /> {FEATURES.gavel.action}</>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {state === "idle" && (
        <>
          {canListen && <Button size="sm" variant="outline" onClick={() => join(false)} title={FEATURES.insider.detail}><Headphones /> {FEATURES.insider.action}</Button>}
          {mayTakeOver && <Button size="sm" onClick={() => join(true)} title={FEATURES.gavel.detail}>{gavel}</Button>}
        </>
      )}
      {state === "joining" && <span className="text-xs text-muted-foreground">Joining…</span>}
      {(state === "listening" || state === "handing") && (
        <>
          <span className="flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium"><Headphones className="size-3.5" /> Listening live</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><MicOff className="size-3.5" /> You&apos;re muted by the phone system. Nobody on the call can hear you.</span>
          {state === "handing" ? <span className="text-xs text-muted-foreground">Removing the assistant…</span> : mayTakeOver && <Button size="sm" onClick={() => handOver()} title={FEATURES.gavel.detail}>{gavel}</Button>}
          <Button size="sm" variant="outline" onClick={stop}><PhoneOff /> Stop listening</Button>
        </>
      )}
      {state === "speaking" && (
        <>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-300"><Mic className="size-3.5" /> You&apos;re speaking with the caller</span>
          <span className="text-xs text-muted-foreground">The assistant is off the call.</span>
          <Button size="sm" variant="destructive" onClick={stop}><PhoneOff /> End call</Button>
        </>
      )}
      {error && <p className="w-full text-xs text-destructive">{error}</p>}
    </div>
  );
}
