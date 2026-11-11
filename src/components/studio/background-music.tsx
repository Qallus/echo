"use client";

import { useRef, useState } from "react";
import { Link2, Sparkles } from "lucide-react";

import { AudioPlayer } from "@/components/studio/audio-player";
import { DrumMachine } from "@/components/studio/drum-machine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { defaultPattern, type Pattern } from "@/lib/studio/drum-engine";
import { cn } from "@/lib/utils";

type LibAudio = { id: string; name: string; url: string | null };
type Tab = "upload" | "machine" | "ai";

export function BackgroundMusic({
  library,
  onMusic,
}: {
  library: LibAudio[];
  onMusic: (buffer: AudioBuffer, name: string) => void;
}) {
  const ctxRef = useRef<AudioContext | null>(null);
  const getCtx = () => (ctxRef.current ??= new AudioContext({ sampleRate: 44100 }));

  const [tab, setTab] = useState<Tab>("upload");
  const [pattern, setPattern] = useState<Pattern>(() => defaultPattern(16));
  const [musicSrc, setMusicSrc] = useState<string | null>(null);

  // AI beats
  const [description, setDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);

  async function loadDecoded(arrayBuffer: ArrayBuffer, name: string, src: string) {
    const buf = await getCtx().decodeAudioData(arrayBuffer);
    onMusic(buf, name);
    setMusicSrc(src);
  }

  async function pickFile(file: File | null) {
    if (!file) return;
    await loadDecoded(await file.arrayBuffer(), file.name, URL.createObjectURL(file));
  }
  async function pickLibrary(id: string) {
    if (!id) return;
    const a = library.find((x) => x.id === id);
    if (!a?.url) return;
    await loadDecoded(await (await fetch(a.url)).arrayBuffer(), a.name, a.url);
  }
  const [url, setUrl] = useState("");
  const [urlMsg, setUrlMsg] = useState<string | null>(null);
  async function loadUrl() {
    if (!url.trim()) return;
    setUrlMsg("Loading…");
    try {
      const res = await fetch(url.trim());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadDecoded(await res.arrayBuffer(), url.split("/").pop() || "URL track", url.trim());
      setUrlMsg("Loaded.");
    } catch (e) {
      setUrlMsg(`Couldn't load it. The site may not allow other sites to play its audio (${(e as Error).message}).`);
    }
  }

  async function generateBeat() {
    setAiMsg("Composing…");
    setGenerating(true);
    try {
      const res = await fetch("/api/studio/beats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data = await res.json();
      if (data.drums && data.melodic) {
        setPattern({ ...defaultPattern(16), bpm: data.bpm, drums: data.drums, melodic: data.melodic });
        setTab("machine");
        setAiMsg(null);
      } else {
        setAiMsg(data.hint || data.detail || data.error || "Couldn't generate a beat.");
      }
    } catch (e) {
      setAiMsg(`Failed: ${(e as Error).message}`);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-md border bg-muted/40 p-1">
        {(["upload", "machine", "ai"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors",
              tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "upload" ? "Upload" : t === "machine" ? "Drum Machine" : "AI Beats"}
          </button>
        ))}
      </div>

      {tab === "upload" && (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">Upload a music file</span>
            <input type="file" accept="audio/*" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:text-secondary-foreground" />
          </label>
          <div>
            <span className="mb-1 block text-xs text-muted-foreground">…or paste an audio URL</span>
            <div className="flex gap-2">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/track.mp3" />
              <Button variant="outline" onClick={loadUrl}><Link2 className="h-4 w-4" /> Load</Button>
            </div>
            {urlMsg && <p className="mt-1 text-xs text-muted-foreground">{urlMsg}</p>}
          </div>
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">…or pick from library</span>
            <select onChange={(e) => pickLibrary(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Select…</option>
              {library.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          {musicSrc && <AudioPlayer src={musicSrc} downloadName="background-music" />}
        </div>
      )}

      {tab === "machine" && <DrumMachine pattern={pattern} onChange={setPattern} onUse={onMusic} />}

      {tab === "ai" && (
        <div className="space-y-3">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the beat, e.g. a calm, light groove at 90 BPM with soft piano for a hold message"
            className="min-h-[80px]"
          />
          <Button onClick={generateBeat} disabled={!description.trim() || generating} className="w-full">
            <Sparkles className="h-4 w-4" /> {generating ? "Composing…" : "Generate beat"}
          </Button>
          {aiMsg && <p className="text-xs text-muted-foreground">{aiMsg}</p>}
          <p className="text-xs text-muted-foreground">
            The AI writes a pattern into the Drum Machine. Adjust it, play it, then choose &ldquo;Use as background music.&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
