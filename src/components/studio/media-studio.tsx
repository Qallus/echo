"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Mic, Music, Play, Sparkles, Square, Wand2, X } from "lucide-react";
import { AudioPlayer } from "@/components/studio/audio-player";
import { BackgroundMusic } from "@/components/studio/background-music";
import { CoverThumb } from "@/components/studio/cover-thumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { imageToDataUrl } from "@/lib/studio/image";
import { MAX_SCRIPT, STUDIO_KINDS, type StudioAudio, type StudioKind } from "@/lib/studio/types";
import { encodeWav } from "@/lib/studio/wav";
import { cn } from "@/lib/utils";

// The Studio tab (ported from Channel Cast's Media Studio): a voiceover from
// the microphone, a file, the library or an AI voice; background music from a
// file, the drum machine or AI beats; then levels, preview and a rendered WAV
// saved to the person's library.

const SR = 44100;

type Voice = { id: string; name: string; gender?: string; description?: string };
type Provider = { id: string; label: string; configured: boolean; voices: Voice[] };
type VoiceMode = "record" | "upload" | "ai";

const SEGMENT = "flex gap-1 rounded-md border bg-muted/40 p-1";
const segBtn = (on: boolean, extra?: string) => cn("flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors", on ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground", extra);
const FILE_INPUT = "block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:text-secondary-foreground";
const SELECT = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

export function MediaStudio({ library, onSaved }: { library: StudioAudio[]; onSaved: (a: StudioAudio) => void }) {
  const ctxRef = useRef<AudioContext | null>(null);
  const getCtx = () => (ctxRef.current ??= new AudioContext({ sampleRate: SR }));
  const playable = library.filter((a) => a.url && !a.archived_at);

  const [voiceMode, setVoiceMode] = useState<VoiceMode>("record");
  const [voiceBuffer, setVoiceBuffer] = useState<AudioBuffer | null>(null);
  const [voiceName, setVoiceName] = useState("");
  const [musicBuffer, setMusicBuffer] = useState<AudioBuffer | null>(null);
  const [musicName, setMusicName] = useState("");

  // Mix controls
  const [voiceGain, setVoiceGain] = useState(1.0);
  const [musicGain, setMusicGain] = useState(0.35);
  const [loopMusic, setLoopMusic] = useState(true);
  const [leadIn, setLeadIn] = useState(0);

  // Recording
  const [recording, setRecording] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // AI
  const [script, setScript] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [speed, setSpeed] = useState(1.0);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [aiPreviewSrc, setAiPreviewSrc] = useState<string | null>(null);
  const [provider, setProvider] = useState("openai");
  const [ttsProviders, setTtsProviders] = useState<Provider[]>([]);
  const [generating, setGenerating] = useState(false);

  const currentVoices = ttsProviders.find((p) => p.id === provider)?.voices ?? [];
  function chooseProvider(id: string) {
    setProvider(id);
    setVoiceId(ttsProviders.find((p) => p.id === id)?.voices[0]?.id ?? "");
  }

  // Preview + render
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<AudioBufferSourceNode[] | null>(null);
  const [rendering, setRendering] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Recording details saved with the rendered mix.
  const [detailName, setDetailName] = useState("");
  const [detailKind, setDetailKind] = useState<StudioKind>("greeting");
  const [detailDescription, setDetailDescription] = useState("");
  const [detailImage, setDetailImage] = useState<string | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  async function pickImage(file: File | null) {
    if (file) setDetailImage(await imageToDataUrl(file));
    if (imageRef.current) imageRef.current.value = "";
  }

  useEffect(() => {
    fetch("/api/studio/voices")
      .then((r) => r.json())
      .then((d: { providers?: Provider[] }) => {
        if (!d.providers) return;
        setTtsProviders(d.providers);
        const chosen = d.providers.find((p) => p.configured) ?? d.providers[0];
        if (chosen) {
          setProvider(chosen.id);
          setVoiceId(chosen.voices[0]?.id ?? "");
        }
      })
      .catch(() => {});
  }, []);

  async function decodeUrl(url: string): Promise<AudioBuffer> {
    return getCtx().decodeAudioData(await (await fetch(url)).arrayBuffer());
  }

  /* voice sources */
  async function startRecording() {
    setRecError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        setVoiceBuffer(await getCtx().decodeAudioData(await blob.arrayBuffer()));
        setVoiceName("Voice recording");
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      setRecError("We couldn't use your microphone. Allow microphone access in your browser and try again.");
    }
  }
  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }
  async function pickVoiceFile(file: File | null) {
    if (!file) return;
    setVoiceBuffer(await getCtx().decodeAudioData(await file.arrayBuffer()));
    setVoiceName(file.name);
  }
  async function pickVoiceFromLibrary(id: string) {
    const a = playable.find((x) => x.id === id);
    if (!a?.url) return;
    setVoiceBuffer(await decodeUrl(a.url));
    setVoiceName(a.name);
  }

  /* AI voice */
  async function generateAiVoice() {
    const label = ttsProviders.find((p) => p.id === provider)?.label ?? "AI";
    setAiMsg(`Generating with ${label}…`);
    setGenerating(true);
    try {
      const res = await fetch("/api/studio/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, voice: voiceId, speed, provider, kind: detailKind }),
      });
      const data = (await res.json()) as { audio?: StudioAudio; error?: string; hint?: string; detail?: string };
      if (data.audio) {
        onSaved(data.audio);
        setAiPreviewSrc(data.audio.url);
        try {
          if (data.audio.url) setVoiceBuffer(await decodeUrl(data.audio.url));
          setVoiceName(data.audio.name);
          setAiMsg("Done. It's playing below, loaded as the voiceover, and saved to your library.");
        } catch {
          setVoiceName(data.audio.name);
          setAiMsg("Saved to your library. Play it below; if it won't load into the mixer, try another engine.");
        }
      } else {
        setAiMsg([data.error, data.hint].filter(Boolean).join(" ") || "Generation isn't available right now.");
      }
    } catch (e) {
      setAiMsg(`Generation failed: ${(e as Error).message}`);
    } finally {
      setGenerating(false);
    }
  }

  /* preview mix */
  function stopPreview() {
    playRef.current?.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } });
    playRef.current = null;
    setPlaying(false);
  }
  function previewMix() {
    if (!voiceBuffer && !musicBuffer) return;
    stopPreview();
    const ctx = getCtx();
    if (ctx.state === "suspended") void ctx.resume();
    const sources: AudioBufferSourceNode[] = [];
    const now = ctx.currentTime + 0.05;
    if (musicBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = musicBuffer;
      src.loop = loopMusic;
      const g = ctx.createGain();
      g.gain.value = musicGain;
      src.connect(g).connect(ctx.destination);
      src.start(now);
      if (voiceBuffer) src.stop(now + voiceBuffer.duration + leadIn + 0.4);
      else src.onended = stopPreview;
      sources.push(src);
    }
    if (voiceBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = voiceBuffer;
      const g = ctx.createGain();
      g.gain.value = voiceGain;
      src.connect(g).connect(ctx.destination);
      src.start(now + leadIn);
      src.onended = stopPreview;
      sources.push(src);
    }
    playRef.current = sources;
    setPlaying(true);
  }

  /* render + save */
  async function renderAndSave() {
    if (!voiceBuffer && !musicBuffer) return;
    setRendering(true);
    setSaveMsg(null);
    try {
      const durationSec = (voiceBuffer ? voiceBuffer.duration + leadIn : musicBuffer!.duration) + 0.4;
      const offline = new OfflineAudioContext(2, Math.ceil(durationSec * SR), SR);
      if (musicBuffer) {
        const src = offline.createBufferSource();
        src.buffer = musicBuffer;
        src.loop = loopMusic;
        const g = offline.createGain();
        g.gain.value = musicGain;
        src.connect(g).connect(offline.destination);
        src.start(0);
      }
      if (voiceBuffer) {
        const src = offline.createBufferSource();
        src.buffer = voiceBuffer;
        const g = offline.createGain();
        g.gain.value = voiceGain;
        src.connect(g).connect(offline.destination);
        src.start(leadIn);
      }
      const rendered = await offline.startRendering();
      const name = detailName.trim() || `${voiceName || "Studio mix"}${musicBuffer ? " + music" : ""}`;
      const fd = new FormData();
      fd.append("file", new File([encodeWav(rendered)], `${name}.wav`, { type: "audio/wav" }));
      fd.append("name", name);
      fd.append("source", "mix");
      fd.append("kind", detailKind);
      fd.append("duration", String(rendered.duration));
      if (detailDescription.trim()) fd.append("description", detailDescription.trim());
      if (detailImage) fd.append("image", detailImage);
      const res = await fetch("/api/studio/audio", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { audio?: StudioAudio; error?: string };
      if (!data.audio) throw new Error(data.error ?? "Couldn't save the mix.");
      onSaved(data.audio);
      setSaveMsg(`Saved "${name}" to your library.`);
      setDetailName("");
      setDetailDescription("");
      setDetailImage(null);
    } catch (e) {
      setSaveMsg(`Render failed: ${(e as Error).message}`);
    } finally {
      setRendering(false);
    }
  }

  /* waveform */
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const w = (canvas.width = canvas.clientWidth * 2);
    const h = (canvas.height = 120);
    ctx.clearRect(0, 0, w, h);
    if (!voiceBuffer) return;
    const data = voiceBuffer.getChannelData(0);
    const step = Math.floor(data.length / w) || 1;
    ctx.fillStyle = getComputedStyle(canvas).color;
    for (let x = 0; x < w; x++) {
      let min = 1;
      let max = -1;
      for (let i = 0; i < step; i++) {
        const v = data[x * step + i] ?? 0;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      ctx.fillRect(x, ((1 + min) / 2) * h, 1, Math.max(1, ((max - min) / 2) * h));
    }
  }, [voiceBuffer]);

  const hasSomething = Boolean(voiceBuffer || musicBuffer);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Voiceover */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Mic className="size-5" />
            <div>
              <CardTitle>Voiceover</CardTitle>
              <CardDescription>Record, upload, or generate the voice track.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className={SEGMENT}>
              {(["record", "upload", "ai"] as VoiceMode[]).map((m) => (
                <button key={m} type="button" onClick={() => setVoiceMode(m)} className={segBtn(voiceMode === m, "capitalize")}>{m === "ai" ? "AI voice" : m}</button>
              ))}
            </div>

            {voiceMode === "record" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {recording
                    ? <Button variant="destructive" onClick={stopRecording}><Square /> Stop</Button>
                    : <Button onClick={startRecording}><Mic /> Record</Button>}
                  {recording && <span className="flex items-center gap-1.5 text-sm text-destructive"><span className="size-2 animate-pulse rounded-full bg-destructive" /> Recording…</span>}
                </div>
                {recError && <p className="text-xs text-destructive">{recError}</p>}
              </div>
            )}

            {voiceMode === "upload" && (
              <div className="space-y-2">
                <label className="block">
                  <span className="mb-1 block text-xs text-muted-foreground">Upload a file</span>
                  <input type="file" accept="audio/*" onChange={(e) => pickVoiceFile(e.target.files?.[0] ?? null)} className={FILE_INPUT} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-muted-foreground">…or pick from your library</span>
                  <select defaultValue="" onChange={(e) => pickVoiceFromLibrary(e.target.value)} className={SELECT}>
                    <option value="">Select…</option>
                    {playable.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </label>
              </div>
            )}

            {voiceMode === "ai" && (
              <div className="space-y-3">
                {ttsProviders.length > 0 && (
                  <div>
                    <span className="mb-1.5 block text-xs text-muted-foreground">Voice engine</span>
                    <div className={SEGMENT}>
                      {ttsProviders.map((p) => (
                        <button key={p.id} type="button" onClick={() => chooseProvider(p.id)} disabled={!p.configured} title={p.configured ? undefined : "Not set up yet"}
                          className={segBtn(provider === p.id, !p.configured ? "cursor-not-allowed opacity-40" : undefined)}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <Textarea value={script} maxLength={MAX_SCRIPT} onChange={(e) => setScript(e.target.value)} placeholder="Type the script the AI voice should read…" className="min-h-[80px]" />
                <div>
                  <span className="mb-1.5 block text-xs text-muted-foreground">Voice ({currentVoices.length})</span>
                  <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                    {currentVoices.map((v) => (
                      <button key={v.id} type="button" onClick={() => setVoiceId(v.id)}
                        className={cn("rounded-md border p-2 text-left transition-colors", voiceId === v.id ? "border-primary bg-primary/10" : "hover:bg-muted/50")}>
                        <span className="block text-sm font-medium">{v.name}</span>
                        {(v.gender || v.description) && <span className="block text-[11px] text-muted-foreground">{[v.gender, v.description].filter(Boolean).join(" · ")}</span>}
                      </button>
                    ))}
                    {currentVoices.length === 0 && <p className="col-span-full text-sm text-muted-foreground">No voices available for this engine.</p>}
                  </div>
                </div>
                <label className="flex items-center gap-3 text-xs text-muted-foreground">
                  Speed {speed.toFixed(2)}×
                  <input type="range" min={0.6} max={1.6} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="flex-1 accent-primary" />
                </label>
                <Button onClick={generateAiVoice} disabled={!script.trim() || !voiceId || generating} className="w-full">
                  <Sparkles /> {generating ? "Generating…" : "Generate voice"}
                </Button>
                {aiPreviewSrc && <AudioPlayer src={aiPreviewSrc} downloadName="ai-voice.wav" />}
                {aiMsg && <p className="text-xs text-muted-foreground">{aiMsg}</p>}
              </div>
            )}

            <div className="rounded-md border bg-muted/30 p-2 text-xs">
              {voiceBuffer
                ? <span>Voice ready: <span className="font-medium">{voiceName}</span> · {voiceBuffer.duration.toFixed(1)}s</span>
                : <span className="text-muted-foreground">No voiceover loaded yet.</span>}
            </div>
            <canvas ref={canvasRef} className="h-[60px] w-full rounded-md bg-muted/20 text-foreground" />
          </CardContent>
        </Card>

        {/* Background music */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Music className="size-5" />
            <div>
              <CardTitle>Background music</CardTitle>
              <CardDescription>Add a music bed under the voiceover.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <BackgroundMusic library={playable} onMusic={(buf, name) => { setMusicBuffer(buf); setMusicName(name); }} />
            <div className="rounded-md border bg-muted/30 p-2 text-xs">
              {musicBuffer
                ? <span>Music loaded: <span className="font-medium">{musicName}</span> · {musicBuffer.duration.toFixed(1)}s</span>
                : <span className="text-muted-foreground">No music yet.</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mix & export */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Wand2 className="size-5" />
          <div>
            <CardTitle>Mix &amp; export</CardTitle>
            <CardDescription>Balance the levels, preview, then save to your library.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Slider label={`Voice level ${Math.round(voiceGain * 100)}%`} min={0} max={1.5} step={0.05} value={voiceGain} onChange={setVoiceGain} />
            <Slider label={`Music level ${Math.round(musicGain * 100)}%`} min={0} max={1} step={0.05} value={musicGain} onChange={setMusicGain} />
            <label className="block text-xs text-muted-foreground">
              Music lead-in (seconds)
              <Input type="number" min={0} max={30} step={0.5} value={leadIn} onChange={(e) => setLeadIn(Math.max(0, Math.min(30, Number(e.target.value) || 0)))} className="mt-1" />
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={loopMusic} onChange={(e) => setLoopMusic(e.target.checked)} className="size-4 accent-primary" />
            Loop the music to fill the voiceover
          </label>

          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Recording details</p>
            <div className="flex items-center gap-3">
              <CoverThumb image={detailImage} size="lg" />
              <input ref={imageRef} type="file" accept="image/*" hidden onChange={(e) => pickImage(e.target.files?.[0] ?? null)} />
              <Button type="button" variant="outline" size="sm" onClick={() => imageRef.current?.click()}><ImagePlus /> {detailImage ? "Replace image" : "Add image"}</Button>
              {detailImage && <Button type="button" variant="ghost" size="sm" onClick={() => setDetailImage(null)}><X /> Remove</Button>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-xs text-muted-foreground">Name</span>
                <Input value={detailName} maxLength={120} onChange={(e) => setDetailName(e.target.value)} placeholder={voiceName || "Name this recording"} />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs text-muted-foreground">What it&apos;s for</span>
                <select value={detailKind} onChange={(e) => setDetailKind(e.target.value as StudioKind)} className={SELECT}>
                  {STUDIO_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                </select>
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs text-muted-foreground">Description</span>
              <Textarea rows={2} maxLength={1000} value={detailDescription} onChange={(e) => setDetailDescription(e.target.value)} placeholder="Where it plays and what it says, e.g. main line greeting, after hours" />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {playing
              ? <Button variant="destructive" onClick={stopPreview}><Square /> Stop</Button>
              : <Button variant="outline" onClick={previewMix} disabled={!hasSomething}><Play /> Preview mix</Button>}
            <Button onClick={renderAndSave} disabled={!hasSomething || rendering}><Sparkles /> {rendering ? "Rendering…" : "Render and save to library"}</Button>
          </div>
          {saveMsg && <p className="text-sm">{saveMsg}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-xs text-muted-foreground">
      {label}
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-primary" />
    </label>
  );
}
