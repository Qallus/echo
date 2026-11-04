"use client";

import { useEffect, useRef, useState } from "react";
import type { Call, Device } from "@twilio/voice-sdk";
import { Headphones, MicOff, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startListening } from "@/lib/redial/actions";
import { FEATURES } from "@/lib/redial/features";

// Insider: listen to a live call in the browser. The server joins this
// browser to the conference muted (enforced by Twilio), and the microphone
// is also muted here, so nothing is sent. Leaving the page hangs up.
export function ListenLive({ callId }: { callId: string }) {
  const device = useRef<Device | null>(null);
  const call = useRef<Call | null>(null);
  const [state, setState] = useState<"idle" | "joining" | "listening">("idle");
  const [error, setError] = useState<string | null>(null);

  const stop = () => {
    call.current?.disconnect();
    device.current?.destroy();
    call.current = null; device.current = null;
    setState("idle");
  };
  useEffect(() => stop, []);

  const join = async () => {
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
      c.on("accept", () => { c.mute(true); setState("listening"); });
      const end = () => { device.current?.destroy(); device.current = null; call.current = null; setState("idle"); };
      c.on("disconnect", end); c.on("cancel", end); c.on("reject", end);
      c.on("error", (e: { message?: string }) => { setError(e.message ?? "The call dropped."); end(); });
    } catch (e) {
      setError(e instanceof Error && /permission|notallowed/i.test(e.message) ? "Allow microphone access to listen. Your microphone stays muted; browsers require it for calls." : "Couldn't join the call.");
      stop();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {state === "listening" ? (
        <>
          <span className="flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium"><Headphones className="size-3.5" /> Listening live</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><MicOff className="size-3.5" /> You&apos;re muted by the phone system. Nobody on the call can hear you.</span>
          <Button size="sm" variant="outline" onClick={stop}><PhoneOff /> Stop listening</Button>
        </>
      ) : (
        <Button size="sm" variant="outline" disabled={state === "joining"} onClick={join} title={FEATURES.insider.detail}>
          <Headphones /> {state === "joining" ? "Joining…" : FEATURES.insider.action}
        </Button>
      )}
      {error && <p className="w-full text-xs text-destructive">{error}</p>}
    </div>
  );
}
