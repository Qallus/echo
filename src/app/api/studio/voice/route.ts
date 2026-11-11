import { getUser } from "@/lib/data";
import { saveStudioFile } from "@/lib/studio/save";
import { TTS_PROVIDERS, providerConfigured, synthesize, type TtsProvider } from "@/lib/studio/tts";
import { AI_PER_DAY, MAX_SCRIPT, isKind } from "@/lib/studio/types";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

const LABEL: Record<TtsProvider, string> = { openai: "OpenAI", xai: "xAI", gemini: "Gemini" };

// POST /api/studio/voice { script, provider, voice, speed, kind? }: reads the
// script with an AI voice and saves the result to the person's studio.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Sign in to use the studio." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const script = String(body?.script ?? "").trim();
  if (!script) return Response.json({ error: "Type the script for the voice to read." }, { status: 400 });
  if (script.length > MAX_SCRIPT) return Response.json({ error: `Keep the script under ${MAX_SCRIPT.toLocaleString()} characters.` }, { status: 400 });
  const provider = body?.provider as TtsProvider;
  if (!TTS_PROVIDERS.some((p) => p.id === provider)) return Response.json({ error: "Choose a voice engine." }, { status: 400 });
  if (!(await providerConfigured(provider))) {
    return Response.json({ error: `${LABEL[provider]} voices aren't set up yet.`, hint: "An admin adds the key in Admin > Settings > Integrations." }, { status: 501 });
  }

  const supabase = await createClient();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await supabase.from("studio_audio").select("id", { count: "exact", head: true }).eq("source", "ai").gte("created_at", since);
  if ((count ?? 0) >= AI_PER_DAY) return Response.json({ error: `You've made ${AI_PER_DAY} AI voice clips today. Try again tomorrow.` }, { status: 429 });

  const voice = String(body?.voice ?? "").slice(0, 80);
  const result = await synthesize(provider, { script, voice, speed: Math.max(0.25, Math.min(4, Number(body?.speed) || 1)) });
  if ("error" in result) return Response.json({ error: result.error, detail: result.detail }, { status: 502 });

  const words = script.split(/\s+/);
  const saved = await saveStudioFile(supabase, user.id, {
    bytes: result.buffer, mime: result.mime, name: `AI · ${words.slice(0, 6).join(" ")}${words.length > 6 ? "…" : ""}`,
    source: "ai", kind: isKind(body?.kind) ? body.kind : "other", description: script.slice(0, 1000), aiProvider: provider, aiVoice: voice,
  });
  if ("error" in saved) return Response.json(saved, { status: 500 });
  return Response.json({ audio: saved });
}
