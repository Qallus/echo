"use client";

import { useEffect, useRef, useState } from "react";
import type { Call, Device } from "@twilio/voice-sdk";
import { Phone, PhoneOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadFlowRuns, startTestCall } from "@/lib/flows/actions";
import type { FlowRun } from "@/lib/flows/data";

// Call the draft from the browser: hear it, press keys on the keypad, and
// watch the path light up on the canvas. Connect blocks ring real numbers;
// the AI assistant and voicemail are stood in for.

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

export function TestCall({ flowId, saved, onClose, onRun }: { flowId: string; saved: boolean; onClose: () => void; onRun: (r: FlowRun | null) => void }) {
  const device = useRef<Device | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [state, setState] = useState<"idle" | "connecting" | "live" | "ended">("idle");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(0);

  useEffect(() => () => { device.current?.destroy(); }, []);

  // While on the call, follow the newest test run.
  useEffect(() => {
    if (state !== "live" && state !== "connecting") return;
    const t = window.setInterval(async () => {
      const runs = await loadFlowRuns(flowId).catch(() => []);
      const run = runs.find((r) => r.from === "Test call" && new Date(r.startedAt).getTime() >= started.current - 5000);
      if (run) onRun(run);
    }, 2000);
    return () => window.clearInterval(t);
  }, [state, flowId, onRun]);

  async function dial() {
    setError(null);
    setState("connecting");
    const r = await startTestCall(flowId);
    if (!r.token || !r.ticket) { setError(r.error ?? "Couldn't start the test call."); setState("idle"); return; }
    try {
      const { Device: TwilioDevice } = await import("@twilio/voice-sdk");
      device.current?.destroy();
      device.current = new TwilioDevice(r.token, { closeProtection: true });
      started.current = Date.now();
      const c = await device.current.connect({ params: { TreeTest: r.ticket } });
      setCall(c);
      c.on("accept", () => setState("live"));
      const end = () => { setState("ended"); setCall(null); };
      c.on("disconnect", end); c.on("cancel", end); c.on("reject", end);
      c.on("error", (e: Error) => { setError(e.message); end(); });
    } catch (e) {
      setError((e as Error).message);
      setState("idle");
    }
  }

  return (
    <div className="pointer-events-auto w-72 space-y-3 rounded-2xl border bg-background p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Test call</p>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={() => { call?.disconnect(); onRun(null); onClose(); }}><X /></Button>
      </div>
      <p className="text-xs text-muted-foreground">Calls your saved draft from this browser. Connect blocks ring real numbers; your AI assistant and voicemail are stood in for.</p>
      {state === "live" && (
        <div className="grid grid-cols-3 gap-1.5">
          {KEYS.map((k) => <Button key={k} variant="outline" size="sm" onClick={() => call?.sendDigits(k)}>{k}</Button>)}
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {call ? (
        <Button variant="destructive" className="w-full" onClick={() => call.disconnect()}><PhoneOff /> {state === "connecting" ? "Cancel" : "Hang up"}</Button>
      ) : (
        <Button className="w-full" disabled={!saved || state === "connecting"} onClick={() => void dial()}><Phone /> {!saved ? "Saving…" : state === "connecting" ? "Calling…" : state === "ended" ? "Call again" : "Call"}</Button>
      )}
      <p className="text-[11px] text-muted-foreground">Your browser will ask to use the microphone.</p>
    </div>
  );
}
