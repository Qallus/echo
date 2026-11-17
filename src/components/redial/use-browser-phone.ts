"use client";

import { useEffect, useRef, useState } from "react";
import type { Call, Device } from "@twilio/voice-sdk";

// Calls from the browser on a Redial line (Twilio Voice, outgoing only). The
// device is created on the first call, so pages that never dial don't ask for
// the microphone or a token.

export type PhoneState = "idle" | "connecting" | "live";

export function useBrowserPhone(onEnded?: () => void) {
  const device = useRef<Device | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [state, setState] = useState<PhoneState>("idle");
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string>();
  const ended = useRef(onEnded);
  useEffect(() => { ended.current = onEnded; }, [onEnded]);

  useEffect(() => () => { device.current?.destroy(); device.current = null; }, []);
  useEffect(() => {
    if (state !== "live") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [state]);

  async function token() {
    const res = await fetch("/api/redial/phone-token", { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
    if (!data.token) throw new Error(data.error ?? "Calling from the browser isn't available.");
    return data.token;
  }

  async function place(params: { To: string; LineId: string; Record: "1" | "0" }) {
    if (call) return;
    setError(undefined);
    try {
      if (!device.current) {
        const { Device: TwilioDevice, Call: TwilioCall } = await import("@twilio/voice-sdk");
        const d = new TwilioDevice(await token(), { codecPreferences: [TwilioCall.Codec.Opus, TwilioCall.Codec.PCMU], closeProtection: true });
        d.on("error", (e: { message?: string }) => setError(e.message ?? "Phone error."));
        d.on("tokenWillExpire", async () => { const t = await token().catch(() => null); if (t) d.updateToken(t); });
        device.current = d;
      }
      const c = await device.current.connect({ params });
      setCall(c); setState("connecting"); setMuted(false); setSeconds(0);
      c.on("accept", () => setState("live"));
      const end = () => { setCall(null); setState("idle"); ended.current?.(); };
      c.on("disconnect", end); c.on("cancel", end); c.on("reject", end);
      c.on("error", (e: { message?: string }) => { setError(e.message ?? "The call failed."); end(); });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't place the call.");
    }
  }

  return {
    state, seconds, muted, error, busy: Boolean(call),
    place,
    hangUp: () => call?.disconnect(),
    toggleMute: () => { if (call) { call.mute(!muted); setMuted(!muted); } },
    digit: (d: string) => call?.sendDigits(d),
    clearError: () => setError(undefined),
  };
}
