// The AI voice a call tree speaks in (client + server). Gemini voices are made
// into Recording Studio clips when the call tree is published; prompts that
// change per call (they contain {{…}}) and the runner's short phrases use a
// matching Google voice that Twilio can speak live.

export const GEMINI_VOICES = [
  "Achernar", "Achird", "Algenib", "Algieba", "Alnilam", "Aoede", "Autonoe", "Callirrhoe", "Charon", "Despina", "Enceladus", "Erinome", "Fenrir",
  "Gacrux", "Iapetus", "Kore", "Laomedeia", "Leda", "Orus", "Puck", "Pulcherrima", "Rasalgethi", "Sadachbia", "Sadaltager", "Schedar", "Sulafat",
  "Umbriel", "Vindemiatrix", "Zephyr", "Zubenelgenubi",
] as const;

// The Chirp 3 HD voices Twilio can speak in <Say> (same voices as Gemini's).
const TWILIO_CHIRP = ["Aoede", "Charon", "Fenrir", "Kore", "Leda", "Orus", "Puck", "Zephyr"];
// Closest live voice for the ones Twilio doesn't have.
const NEAREST: Record<string, string> = {
  Despina: "Kore", Achernar: "Aoede", Autonoe: "Zephyr", Callirrhoe: "Aoede", Erinome: "Kore", Laomedeia: "Leda", Pulcherrima: "Kore",
  Sulafat: "Aoede", Vindemiatrix: "Aoede", Gacrux: "Kore",
};

export type FlowVoice = { provider: "gemini"; id: string };
export const voiceKey = (v: FlowVoice) => `${v.provider}:${v.id}`;

// The <Say voice="…"> value for live speech in this voice.
export function sayVoice(v: FlowVoice | undefined): string | null {
  if (!v) return null;
  const id = TWILIO_CHIRP.includes(v.id) ? v.id : NEAREST[v.id] ?? "Charon";
  return `Google.en-US-Chirp3-HD-${id}`;
}
