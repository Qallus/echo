"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, Sparkles, Star } from "lucide-react";
import { AudioPlayer } from "@/components/studio/audio-player";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { setDefaultVoice, useDefaultVoice } from "@/lib/studio/default-voice";
import { MAX_SCRIPT, STUDIO_KINDS, type StudioAudio, type StudioKind } from "@/lib/studio/types";
import { cn } from "@/lib/utils";

// Recording Studio's guided path: a greeting in four steps. What it's for,
// the words (with a starter script for each kind), the voice (remembered as
// your default, shared with Call Tree), then make it and save it to the
// library. Call Tree's "Make a clip" opens this with the words filled in.

type Voice = { id: string; name: string; gender?: string; description?: string };
type Provider = { id: string; label: string; configured: boolean; voices: Voice[] };
export type GreetingPrefill = { script?: string; kind?: string; name?: string; extension?: string };

const STARTERS: Record<StudioKind, string> = {
  greeting: "Thank you for calling. If you know your party's extension, please dial it at any time.",
  ivr: "For sales, press 1. For support, press 2. To speak to an operator, press 0.",
  extension: "You've reached the sales team. Please hold while we connect you.",
  hold: "Thanks for holding. Someone will be with you shortly.",
  voicemail: "Sorry we missed your call. Please leave your name, number and a short message after the tone.",
  other: "",
};

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span className={cn("flex size-6 items-center justify-center rounded-full text-xs", done ? "bg-primary text-primary-foreground" : "bg-muted")}>{done ? <Check className="size-3.5" /> : n}</span>
        {title}
      </h3>
      <div className="pl-8">{children}</div>
    </section>
  );
}

export function QuickGreeting({ prefill, onSaved }: { prefill?: GreetingPrefill; onSaved: (a: StudioAudio) => void }) {
  const preferred = useDefaultVoice();
  const [kind, setKind] = useState<StudioKind>(STUDIO_KINDS.some((k) => k.id === prefill?.kind) ? (prefill!.kind as StudioKind) : "greeting");
  const [name, setName] = useState(prefill?.name ?? "");
  const [extension, setExtension] = useState(prefill?.extension ?? "");
  const [script, setScript] = useState(prefill?.script ?? STARTERS.greeting);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [pick, setPick] = useState<{ provider: string; voice: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [made, setMade] = useState<StudioAudio | null>(null);

  useEffect(() => {
    fetch("/api/studio/voices").then((r) => r.json()).then((d: { providers?: Provider[] }) => setProviders(d.providers ?? [])).catch(() => {});
  }, []);
  // Your default voice, else the first voice of the first engine that's set up.
  const voice = pick ?? preferred ?? (() => { const p = providers.find((x) => x.configured); return p?.voices[0] ? { provider: p.id, voice: p.voices[0].id } : null; })();
  const engine = providers.find((p) => p.id === voice?.provider);
  const isDefault = Boolean(voice && preferred && voice.provider === preferred.provider && voice.voice === preferred.voice);
  const kindLabel = useMemo(() => STUDIO_KINDS.find((k) => k.id === kind)?.label ?? "Greeting", [kind]);

  function chooseKind(k: StudioKind) {
    setKind(k);
    // Swap the starter script only if the words are still a starter.
    if (!script.trim() || Object.values(STARTERS).includes(script)) setScript(STARTERS[k]);
  }

  async function make() {
    if (!voice) return;
    setBusy(true);
    setMsg(null);
    setMade(null);
    try {
      const res = await fetch("/api/studio/voice", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, provider: voice.provider, voice: voice.voice, speed: 1, kind, name: name.trim() || undefined, extension: extension.trim() || undefined }),
      });
      const data = (await res.json()) as { audio?: StudioAudio; error?: string; hint?: string };
      if (!data.audio) { setMsg({ text: [data.error, data.hint].filter(Boolean).join(" ") || "Couldn't make it.", error: true }); return; }
      setMade(data.audio);
      setMsg({ text: `Saved to your library as "${data.audio.name}".` });
      onSaved(data.audio);
    } catch {
      setMsg({ text: "Couldn't reach the voice service. Try again.", error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 rounded-2xl border bg-card p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">New greeting with an AI voice</h2>
        <p className="text-sm text-muted-foreground">Four quick steps. It&apos;s saved to your library, ready to pick in Call Tree.</p>
      </div>

      <Step n={1} title="What's it for?" done={Boolean(kind)}>
        <div className="flex flex-wrap gap-2">
          {STUDIO_KINDS.filter((k) => k.id !== "other").map((k) => (
            <button key={k.id} type="button" onClick={() => chooseKind(k.id)}
              className={cn("rounded-full border px-3 py-1.5 text-sm transition-colors", kind === k.id ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}>{k.label}</button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5"><span className="text-xs text-muted-foreground">Name (optional)</span>
            <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder={`${kindLabel}, e.g. Main line greeting`} /></label>
          <label className="space-y-1.5"><span className="text-xs text-muted-foreground">Extension or who it&apos;s for (optional)</span>
            <Input value={extension} maxLength={40} onChange={(e) => setExtension(e.target.value)} placeholder="101, or Sales" /></label>
        </div>
      </Step>

      <Step n={2} title="What should it say?" done={Boolean(script.trim())}>
        <Textarea rows={3} maxLength={MAX_SCRIPT} value={script} onChange={(e) => setScript(e.target.value)} placeholder="Type the words, exactly as they should be spoken." />
        <p className="mt-1 text-right text-[11px] text-muted-foreground">{script.length}/{MAX_SCRIPT}</p>
      </Step>

      <Step n={3} title="Pick a voice" done={Boolean(voice)}>
        {providers.length === 0 ? <p className="text-sm text-muted-foreground">Loading voices…</p> : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1 sm:w-fit">
              {providers.map((p) => (
                <button key={p.id} type="button" disabled={!p.configured} title={p.configured ? undefined : "Not set up yet (Admin → Settings → Integrations)"}
                  onClick={() => setPick({ provider: p.id, voice: p.voices[0]?.id ?? "" })}
                  className={cn("rounded-md px-3 py-1 text-sm", voice?.provider === p.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground", !p.configured && "cursor-not-allowed opacity-40")}>
                  {p.label}{p.id === "xai" ? " (your AI receptionist)" : ""}
                </button>
              ))}
            </div>
            <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 lg:grid-cols-6">
              {(engine?.voices ?? []).map((v) => (
                <button key={v.id} type="button" onClick={() => setPick({ provider: engine!.id, voice: v.id })}
                  className={cn("rounded-md border p-2 text-left transition-colors", voice?.voice === v.id ? "border-primary bg-primary/10" : "hover:bg-muted/50")}>
                  <span className="flex items-center gap-1 text-sm font-medium">{v.name}{preferred?.provider === engine?.id && preferred?.voice === v.id && <Star className="size-3 fill-current text-amber-500" />}</span>
                  {(v.gender || v.description) && <span className="block text-[11px] text-muted-foreground">{[v.gender, v.description].filter(Boolean).join(" · ")}</span>}
                </button>
              ))}
            </div>
            {voice && (
              <Button size="sm" variant="ghost" disabled={isDefault} onClick={() => setDefaultVoice(voice.provider, voice.voice)}>
                <Star className={cn(isDefault && "fill-current text-amber-500")} /> {isDefault ? "Your default voice" : "Make this my default voice"}
              </Button>
            )}
            <p className="text-xs text-muted-foreground">Your default voice is picked first here and suggested in Call Tree.</p>
          </div>
        )}
      </Step>

      <Step n={4} title="Make it and save" done={Boolean(made)}>
        <div className="space-y-3">
          <Button onClick={make} disabled={busy || !voice || !script.trim()}><Sparkles /> {busy ? "Making it…" : `Make ${kindLabel.toLowerCase()}`}</Button>
          {made?.url && <AudioPlayer src={made.url} downloadName={`${made.name}.wav`} />}
          {msg && <p role="status" className={cn("text-sm", msg.error ? "text-destructive" : "text-muted-foreground")}>{msg.text}</p>}
          {made && (
            <Link href="/call-tree" className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">
              Use it in a call tree <ExternalLink className="size-3.5" />
            </Link>
          )}
        </div>
      </Step>
    </div>
  );
}
