/** Synthesized drum + melodic engine and step-pattern renderer (Web Audio). */

export type DrumTrackId =
  | "kick"
  | "snare"
  | "hihat"
  | "openhat"
  | "clap"
  | "tom"
  | "rimshot"
  | "cowbell"
  | "ride"
  | "crash";

export type MelodicTrackId = "piano" | "guitar" | "bass" | "synth";

export type Pattern = {
  bpm: number;
  steps: number;
  drums: Record<DrumTrackId, boolean[]>;
  drumGains: Record<DrumTrackId, number>;
  drumMutes: Record<DrumTrackId, boolean>;
  /** One note name (e.g. "C3") or null per step — monophonic per instrument. */
  melodic: Record<MelodicTrackId, (string | null)[]>;
  melodicGains: Record<MelodicTrackId, number>;
  melodicMutes: Record<MelodicTrackId, boolean>;
};

export const DRUMS: { id: DrumTrackId; label: string }[] = [
  { id: "kick", label: "Kick" },
  { id: "snare", label: "Snare" },
  { id: "hihat", label: "Hi-Hat" },
  { id: "openhat", label: "Open Hat" },
  { id: "clap", label: "Clap" },
  { id: "tom", label: "Tom" },
  { id: "rimshot", label: "Rimshot" },
  { id: "cowbell", label: "Cowbell" },
  { id: "ride", label: "Ride" },
  { id: "crash", label: "Crash" },
];

export const MELODIC: { id: MelodicTrackId; label: string }[] = [
  { id: "piano", label: "Piano" },
  { id: "guitar", label: "Guitar" },
  { id: "bass", label: "Bass" },
  { id: "synth", label: "Synth" },
];

const CHROMA = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SEMI: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

export function noteFreq(note: string): number {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(note.trim());
  if (!m) return 130.81;
  const midi = (SEMI[m[1]] ?? 0) + (parseInt(m[2], 10) + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** 13 notes (an octave incl. both C's) starting at the given octave. */
export function rollNotes(octave: number): string[] {
  return Array.from({ length: 13 }, (_, i) => `${CHROMA[i % 12]}${octave + Math.floor(i / 12)}`);
}
export const isSharp = (note: string) => note.includes("#");

const nullRow = () => Array.from({ length: 16 }, () => null as string | null);

export function defaultPattern(steps = 16): Pattern {
  const row = (on: number[]) => Array.from({ length: steps }, (_, i) => on.includes(i));
  const off = () => Array.from({ length: steps }, () => false);
  const piano = nullRow();
  [
    [0, "C3"],
    [4, "E3"],
    [8, "G3"],
    [12, "E3"],
  ].forEach(([i, n]) => (piano[i as number] = n as string));
  return {
    bpm: 90,
    steps,
    drums: {
      kick: row([0, 4, 8, 12]),
      snare: row([4, 12]),
      hihat: row([0, 2, 4, 6, 8, 10, 12, 14]),
      openhat: off(),
      clap: off(),
      tom: off(),
      rimshot: off(),
      cowbell: off(),
      ride: off(),
      crash: off(),
    },
    drumGains: { kick: 0.9, snare: 0.7, hihat: 0.5, openhat: 0.4, clap: 0.6, tom: 0.6, rimshot: 0.5, cowbell: 0.4, ride: 0.4, crash: 0.5 },
    drumMutes: { kick: false, snare: false, hihat: false, openhat: false, clap: false, tom: false, rimshot: false, cowbell: false, ride: false, crash: false },
    melodic: { piano, guitar: nullRow(), bass: nullRow(), synth: nullRow() },
    melodicGains: { piano: 0.5, guitar: 0.5, bass: 0.6, synth: 0.45 },
    melodicMutes: { piano: false, guitar: false, bass: false, synth: false },
  };
}

function noise(ctx: BaseAudioContext, dur: number): AudioBufferSourceNode {
  const len = Math.max(1, Math.ceil(ctx.sampleRate * dur));
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource();
  s.buffer = b;
  return s;
}

export function scheduleDrum(ctx: BaseAudioContext, dest: AudioNode, id: DrumTrackId, t: number, gain: number) {
  const g = ctx.createGain();
  g.connect(dest);
  if (id === "kick") {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.36);
  } else if (id === "snare") {
    const n = noise(ctx, 0.2);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1200;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    n.connect(hp).connect(g);
    n.start(t);
    n.stop(t + 0.2);
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = 180;
    const og = ctx.createGain();
    og.gain.setValueAtTime(gain * 0.5, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(og).connect(dest);
    o.start(t);
    o.stop(t + 0.12);
  } else if (id === "hihat" || id === "openhat" || id === "ride" || id === "crash") {
    const dur = id === "hihat" ? 0.05 : id === "openhat" ? 0.3 : id === "ride" ? 0.5 : 1.0;
    const hpFreq = id === "crash" ? 4000 : id === "ride" ? 5000 : 7000;
    const n = noise(ctx, dur);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = hpFreq;
    g.gain.setValueAtTime(gain * 0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(hp).connect(g);
    n.start(t);
    n.stop(t + dur);
  } else if (id === "clap") {
    [0, 0.01, 0.02].forEach((d) => {
      const n = noise(ctx, 0.06);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1500;
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(gain * 0.6, t + d);
      cg.gain.exponentialRampToValueAtTime(0.001, t + d + 0.06);
      n.connect(bp).connect(cg).connect(dest);
      n.start(t + d);
      n.stop(t + d + 0.06);
    });
  } else if (id === "tom") {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.2);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.31);
  } else if (id === "rimshot") {
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = 330;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.06);
  } else {
    // cowbell — two square tones
    [540, 800].forEach((f) => {
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.setValueAtTime(gain * 0.4, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(og).connect(dest);
      o.start(t);
      o.stop(t + 0.26);
    });
  }
}

export function scheduleMelodic(ctx: BaseAudioContext, dest: AudioNode, id: MelodicTrackId, freq: number, t: number, gain: number) {
  const g = ctx.createGain();
  g.connect(dest);
  if (id === "piano") {
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = freq * 2;
    const o2g = ctx.createGain();
    o2g.gain.value = 0.3;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.connect(g);
    o2.connect(o2g).connect(g);
    o.start(t);
    o.stop(t + 0.47);
    o2.start(t);
    o2.stop(t + 0.47);
  } else if (id === "guitar") {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = "sawtooth";
    o2.frequency.value = freq * 1.005;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(3200, t);
    lp.frequency.exponentialRampToValueAtTime(700, t + 0.4);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(lp);
    o2.connect(lp);
    lp.connect(g);
    o.start(t);
    o.stop(t + 0.52);
    o2.start(t);
    o2.stop(t + 0.52);
  } else if (id === "bass") {
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = freq / 2;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.37);
  } else {
    // synth lead — saw + sub through lowpass, slight sustain
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = freq;
    const sub = ctx.createOscillator();
    sub.type = "sawtooth";
    sub.frequency.value = freq / 2;
    const subg = ctx.createGain();
    subg.gain.value = 0.4;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1600;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.connect(lp);
    sub.connect(subg).connect(lp);
    lp.connect(g);
    o.start(t);
    o.stop(t + 0.47);
    sub.start(t);
    sub.stop(t + 0.47);
  }
}

export async function renderPatternToBuffer(pattern: Pattern, bars = 2): Promise<AudioBuffer> {
  const stepDur = 60 / pattern.bpm / 4;
  const totalSteps = pattern.steps * bars;
  const duration = totalSteps * stepDur + 1.0;
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * 44100), 44100);
  for (let s = 0; s < totalSteps; s++) {
    const step = s % pattern.steps;
    const t = s * stepDur;
    for (const { id } of DRUMS) {
      if (pattern.drums[id][step] && !pattern.drumMutes[id]) scheduleDrum(ctx, ctx.destination, id, t, pattern.drumGains[id]);
    }
    for (const { id } of MELODIC) {
      const note = pattern.melodic[id][step];
      if (note && !pattern.melodicMutes[id]) scheduleMelodic(ctx, ctx.destination, id, noteFreq(note), t, pattern.melodicGains[id]);
    }
  }
  return ctx.startRendering();
}
