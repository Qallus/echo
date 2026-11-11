import "server-only";
import { secret } from "@/lib/secrets";

// Text-to-speech for the Recording Studio (ported from Channel Cast). Exposes
// each provider's real voice list and synthesizes with the voice the person
// picked. Keys come from Admin > Settings > Integrations through secret().

export type TtsProvider = "openai" | "xai" | "gemini";
export type Voice = { id: string; name: string; gender?: string; description?: string };

export const TTS_PROVIDERS: { id: TtsProvider; label: string; envVar: string }[] = [
  { id: "openai", label: "OpenAI", envVar: "OPENAI_API_KEY" },
  { id: "xai", label: "xAI (Grok)", envVar: "XAI_API_KEY" },
  { id: "gemini", label: "Gemini", envVar: "GEMINI_API_KEY" },
];

const OPENAI_VOICES: Voice[] = [
  { id: "alloy", name: "Alloy", gender: "Neutral", description: "Balanced, professional" },
  { id: "ash", name: "Ash", gender: "Male", description: "Expressive, punchy" },
  { id: "ballad", name: "Ballad", gender: "Male", description: "Soft, storytelling" },
  { id: "coral", name: "Coral", gender: "Female", description: "Warm, friendly" },
  { id: "echo", name: "Echo", gender: "Male", description: "Clear, crisp" },
  { id: "fable", name: "Fable", gender: "Male", description: "British storyteller" },
  { id: "nova", name: "Nova", gender: "Female", description: "Bright, upbeat" },
  { id: "onyx", name: "Onyx", gender: "Male", description: "Deep, authoritative" },
  { id: "sage", name: "Sage", gender: "Female", description: "Calm, measured" },
  { id: "shimmer", name: "Shimmer", gender: "Female", description: "Soft, gentle" },
];

// Gemini prebuilt voices with their documented character.
const GEMINI_VOICES: Voice[] = [
  { id: "Zephyr", name: "Zephyr", description: "Bright" },
  { id: "Puck", name: "Puck", description: "Upbeat" },
  { id: "Charon", name: "Charon", description: "Informative" },
  { id: "Kore", name: "Kore", description: "Firm" },
  { id: "Fenrir", name: "Fenrir", description: "Excitable" },
  { id: "Leda", name: "Leda", description: "Youthful" },
  { id: "Orus", name: "Orus", description: "Firm" },
  { id: "Aoede", name: "Aoede", description: "Breezy" },
  { id: "Callirrhoe", name: "Callirrhoe", description: "Easy-going" },
  { id: "Autonoe", name: "Autonoe", description: "Bright" },
  { id: "Enceladus", name: "Enceladus", description: "Breathy" },
  { id: "Iapetus", name: "Iapetus", description: "Clear" },
  { id: "Umbriel", name: "Umbriel", description: "Easy-going" },
  { id: "Algieba", name: "Algieba", description: "Smooth" },
  { id: "Despina", name: "Despina", description: "Smooth" },
  { id: "Erinome", name: "Erinome", description: "Clear" },
  { id: "Algenib", name: "Algenib", description: "Gravelly" },
  { id: "Rasalgethi", name: "Rasalgethi", description: "Informative" },
  { id: "Laomedeia", name: "Laomedeia", description: "Upbeat" },
  { id: "Achernar", name: "Achernar", description: "Soft" },
  { id: "Alnilam", name: "Alnilam", description: "Firm" },
  { id: "Schedar", name: "Schedar", description: "Even" },
  { id: "Gacrux", name: "Gacrux", description: "Mature" },
  { id: "Pulcherrima", name: "Pulcherrima", description: "Forward" },
  { id: "Achird", name: "Achird", description: "Friendly" },
  { id: "Zubenelgenubi", name: "Zubenelgenubi", description: "Casual" },
  { id: "Vindemiatrix", name: "Vindemiatrix", description: "Gentle" },
  { id: "Sadachbia", name: "Sadachbia", description: "Lively" },
  { id: "Sadaltager", name: "Sadaltager", description: "Knowledgeable" },
  { id: "Sulafat", name: "Sulafat", description: "Warm" },
];

const XAI_FALLBACK: Voice[] = [
  { id: "ara", name: "Ara" },
  { id: "eve", name: "Eve" },
  { id: "leo", name: "Leo" },
  { id: "rex", name: "Rex" },
  { id: "sal", name: "Sal" },
];

const DEFAULT_VOICE: Record<TtsProvider, string> = { openai: "onyx", xai: "eve", gemini: "Charon" };

export type TtsResult = { buffer: Buffer; ext: string; mime: string };
export type TtsError = { error: string; status?: number; detail?: string };

function keyFor(provider: TtsProvider): Promise<string | undefined> {
  return secret(TTS_PROVIDERS.find((p) => p.id === provider)!.envVar);
}

export async function providerConfigured(provider: TtsProvider): Promise<boolean> {
  return Boolean(await keyFor(provider));
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Available voices for a provider. xAI is fetched live (may exceed the docs' 5). */
export async function listVoices(provider: TtsProvider): Promise<Voice[]> {
  if (provider === "openai") return OPENAI_VOICES;
  if (provider === "gemini") return GEMINI_VOICES;

  const key = await keyFor("xai");
  if (!key) return XAI_FALLBACK;
  try {
    const res = await fetch("https://api.x.ai/v1/tts/voices", { headers: { Authorization: `Bearer ${key}` }, next: { revalidate: 3600 } });
    if (!res.ok) return XAI_FALLBACK;
    const data = await res.json();
    const arr: unknown[] = Array.isArray(data) ? data : data?.voices || data?.data || [];
    const voices = arr
      .map((v): Voice | null => {
        if (typeof v === "string") return { id: v, name: cap(v) };
        const o = v as Record<string, unknown>;
        const id = (o.voice_id || o.id || o.name) as string | undefined;
        if (!id) return null;
        return {
          id,
          name: (o.name as string) || cap(id),
          gender: o.gender ? cap(String(o.gender)) : undefined,
          description: (o.description as string) || undefined,
        };
      })
      .filter((v): v is Voice => Boolean(v));
    return voices.length ? voices : XAI_FALLBACK;
  } catch {
    return XAI_FALLBACK;
  }
}

/** Some providers stream WAV with placeholder sizes (0xFFFFFFFF); fix them. */
function fixWavSizes(buf: Buffer): Buffer {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") return buf;
  buf.writeUInt32LE(buf.length - 8, 4);
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString("ascii", offset, offset + 4);
    const declared = buf.readUInt32LE(offset + 4);
    if (chunkId === "data") {
      buf.writeUInt32LE(buf.length - (offset + 8), offset + 4);
      break;
    }
    if (declared <= 0 || offset + 8 + declared > buf.length) break;
    offset += 8 + declared + (declared % 2);
  }
  return buf;
}

/** Wrap raw signed 16-bit PCM in a WAV container (used for Gemini output). */
function wavFromPcm(pcm: Buffer, sampleRate = 24000, channels = 1, bits = 16): Buffer {
  const blockAlign = (channels * bits) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * blockAlign, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bits, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export async function synthesize(
  provider: TtsProvider,
  opts: { script: string; voice: string; speed: number },
): Promise<TtsResult | TtsError> {
  const key = await keyFor(provider);
  if (!key) return { error: `${provider} not configured` };
  const voice = opts.voice || DEFAULT_VOICE[provider];

  try {
    if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: (await secret("OPENAI_TTS_MODEL")) || "tts-1-hd", voice, input: opts.script, speed: opts.speed, response_format: "wav" }),
      });
      if (!res.ok) return { error: "OpenAI TTS failed", status: res.status, detail: (await res.text()).slice(0, 400) };
      return { buffer: fixWavSizes(Buffer.from(await res.arrayBuffer())), ext: "wav", mime: "audio/wav" };
    }

    if (provider === "xai") {
      const res = await fetch("https://api.x.ai/v1/tts", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: opts.script, voice_id: voice, language: "en", output_format: { codec: "wav", sample_rate: 24000 } }),
      });
      if (!res.ok) return { error: "xAI TTS failed", status: res.status, detail: (await res.text()).slice(0, 400) };
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        return { buffer: fixWavSizes(Buffer.from(await res.arrayBuffer())), ext: "wav", mime: "audio/wav" };
      }
      const data = await res.json();
      if (!data?.audio) return { error: "xAI TTS returned no audio", detail: JSON.stringify(data).slice(0, 300) };
      return { buffer: fixWavSizes(Buffer.from(data.audio, "base64")), ext: "wav", mime: "audio/wav" };
    }

    // gemini
    const model = (await secret("GEMINI_TTS_MODEL")) || "gemini-2.5-flash-preview-tts";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: opts.script }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
      }),
    });
    if (!res.ok) return { error: "Gemini TTS failed", status: res.status, detail: (await res.text()).slice(0, 400) };
    const data = await res.json();
    const part = data?.candidates?.[0]?.content?.parts?.find((p: { inlineData?: { data?: string } }) => p.inlineData?.data);
    const b64 = part?.inlineData?.data;
    if (!b64) return { error: "Gemini TTS returned no audio", detail: JSON.stringify(data).slice(0, 500) };
    const rate = parseInt((part.inlineData.mimeType || "").match(/rate=(\d+)/)?.[1] || "24000", 10);
    return { buffer: wavFromPcm(Buffer.from(b64, "base64"), rate), ext: "wav", mime: "audio/wav" };
  } catch (e) {
    return { error: `${provider} request failed`, detail: String(e) };
  }
}
