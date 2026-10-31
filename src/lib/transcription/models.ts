// Transcription options the Super Admin can choose from (Admin page).
// Stored in platform_settings under key "transcription".

export type TranscriptionSetting = { provider: "openai"; model: OpenAIModel };
export type OpenAIModel = "gpt-4o-transcribe-diarize" | "gpt-transcribe";

export const DEFAULT_TRANSCRIPTION: TranscriptionSetting = { provider: "openai", model: "gpt-4o-transcribe-diarize" };

export const TRANSCRIPTION_OPTIONS: {
  provider: string; model: string; label: string; detail: string; available: boolean;
}[] = [
  {
    provider: "openai", model: "gpt-4o-transcribe-diarize", available: true,
    label: "OpenAI · speakers and timestamps",
    detail: "Labels who said what, with times. OpenAI has deprecated this model; it works until Feb 26, 2027.",
  },
  {
    provider: "openai", model: "gpt-transcribe", available: true,
    label: "OpenAI · most accurate, text only",
    detail: "OpenAI's current model. No speaker labels; times are estimated from the text.",
  },
  {
    provider: "gemini", model: "gemini", available: false,
    label: "Gemini · long recordings",
    detail: "Coming next: one pass for long files, with speakers.",
  },
];

export const MAX_TRANSCRIBE_BYTES = 25 * 1024 * 1024; // OpenAI per-file limit

export function parseSetting(value: unknown): TranscriptionSetting {
  const v = value as Partial<TranscriptionSetting> | null;
  const ok = TRANSCRIPTION_OPTIONS.some((o) => o.available && o.provider === v?.provider && o.model === v?.model);
  return ok ? (v as TranscriptionSetting) : DEFAULT_TRANSCRIPTION;
}
