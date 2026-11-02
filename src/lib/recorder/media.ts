// Browser audio capture: microphone, optionally mixed with a shared tab/screen's
// audio (for meetings running in another tab or app).

export type CaptureMode = "mic" | "mic+tab";

export type Capture = {
  stream: MediaStream; // the mixed stream fed to MediaRecorder
  analyser: AnalyserNode; // for the live level meter
  stop: () => void; // releases the mic, the shared tab and the audio graph
};

export async function startCapture(mode: CaptureMode): Promise<Capture> {
  const mic = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  let tab: MediaStream | null = null;
  if (mode === "mic+tab") {
    try {
      // Browsers require video for screen capture; only its audio is kept.
      tab = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      tab.getVideoTracks().forEach((t) => t.stop());
      if (!tab.getAudioTracks().length) {
        tab = null;
        throw new Error('No audio was shared. Pick the meeting tab and turn on "Share tab audio".');
      }
    } catch (e) {
      mic.getTracks().forEach((t) => t.stop());
      throw e;
    }
  }

  const ctx = new AudioContext();
  // Created after awaits, so some browsers start it suspended, which would record silence.
  if (ctx.state === "suspended") await ctx.resume();
  const out = ctx.createMediaStreamDestination();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  for (const s of [mic, tab]) {
    if (!s) continue;
    const src = ctx.createMediaStreamSource(s);
    src.connect(out);
    src.connect(analyser);
  }

  let stopped = false;
  return {
    stream: out.stream,
    analyser,
    stop: () => {
      if (stopped) return; // safe to call more than once
      stopped = true;
      mic.getTracks().forEach((t) => t.stop());
      tab?.getTracks().forEach((t) => t.stop());
      void ctx.close();
    },
  };
}

// Opus in WebM where supported (Chrome, Edge, Firefox); MP4/AAC on Safari.
export function pickMimeType(): string {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4"];
  return options.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
}

export const extensionFor = (mime: string) => (mime.includes("mp4") ? "m4a" : "webm");

// 0..1 loudness from the analyser, for the level meter. Speech is roughly
// 0.01-0.1 RMS, so a square-root curve lights the bars for voices, not hiss.
export function readLevel(analyser: AnalyserNode, buf: Uint8Array<ArrayBuffer>): number {
  analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (const v of buf) sum += ((v - 128) / 128) ** 2;
  return Math.min(1, Math.sqrt(Math.sqrt(sum / buf.length)) * 2.2);
}

// Raw RMS loudness (0..1), from float samples: byte samples are too coarse to
// tell a quiet room from a dead microphone. A muted or taken-over mic reads ~0.
export function readRms(analyser: AnalyserNode, buf: Float32Array<ArrayBuffer>): number {
  analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  for (const v of buf) sum += v * v;
  return Math.sqrt(sum / buf.length);
}

// Duration in seconds of an audio/video file, read from its metadata.
export function fileDuration(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement("audio");
    const url = URL.createObjectURL(file);
    const done = (n: number) => { URL.revokeObjectURL(url); resolve(Number.isFinite(n) ? Math.round(n) : 0); };
    el.preload = "metadata";
    el.onloadedmetadata = () => done(el.duration);
    el.onerror = () => done(0);
    el.src = url;
  });
}
