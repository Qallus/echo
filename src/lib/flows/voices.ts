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

// xAI voices (the same voices the Redial AI receptionist speaks with).
export const XAI_VOICES = [
  { id: "ara", label: "Ara" }, { id: "eve", label: "Eve" }, { id: "leo", label: "Leo" }, { id: "rex", label: "Rex" }, { id: "sal", label: "Sal" },
] as const;
const XAI_NEAREST: Record<string, string> = { ara: "Aoede", eve: "Kore", leo: "Charon", rex: "Orus", sal: "Puck" };

export type FlowVoice = { provider: "gemini" | "xai"; id: string };
export const voiceName = (v: FlowVoice) => (v.provider === "xai" ? `${XAI_VOICES.find((x) => x.id === v.id)?.label ?? v.id} (xAI)` : `${v.id} (Gemini)`);

// Short things the call tree says between prompts. Made into clips in the
// call tree's voice when it's published, like the prompts.
export const PHRASES = {
  noInput: "Sorry, I didn't get that.",
  noMatch: "Sorry, that's not one of the choices.",
  goodbye: "Thanks for calling. Goodbye.",
  notice: "This call may be recorded.",
} as const;
export const DIRECTORY_CONNECTING = "Connecting you to {{name}}.";
export const DIRECTORY_NOT_FOUND = "Sorry, I didn't catch that name.";
export const voiceKey = (v: FlowVoice) => `${v.provider}:${v.id}`;

// The <Say voice="…"> value for live speech in this voice.
export function sayVoice(v: FlowVoice | undefined): string | null {
  if (!v) return null;
  const id = v.provider === "xai" ? XAI_NEAREST[v.id] ?? "Kore" : TWILIO_CHIRP.includes(v.id) ? v.id : NEAREST[v.id] ?? "Charon";
  return `Google.en-US-Chirp3-HD-${id}`;
}
