"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TRANSCRIPTION_OPTIONS, type TranscriptionSetting } from "@/lib/transcription/models";
import { cn } from "@/lib/utils";
import { setTranscription } from "./actions";

export function TranscriptionSettingForm({ current, keys }: { current: TranscriptionSetting; keys: Record<string, boolean> }) {
  const [selected, setSelected] = useState(`${current.provider}:${current.model}`);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const choose = (provider: string, model: string) => {
    const prev = selected;
    setSelected(`${provider}:${model}`);
    setSaved(false);
    start(async () => {
      const res = await setTranscription(provider, model);
      if (res.error) { setError(res.error); setSelected(prev); } else { setError(undefined); setSaved(true); }
    });
  };

  return (
    <div className="space-y-2">
      <div className="grid gap-2 md:grid-cols-3">
        {TRANSCRIPTION_OPTIONS.map((o) => {
          const id = `${o.provider}:${o.model}`;
          const active = selected === id;
          const missingKey = o.available && !keys[o.provider];
          return (
            <button key={id} type="button" disabled={!o.available || pending} aria-pressed={active}
              onClick={() => choose(o.provider, o.model)}
              className={cn("flex flex-col items-start gap-1 rounded-lg border p-3 text-left text-sm transition-colors enabled:hover:bg-muted/50 disabled:opacity-60",
                active && "border-primary ring-1 ring-primary")}>
              <span className="flex w-full items-center gap-2 font-medium">
                {o.label} {active && <Check className="ml-auto size-4" />}
              </span>
              <span className="text-xs text-muted-foreground">{o.detail}</span>
              {!o.available && <Badge variant="outline">Coming next</Badge>}
              {missingKey && <Badge variant="outline" className="text-destructive">API key missing</Badge>}
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-muted-foreground">Saved. New transcriptions use this option.</p>}
    </div>
  );
}
